# Snaphunt AI 🚀

Snaphunt AI is a premium, intelligent recruitment platform that leverages **Google Gemini 1.5** and **Retrieval-Augmented Generation (RAG)** to transform how you find and analyze talent. By combining semantic search with deep reasoning, Snaphunt AI turns static PDF resumes into actionable intelligence.

---

## ✨ Specialties & Highlights

### 🧠 Intelligent Analysis
- **Gemini & OpenAI Support**: Choose your preferred reasoning engine. Keep your data on Gemini RAG while analyzing with GPT-4o, O1, or Gemini Pro.
- **Dynamic Reasoning**: Seamlessly switch providers without re-indexing your candidate pool.
- **Deep Dive Reports**: Generates comprehensive candidate breakdowns including technical accuracy, cultural fit, and growth potential.
- **RAG-Powered Context**: Fixed Gemini-powered semantic retrieval ensures 100% data consistency.

### 🔍 Semantic Match Engine
- **Beyond Keywords**: Finds the best candidates even if they don't use the exact words from the JD.
- **Ranked Retrieval**: Automatically ranks talent by semantic relevance score (0-100%).
- **Multi-Source Ingestion**: Ingest PDFs from local directories, **ZIP archives**, web URLs, or cloud buckets.
- **Smart ZIP Parsing**: Point to a single `.zip` file, and Snaphunt will automatically extract and index every candidate within.

### 💎 Premium User Experience
- **In-App PDF Modal**: View full candidate resumes instantly without leaving the dashboard using the integrated modal viewer.
- **Global Context Tuning**: Fine-tune your initial candidate pool in the configuration for high-precision matching.
- **Desktop-First Dashboard**: A professional, sophisticated UI designed for high-efficiency talent acquisition.
- **Glassmorphic Design**: Modern, clean aesthetics with reactive micro-animations.

---

## 🛠️ Configuration & Setup

Get Snaphunt AI running from scratch in minutes.

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Qdrant**: A vector database for semantic storage.
  ```bash
  docker run -p 6333:6333 qdrant/qdrant
  ```
- **Gemini API Key**: Obtain from [Google AI Studio](https://aistudio.google.com/).

### 2. Installation
Clone the repository and install dependencies for both backend and frontend.

```bash
# Install root dependencies (includes ZIP handling & SDKs)
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Environment Setup
Create a `.env` file in the project root:
```env
PORT=3200
```

### 4. Running the Project
Start both the backend server and the frontend development environment.

```bash
# Terminal 1: Backend
npm run build && npm start

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

## 🚀 How to Use

1. **Initialize System**: Visit the `/config` page.
    - Set your **Gemini RAG Key** (for embeddings).
    - Provide a **Knowledge Source** (Local folder/path, a `.zip` file, or a URL).
    - Use the **Global Context Filter** to seed your initial candidate requirements.
2. **Review Talent**: On the Home dashboard, see the ranked list of candidates matching your initial configuration.
3. **Deep Dive**: Paste a specific Job Description and click **"Deep Dive Analysis"** to generate a full AI assessment.
4. **Instant Preview**: Click on any candidate to open their resume in the **Modal Viewer**.

---

*Powered by Google Gemini 1.5 & Advanced RAG Architecture.*
