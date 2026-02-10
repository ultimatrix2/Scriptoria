#  Scriptoria: Advanced Desktop PDF Reader with AI-Powered Annotations

![Electron](https://img.shields.io/badge/Electron-20232A?style=for-the-badge&logo=electron&logoColor=61DAFB)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PDF.js](https://img.shields.io/badge/PDF.js-FF0000?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

>  Scriptoria is a **next-generation Desktop PDF Reader with Annotations** built using **Electron** and **pdf.js**, designed for researchers, students, and avid readers who want to go beyond just reading — and start interacting with their documents.

---

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#project-structure)
- [Screenshots](#-screenshots)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Usage Guide](#usage-guide)
- [Contributing](#contributing)
- [License](#license)

---

##  Overview

**Scriptoria** is not just a PDF reader — it's an **intelligent reading companion**.  
With powerful annotation tools, seamless **text-to-speech (TTS)**, and **AI-powered question answering**, Scriptoria transforms reading into an interactive experience.

The application is built as a cross-platform **Electron** desktop app. PDFs are rendered using **pdf.js**, and all annotations (highlights, underlines, bookmarks, and sticky notes) are persisted in local **JSON sidecar files** identified by a **SHA-256 hash** of each PDF. Advanced AI features — including document summarization and question answering — are powered by a companion **Python/Flask** server running Hugging Face Transformer models locally.

---

##  Features

### Core Reading Features
-   **Multi-tab Interface** – Open and read multiple PDFs simultaneously.
-   **Seamless Navigation** – Quickly jump between pages using next/previous buttons or direct page input.
-   **Page Preview Modes** – Switch between Single, Split, and Continuous viewing for personalized reading.
-   **Dynamic View Adjustment** – Rotate pages left or right for flexible reading orientations.
-   **Precision Zooming** – Smooth Zoom In/Out functionality for detailed content inspection.
-   **Thumbnail Sidebar** – Visual page thumbnails for quick navigation.
-   **Full-screen Mode** – Distraction-free reading experience.
-   **Reader Modes** – Light/Dark mode toggle for comfortable reading in any environment.

### Annotation Features
-   **Highlights** – Color-coded highlights with normalized rectangle positions, persisted per-PDF.
-   **Underlines** – Underline key passages and save them across sessions.
-   **Bookmarks** – Bookmark important pages for instant access via the sidebar.
-   **Sticky Notes** – Add positioned sticky notes with custom text and colors on any page.
-   **Save & Export** – Save annotations locally or export an annotated copy as a new PDF with annotations embedded.

###  Advanced Features
-  **Interactive AI-Powered Summarizer & QnA Module** – Ask natural language questions about the document content and get AI-generated summaries in a split-view panel.
-  **OCR (Optical Character Recognition)** – Extract text from image-based or scanned PDFs using Tesseract.js.
-  **Text-to-Speech (TTS)** – Listen to the PDF text read aloud using the Web Speech Synthesis API.  
-  **Dictionary & Translation** – Instantly look up word meanings via the Free Dictionary API and translate selected text.

---

##  Tech Stack

| Layer | Technology |
|:------|:------------|
| **Desktop Framework** | Electron |
| **PDF Engine** | pdf.js (v3.11.174), pdf-lib |
| **OCR** | Tesseract.js |
| **Frontend** | HTML, CSS, JavaScript |
| **Utilities** | Node.js, File System APIs |
| **Annotations** | JSON sidecars per-PDF, SHA-256 hashing |
| **AI/ML** | Python, Jupyter Notebook, Hugging Face Transformers library, PyTorch, Flask |
| **Models** | Helsinki-NLP opus-mt, DistilBERT-cnn-12-6 |
| **Storage** | Local file system (userData/annotations/) |
| **TTS** | Web SpeechSynthesis API |
| **Dictionary** | Free Dictionary API |

---

## Project Structure

```
Scriptoria/
├── main.js              # Electron main process (window management, IPC, file I/O)
├── preload.js           # Context bridge exposing safe APIs to the renderer
├── renderer.js          # Main frontend logic (PDF rendering, tabs, zoom, navigation)
├── index.html           # Application UI layout (toolbar, sidebar, panels)
├── styles.css           # Styling with CSS variables, dark mode, responsive layout
├── package.json         # Project metadata and dependencies
│
├── features/            # Core annotation and reading modules
│   ├── bookmarks.js     #   Bookmark management (per-PDF sidecar storage)
│   ├── highlights.js    #   Highlight annotations with normalized rects & colors
│   ├── underlines.js    #   Underline annotations with rects
│   ├── stickynotes.js   #   Sticky notes with position, text, and color
│   ├── text-store.js    #   Centralized per-page text extraction storage
│   └── tts.js           #   Text-to-speech via Web Speech API
│
├── advance/             # Advanced feature modules
│   ├── dictionary.js    #   Context-menu dictionary lookup via API
│   ├── exportToPdf.js   #   Export annotated PDF (rasterized with annotations baked in)
│   └── summarize.js     #   AI summarizer & QnA UI (connects to Python server)
│
├── model/               # ML backend and server
│   ├── server.py        #   Flask server for AI summarization (port 5001)
│   ├── summarizer_server.py  # Dedicated summarizer endpoint
│   ├── llm_app.js       #   LLM application logic
│   ├── llm_app.ipynb    #   Jupyter notebook for model experimentation
│   ├── start_server.bat #   Windows script to launch the Python server
│   └── start_server.sh  #   Linux/Mac script to launch the Python server
│
├── build/               # Bundled libraries
│   ├── ocr.js           #   Tesseract.js OCR wrapper
│   ├── pdf.mjs          #   PDF.js distribution module
│   └── pdf.worker.mjs   #   PDF.js web worker for rendering
│
└── icons/               # UI icons (SVGs) and screenshot assets
```

---

##  Screenshots

###  Annotations
![Annotations](icons/anotate.png)

### Summarizer and QnA
![Summarizer and QnA](icons/qnaa.png)

###  Navigation
![Navigation](icons/nav.png)

###  Text-to-speech
![TTS](icons/tts.png)

###  Dictionary
![Dictionary](icons/dic.png)

---

## Prerequisites

Before setting up Scriptoria, ensure you have the following installed:

- **Node.js** (v16 or higher) and **npm** – Required to run the Electron app.
- **Python 3.8+** *(optional, for AI features)* – Required only if you want to use the AI-powered summarizer and QnA module.
- **pip** *(optional, for AI features)* – To install Python dependencies (Flask, Transformers, PyTorch).

---

## Installation and Setup

### 1. Clone the Repository
```bash
git clone https://github.com/SoftaBlitz-2k25/Scriptoria.git  
cd scriptoria
```  

### 2. Install Dependencies  
```bash
npm install
```    

### 3. Run the App  
```bash
npm start  
```

### 4. Build Executable  
```bash
npm run build  
```

### 5. Start the AI Server *(optional — needed for Summarizer & QnA)*

The AI-powered summarization and question-answering features require a local Python server running on port **5001**.

**On Linux / macOS:**
```bash
cd model
chmod +x start_server.sh
./start_server.sh
```

**On Windows:**
```bash
cd model
start_server.bat
```

> **Note:** On the first run the server will download the required Hugging Face models (Helsinki-NLP opus-mt, DistilBERT-cnn-12-6). This may take a few minutes depending on your internet connection.

---

## Usage Guide  

1. **Open a PDF** – Click the folder icon in the toolbar or drag and drop a PDF file into the window.
2. **Navigate Pages** – Use the previous/next buttons, enter a page number directly, or click a thumbnail in the sidebar.
3. **Change View Mode** – Switch between Single, Split (side-by-side), and Continuous (vertical scroll) view modes.
4. **Annotate** – Use the toolbar to highlight, underline, or add sticky notes. Bookmark pages via the sidebar.
5. **Save & Export** – Click Save to persist annotations locally. Use Export to generate a new PDF with annotations embedded.
6. **AI Summarizer & QnA** – Open the orange Q&A or purple Summarizer panel on the right side, type your question, and get AI-generated answers about the document content. *(Requires the Python server to be running.)*
7. **Text-to-Speech** – Open the green Audio panel and press play to have the current page read aloud.
8. **Dictionary** – Select a word and open the blue Dictionary panel to look up its meaning.
9. **Dark Mode** – Toggle the day/night icon in the toolbar to switch between light and dark themes.

---

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a new branch for your feature or bug fix (`git checkout -b feature/my-feature`).
3. Commit your changes (`git commit -m "Add my feature"`).
4. Push to your branch (`git push origin feature/my-feature`).
5. Open a Pull Request describing your changes.

---

## License

This project is licensed under the **ISC License**. See the [package.json](package.json) for details.
