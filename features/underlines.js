// Sidecar-based storage for underlines per PDF
// Data shape example:
// [ { page: 3, rects: [ { x, y, w, h } ], color: '#000000' } ]

const MEMORY = new Map(); // fileKey -> Array of underlines

export async function initForFile(fileKey) {
  const data = await window.electronAPI?.readAnnotations?.(fileKey, 'underlines');
  MEMORY.set(fileKey, Array.isArray(data) ? data : []);
}

export function getAll(fileKey) {
  return [...(MEMORY.get(fileKey) || [])];
}

export async function add(fileKey, entry) {
  const arr = MEMORY.get(fileKey) || [];
  arr.push(entry);
  MEMORY.set(fileKey, arr);
  await window.electronAPI?.writeAnnotations?.(fileKey, 'underlines', arr);
}

export async function replaceAll(fileKey, entries) {
  MEMORY.set(fileKey, Array.isArray(entries) ? entries : []);
  await window.electronAPI?.writeAnnotations?.(fileKey, 'underlines', MEMORY.get(fileKey));
}

export async function removeAtIndex(fileKey, index) {
  const arr = MEMORY.get(fileKey) || [];
  if (index >= 0 && index < arr.length) {
    arr.splice(index, 1);
    MEMORY.set(fileKey, arr);
    await window.electronAPI?.writeAnnotations?.(fileKey, 'underlines', arr);
  }
}

