// Translation lookup and floating popup utility for Scriptoria

async function fetchTranslation(text) {
  const query = text.trim();
  if (!query) return null;

  try {
    const res = await fetch('http://127.0.0.1:5001/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: query })
    });
    
    if (!res.ok) {
      console.error('Translation API error:', res.status, res.statusText);
      return null;
    }
    const data = await res.json();
    return data && data.translation ? data.translation : null;
  } catch (error) {
    console.error('Translation fetch error:', error);
    return null;
  }
}

function getSelectedTextAndRect() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return { text: '', rect: null };

  const text = selection.toString().trim();
  if (!text) return { text: '', rect: null };

  try {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    return { text, rect };
  } catch {
    return { text: '', rect: null };
  }
}

function ensurePopup() {
  let popup = document.getElementById('translate-popup');
  if (popup) return popup;

  popup = document.createElement('div');
  popup.id = 'translate-popup';
  Object.assign(popup.style, {
    position: 'fixed',
    zIndex: '10000',
    maxWidth: '380px',
    background: '#ffffff',
    color: '#000000',
    border: '2px solid #000000', // Black border
    borderRadius: '8px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    padding: '12px 14px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    display: 'none',
    transition: 'opacity 0.2s ease-in-out'
  });

  const closeBtn = Object.assign(document.createElement('button'), {
    textContent: '✖',
    title: 'Close',
  });
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '8px',
    right: '10px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#000000',
  });
  closeBtn.onclick = () => (popup.style.display = 'none');

  const content = document.createElement('div');
  content.id = 'translate-popup-content';
  content.style.paddingRight = '20px';

  popup.append(closeBtn, content);
  document.body.appendChild(popup);
  return popup;
}

function renderTranslation(popup, term, translation) {
  const container = popup.querySelector('#translate-popup-content');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'font-weight:bold;margin-bottom:6px;color:#000000;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;';
  header.textContent = 'Translation (Hindi)';
  container.appendChild(header);

  const sourceText = document.createElement('div');
  sourceText.style.cssText = 'font-style:italic;color:#000000;margin-bottom:8px;font-size:13px;border-left:2px solid #000000;padding-left:6px;';
  sourceText.textContent = `"${term.length > 60 ? term.substring(0, 57) + '...' : term}"`;
  container.appendChild(sourceText);

  const translatedText = document.createElement('div');
  translatedText.style.cssText = 'font-size:15px;color:#000000;font-weight:500;white-space:pre-wrap;';
  translatedText.textContent = translation || 'Could not translate text. Make sure the backend server is running.';
  container.appendChild(translatedText);
}

async function showTranslationForSelection() {
  const { text, rect } = getSelectedTextAndRect();
  if (!text) {
    alert('Please select some text to translate first.');
    return;
  }

  const popup = ensurePopup();
  popup.style.display = 'block';
  
  // Position the popup above or below the selection
  let top = (rect?.top || 0) - 100;
  if (top < 10) top = (rect?.bottom || 0) + 10;
  
  popup.style.top = `${Math.max(10, top)}px`;
  popup.style.left = `${Math.max(10, rect?.left || 0)}px`;

  const content = popup.querySelector('#translate-popup-content');
  content.innerHTML = '<span style="color:#666;">Translating into Hindi...</span>';

  const translation = await fetchTranslation(text);
  renderTranslation(popup, text, translation);
}

// Attach event listener
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('translate')?.addEventListener('click', showTranslationForSelection);
});
