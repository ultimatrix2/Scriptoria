// Centralized text store for PDF documents and pages
//  format of storage: {filepath : {pages: Map<pageNumber, text>, lastUpdatedAt: timestamp}}
// Keyed by filePath; stores per-page plain text 

const documentTextByFile = new Map();

function ensureDoc(filePath) {
	if (!documentTextByFile.has(filePath)) {
		documentTextByFile.set(filePath, { pages: new Map(), lastUpdatedAt: Date.now() });
	}
	return documentTextByFile.get(filePath);
}

export function setPageText(filePath, pageNumber, text) {
	const doc = ensureDoc(filePath);      //  cheking if doc exists or not 
	doc.pages.set(pageNumber, normalizeWhitespace(text || ''));   // Sets  text for a current page.
	doc.lastUpdatedAt = Date.now();
}

export function appendToPageText(filePath, pageNumber, extraText) { 
			// in case , OCR fetches the text ; appended to the existing text of that page.
			// using newline as a separator
	const doc = ensureDoc(filePath);
	const prev = doc.pages.get(pageNumber) || '';
	doc.pages.set(pageNumber, normalizeWhitespace(prev + '\n' + (extraText || '')));
	doc.lastUpdatedAt = Date.now();
}

export function getPageText(filePath, pageNumber) {
	const doc = ensureDoc(filePath);
	return doc.pages.get(pageNumber) || '';
}

export function getDocumentText(filePath) {
	const doc = ensureDoc(filePath);
	const pagesSorted = Array.from(doc.pages.entries()).sort((a, b) => a[0] - b[0]);
	return normalizeWhitespace(pagesSorted.map(([, t]) => t).join('\n\n'));
}

export function getAllDocumentsIndex() {
	return Array.from(documentTextByFile.keys());
}

export function clearDocumentText(filePath) {
	documentTextByFile.delete(filePath);
}

function normalizeWhitespace(s) {
	return String(s).replace(/\u00A0/g, ' ').replace(/[\t ]+/g, ' ').replace(/[\r\f]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Convenience accessors for current selection in the DOM
export function getCurrentSelectionText() {
	const sel = globalThis.getSelection && globalThis.getSelection();
	return normalizeWhitespace(sel ? String(sel) : '');
}

// Expose in a global namespace for easy access from devtools without wiring preload
globalThis.Scriptoria = globalThis.Scriptoria || {};
globalThis.Scriptoria.textStore = {
	setPageText,
	appendToPageText,
	getPageText,
	getDocumentText,
	getAllDocumentsIndex,
	clearDocumentText,
	getCurrentSelectionText
};


