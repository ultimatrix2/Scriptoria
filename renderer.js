// Global variables
let pdfDocs = [];
let currentTab = 0;
let viewMode = 'single'; // 'single' | 'split' | 'continuous'

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
    await generateThumbnails(pdf);
    await loadBookmarks(pdf);
    
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
  await page.render({ canvasContext: ctx, viewport }).promise;
}

function createTab(fileName) {
  const tabsContainer = document.getElementById('tabs');
  const tab = document.createElement('li');
  tab.textContent = fileName;
  tab.addEventListener('click', () => {
    // Switch to this tab
    const tabIndex = Array.from(tabsContainer.children).indexOf(tab);
    currentTab = tabIndex;
    renderPage();
    
    // Update active tab styling
    document.querySelectorAll('#tabs li').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
  
  // Clear active class from all tabs
  document.querySelectorAll('#tabs li').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  
  tabsContainer.appendChild(tab);
} 

// Generate Thumbnails
async function generateThumbnails(pdf) {
  const thumbContainer = document.getElementById("thumbnails");
  thumbContainer.innerHTML = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3, rotation: 0 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;
    canvas.addEventListener("click", () => {
      goToPage(i);
    });
    thumbContainer.appendChild(canvas);
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
function highlightSelection() {
  const selection = window.getSelection().toString();
  if (!selection) return;
  alert(`Highlighted: ${selection}`);
  // later we can draw yellow overlay rects
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
  pdfDocs[currentTab].pageNum = Math.max(1, pdfDocs[currentTab].pageNum - step);
  renderPage();
}

function goToNextPage() {
  if (!pdfDocs[currentTab] || pdfDocs[currentTab].pageNum >= pdfDocs[currentTab].pdf.numPages) return;
  const step = viewMode === 'split' ? 2 : 1;
  pdfDocs[currentTab].pageNum = Math.min(pdfDocs[currentTab].pdf.numPages, pdfDocs[currentTab].pageNum + step);
  renderPage();
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
