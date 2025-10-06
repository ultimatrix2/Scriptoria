// Simple OCR helper using Tesseract.js via CDN dynamic import.
// Exposes a cache so we don't re-run OCR on every zoom; boxes are stored normalized.

const ocrCache = new Map(); // key: `${filePath}::${pageNumber}` -> { width, height, words: [{ text, x, y, w, h }] normalized 0..1 }

async function getTesseract() {
  if (globalThis.Tesseract) return globalThis.Tesseract;
  // Load from CDN lazily in renderer
  await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  return globalThis.Tesseract;
}

export function hasOCRCache(filePath, pageNumber) {
  const key = `${filePath}::${pageNumber}`;
  return ocrCache.has(key);
}

export async function runOCROnCanvasAndCache(filePath, pageNumber, canvas, lang = 'eng') {
  const key = `${filePath}::${pageNumber}`;
  const Tesseract = await getTesseract();

  // Downscale large canvases to improve speed while preserving aspect ratio
  const maxDim = 1600; // trade-off between speed and accuracy
  let srcCanvas = canvas;
  if (canvas.width > maxDim || canvas.height > maxDim) {
    const scale = Math.min(maxDim / canvas.width, maxDim / canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(canvas.width * scale));
    tmp.height = Math.max(1, Math.round(canvas.height * scale));
    const tctx = tmp.getContext('2d');
    tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    srcCanvas = tmp;
  }

  const { data } = await Tesseract.recognize(srcCanvas, lang, {
    // Suppress logs in production UI
    logger: () => {}
  });

  const pageWidth = srcCanvas.width;
  const pageHeight = srcCanvas.height;

  const words = (data.words || [])
    .filter(w => w.text && w.text.trim().length > 0)
    .map(w => {
      const x = w.bbox?.x0 ?? 0;
      const y = w.bbox?.y0 ?? 0;
      const wdt = (w.bbox?.x1 ?? 0) - x;
      const hgt = (w.bbox?.y1 ?? 0) - y;
      return {
        text: w.text,
        x: x / pageWidth,
        y: y / pageHeight,
        w: wdt / pageWidth,
        h: hgt / pageHeight
      };
    });

  ocrCache.set(key, { width: pageWidth, height: pageHeight, words });
  return ocrCache.get(key);
}

export function renderOCRTextLayerFromCache(wrapper, pageWidthPx, pageHeightPx, filePath, pageNumber) {
  const key = `${filePath}::${pageNumber}`;
  const cached = ocrCache.get(key);
  if (!cached) return false;

  // Remove existing text layer if any
  const old = wrapper.querySelector('.textLayer');
  if (old) old.remove();

  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  textLayerDiv.style.position = 'absolute';
  textLayerDiv.style.left = '0';
  textLayerDiv.style.top = '0';
  textLayerDiv.style.width = `${pageWidthPx}px`;
  textLayerDiv.style.height = `${pageHeightPx}px`;
  textLayerDiv.style.pointerEvents = 'auto';
  textLayerDiv.style.color = 'transparent';
  textLayerDiv.style.userSelect = 'text';
  textLayerDiv.style.webkitUserSelect = 'text';
  textLayerDiv.style.MozUserSelect = 'text';
  wrapper.appendChild(textLayerDiv);

  // Place each recognized word as an absolutely positioned div so selection works
  for (const w of cached.words) {
    const div = document.createElement('div');
    div.textContent = w.text;
    div.style.position = 'absolute';
    div.style.left = `${w.x * pageWidthPx}px`;
    div.style.top = `${w.y * pageHeightPx}px`;
    div.style.width = `${Math.max(1, w.w * pageWidthPx)}px`;
    div.style.height = `${Math.max(1, w.h * pageHeightPx)}px`;
    // Make the text effectively invisible but selectable
    div.style.color = 'transparent';
    div.style.whiteSpace = 'pre';
    textLayerDiv.appendChild(div);
  }
  return true;
}

export async function ensureOCRTextLayer(wrapper, canvas, pageWidthPx, pageHeightPx, filePath, pageNumber, lang = 'eng') {
  const key = `${filePath}::${pageNumber}`;
  if (!ocrCache.has(key)) {
    await runOCROnCanvasAndCache(filePath, pageNumber, canvas, lang);
  }
  return renderOCRTextLayerFromCache(wrapper, pageWidthPx, pageHeightPx, filePath, pageNumber);
}


