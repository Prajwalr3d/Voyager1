# SmartChunk: Evidence-Aware Scientific RAG Backend

Production-ready FastAPI backend for **SmartChunk**, an evidence-aware scientific document RAG platform featuring a strict Quality Gate, cryptographic source provenance tracking (SHA-256), and Reciprocal Rank Fusion (RRF) hybrid retrieval.

---

## 📁 Architecture & Folder Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI routes, error handlers, static mounting
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py               # Settings, environment variables, defaults
│   │   └── database.py             # SQLite connection, FTS5 virtual table, vector BLOBs
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py              # Pydantic schemas (requests, responses, provenance)
│   └── services/
│       ├── __init__.py
│       ├── ingestion.py            # PDF extraction (pypdf), canonical text, SHA-256
│       ├── chunking.py             # Structure-Aware splitter & deterministic Quality Gate
│       ├── retrieval.py            # Hybrid search (FTS5 BM25 + MiniLM vectors + RRF)
│       └── llm.py                  # Grounded Q&A chain with Google Gemini
├── static/                         # Vanilla HTML/CSS/JS frontend served at /app
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example                    # Environment variable template
├── requirements.txt                # Python dependencies
└── run.py                          # Server launcher
```

---

## 🚀 Quickstart Guide

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and provide your Google Gemini API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SQLITE_DB_PATH=smartchunk.db
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
GEMINI_MODEL=gemini-1.5-flash
PORT=8000
```

### 3. Start the Server
```bash
python run.py
```
Or with uvicorn directly:
```bash
uvicorn app.main:app --reload --port 8000
```

The web dashboard is served at: **`http://localhost:8000/app`** (or `http://localhost:8000`).
FastAPI interactive Swagger docs are available at: **`http://localhost:8000/docs`**.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Multipart PDF upload, canonical normalization, Quality Gate, and indexing |
| `GET` | `/api/search?q={query}&top_k=5` | Hybrid retrieval (SQLite FTS5 + Dense Embeddings + RRF) |
| `POST` | `/api/qa` | Grounded Q&A with Google Gemini and evidence attribution |
| `GET` | `/api/documents` | List of all indexed documents with SHA-256 hashes |
| `GET` | `/api/health` | Health check and database statistics |
| `GET` | `/app` | Serves the vanilla HTML/CSS/JS frontend |

