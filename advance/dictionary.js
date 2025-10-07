// Minimal dictionary integration: get selection, fetch definition, and show popup

// Fetch definition from a public API (dictionaryapi.dev)
async function fetchDefinition(term) {
  const q = term.trim();
  if (!q) return null;
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (_) {
    return null;
  }
}

function getSelectedTextAndRect() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return { text: '', rect: null };
  const text = selection.toString().trim();
  if (!text) return { text: '', rect: null };
  let range;
  try {
    range = selection.getRangeAt(0);
  } catch (_) {
    return { text: '', rect: null };
  }
  const rect = range.getBoundingClientRect();
  return { text, rect };
}

function ensurePopupContainer() {
  let el = document.getElementById('dictionary-popup');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dictionary-popup';
    el.style.position = 'fixed';
    el.style.zIndex = '10000';
    el.style.maxWidth = '360px';
    el.style.background = '#fff';
    el.style.color = '#000';
    el.style.border = '1px solid #ccc';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
    el.style.padding = '10px 12px';
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.fontSize = '14px';
    el.style.lineHeight = '1.4';
    el.style.display = 'none';
    el.style.backdropFilter = 'saturate(180%) blur(10px)';

    const close = document.createElement('button');
    close.textContent = '✖';
    close.title = 'Close';
    close.style.position = 'absolute';
    close.style.top = '6px';
    close.style.right = '8px';
    close.style.border = 'none';
    close.style.background = 'transparent';
    close.style.cursor = 'pointer';
    close.style.fontSize = '14px';
    close.addEventListener('click', () => {
      el.style.display = 'none';
    });
    el.appendChild(close);

    const content = document.createElement('div');
    content.id = 'dictionary-popup-content';
    content.style.paddingRight = '16px';
    el.appendChild(content);

    document.body.appendChild(el);
  }
  return el;
}

function renderDefinitions(container, term, data) {
  const c = container.querySelector('#dictionary-popup-content');
  c.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = term;
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  c.appendChild(title);

  if (!data || data.length === 0) {
    const p = document.createElement('div');
    p.textContent = 'No definition found.';
    c.appendChild(p);
    return;
  }

  // Show first entry meanings concisely
  const entry = data[0];
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  let count = 0;
  for (const m of meanings) {
    if (!Array.isArray(m.definitions)) continue;
    for (const d of m.definitions) {
      const row = document.createElement('div');
      row.style.marginBottom = '6px';
      const pos = m.partOfSpeech ? ` (${m.partOfSpeech})` : '';
      row.textContent = `•${pos} ${d.definition || ''}`.trim();
      c.appendChild(row);
      count += 1;
      if (count >= 5) break; // limit lines
    }
    if (count >= 5) break;
  }
  if (count === 0) {
    const p = document.createElement('div');
    p.textContent = 'No concise definitions available.';
    c.appendChild(p);
  }
}

async function showDictionaryForSelection() {
  const { text, rect } = getSelectedTextAndRect();
  if (!text) {
    alert('Select some text first.');
    return;
  }
  const popup = ensurePopupContainer();
  // Position near selection
  const top = Math.max(8, (rect?.top || 0) - 8);
  const left = Math.max(8, (rect?.left || 0));
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  popup.style.display = 'block';

  const c = popup.querySelector('#dictionary-popup-content');
  c.textContent = 'Looking up definition…';

  const data = await fetchDefinition(text);
  renderDefinitions(popup, text, data);
}

// Wire toolbar button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('dictionary');
    if (btn) btn.addEventListener('click', showDictionaryForSelection);
  });
} else {
  const btn = document.getElementById('dictionary');
  if (btn) btn.addEventListener('click', showDictionaryForSelection);
}
