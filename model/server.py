#!/usr/bin/env python3
from flask import Flask, request, jsonify
from transformers import pipeline

# Initialize app
app = Flask(__name__)

# Load models
summarizer = pipeline("summarization", device=-1)
translator = pipeline("translation_en_to_hi", model="Helsinki-NLP/opus-mt-en-hi", device=-1)
qa_pipeline = pipeline("question-answering", device=-1)

@app.route('/summarize', methods=['POST'])
def summarize():
    data = request.json
    text = data.get("text", "")
    if not text:
        return jsonify({"error": "No text provided"}), 400
    result = summarizer(text, max_length=130, min_length=30, do_sample=False)
    return jsonify({"summary": result[0]['summary_text']})

@app.route('/translate', methods=['POST'])
def translate():
    data = request.json
    text = data.get("text", "")
    result = translator(text)
    return jsonify({"translation": result[0]['translation_text']})

@app.route('/qa', methods=['POST'])
def qa():
    data = request.json
    question = data.get("question", "")
    context = data.get("context", "")
    result = qa_pipeline(question=question, context=context)
    return jsonify({"answer": result['answer']})

if __name__ == '__main__':
    app.run(port=5001)
