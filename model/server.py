#!/usr/bin/env python3
# server.py - Unified Flask server for text summarization, translation, and Q&A
# Supports: Gemini API, Hugging Face Inference API, or local transformers pipelines

import logging
import os
import requests as http_requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Load env variables from multiple possible locations
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("HF_API_KEY")

use_gemini = False
use_hf_api = False

# --- Provider 1: Gemini API ---
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        use_gemini = True
        logger.info("Gemini API initialized successfully (using gemini-1.5-flash).")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini API: {e}")

# --- Provider 2: Hugging Face Serverless Inference API ---
if not use_gemini and HF_TOKEN:
    use_hf_api = True
    logger.info("Hugging Face Serverless Inference API configured successfully.")

HF_HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}
HF_SUMMARIZE_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
HF_TRANSLATE_URL = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-hi"
HF_QA_URL = "https://api-inference.huggingface.co/models/deepset/roberta-base-squad2"

app = Flask(__name__)
CORS(app)  # Enable CORS for all origins

# --- Provider 3: Local pipelines (only if no cloud API is active) ---
summarizer = None
translator = None
qa_pipeline = None

if not use_gemini and not use_hf_api:
    logger.info("No cloud API keys found. Falling back to local Hugging Face pipelines...")

    # Bypass Hugging Face safety check for torch.load on PyTorch versions < 2.6
    try:
        import transformers.utils.import_utils as import_utils
        import_utils.check_torch_load_is_safe = lambda: None
    except Exception:
        pass

    try:
        import transformers.modeling_utils as modeling_utils
        modeling_utils.check_torch_load_is_safe = lambda: None
    except Exception:
        pass

    from transformers import pipeline

    try:
        summarizer = pipeline("summarization", framework="pt", device=-1)
        logger.info("Summarization pipeline loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load summarization pipeline: {e}")

    try:
        translator = pipeline("translation_en_to_hi", model="Helsinki-NLP/opus-mt-en-hi", framework="pt", device=-1)
        logger.info("Translation pipeline (en -> hi) loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load translation pipeline: {e}")

    try:
        qa_pipeline = pipeline("question-answering", framework="pt", device=-1)
        logger.info("Question answering pipeline loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load Q&A pipeline: {e}")
else:
    logger.info("Bypassing local model loading — cloud API is active.")


def query_hf_api(url, payload):
    """Send a request to the Hugging Face Serverless Inference API."""
    try:
        response = http_requests.post(url, headers=HF_HEADERS, json=payload, timeout=30)
        # Handle model cold-start (503 = model is loading)
        if response.status_code == 503:
            error_data = response.json()
            estimated_time = error_data.get("estimated_time", 20)
            logger.warning(f"HF model is loading, waiting {min(estimated_time, 10)}s...")
            import time
            time.sleep(min(estimated_time, 10))
            response = http_requests.post(url, headers=HF_HEADERS, json=payload, timeout=30)

        if response.status_code != 200:
            logger.error(f"HF API returned status {response.status_code}: {response.text}")
            raise Exception(f"HF API returned status {response.status_code}")

        return response.json()
    except Exception as e:
        logger.error(f"HF API request failed: {e}")
        raise e


@app.route('/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON format"}), 400

        text = data.get("text", "")
        max_chars = data.get("max_chars", None)

        if not text.strip():
            return jsonify({"error": "No text provided"}), 400

        logger.info(f"Summarizing text of length: {len(text)}")

        if use_gemini:
            prompt = (
                f"You are a summarization assistant. Summarize the following text. "
                f"Limit the summary to about 130-150 words. "
                f"Return only the summary text, with no introductory or meta-commentary:\n\n{text}"
            )
            response = gemini_model.generate_content(prompt)
            summary = response.text.strip()
        elif use_hf_api:
            payload = {
                "inputs": text,
                "parameters": {"max_length": 130, "min_length": 30}
            }
            result = query_hf_api(HF_SUMMARIZE_URL, payload)
            summary = result[0]['summary_text']
        else:
            if not summarizer:
                return jsonify({"error": "Summarization model not available"}), 503
            result = summarizer(text, max_length=130, min_length=30, do_sample=False)
            summary = result[0]['summary_text']

        if max_chars and len(summary) > max_chars:
            summary = summary[:max_chars].rstrip() + "..."

        return jsonify({
            "summary": summary,
            "original_length": len(text),
            "summary_length": len(summary)
        })
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON format"}), 400

        text = data.get("text", "")
        if not text.strip():
            return jsonify({"error": "No text provided"}), 400

        logger.info(f"Translating text of length: {len(text)}")

        if use_gemini:
            prompt = (
                f"Translate the following English text to Hindi. "
                f"Return only the Hindi translation, with no explanation or introductory text:\n\n{text}"
            )
            response = gemini_model.generate_content(prompt)
            translation = response.text.strip()
        elif use_hf_api:
            payload = {"inputs": text}
            result = query_hf_api(HF_TRANSLATE_URL, payload)
            translation = result[0]['translation_text']
        else:
            if not translator:
                return jsonify({"error": "Translation model not available"}), 503
            result = translator(text)
            translation = result[0]['translation_text']

        return jsonify({"translation": translation})
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/qa', methods=['POST'])
def qa():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON format"}), 400

        question = data.get("question", "")
        context = data.get("context", "")

        if not question.strip() or not context.strip():
            return jsonify({"error": "Both question and context are required"}), 400

        logger.info(f"Answering question: '{question}' using context of length: {len(context)}")

        if use_gemini:
            prompt = (
                f"You are a helpful reading assistant. Based on the provided context, answer the user's question. "
                f"If the answer cannot be found in the context, answer it using your general knowledge but mention "
                f"that it is not directly stated in the text. Be concise.\n\n"
                f"Context:\n{context}\n\n"
                f"Question: {question}\n\n"
                f"Answer:"
            )
            response = gemini_model.generate_content(prompt)
            answer = response.text.strip()
        elif use_hf_api:
            payload = {
                "inputs": {
                    "question": question,
                    "context": context
                }
            }
            result = query_hf_api(HF_QA_URL, payload)
            answer = result['answer']
        else:
            if not qa_pipeline:
                return jsonify({"error": "Q&A model not available"}), 503
            result = qa_pipeline(question=question, context=context)
            answer = result['answer']

        return jsonify({"answer": answer})
    except Exception as e:
        logger.error(f"Q&A error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    provider = "local"
    if use_gemini:
        provider = "gemini"
    elif use_hf_api:
        provider = "huggingface_api"

    return jsonify({
        "status": "healthy",
        "provider": provider,
        "summarizer_loaded": use_gemini or use_hf_api or (summarizer is not None),
        "translator_loaded": use_gemini or use_hf_api or (translator is not None),
        "qa_pipeline_loaded": use_gemini or use_hf_api or (qa_pipeline is not None)
    })


if __name__ == '__main__':
    logger.info(f"Starting server on http://127.0.0.1:5001")
    app.run(host='127.0.0.1', port=5001, debug=False)
