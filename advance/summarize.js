// PDF Summarizer using LLM server
// Creates split view with PDF on left and summary on right

import { getDocumentText } from '../features/text-store.js';

let isSummarizerActive = false;

// Access global variables from renderer.js
function getCurrentPDFDoc() {
  return window.pdfDocs && window.pdfDocs[window.currentTab];
}

function getCurrentTabIndex() {
  return window.currentTab || 0;
}

// LLM-based summarization using the server
async function summarizeText(text) {
  try {
    console.log('Sending text to LLM server, length:', text.length);
    
    // Use LLM server for summarization
    const response = await fetch('http://127.0.0.1:5001/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        max_chars: 500
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log('LLM summary received:', result.summary?.length || 0, 'characters');
    return result.summary || 'No summary generated.';
  } catch (error) {
    console.error('LLM summarization failed:', error);
    return 'Error: Could not connect to summarization server. Please ensure the server is running.';
  }
}

// Create right panel for summary/QnA
function createRightPanel() {
  const panel = document.createElement('div');
  panel.id = 'right-panel';
  panel.innerHTML = `
    <div class="right-panel-header">
      <div class="panel-tabs">
        <button class="panel-tab active" data-panel="summary">Summary</button>
        <button class="panel-tab" data-panel="qna">Q&A</button>
      </div>
      <button id="close-right-panel" class="close-btn">✖</button>
    </div>
    <div class="right-panel-content">
      <div id="summary-panel" class="panel-content active">
        <div class="summary-controls-top">
          <button id="refresh-summary">Refresh</button>
          <button id="extract-text">Extract Text</button>
        </div>
        <div id="summary-text">Generating summary...</div>
        <div class="summary-controls">
          <button id="copy-summary">Copy</button>
          <button id="export-summary">Export</button>
        </div>
      </div>
      <div id="qna-panel" class="panel-content">
        <div class="qna-controls">
          <input type="text" id="question-input" placeholder="Ask a question about the PDF...">
          <button id="ask-question">Ask</button>
        </div>
        <div id="qna-results"></div>
      </div>
    </div>
  `;
  
  // Add styles
  panel.style.cssText = `
    width: 50%;
    height: 100%;
    background: #f8f9fa;
    border-left: 1px solid #ccc;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  
  const header = panel.querySelector('.right-panel-header');
  header.style.cssText = `
    padding: 8px 12px;
    background: #e9ecef;
    border-bottom: 1px solid #ccc;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 40px;
  `;
  
  const tabs = panel.querySelector('.panel-tabs');
  tabs.style.cssText = `
    display: flex;
    gap: 4px;
  `;
  
  const content = panel.querySelector('.right-panel-content');
  content.style.cssText = `
    flex: 1;
    overflow: hidden;
    position: relative;
  `;
  
  // Style panel tabs
  panel.querySelectorAll('.panel-tab').forEach(tab => {
    tab.style.cssText = `
      padding: 6px 12px;
      border: 1px solid #ccc;
      background: #fff;
      cursor: pointer;
      border-radius: 4px 4px 0 0;
      font-size: 12px;
      border-bottom: none;
    `;
    tab.addEventListener('mouseenter', () => {
      if (!tab.classList.contains('active')) {
        tab.style.background = '#f0f0f0';
      }
    });
    tab.addEventListener('mouseleave', () => {
      if (!tab.classList.contains('active')) {
        tab.style.background = '#fff';
      }
    });
  });
  
  // Style active tab
  const activeTab = panel.querySelector('.panel-tab.active');
  if (activeTab) {
    activeTab.style.background = '#007bff';
    activeTab.style.color = 'white';
  }
  
  // Style close button
  const closeBtn = panel.querySelector('#close-right-panel');
  closeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
  `;
  
  // Style panel content
  panel.querySelectorAll('.panel-content').forEach(content => {
    content.style.cssText = `
      display: none;
      flex-direction: column;
      height: 100%;
      padding: 12px;
    `;
  });
  
  // Show active panel
  const activePanel = panel.querySelector('.panel-content.active');
  if (activePanel) {
    activePanel.style.display = 'flex';
  }
  
  // Style summary controls
  const summaryControlsTop = panel.querySelector('.summary-controls-top');
  summaryControlsTop.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    align-items: center;
  `;
  
  const summaryControls = panel.querySelector('.summary-controls');
  summaryControls.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #ddd;
  `;
  
  const summaryText = panel.querySelector('#summary-text');
  summaryText.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.5;
  `;
  
  // Style QnA controls
  const qnaControls = panel.querySelector('.qna-controls');
  qnaControls.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  `;
  
  const qnaResults = panel.querySelector('#qna-results');
  qnaResults.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.5;
  `;
  
  // Style form elements
  panel.querySelectorAll('select, input, button').forEach(el => {
    if (el.id !== 'close-right-panel') {
      el.style.cssText = `
        padding: 6px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 12px;
      `;
    }
  });
  
  // Style buttons
  panel.querySelectorAll('button').forEach(btn => {
    if (btn.id !== 'close-right-panel') {
      btn.style.cssText = `
        padding: 6px 12px;
        border: 1px solid #ccc;
        background: #fff;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f0f0f0';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#fff';
      });
    }
  });
  
  return panel;
}

// Show summarizer split view
export async function showSummarizer(filePath) {
  console.log('showSummarizer called with filePath:', filePath);
  
  if (!filePath) {
    alert('No PDF loaded. Please open a PDF first.');
    return;
  }

  const canvasContainer = document.getElementById('canvas-container');
  if (!canvasContainer) {
    console.error('Canvas container not found');
    return;
  }

  // Check if summarizer is already active
  if (isSummarizerActive) {
    console.log('Summarizer already active, hiding');
    hideSummarizer();
    return;
  }

  // Get document text
  const documentText = getDocumentText(filePath);
  console.log('Document text length:', documentText ? documentText.length : 0);
  
  if (!documentText || documentText.trim().length === 0) {
    alert('No text found in PDF. The document may be image-based or text extraction failed.');
    return;
  }

  console.log('Creating right panel');
  // Create right panel for summary/QnA
  const rightPanel = createRightPanel();
  
  // Get pdf-viewer and set up horizontal layout
  const pdfViewer = document.getElementById('pdf-viewer');
  console.log('PDF viewer element:', pdfViewer);
  
  // Set pdf-viewer to horizontal flex layout
  pdfViewer.style.display = 'flex';
  pdfViewer.style.setProperty('flex-direction', 'row', 'important');
  pdfViewer.style.setProperty('align-items', 'flex-start', 'important');
  
  // Modify canvas container for split view (left side)
  canvasContainer.style.width = '50%';
  canvasContainer.style.flex = '0 0 50%';
  canvasContainer.style.overflowY = 'auto';
  
  // Add right panel to pdf-viewer (right side)
  pdfViewer.appendChild(rightPanel);
  
  isSummarizerActive = true;
  console.log('Summarizer is now active');
  
  // Generate summary
  try {
    const summary = await summarizeText(documentText);
    const summaryText = rightPanel.querySelector('#summary-text');
    summaryText.textContent = summary;
  } catch (error) {
    const summaryText = rightPanel.querySelector('#summary-text');
    summaryText.textContent = 'Error generating summary. Please try again.';
  }
  
  // Add event listeners
  rightPanel.querySelector('#close-right-panel').addEventListener('click', hideSummarizer);
  
  rightPanel.querySelector('#refresh-summary').addEventListener('click', async () => {
    const summaryText = rightPanel.querySelector('#summary-text');
    summaryText.textContent = 'Generating summary...';
    try {
      const summary = await summarizeText(documentText);
      summaryText.textContent = summary;
    } catch (error) {
      summaryText.textContent = 'Error generating summary. Please try again.';
    }
  });
  
  // Extract text button handler
  rightPanel.querySelector('#extract-text').addEventListener('click', async () => {
    const summaryText = rightPanel.querySelector('#summary-text');
    summaryText.textContent = 'Extracting text from all pages...';
    
    try {
      // Trigger text extraction for all pages
      const currentDoc = getCurrentPDFDoc();
      if (currentDoc && currentDoc.pdf) {
        // Call the extractAllPagesText function from renderer.js
        if (window.extractAllPagesText) {
          await window.extractAllPagesText(filePath, currentDoc.pdf);
        }
        const newDocumentText = getDocumentText(filePath);
        
        if (newDocumentText && newDocumentText.trim().length > 0) {
          const summary = await summarizeText(newDocumentText);
          summaryText.textContent = summary;
        } else {
          summaryText.textContent = 'No text could be extracted from this PDF. It may be image-based or corrupted.';
        }
      } else {
        summaryText.textContent = 'No PDF document available for text extraction.';
      }
    } catch (error) {
      console.error('Text extraction failed:', error);
      summaryText.textContent = 'Text extraction failed. Please try again.';
    }
  });
  
  rightPanel.querySelector('#copy-summary').addEventListener('click', () => {
    const summaryText = rightPanel.querySelector('#summary-text').textContent;
    navigator.clipboard.writeText(summaryText).then(() => {
      alert('Summary copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy summary.');
    });
  });
  
  rightPanel.querySelector('#export-summary').addEventListener('click', () => {
    const summaryText = rightPanel.querySelector('#summary-text').textContent;
    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf-summary.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  
  // Panel tab switching
  rightPanel.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanel = tab.dataset.panel;
      
      // Update active tab
      rightPanel.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update tab styles
      rightPanel.querySelectorAll('.panel-tab').forEach(t => {
        if (t.classList.contains('active')) {
          t.style.background = '#007bff';
          t.style.color = 'white';
        } else {
          t.style.background = '#fff';
          t.style.color = '#000';
        }
      });
      
      // Show/hide panel content
      rightPanel.querySelectorAll('.panel-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });
      
      const targetContent = rightPanel.querySelector(`#${targetPanel}-panel`);
      if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'flex';
      }
    });
  });
  
  // QnA functionality (placeholder)
  rightPanel.querySelector('#ask-question').addEventListener('click', () => {
    const question = rightPanel.querySelector('#question-input').value.trim();
    const results = rightPanel.querySelector('#qna-results');
    
    if (question) {
      results.textContent = `Q: ${question}\n\nA: Q&A functionality is not yet implemented. This will be added in a future update.`;
    } else {
      results.textContent = 'Please enter a question first.';
    }
  });
}

// Hide summarizer and restore normal view
export function hideSummarizer() {
  console.log('hideSummarizer called, isSummarizerActive:', isSummarizerActive);
  
  if (!isSummarizerActive) return;
  
  const canvasContainer = document.getElementById('canvas-container');
  const rightPanel = document.getElementById('right-panel');
  
  console.log('Canvas container:', canvasContainer);
  console.log('Right panel:', rightPanel);
  
  if (rightPanel) {
    rightPanel.remove();
    console.log('Right panel removed');
  }
  
  // Restore canvas container and pdf-viewer layout
  canvasContainer.style.width = '100%';
  canvasContainer.style.flex = '1';
  canvasContainer.style.overflowY = '';
  
  // Restore pdf-viewer to original layout
  const pdfViewer = document.getElementById('pdf-viewer');
  pdfViewer.style.display = 'flex';
  pdfViewer.style.setProperty('flex-direction', 'column', 'important');
  pdfViewer.style.setProperty('align-items', 'center', 'important');
  
  isSummarizerActive = false;
  console.log('Summarizer is now inactive');
}

// Export functions for external use
export function isSummarizerVisible() {
  return isSummarizerActive;
}