"""
Pydantic Schemas and Data Models for SmartChunk.
Enforces strict type safety for requests, responses, and provenance records.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class QualityStatus(str, Enum):
    PASS = "PASS"
    REPAIR = "REPAIR"
    REVIEW = "REVIEW"
    REJECT = "REJECT"


class DocumentMetadata(BaseModel):
    doc_id: str
    filename: str
    sha256_hash: str = Field(..., description="Cryptographic SHA-256 of canonical text")
    upload_date: str
    total_pages: int
    total_chunks: int


class QualityReport(BaseModel):
    total_generated: int
    passed: int
    repaired: int
    reviewed: int
    rejected: int
    rejection_reasons: List[str] = Field(default_factory=list)
    repairs_applied: List[str] = Field(default_factory=list)


class UploadResponse(BaseModel):
    success: bool
    message: str
    document: DocumentMetadata
    quality_report: QualityReport


class SearchResultChunk(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    page_num: int
    chunk_index: int
    doc_sha256: str = Field(..., description="Source document SHA-256 hash")
    chunk_hash: str = Field(..., description="Cryptographic hash of the chunk content")
    quality_status: str
    content: str
    rrf_score: float
    fts_rank: Optional[int] = None
    vector_rank: Optional[int] = None


class SearchResponse(BaseModel):
    query: str
    top_k: int
    total_found: int
    results: List[SearchResultChunk]


class QARequest(BaseModel):
    query: str = Field(..., min_length=2, description="User's natural language question")
    top_k: Optional[int] = Field(default=5, ge=1, le=20, description="Top evidence chunks to use")


class EvidenceChunk(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    page_num: int
    doc_sha256: str
    chunk_hash: str
    quality_status: str
    content: str
    rrf_score: float


class QAResponse(BaseModel):
    query: str
    answer: str
    evidence_chunks: List[EvidenceChunk]
    model: str
    provenance_verified: bool

