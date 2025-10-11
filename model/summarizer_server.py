#!/usr/bin/env python3
# summarizer_server.py - A Flask server for text summarization using transformers

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the summarization pipeline
try:
    summarizer = pipeline("summarization", device=-1)  # uses distilbart-cnn-12-6 by default
    logger.info("Summarization pipeline initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize summarization pipeline: {e}")
    summarizer = None

def summarize_text(text: str, max_chars: int = None) -> str:
    """
    Generate a concise summary of the given text using a pretrained summarization model.
    :param text: The input text to summarize.
    :param max_chars: Optional limit on summary length in characters (for post-processing).
    :return: A summary of the text.
    """
    if not summarizer:
        return "Summarization service is not available."
    
    try:
        # Use the summarization pipeline to get summary
        result = summarizer(text, max_length=130, min_length=30, do_sample=False)
        summary = result[0]['summary_text']
        
        # If max_chars is specified, truncate the summary to that length
        if max_chars and len(summary) > max_chars:
            summary = summary[:max_chars].rstrip() + "..."
        
        return summary
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        return f"Error generating summary: {str(e)}"

@app.route('/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json()
        text = data.get('text', '')
        max_chars = data.get('max_chars', None)
        
        if not text.strip():
            return jsonify({'error': 'No text provided'}), 400
        
        logger.info(f"Summarizing text of length: {len(text)}")
        summary = summarize_text(text, max_chars)
        
        return jsonify({
            'summary': summary,
            'original_length': len(text),
            'summary_length': len(summary)
        })
        
    except Exception as e:
        logger.error(f"Server error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'summarizer_available': summarizer is not None
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
