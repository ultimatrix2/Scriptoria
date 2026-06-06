// Export current PDF with drawn highlights and underlines baked into a new PDF.
// This approach rasterizes each page (with annotations overlaid) to images and embeds them.

import * as UserHighlights from '../features/highlights.js';
import * as UserUnderlines from '../features/underlines.js';

// Helper: draw annotations on a temporary overlay canvas using stored normalized rects
function drawPageAnnotations(ctx, pageWidth, pageHeight, fileKey, pageNumber) {
  const anns = UserHighlights.getAll(fileKey).filter(a => (a.page === pageNumber) && (a.type === 'highlight' || !a.type));
  const underlines = UserUnderlines.getAll(fileKey).filter(a => a.page === pageNumber);
  const textAnns = UserHighlights.getAll(fileKey).filter(a => (a.page === pageNumber) && (a.type === 'text'));

  // Highlights
  for (const ann of anns) {
    const color = ann.color || '#ffff0066';
    ctx.fillStyle = color;
    for (const r of ann.rects || []) {
      const x = r.x * pageWidth;
      const y = r.y * pageHeight;
      const w = r.w * pageWidth;
      const h = r.h * pageHeight;
      ctx.fillRect(x, y, w, h);
    }
  }

  // Underlines
  for (const ann of underlines) {
    const color = ann.color || '#000000';
    ctx.fillStyle = color;
    for (const r of ann.rects || []) {
      const x = r.x * pageWidth;
      const y = r.y * pageHeight;
      const w = r.w * pageWidth;
      const h = r.h * pageHeight;
      const lineY = y + h - 2;
      ctx.fillRect(x, lineY, w, 2);
    }
  }

  // Text Annotations
  for (const ann of textAnns) {
    const color = ann.color || 'red';
    ctx.fillStyle = color;
    ctx.font = 'bold 28px sans-serif'; // Scaled up font for export scale
    const x = ann.x * pageWidth;
    const y = ann.y * pageHeight;
    ctx.fillText(ann.text, x, y);
  }
}

// Public API: export the current open document with annotations
export async function exportCurrentWithAnnotations(currentInfo) {
  if (!currentInfo || !currentInfo.pdf) return;
  const { pdf, filePath } = currentInfo;

  // Create output PDF
  // pdf-lib is loaded on window when included via CDN in index.html
  const { PDFDocument } = window.PDFLib || {};
  if (!PDFDocument) throw new Error('pdf-lib not loaded');
  const outDoc = await PDFDocument.create();

  // We render each page to a canvas at a reasonable DPI for quality
  const exportScale = 2.0; // 2x the current viewport for sharper output

  for (let i = 1; i <= pdf.numPages; i++) {
    // Render base page to a canvas using PDF.js
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: (currentInfo.scale || 1.5) * exportScale, rotation: currentInfo.rotation || 0 });
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = Math.ceil(viewport.width);
    baseCanvas.height = Math.ceil(viewport.height);
    const baseCtx = baseCanvas.getContext('2d');
    await page.render({ canvasContext: baseCtx, viewport }).promise;

    // Draw annotations on top
    drawPageAnnotations(baseCtx, baseCanvas.width, baseCanvas.height, filePath, i);

    // Convert to PNG bytes
    const dataUrl = baseCanvas.toDataURL('image/png');
    const pngBytes = dataURLToBytes(dataUrl);

    // Add a matching-sized page to the output PDF
    const pdfPage = outDoc.addPage([baseCanvas.width, baseCanvas.height]);
    const pngImage = await outDoc.embedPng(pngBytes);
    pdfPage.drawImage(pngImage, { x: 0, y: 0, width: baseCanvas.width, height: baseCanvas.height });
  }

  const bytes = await outDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // Trigger download
  const a = document.createElement('a');
  const baseName = (currentInfo.fileName || 'document').replace(/\.pdf$/i, '');
  a.href = url;
  a.download = `${baseName}-with-annotations.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dataURLToBytes(dataUrl) {
  const parts = dataUrl.split(',');
  const base64 = parts[1];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}


