// Dictionary lookup and popup utility
async function fetchDefinition(term) {
  const query = term.trim();
  if (!query) return null;

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
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
  let popup = document.getElementById('dictionary-popup');
  if (popup) return popup;

  popup = document.createElement('div');
  popup.id = 'dictionary-popup';
  Object.assign(popup.style, {
    position: 'fixed',
    zIndex: '10000',
    maxWidth: '360px',
    background: '#fff',
    color: '#000',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
    padding: '10px 12px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    display: 'none',
    backdropFilter: 'saturate(180%) blur(10px)',
  });

  const closeBtn = Object.assign(document.createElement('button'), {
    textContent: '✖',
    title: 'Close',
  });
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '6px',
    right: '8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
  });
  closeBtn.onclick = () => (popup.style.display = 'none');

  const content = document.createElement('div');
  content.id = 'dictionary-popup-content';
  content.style.paddingRight = '16px';

  popup.append(closeBtn, content);
  document.body.appendChild(popup);
  return popup;
}

function renderDefinitions(popup, term, data) {
  const container = popup.querySelector('#dictionary-popup-content');
  container.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = term;
  title.style.cssText = 'font-weight:bold;margin-bottom:8px;';
  container.appendChild(title);

  if (!data?.length) {
    container.textContent = 'No definition found.';
    return;
  }

  const meanings = data[0]?.meanings ?? [];
  const definitions = meanings.flatMap(m =>
    (m.definitions || []).map(d => ({
      pos: m.partOfSpeech,
      def: d.definition,
    }))
  );

  if (!definitions.length) {
    container.textContent = 'No concise definitions available.';
    return;
  }

  definitions.slice(0, 5).forEach(({ pos, def }) => {
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.textContent = `• (${pos || '—'}) ${def}`;
    container.appendChild(div);
  });
}

async function showDictionaryForSelection() {
  const { text, rect } = getSelectedTextAndRect();
  if (!text) {
    alert('Select some text first.');
    return;
  }

  const popup = ensurePopup();
  popup.style.display = 'block';
  popup.style.top = `${Math.max(8, (rect?.top || 0) - 8)}px`;
  popup.style.left = `${Math.max(8, rect?.left || 0)}px`;

  const content = popup.querySelector('#dictionary-popup-content');
  content.textContent = 'Looking up definition…';

  const data = await fetchDefinition(text);
  renderDefinitions(popup, text, data);
}

// Attach event
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dictionary')?.addEventListener('click', showDictionaryForSelection);
});
