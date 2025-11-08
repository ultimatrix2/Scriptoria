#  Scriptoria: Advanced Desktop PDF Reader with AI-Powered Annotations

![Electron](https://img.shields.io/badge/Electron-20232A?style=for-the-badge&logo=electron&logoColor=61DAFB)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PDF.js](https://img.shields.io/badge/PDF.js-FF0000?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)

>  Scriptoria is a **next-generation Desktop PDF Reader with Annotations** built using **Electron** and **pdf.js**, designed for researchers, students, and avid readers who want to go beyond just reading — and start interacting with their documents.

---

##  Overview

**Scriptoria** is not just a PDF reader — it’s an **intelligent reading companion**.  
With powerful annotation tools, seamless **text-to-speech (TTS)**, and **AI-powered question answering**, Scriptoria transforms reading into an interactive experience.

---

##  Features

### Basic Features
-   **Multi-tab Interface** – Open and read multiple PDFs simultaneously.
-   **Seamless Navigation**: Quickly jump between pages using next/previous buttons or direct page input.
-   **Page Preview Modes**: Switch between Single, Split, and Continuous viewing for personalized reading
-   **Dynamic View Adjustment**: Rotate pages left or right for flexible reading orientations.
-   **Precision Zooming**: Smooth Zoom In/Out functionality for detailed content inspection.
-   **Annotations** – Highlight, underline, and bookmark key sections.
-   **Save & Export** – Save your annotations locally for future reference.
-   **Reader Modes** – Light/Dark mode and full-screen view for comfortable reading.

###  Advanced Features
-  **Interactive AI-Powered Summarizer & QnA Module** – Ask natural language questions about the document content.  
-  **Text-to-Speech (TTS)** – Listen to the PDF text read aloud using modern speech synthesis.  
-  **Dictionary & Translation** – Instantly look up meanings and translate selected text.

---

##  Tech Stack

| Layer | Technology |
|:------|:------------|
| **Desktop Framework** | Electron |
| **PDF Engine** | pdf.js , Tesseract.js (OCR ) |
| **Frontend** | HTML, CSS, JavaScript |
| **Utilities** | Node.js, File System APIs |
| **Annotations** | JSON sidecars per-PDF , SHA-256 hashing |
| **AI/ML** | Python, Jupyter Notebook, Hugging Face Transformers library , PyTorch , Flask |
| **Models** | Helsinki-NLP opus-mt, DistilBERT-cnn-12-6 |
| **Database** | local Storage |
| **TTS** | SpeechSynthesis |
| **Dictionary** | Free dictionary API |

---

##  Screenshots

### 🏠 Home Page
![Home Page](assets/screenshots/homepage.png)

### 📝 Annotations
![Annotations](assets/screenshots/annotations.png)

---
## Installation and Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/SoftaBlitz-2k25/Scriptoria.git  
   cd scriptoria
   ```  

3. **Install Dependencies**  
   ```bash
   npm install
   ```    

5. **Run the App**  
   ```bash
   npm start  
   ```
   
7. **Build Executable**  
   ```bash
   npm run build  
   ```
   
## Usage Guide  

Open PDF files from your local system.  
Annotate using the toolbar options (highlight, underline, bookmark).  
Use Q&A to ask context-based questions about your document.  
Turn on Text-to-Speech for hands-free reading.  
Access dictionary and translation for quick learning support.  

  
