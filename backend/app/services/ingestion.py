"""
Document Ingestion & Provenance Service.
Extracts PDF text using pypdf, creates canonical text, computes SHA-256 cryptographic hash,
and persists document metadata.
"""

import io
import hashlib
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Any
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.core.database import insert_document
from app.models.schemas import DocumentMetadata


def normalize_canonical_text(text: str) -> str:
    """
    Produce canonical text from raw extracted document content:
    - Normalizes Unicode using NFKC format (resolving ligatures, distinct quote marks, etc.).
    - Unifies line endings to Unix style LF.
    - Strips non-printable control characters except standard whitespace.
    - Removes trailing line whitespace and collapses 3+ consecutive newlines.
    """
    if not text:
        return ""

    # NFKC Unicode Normalization
    normalized = unicodedata.normalize("NFKC", text)

    # Convert line endings
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")

    # Remove non-printable control characters except \n, \t
    cleaned_chars = [
        ch for ch in normalized if ch in ("\n", "\t") or (ord(ch) >= 32 and ord(ch) != 127)
    ]
    normalized = "".join(cleaned_chars)

    # Process lines
    lines = [line.rstrip() for line in normalized.split("\n")]
    processed_text = "\n".join(lines)

    # Collapse excessive blank lines
    while "\n\n\n" in processed_text:
        processed_text = processed_text.replace("\n\n\n", "\n\n")

    return processed_text.strip()


def compute_sha256(content: str) -> str:
    """Generate SHA-256 cryptographic hex digest of normalized string content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def ingest_pdf(
    file_bytes: bytes, filename: str
) -> Tuple[DocumentMetadata, List[Dict[str, Any]]]:
    """
    Process an uploaded PDF file:
    1. Reads PDF via pypdf.
    2. Extracts and normalizes text on a per-page basis.
    3. Computes document-level canonical text and SHA-256 provenance hash.
    4. Saves document record to SQLite.

    Raises:
        ValueError: If file is not a valid or readable PDF or contains no extractable text.
    """
    if not file_bytes:
        raise ValueError("Uploaded file is empty.")

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except (PdfReadError, Exception) as e:
        raise ValueError(f"Failed to parse PDF document: {str(e)}")

    if reader.is_encrypted:
        try:
            # Attempt blank password decrypt
            decrypted = reader.decrypt("")
            if not decrypted:
                raise ValueError("PDF is password-protected and cannot be read.")
        except Exception:
            raise ValueError("PDF is password-protected and cannot be read.")

    total_pages = len(reader.pages)
    if total_pages == 0:
        raise ValueError("PDF document contains 0 pages.")

    pages_data: List[Dict[str, Any]] = []
    full_canonical_chunks: List[str] = []

    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        raw_text = page.extract_text() or ""
        canonical_text = normalize_canonical_text(raw_text)

        if canonical_text:
            page_hash = compute_sha256(canonical_text)
            pages_data.append(
                {
                    "page_num": page_num,
                    "text": canonical_text,
                    "page_hash": page_hash,
                }
            )
            full_canonical_chunks.append(canonical_text)

    if not full_canonical_chunks:
        raise ValueError(
            "No extractable text found in the PDF. The document may contain scanned raster images without text."
        )

    # Document-level provenance hash
    combined_canonical_text = "\n\n".join(full_canonical_chunks)
    doc_sha256 = compute_sha256(combined_canonical_text)

    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    upload_date = datetime.now(timezone.utc).isoformat()

    # Save to SQLite
    insert_document(
        doc_id=doc_id,
        filename=filename,
        sha256_hash=doc_sha256,
        upload_date=upload_date,
        total_pages=total_pages,
        total_chunks=0,  # Will be updated once chunking finishes
    )

    metadata = DocumentMetadata(
        doc_id=doc_id,
        filename=filename,
        sha256_hash=doc_sha256,
        upload_date=upload_date,
        total_pages=total_pages,
        total_chunks=0,
    )

    return metadata, pages_data

