// Simple Web Speech API helper for Text-to-Speech
// Usage: speakSelection() / speakPage(filePath, pageNumber) / speakDocument(filePath)

import { getCurrentSelectionText, getPageText, getDocumentText } from './text-store.js';

let currentUtterance = null;
let isSpeaking = false;
let originalIconHTML = null;

export function speakText(text) {
	const clean = String(text || '').trim();
	if (!clean) return false;
	stop();
	const utter = new SpeechSynthesisUtterance(clean);
	utter.rate = 1.0;
	utter.pitch = 1.0;
	utter.volume = 1.0;
	currentUtterance = utter;
	
	// Set up event listeners to track speaking state
	utter.onstart = () => {
		isSpeaking = true;
		updateTTSButtonState();
	};
	utter.onend = () => {
		isSpeaking = false;
		updateTTSButtonState();
	};
	utter.onerror = () => {
		isSpeaking = false;
		updateTTSButtonState();
	};
	
	speechSynthesis.speak(utter);
	return true;
}

export function stop() {
	if (speechSynthesis.speaking || speechSynthesis.paused) {
		speechSynthesis.cancel();
	}
	isSpeaking = false;
	currentUtterance = null;
	updateTTSButtonState();
}

export function pause() {
	if (speechSynthesis.speaking && !speechSynthesis.paused) speechSynthesis.pause();
}

export function resume() {
	if (speechSynthesis.paused) speechSynthesis.resume();
}

export function speakSelection() {
	return speakText(getCurrentSelectionText());
}

export function speakPage(filePath, pageNumber) {
	return speakText(getPageText(filePath, pageNumber));
}

export function speakDocument(filePath) {
	return speakText(getDocumentText(filePath));
}

// Optional: pick a different voice by name substring
export function setVoiceByNameFragment(fragment) {
	const list = speechSynthesis.getVoices();
	const f = String(fragment || '').toLowerCase();
	const v = list.find(x => x.name.toLowerCase().includes(f));
	if (currentUtterance && v) currentUtterance.voice = v;
	return v || null;
}

// Update TTS button visual state
function updateTTSButtonState() {
	const ttsTab = document.getElementById('translation-tab');
	if (!ttsTab) return;
	
	const icon = ttsTab.querySelector('.tab-icon');
	const text = ttsTab.querySelector('.tab-text');
	
	// Save original icon HTML on first call so we can restore it later
	if (originalIconHTML === null && icon) {
		originalIconHTML = icon.innerHTML;
	}
	
	if (isSpeaking) {
		// Show stop state — use innerHTML to preserve element structure
		if (icon) icon.innerHTML = '<img src="icons/audio-stop.svg" alt="stop" class="icon" onerror="this.outerHTML=\'⏹️\'" />';
		if (text) text.textContent = 'Stop';
		ttsTab.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)';
		ttsTab.style.borderColor = '#d63031';
	} else {
		// Restore original SVG icon
		if (icon && originalIconHTML) {
			icon.innerHTML = originalIconHTML;
		} else if (icon) {
			icon.innerHTML = '<img src="icons/audio-play.svg" alt="audio-on" class="icon" />';
		}
		if (text) text.textContent = 'Audio';
		ttsTab.style.background = 'linear-gradient(135deg, #a5d6a7 0%, #66bb6a 100%)';
		ttsTab.style.borderColor = '#388e3c';
	}
}

// Get current speaking state
export function getSpeakingState() {
	return isSpeaking;
}

globalThis.Scriptoria = globalThis.Scriptoria || {};
globalThis.Scriptoria.tts = { speakText, speakSelection, speakPage, speakDocument, stop, pause, resume, setVoiceByNameFragment, getSpeakingState };


