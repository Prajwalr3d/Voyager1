"""
SQLite Database Layer with FTS5 Full-Text Search.
Provides thread-safe connections, table initialization, and CRUD helpers.
"""

import sqlite3
import logging
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional
import numpy as np

from app.core.config import settings

logger = logging.getLogger("smartchunk.database")


def get_db_connection() -> sqlite3.Connection:
    """Create a new SQLite connection with foreign keys and row factory enabled."""
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite database operations with auto-commit and rollback."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database transaction error: {e}")
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables including documents, chunks, and FTS5 virtual table."""
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Documents Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                doc_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                sha256_hash TEXT NOT NULL UNIQUE,
                upload_date TEXT NOT NULL,
                total_pages INTEGER NOT NULL,
                total_chunks INTEGER NOT NULL
            );
            """
        )

        # 2. Chunks Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS chunks (
                chunk_id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                page_num INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                chunk_hash TEXT NOT NULL,
                quality_status TEXT NOT NULL,
                content TEXT NOT NULL,
                vector_blob BLOB,
                created_at TEXT NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documents (doc_id) ON DELETE CASCADE
            );
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks (doc_id);
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_chunks_chunk_hash ON chunks (chunk_hash);
            """
        )

        # 3. FTS5 Virtual Table for Keyword Search
        cursor.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                chunk_id UNINDEXED,
                content,
                tokenize = 'porter unicode61'
            );
            """
        )

        logger.info("SmartChunk database initialized successfully with FTS5.")


def serialize_vector(vector: np.ndarray) -> bytes:
    """Serialize a numpy float32 vector to raw bytes for BLOB storage."""
    return vector.astype(np.float32).tobytes()


def deserialize_vector(blob: bytes) -> np.ndarray:
    """Deserialize raw bytes back to a numpy float32 vector."""
    return np.frombuffer(blob, dtype=np.float32)


def insert_document(
    doc_id: str,
    filename: str,
    sha256_hash: str,
    upload_date: str,
    total_pages: int,
    total_chunks: int,
) -> None:
    """Insert or replace document metadata."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO documents 
            (doc_id, filename, sha256_hash, upload_date, total_pages, total_chunks)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (doc_id, filename, sha256_hash, upload_date, total_pages, total_chunks),
        )


def insert_chunks_batch(chunks: List[Dict[str, Any]]) -> None:
    """
    Batch insert chunks into both standard chunks table and FTS5 virtual table.
    """
    if not chunks:
        return

    with get_db() as conn:
        cursor = conn.cursor()

        chunks_data = []
        fts_data = []

        for ch in chunks:
            vector_blob = (
                serialize_vector(ch["vector"]) if ch.get("vector") is not None else None
            )
            chunks_data.append(
                (
                    ch["chunk_id"],
                    ch["doc_id"],
                    ch["page_num"],
                    ch["chunk_index"],
                    ch["chunk_hash"],
                    ch["quality_status"],
                    ch["content"],
                    vector_blob,
                    ch["created_at"],
                )
            )
            fts_data.append((ch["chunk_id"], ch["content"]))

        cursor.executemany(
            """
            INSERT OR REPLACE INTO chunks 
            (chunk_id, doc_id, page_num, chunk_index, chunk_hash, quality_status, content, vector_blob, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            chunks_data,
        )

        cursor.executemany(
            """
            INSERT INTO chunks_fts (chunk_id, content)
            VALUES (?, ?)
            """,
            fts_data,
        )


def get_all_chunks_with_vectors() -> List[Dict[str, Any]]:
    """Retrieve all chunks with their deserialized embedding vectors for vector search."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.chunk_id, c.doc_id, c.page_num, c.chunk_index, c.chunk_hash,
                   c.quality_status, c.content, c.vector_blob, d.sha256_hash AS doc_sha256,
                   d.filename
            FROM chunks c
            JOIN documents d ON c.doc_id = d.doc_id
            WHERE c.vector_blob IS NOT NULL
            """
        )
        rows = cursor.fetchall()

    results = []
    for r in rows:
        results.append(
            {
                "chunk_id": r["chunk_id"],
                "doc_id": r["doc_id"],
                "filename": r["filename"],
                "page_num": r["page_num"],
                "chunk_index": r["chunk_index"],
                "chunk_hash": r["chunk_hash"],
                "doc_sha256": r["doc_sha256"],
                "quality_status": r["quality_status"],
                "content": r["content"],
                "vector": deserialize_vector(r["vector_blob"]),
            }
        )
    return results


def fts_search(query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Execute full-text search against FTS5 table with BM25 ranking.
    Sanitizes query input to handle scientific symbols and special characters safely.
    """
    # Sanitize query by stripping special FTS5 operators unless properly quoted
    clean_terms = [t.strip('":*^()') for t in query.split() if t.strip('":*^()')]
    if not clean_terms:
        return []

    # Construct match expression with prefix matching: term1* OR term2* ...
    match_query = " OR ".join([f'"{term}"*' for term in clean_terms])

    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT c.chunk_id, c.doc_id, c.page_num, c.chunk_index, c.chunk_hash,
                       c.quality_status, c.content, d.sha256_hash AS doc_sha256, d.filename,
                       bm25(chunks_fts) AS bm25_score
                FROM chunks_fts
                JOIN chunks c ON chunks_fts.chunk_id = c.chunk_id
                JOIN documents d ON c.doc_id = d.doc_id
                WHERE chunks_fts MATCH ?
                ORDER BY bm25_score ASC
                LIMIT ?
                """,
                (match_query, limit),
            )
            rows = cursor.fetchall()
        except sqlite3.OperationalError as e:
            # Fallback to simple quoted phrase search if complex expression fails
            logger.warning(f"FTS query syntax issue '{match_query}', falling back: {e}")
            fallback_query = f'"{query.replace('"', "")}"'
            cursor.execute(
                """
                SELECT c.chunk_id, c.doc_id, c.page_num, c.chunk_index, c.chunk_hash,
                       c.quality_status, c.content, d.sha256_hash AS doc_sha256, d.filename,
                       bm25(chunks_fts) AS bm25_score
                FROM chunks_fts
                JOIN chunks c ON chunks_fts.chunk_id = c.chunk_id
                JOIN documents d ON c.doc_id = d.doc_id
                WHERE chunks_fts MATCH ?
                ORDER BY bm25_score ASC
                LIMIT ?
                """,
                (fallback_query, limit),
            )
            rows = cursor.fetchall()

    return [dict(r) for r in rows]

