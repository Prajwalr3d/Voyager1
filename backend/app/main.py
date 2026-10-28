"""
SmartChunk Main FastAPI Application.
Integrates:
  1. The complete SmartChunk v2.4.0 API Suite (/api/v1/...) for the React 18 frontend.
  2. The Evidence-Aware RAG API (/api/...) for PDF ingestion, quality gate, and hybrid Q&A.
  3. Direct static hosting of the compiled React frontend (frontend/dist) at / and /app.
"""

import sys
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse, JSONResponse

# -------------------------------------------------------------
# 1. Path Setup
# -------------------------------------------------------------
CURRENT_DIR = Path(__file__).resolve().parent          # .../backend/app
BACKEND_DIR = CURRENT_DIR.parent                      # .../backend
WORKSPACE_DIR = BACKEND_DIR.parent                    # .../GRAPHITE FRONTEND

for p in [str(BACKEND_DIR), str(CURRENT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from app.core.config import settings
    from app.core.database import init_db, get_db
    from app.models.schemas import (
        UploadResponse, SearchResponse, QARequest, QAResponse, DocumentMetadata
    )
    from app.services.ingestion import ingest_pdf
    from app.services.chunking import process_and_filter_chunks
    from app.services.retrieval import index_chunks, hybrid_search
    from app.services.llm import run_grounded_qa
    from app.api.v1 import router as v1_router
except ImportError:
    from core.config import settings
    from core.database import init_db, get_db
    from models.schemas import (
        UploadResponse, SearchResponse, QARequest, QAResponse, DocumentMetadata
    )
    from services.ingestion import ingest_pdf
    from services.chunking import process_and_filter_chunks
    from services.retrieval import index_chunks, hybrid_search
    from services.llm import run_grounded_qa
    from api.v1 import router as v1_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("smartchunk.main")

# -------------------------------------------------------------
# 2. Determine Frontend Static Paths
# -------------------------------------------------------------
REACT_DIST_DIR = (WORKSPACE_DIR / "frontend" / "dist").resolve()
VANILLA_STATIC_DIR = (BACKEND_DIR / "static").resolve()

# Prefer compiled React distribution if built; fallback to vanilla static
PRIMARY_FRONTEND_DIR = REACT_DIST_DIR if (REACT_DIST_DIR / "index.html").exists() else VANILLA_STATIC_DIR

logger.info(f"Primary frontend static path: {PRIMARY_FRONTEND_DIR}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: initializes database and tables on startup."""
    logger.info("Initializing SmartChunk SQLite tables and FTS5 index...")
    init_db()
    logger.info("SmartChunk backend ready.")
    yield
    logger.info("SmartChunk backend shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SmartChunk Structure-Aware Scientific Document RAG & Evaluation Platform",
    lifespan=lifespan,
)

# -------------------------------------------------------------
# 3. CORS Middleware
# -------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# 4. Include v2.4.0 API Router (Matches React frontend contracts)
# -------------------------------------------------------------
app.include_router(v1_router)


# -------------------------------------------------------------
# 5. Root & System Endpoints
# -------------------------------------------------------------

@app.get("/api/health", summary="Health check endpoint", tags=["System"])
async def root_health_check():
    """Simple health check returning status: ok."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


@app.post(
    "/api/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload & Index PDF with Quality Gate",
    tags=["Ingestion"],
)
async def upload_document(file: UploadFile = File(...)):
    """Accepts a PDF, executes canonical normalization, Quality Gate, embeddings, and FTS5 indexing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF (.pdf) documents are supported.",
        )

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        doc_metadata, pages_data = ingest_pdf(file_bytes, file.filename)
        accepted_chunks, quality_report = process_and_filter_chunks(
            doc_id=doc_metadata.doc_id, pages_data=pages_data
        )

        if not accepted_chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="All extracted chunks were rejected by the Quality Gate. Document text could not be verified.",
            )

        index_chunks(accepted_chunks, doc_id=doc_metadata.doc_id)
        doc_metadata.total_chunks = len(accepted_chunks)

        return UploadResponse(
            success=True,
            message=f"Document '{file.filename}' processed successfully: {len(accepted_chunks)} chunks indexed.",
            document=doc_metadata,
            quality_report=quality_report,
        )

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal processing failure: {str(e)}")


@app.get(
    "/api/search",
    response_model=SearchResponse,
    summary="Hybrid Retrieval (FTS5 + Dense Embeddings + RRF)",
    tags=["Retrieval"],
)
async def search_chunks(
    q: str = Query(..., min_length=1),
    top_k: int = Query(5, ge=1, le=50),
):
    """Executes hybrid search combining SQLite FTS5 (BM25) and sentence vectors via RRF."""
    results = hybrid_search(query=q, top_k=top_k)
    return SearchResponse(query=q, top_k=top_k, total_found=len(results), results=results)


@app.post(
    "/api/qa",
    response_model=QAResponse,
    summary="Grounded Q&A with Provenance Tracking",
    tags=["Q&A"],
)
async def grounded_qa(payload: QARequest):
    """Hybrid-retrieves relevant evidence chunks and runs Gemini prompt chain with evidence citations."""
    evidence_chunks = hybrid_search(query=payload.query, top_k=payload.top_k or 5)
    return run_grounded_qa(query=payload.query, retrieved_chunks=evidence_chunks)


# -------------------------------------------------------------
# 6. Static Frontend Mount & SPA Routing
# -------------------------------------------------------------

# Mount assets directory (for React JS/CSS bundles)
if (PRIMARY_FRONTEND_DIR / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(PRIMARY_FRONTEND_DIR / "assets")),
        name="react_assets",
    )

# Mount /app for direct static access
app.mount(
    "/app",
    StaticFiles(directory=str(PRIMARY_FRONTEND_DIR), html=True),
    name="primary_frontend",
)

# Root SPA route: serves index.html directly
@app.get("/", include_in_schema=False)
async def serve_root():
    index_file = PRIMARY_FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return RedirectResponse(url="/app")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
