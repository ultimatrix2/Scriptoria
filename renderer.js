// Global variables
let pdfDocs = [];
let currentTab = 0;
let thumbnailsDocIndex = null; // Index of the doc whose thumbnails remain shown
let viewMode = 'single'; // 'single' | 'split' | 'continuous'

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Bookmarks module
import * as UserBookmarks from './features/bookmarks.js';
import * as UserHighlights from './features/highlights.js';
import * as UserUnderlines from './features/underlines.js';
import * as UserStickynotes from './features/stickynotes.js';

// Core PDF functionality
async function loadPDF(filePath) {
  try {
    const loadingTask = pdfjsLib.getDocument(filePath);
    const pdf = await loadingTask.promise;
    
    const pdfDoc = {
      pdf: pdf,
      filePath: filePath,
      fileName: filePath.split('/').pop().split('\\').pop(),
      pageNum: 1,
      scale: 1.5,
      rotation: 0
    };
    
    // Compute initial scale to fit width of viewer
    try {
      const firstPage = await pdf.getPage(1);
      const viewer = document.getElementById('pdf-viewer');
      const availableWidth = Math.max(100, viewer.clientWidth - 20);
      const baseViewport = firstPage.getViewport({ scale: 1, rotation: pdfDoc.rotation });
      const fitWidthScale = availableWidth / baseViewport.width;
      if (isFinite(fitWidthScale) && fitWidthScale > 0) {
        pdfDoc.scale = fitWidthScale;
      }
    } catch (e) {
      console.warn('Fit-to-width calculation failed, using default scale.', e);
    }

    pdfDocs.push(pdfDoc);
    currentTab = pdfDocs.length - 1;

    createTab(pdfDoc.fileName);
    await renderPage();

    // Always set thumbnails to the currently opened PDF
    thumbnailsDocIndex = currentTab;
    await generateThumbnailsForDoc(thumbnailsDocIndex);
    await loadBookmarks(pdf);
    // Initialize user bookmarks store for this file
    await UserBookmarks.initForFile(pdfDoc.filePath);
    // Ensure sidecar files exist
    await window.electronAPI?.initAllAnnotations?.(pdfDoc.filePath);
    // Load other stores
    await UserHighlights.initForFile(pdfDoc.filePath);
    await UserUnderlines.initForFile(pdfDoc.filePath);
    await UserStickynotes.initForFile(pdfDoc.filePath);
    
    return pdfDoc;
  } catch (error) {
    console.error('Error loading PDF:', error);
    alert('Error loading PDF file');
  }
}

async function renderPage() {
  if (!pdfDocs[currentTab]) return;
  const container = document.getElementById('canvas-container');
  // Clear previous children
  container.innerHTML = '';

  const { pdf, pageNum, scale, rotation } = pdfDocs[currentTab];

  if (viewMode === 'single') {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    await renderSingleCanvas(canvas, pdf, pageNum, scale, rotation);
  } else if (viewMode === 'split') {
    const firstCanvas = document.createElement('canvas');
    const secondCanvas = document.createElement('canvas');
    container.appendChild(firstCanvas);
    container.appendChild(secondCanvas);
    await renderSingleCanvas(firstCanvas, pdf, pageNum, scale, rotation);
    if (pageNum + 1 <= pdf.numPages) {
      await renderSingleCanvas(secondCanvas, pdf, pageNum + 1, scale, rotation);
    } else {
      secondCanvas.style.display = 'none';
    }
  } else if (viewMode === 'continuous') {
    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      // eslint-disable-next-line no-await-in-loop
      await renderSingleCanvas(canvas, pdf, i, scale, rotation);
    }
    // After rendering all pages, scroll the current page into view
    const canvases = Array.from(container.querySelectorAll('canvas'));
    const targetCanvas = canvases[pageNum - 1];
    if (targetCanvas) {
      targetCanvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Update page counter and zoom
  document.getElementById('page-num').value = pageNum;
  document.getElementById('page-count').textContent = pdf.numPages;
  updateZoomDisplay();
}

async function renderSingleCanvas(canvas, pdf, pageNumber, scale, rotation) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });
  const ctx = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  // Ensure the canvas is wrapped with a positioned container for overlay layers
  let wrapper = canvas.parentElement;
  if (!wrapper || !wrapper.classList || !wrapper.classList.contains('page-wrapper')) {
    wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;
    canvas.replaceWith(wrapper);
    wrapper.appendChild(canvas);
  } else {
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;
  }

  // Render page bitmap
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Build or update invisible selectable text layer
  await buildTextLayer(wrapper, page, viewport);

  // Draw stored annotations (highlights and underlines)
  drawAnnotations(wrapper, pageNumber, viewport.width, viewport.height);
}

// Build invisible selectable text layer for a page
async function buildTextLayer(wrapper, page, viewport) {
  // Remove existing text layer if any
  const old = wrapper.querySelector('.textLayer');
  if (old) old.remove();
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  textLayerDiv.style.position = 'absolute';
  textLayerDiv.style.left = '0';
  textLayerDiv.style.top = '0';
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;
  textLayerDiv.style.pointerEvents = 'auto';
  textLayerDiv.style.color = 'transparent';
  textLayerDiv.style.userSelect = 'text';
  textLayerDiv.style.webkitUserSelect = 'text';
  textLayerDiv.style.MozUserSelect = 'text';
  wrapper.appendChild(textLayerDiv);

  const textContent = await page.getTextContent();
  const task = pdfjsLib.renderTextLayer({
    textContentSource: textContent,
    container: textLayerDiv,
    viewport,
    textDivs: []
  });
  await task.promise;
}

function getCurrentWrapperAndPage() {
  const container = document.getElementById('canvas-container');
  // pick current visible canvas by current page number
  const { pageNum } = pdfDocs[currentTab] || { pageNum: 1 };
  // wrappers are in same order as canvases
  const wrappers = Array.from(container.querySelectorAll('.page-wrapper'));
  const wrapper = viewMode === 'single' ? wrappers[0] : wrappers[pageNum - 1] || wrappers[0];
  return { wrapper, pageNum };
}

function selectionRectsRelativeToWrapper(wrapper) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return [];
  const ranges = [];
  for (let i = 0; i < sel.rangeCount; i++) {
    ranges.push(sel.getRangeAt(i));
  }
  const wrapperRect = wrapper.getBoundingClientRect();
  const rects = [];
  for (const range of ranges) {
    const clientRects = Array.from(range.getClientRects());
    for (const r of clientRects) {
      // Only accept rects that intersect the wrapper (same page)
      const intersects = !(r.right < wrapperRect.left || r.left > wrapperRect.right || r.bottom < wrapperRect.top || r.top > wrapperRect.bottom);
      if (!intersects) continue;
      rects.push({
        x: r.left - wrapperRect.left,
        y: r.top - wrapperRect.top,
        w: r.width,
        h: r.height
      });
    }
  }
  return rects;
}

function normalizeRects(rects, pageWidth, pageHeight) {
  return rects.map(r => ({
    x: r.x / pageWidth,
    y: r.y / pageHeight,
    w: r.w / pageWidth,
    h: r.h / pageHeight
  }));
}

function denormalizeRects(rects, pageWidth, pageHeight) {
  return rects.map(r => ({
    x: r.x * pageWidth,
    y: r.y * pageHeight,
    w: r.w * pageWidth,
    h: r.h * pageHeight
  }));
}

function ensureOverlay(wrapper) {
  let overlay = wrapper.querySelector('.annotationLayer');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'annotationLayer';
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.pointerEvents = 'none';
    wrapper.appendChild(overlay);
  }
  return overlay;
}

function drawAnnotations(wrapper, pageNumber, pageWidth, pageHeight) {
  const overlay = ensureOverlay(wrapper);
  overlay.innerHTML = '';
  const fileKey = pdfDocs[currentTab]?.filePath;
  if (!fileKey) return;
  const allHighlightsRaw = UserHighlights.getAll(fileKey);
  const allUnderlinesRaw = UserUnderlines.getAll(fileKey);
  const allHighlights = allHighlightsRaw
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => a.page === pageNumber && (a.type === 'highlight' || !a.type));
  const allUnderlines = allUnderlinesRaw
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => a.page === pageNumber);

  for (const { a: ann, idx } of allHighlights) {
    const rects = denormalizeRects(ann.rects, pageWidth, pageHeight);
    for (const r of rects) {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.left = `${r.x}px`;
      div.style.top = `${r.y}px`;
      div.style.width = `${r.w}px`;
      div.style.height = `${r.h}px`;
      div.style.background = (ann.color || '#ffff0066');
      div.style.pointerEvents = 'none';
      div.dataset.type = 'highlight';
      div.dataset.index = String(idx);
      overlay.appendChild(div);
    }
  }
  for (const { a: ann, idx } of allUnderlines) {
    const rects = denormalizeRects(ann.rects, pageWidth, pageHeight);
    for (const r of rects) {
      const line = document.createElement('div');
      line.style.position = 'absolute';
      line.style.left = `${r.x}px`;
      line.style.top = `${r.y + r.h - 2}px`;
      line.style.width = `${r.w}px`;
      line.style.height = '2px';
      line.style.background = ann.color || '#000';
      line.style.pointerEvents = 'none';
      line.dataset.type = 'underline';
      line.dataset.index = String(idx);
      overlay.appendChild(line);
    }
  }

  // Right-click to remove an annotation group (highlight/underline) by index
  overlay.oncontextmenu = async (e) => {
    e.preventDefault();
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const type = target.dataset.type;
    const indexStr = target.dataset.index;
    const file = pdfDocs[currentTab]?.filePath;
    if (!type || indexStr == null || !file) return;
    const idx = parseInt(indexStr);
    if (type === 'highlight') {
      await UserHighlights.removeAtIndex(file, idx);
    } else if (type === 'underline') {
      await UserUnderlines.removeAtIndex(file, idx);
    }
    drawAnnotations(wrapper, pageNumber, pageWidth, pageHeight);
  };
}

function createTab(fileName) {
  const tabsContainer = document.getElementById('tabs');
  const tab = document.createElement('li');
  const label = document.createElement('span');
  label.textContent = fileName;
  const close = document.createElement('span');
  close.className = 'close-btn';
  close.textContent = '×';
  close.title = 'Close';
  close.addEventListener('click', (e) => {
    e.stopPropagation();
    const tabIndex = Array.from(tabsContainer.children).indexOf(tab);
    closeTab(tabIndex);
  });
  tab.appendChild(label);
  tab.appendChild(close);
  tab.addEventListener('click', async () => {
    // Switch to this tab and update thumbnails to match
    const tabIndex = Array.from(tabsContainer.children).indexOf(tab);
    currentTab = tabIndex;
    thumbnailsDocIndex = currentTab;
    await generateThumbnailsForDoc(thumbnailsDocIndex);
    await renderPage();
    
    // Update active tab styling
    document.querySelectorAll('#tabs li').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
  
  // Clear active class from all tabs
  document.querySelectorAll('#tabs li').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  
  tabsContainer.appendChild(tab);
} 

function closeTab(index) {
  if (index < 0 || index >= pdfDocs.length) return;
  const tabsContainer = document.getElementById('tabs');
  // remove doc
  pdfDocs.splice(index, 1);
  // remove tab element
  const node = tabsContainer.children[index];
  if (node) tabsContainer.removeChild(node);
  // adjust indices
  if (thumbnailsDocIndex !== null) {
    if (thumbnailsDocIndex === index) {
      thumbnailsDocIndex = pdfDocs.length > 0 ? 0 : null;
      if (thumbnailsDocIndex !== null) {
        generateThumbnailsForDoc(thumbnailsDocIndex);
      } else {
        const thumbContainer = document.getElementById('thumbnails');
        if (thumbContainer) thumbContainer.innerHTML = '';
      }
    } else if (thumbnailsDocIndex > index) {
      thumbnailsDocIndex -= 1;
    }
  }
  if (pdfDocs.length === 0) {
    currentTab = 0;
    const container = document.getElementById('canvas-container');
    if (container) container.innerHTML = '';
    document.getElementById('page-num').value = 0;
    document.getElementById('page-count').textContent = 0;
    document.getElementById('zoom-display').textContent = '100%';
    return;
  }
  if (currentTab === index) {
    currentTab = Math.max(0, index - 1);
  } else if (currentTab > index) {
    currentTab -= 1;
  }
  // update active class
  document.querySelectorAll('#tabs li').forEach(t => t.classList.remove('active'));
  const newActive = tabsContainer.children[currentTab];
  if (newActive) newActive.classList.add('active');
  renderPage();
}

// Generate Thumbnails
async function generateThumbnailsForDoc(docIndex) {
  const target = pdfDocs[docIndex];
  if (!target) return;
  const pdf = target.pdf;
  const thumbContainer = document.getElementById("thumbnails");
  thumbContainer.innerHTML = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3, rotation: 0 });
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;
    canvas.addEventListener("click", () => {
      goToPageOnDoc(docIndex, i);
    });
    // Bookmark toggle button overlay
    const bmBtn = document.createElement('button');
    bmBtn.textContent = UserBookmarks.isBookmarked(target.filePath, i) ? '🔖' : '📑';
    bmBtn.title = 'Toggle bookmark';
    bmBtn.style.position = 'absolute';
    bmBtn.style.top = '4px';
    bmBtn.style.right = '4px';
    bmBtn.style.padding = '2px 4px';
    bmBtn.style.fontSize = '14px';
    bmBtn.style.cursor = 'pointer';
    bmBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nowBookmarked = await UserBookmarks.toggle(target.filePath, i);
      bmBtn.textContent = nowBookmarked ? '🔖' : '📑';
    });
    wrapper.appendChild(canvas);
    wrapper.appendChild(bmBtn);
    thumbContainer.appendChild(wrapper);
  }
}

// Load Bookmarks
async function loadBookmarks(pdf) {
  const outline = await pdf.getOutline();
  const bmContainer = document.getElementById("bookmarks");
  bmContainer.innerHTML = "";

  if (outline) {
    outline.forEach((bm) => {
      const div = document.createElement("div");
      div.textContent = bm.title;
      div.classList.add("bookmark-item");
      div.addEventListener("click", async () => {
        const dest = await pdf.getDestination(bm.dest);
        const pageIndex = await pdf.getPageIndex(dest[0]);
        goToPage(pageIndex + 1);
      });
      bmContainer.appendChild(div);
    });
  }
}

// Render thumbnails only for user-bookmarked pages of a document
async function generateBookmarkThumbnails(docIndex) {
  const doc = pdfDocs[docIndex];
  if (!doc) return;
  const pdf = doc.pdf;
  const bmContainer = document.getElementById("bookmarks");
  if (!bmContainer) return;
  bmContainer.innerHTML = "";

  // Get user bookmarks for this file
  const bookmarkedPages = UserBookmarks.get(doc.filePath);
  if (bookmarkedPages.length === 0) {
    const msg = document.createElement('div');
    msg.textContent = 'No bookmarked pages. Click the bookmark icon on thumbnails to add pages.';
    msg.classList.add('bookmark-item');
    bmContainer.appendChild(msg);
    return;
  }

  for (const pageNum of bookmarkedPages) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.3, rotation: 0 });
    const wrapper = document.createElement('div');
    wrapper.style.padding = '6px';
    wrapper.style.borderBottom = '1px solid #ddd';
    const label = document.createElement('div');
    label.textContent = `Page ${pageNum}`;
    label.style.fontSize = '12px';
    label.style.marginBottom = '4px';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    // eslint-disable-next-line no-await-in-loop
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.border = '1px solid #bbb';
    canvas.addEventListener('click', () => {
      goToPageOnDoc(docIndex, pageNum);
    });
    // Also show bookmark toggle on each bookmarked page entry
    const bmBtn = document.createElement('button');
    bmBtn.textContent = '🔖';
    bmBtn.title = 'Remove bookmark';
    bmBtn.style.marginLeft = '6px';
    bmBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await UserBookmarks.remove(doc.filePath, pageNum);
      // Refresh the list
      await generateBookmarkThumbnails(docIndex);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(canvas);
    wrapper.appendChild(bmBtn);
    bmContainer.appendChild(wrapper);
  }
}

// Search inside PDF
async function searchInPDF(query) {
  const { pdf } = pdfDocs[currentTab];
  const resultsContainer = document.getElementById("search-results");
  resultsContainer.innerHTML = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((s) => s.str).join(" ");

    if (text.toLowerCase().includes(query.toLowerCase())) {
      const result = document.createElement("div");
      result.textContent = `Found on page ${i}`;
      result.classList.add("search-result");
      result.addEventListener("click", () => {
        goToPage(i);
      });
      resultsContainer.appendChild(result);
    }
  }
}

// Highlight function
async function highlightSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const { wrapper, pageNum } = getCurrentWrapperAndPage();
  if (!wrapper) return;
  const pageWidth = wrapper.clientWidth;
  const pageHeight = wrapper.clientHeight;
  const rects = selectionRectsRelativeToWrapper(wrapper);
  if (rects.length === 0) return;
  const normalized = normalizeRects(rects, pageWidth, pageHeight);
  const fileKey = pdfDocs[currentTab]?.filePath;
  if (!fileKey) return;
  await UserHighlights.upsert(fileKey, { page: pageNum, type: 'highlight', rects: normalized, color: '#ffff0066' });
  // Clear selection and redraw
  sel.removeAllRanges();
  drawAnnotations(wrapper, pageNum, pageWidth, pageHeight);
}

async function underlineSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const { wrapper, pageNum } = getCurrentWrapperAndPage();
  if (!wrapper) return;
  const pageWidth = wrapper.clientWidth;
  const pageHeight = wrapper.clientHeight;
  const rects = selectionRectsRelativeToWrapper(wrapper);
  if (rects.length === 0) return;
  const normalized = normalizeRects(rects, pageWidth, pageHeight);
  const fileKey = pdfDocs[currentTab]?.filePath;
  if (!fileKey) return;
  await UserUnderlines.add(fileKey, { page: pageNum, rects: normalized, color: '#000000' });
  // Clear selection and redraw
  sel.removeAllRanges();
  drawAnnotations(wrapper, pageNum, pageWidth, pageHeight);
}

// Add Text function
function addTextAnnotation(text) {
  const canvas = document.getElementById("pdf-render");
  const textDiv = document.createElement("div");
  textDiv.textContent = text;
  textDiv.classList.add("annotation-text");
  textDiv.style.position = "absolute";
  textDiv.style.left = "100px";
  textDiv.style.top = "100px";
  textDiv.style.color = "red";
  textDiv.style.fontWeight = "bold";
  document.body.appendChild(textDiv);
}

// Dark mode functionality
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
}

// Initialize dark mode from localStorage
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
}

// Navigation functions
function goToPrevPage() {
  if (!pdfDocs[currentTab] || pdfDocs[currentTab].pageNum <= 1) return;
  const step = viewMode === 'split' ? 2 : 1;
  const target = Math.max(1, pdfDocs[currentTab].pageNum - step);
  goToPage(target);
}

function goToNextPage() {
  if (!pdfDocs[currentTab] || pdfDocs[currentTab].pageNum >= pdfDocs[currentTab].pdf.numPages) return;
  const step = viewMode === 'split' ? 2 : 1;
  const target = Math.min(pdfDocs[currentTab].pdf.numPages, pdfDocs[currentTab].pageNum + step);
  goToPage(target);
}

function rotateLeft() {
  if (!pdfDocs[currentTab]) return;
  // Rotate counter-clockwise by 90 degrees
  pdfDocs[currentTab].rotation = (pdfDocs[currentTab].rotation - 90) % 360;
  renderPage();
}

function rotateRight() {
  if (!pdfDocs[currentTab]) return;
  // Rotate clockwise by 90 degrees
  pdfDocs[currentTab].rotation = (pdfDocs[currentTab].rotation + 90) % 360;
  renderPage();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// Zoom functionality
function zoomIn() {
  if (!pdfDocs[currentTab]) return;
  pdfDocs[currentTab].scale = Math.min(pdfDocs[currentTab].scale * 1.2, 5.0);
  renderPage();
}

function zoomOut() {
  if (!pdfDocs[currentTab]) return;
  pdfDocs[currentTab].scale = Math.max(pdfDocs[currentTab].scale / 1.2, 0.2);
  renderPage();
}

function updateZoomDisplay() {
  if (!pdfDocs[currentTab]) return;
  const zoomPercentage = Math.round(pdfDocs[currentTab].scale * 100);
  document.getElementById('zoom-display').textContent = `${zoomPercentage}%`;
}

// Direct page navigation
async function goToPage(pageNumber) {
  if (!pdfDocs[currentTab]) return;
  const totalPages = pdfDocs[currentTab].pdf.numPages;
  if (pageNumber >= 1 && pageNumber <= totalPages) {
    pdfDocs[currentTab].pageNum = pageNumber;
    await renderPage();
    if (viewMode === 'continuous') {
      // Scroll to the canvas corresponding to the page
      const container = document.getElementById('canvas-container');
      const canvases = Array.from(container.querySelectorAll('canvas'));
      // In continuous mode, canvases are in order 1..N
      const target = canvases[pageNumber - 1];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  } else {
    // Reset to current page if invalid
    document.getElementById('page-num').value = pdfDocs[currentTab].pageNum;
  }
}

async function goToPageOnDoc(docIndex, pageNumber) {
  const doc = pdfDocs[docIndex];
  if (!doc) return;
  const totalPages = doc.pdf.numPages;
  if (pageNumber < 1 || pageNumber > totalPages) return;
  doc.pageNum = pageNumber;
  // focus this tab
  currentTab = docIndex;
  const tabsContainer = document.getElementById('tabs');
  document.querySelectorAll('#tabs li').forEach(t => t.classList.remove('active'));
  const newActive = tabsContainer.children[currentTab];
  if (newActive) newActive.classList.add('active');
  await renderPage();
}

// Sidebar tab functionality
function showSidebarTab(target) {
  document.querySelectorAll('#sidebar-content > div').forEach(div => {
    div.style.display = 'none';
  });
  document.getElementById(target).style.display = 'block';
}

// Drag and drop functionality
function setupDragAndDrop() {
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      const filePath = await window.electronAPI.openDroppedFile({
        name: files[0].name,
        path: files[0].path
      });
      if (filePath) {
        await loadPDF(filePath);
      }
    }
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Toolbar buttons
  document.getElementById('open').addEventListener('click', async () => {
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
      await loadPDF(filePath);
    }
  });

  document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
  document.getElementById('prev').addEventListener('click', goToPrevPage);
  document.getElementById('next').addEventListener('click', goToNextPage);
  document.getElementById('rotate-left').addEventListener('click', rotateLeft);
  document.getElementById('rotate-right').addEventListener('click', rotateRight);
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('highlight').addEventListener('click', highlightSelection);
  document.getElementById('underline')?.addEventListener('click', underlineSelection);
  document.getElementById('save')?.addEventListener('click', async () => {
    const fileKey = pdfDocs[currentTab]?.filePath;
    if (!fileKey) return;
    // Force-save: rewrite current in-memory stores back to disk
    await UserHighlights.replaceAll(fileKey, UserHighlights.getAll(fileKey));
    await UserUnderlines.replaceAll(fileKey, UserUnderlines.getAll(fileKey));
    // bookmarks are saved on toggle already, but no-op ensures files exist
    // No explicit call needed as bookmarks module persists on changes
    alert('Annotations saved.');
  });
  document.getElementById('add-text').addEventListener('click', () => {
    const userText = prompt("Enter text to add:");
    if (userText) addTextAnnotation(userText);
  });

  // Zoom controls
  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);

  // View mode buttons
  const canvasContainer = document.getElementById('canvas-container');
  function setActive(buttonId) {
    document.querySelectorAll('.view-mode').forEach(b => b.classList.remove('active'));
    document.getElementById(buttonId).classList.add('active');
  }
  function updateContainerModeClass() {
    canvasContainer.classList.remove('mode-single','mode-split','mode-continuous');
    canvasContainer.classList.add(`mode-${viewMode}`);
  }
  document.getElementById('view-single').addEventListener('click', () => {
    viewMode = 'single';
    setActive('view-single');
    updateContainerModeClass();
    renderPage();
  });
  document.getElementById('view-split').addEventListener('click', () => {
    viewMode = 'split';
    setActive('view-split');
    updateContainerModeClass();
    // ensure current page is odd so pairs align: (1,2), (3,4)...
    if (pdfDocs[currentTab]) {
      if ((pdfDocs[currentTab].pageNum % 2) === 0) {
        pdfDocs[currentTab].pageNum = Math.max(1, pdfDocs[currentTab].pageNum - 1);
      }
      // Force 75% zoom in split view
      pdfDocs[currentTab].scale = 0.75;
    }
    renderPage();
  });
  document.getElementById('view-continuous').addEventListener('click', () => {
    viewMode = 'continuous';
    setActive('view-continuous');
    updateContainerModeClass();
    renderPage();
  });

  // Initialize container class
  updateContainerModeClass();

  // Direct page navigation
  document.getElementById('page-num').addEventListener('change', (e) => {
    const pageNumber = parseInt(e.target.value);
    if (!isNaN(pageNumber)) {
      goToPage(pageNumber);
    }
  });

  // Allow Enter key to navigate to page
  document.getElementById('page-num').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const pageNumber = parseInt(e.target.value);
      if (!isNaN(pageNumber)) {
        goToPage(pageNumber);
      }
    }
  });

  // Sidebar tabs
    const sidebarButtons = document.querySelectorAll('.tab-buttons button');
  sidebarButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-target');
      showSidebarTab(target);
      // active state
      sidebarButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');

      // When switching to Bookmarks pane, show only bookmark pages as thumbnails
      if (target === 'bookmarks') {
        const docIndex = typeof thumbnailsDocIndex === 'number' ? thumbnailsDocIndex : currentTab;
        generateBookmarkThumbnails(docIndex);
      }
    });
  });
  // Set initial active tab
  const firstSidebarBtn = document.querySelector('.tab-buttons button[data-target="thumbnails"]');
  if (firstSidebarBtn) firstSidebarBtn.classList.add('active');

  // Search functionality
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    searchInPDF(e.target.value);
  });

  // Setup drag and drop
  setupDragAndDrop();
});
