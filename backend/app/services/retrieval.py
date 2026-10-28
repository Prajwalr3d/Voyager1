"""
Hybrid Retrieval Engine for SmartChunk.
Combines SQLite FTS5 Full-Text Search and SentenceTransformer Vector Embeddings
using Reciprocal Rank Fusion (RRF).
"""

import logging
import hashlib
from typing import List, Dict, Any, Optional
import numpy as np

from app.core.config import settings
from app.core.database import (
    fts_search,
    get_all_chunks_with_vectors,
    insert_chunks_batch,
    get_db,
)
from app.models.schemas import SearchResultChunk

logger = logging.getLogger("smartchunk.retrieval")


def _hash_fallback_embed(text: str, dim: int = 384) -> np.ndarray:
    """Lightweight deterministic token-hash vector embedding used if PyTorch/ST is unavailable."""
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()
    for word in words:
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


class EmbeddingEngine:
    """
    Singleton wrapper for sentence-transformers to lazy-load the model
    and cache vector computations, with automatic lightweight fallback.
    """

    _instance = None
    _model = None
    _use_fallback = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingEngine, cls).__new__(cls)
        return cls._instance

    @property
    def model(self):
        if self._model is None and not self._use_fallback:
            try:
                from sentence_transformers import SentenceTransformer

                logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL_NAME}...")
                self._model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
                logger.info("SentenceTransformer model loaded successfully.")
            except ImportError:
                logger.warning(
                    "sentence-transformers not installed. Using high-speed token-hash fallback embeddings."
                )
                self._use_fallback = True
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer ({e}). Using fallback embeddings.")
                self._use_fallback = True
        return self._model

    def encode(self, texts: List[str]) -> np.ndarray:
        """Compute normalized vector embeddings for a list of texts."""
        if self.model is not None and not self._use_fallback:
            try:
                embeddings = self.model.encode(
                    texts, show_progress_bar=False, convert_to_numpy=True, normalize_embeddings=True
                )
                return embeddings.astype(np.float32)
            except Exception as e:
                logger.warning(f"Error during ST encoding ({e}). Using fallback.")
                self._use_fallback = True

        return np.vstack([_hash_fallback_embed(t) for t in texts])

    def encode_query(self, query: str) -> np.ndarray:
        """Compute normalized vector embedding for a single query."""
        if self.model is not None and not self._use_fallback:
            try:
                embedding = self.model.encode(
                    [query], show_progress_bar=False, convert_to_numpy=True, normalize_embeddings=True
                )[0]
                return embedding.astype(np.float32)
            except Exception as e:
                logger.warning(f"Error during query ST encoding ({e}). Using fallback.")
                self._use_fallback = True

        return _hash_fallback_embed(query)


# Global instance
embedding_engine = EmbeddingEngine()


def index_chunks(chunks: List[Dict[str, Any]], doc_id: str) -> None:
    """
    Compute vector embeddings for accepted chunks and persist them into SQLite & FTS5.
    Also updates document record with total chunk count.
    """
    if not chunks:
        return

    texts = [c["content"] for c in chunks]
    vectors = embedding_engine.encode(texts)

    for i, c in enumerate(chunks):
        c["vector"] = vectors[i]

    insert_chunks_batch(chunks)

    # Update total_chunks in documents table
    with get_db() as conn:
        conn.execute(
            "UPDATE documents SET total_chunks = ? WHERE doc_id = ?",
            (len(chunks), doc_id),
        )

    logger.info(f"Indexed {len(chunks)} chunks with embeddings for doc_id '{doc_id}'.")


def vector_similarity_search(query_vector: np.ndarray, top_k: int = 50) -> List[Dict[str, Any]]:
    """
    Compute cosine similarity between query vector and all indexed chunk vectors in SQLite.
    Returns ranked chunk candidates.
    """
    all_chunks = get_all_chunks_with_vectors()
    if not all_chunks:
        return []

    # Stack all chunk vectors into a single 2D matrix
    matrix = np.vstack([c["vector"] for c in all_chunks])  # Shape: (N, D)

    # Query vector is assumed normalized
    q_norm = query_vector / (np.linalg.norm(query_vector) + 1e-10)
    m_norms = np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-10
    norm_matrix = matrix / m_norms

    # Cosine similarities = dot product of unit vectors
    similarities = np.dot(norm_matrix, q_norm)  # Shape: (N,)

    # Sort descending
    top_indices = np.argsort(-similarities)[:top_k]

    results = []
    for idx in top_indices:
        chunk = all_chunks[idx]
        results.append(
            {
                "chunk_id": chunk["chunk_id"],
                "doc_id": chunk["doc_id"],
                "filename": chunk["filename"],
                "page_num": chunk["page_num"],
                "chunk_index": chunk["chunk_index"],
                "doc_sha256": chunk["doc_sha256"],
                "chunk_hash": chunk["chunk_hash"],
                "quality_status": chunk["quality_status"],
                "content": chunk["content"],
                "cosine_similarity": float(similarities[idx]),
            }
        )
    return results


def hybrid_search(query: str, top_k: int = 5) -> List[SearchResultChunk]:
    """
    Executes hybrid retrieval:
    1. Keyword FTS5 search (ranked by BM25).
    2. Vector similarity search (ranked by Cosine Similarity).
    3. Merges result lists using Reciprocal Rank Fusion (RRF):
       score = 1 / (k + rank_fts) + 1 / (k + rank_vector)
    4. Returns top_k results with complete provenance metadata.
    """
    k = settings.RRF_K
    fetch_limit = max(top_k * 5, 40)

    # 1. FTS5 Search
    fts_results = fts_search(query, limit=fetch_limit)
    fts_ranks: Dict[str, int] = {}
    fts_lookup: Dict[str, Dict[str, Any]] = {}
    for rank, item in enumerate(fts_results, start=1):
        cid = item["chunk_id"]
        fts_ranks[cid] = rank
        fts_lookup[cid] = item

    # 2. Vector Search
    query_vector = embedding_engine.encode_query(query)
    vec_results = vector_similarity_search(query_vector, top_k=fetch_limit)
    vec_ranks: Dict[str, int] = {}
    vec_lookup: Dict[str, Dict[str, Any]] = {}
    for rank, item in enumerate(vec_results, start=1):
        cid = item["chunk_id"]
        vec_ranks[cid] = rank
        vec_lookup[cid] = item

    # 3. Combine with Reciprocal Rank Fusion (RRF)
    all_chunk_ids = set(fts_ranks.keys()).union(set(vec_ranks.keys()))
    rrf_scores: Dict[str, float] = {}

    for cid in all_chunk_ids:
        score = 0.0
        if cid in fts_ranks:
            score += 1.0 / (k + fts_ranks[cid])
        if cid in vec_ranks:
            score += 1.0 / (k + vec_ranks[cid])
        rrf_scores[cid] = score

    # Sort chunk IDs descending by RRF score
    sorted_ids = sorted(all_chunk_ids, key=lambda x: rrf_scores[x], reverse=True)[:top_k]

    final_results: List[SearchResultChunk] = []
    for cid in sorted_ids:
        source_data = fts_lookup.get(cid) or vec_lookup.get(cid)
        if not source_data:
            continue

        final_results.append(
            SearchResultChunk(
                chunk_id=source_data["chunk_id"],
                doc_id=source_data["doc_id"],
                filename=source_data["filename"],
                page_num=source_data["page_num"],
                chunk_index=source_data["chunk_index"],
                doc_sha256=source_data["doc_sha256"],
                chunk_hash=source_data["chunk_hash"],
                quality_status=source_data["quality_status"],
                content=source_data["content"],
                rrf_score=round(rrf_scores[cid], 5),
                fts_rank=fts_ranks.get(cid),
                vector_rank=vec_ranks.get(cid),
            )
        )

    return final_results
