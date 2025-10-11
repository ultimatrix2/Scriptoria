#!/usr/bin/env node
// llm_app.js - A JavaScript application for summarization, English-to-Hindi translation,
// and question answering using open-source LLMs via transformers.js.

// Import required library
import { pipeline } from "@xenova/transformers";

// Initialize pipelines asynchronously
let summarizer, translator, qa_pipeline;

async function initializePipelines() {
    console.log("Initializing models... This may take a minute on first run.");
  summarizer = await pipeline("summarization", "Xenova/distilbart-cnn-12-6");
  translator = await pipeline("translation_en_to_hi", "Helsinki-NLP/opus-mt-en-hi");
  qa_pipeline = await pipeline("question-answering", "Xenova/distilbert-base-cased-distilled-squad");
    console.log(" All models loaded successfully!");
}

// Call the initialization function
await initializePipelines();

// --- Summarization ---
async function summarizeText(text, maxChars = null) {
  const result = await summarizer(text.trim(), { max_length: 130, min_length: 30, do_sample: false });
  let summary = result[0].summary_text;
  if (maxChars && summary.length > maxChars) {
    summary = summary.slice(0, maxChars).trim() + "...";
  }
  return summary;
}

// --- Translation ---
async function translateEnToHi(text, chunkSize = 400) {
  // Split long text into chunks to avoid token overflow
  const sentences = text.split(". ");
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length < chunkSize) {
      current += sentence + ". ";
    } else {
      chunks.push(current.trim());
      current = sentence + ". ";
    }
  }
  if (current) chunks.push(current.trim());

  const translatedChunks = [];
  for (const chunk of chunks) {
    const result = await translator(chunk, { max_length: 512 });
    translatedChunks.push(result[0].translation_text);
  }
  return translatedChunks.join(" ");
}

// --- Question Answering ---
async function answerQuestion(question, context) {
  const result = await qa_pipeline({ question, context });
  return result.answer;
}
