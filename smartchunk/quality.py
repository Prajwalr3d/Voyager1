"""Explainable, deterministic chunk quality gate; no semantic-content claims."""
from __future__ import annotations

import re
from collections import Counter
from typing import Literal

from pydantic import BaseModel, Field

from .models import DocumentInput


class Diagnostic(BaseModel):
    code: str
    severity: Literal["INFO", "WARNING", "ERROR"]
    explanation: str
    chunk_id: str
    evidence: dict = Field(default_factory=dict)
    suggested_action: str
    hard: bool = False


class ChunkQuality(BaseModel):
    chunk_id: str
    status: Literal["PASS", "REPAIR", "REVIEW", "REJECT"]
    indexable: bool
    diagnostics: list[Diagnostic] = Field(default_factory=list)


class QualityReport(BaseModel):
    document_id: str
    chunks: list[ChunkQuality]

    @property
    def diagnostics(self) -> list[Diagnostic]:
        return [d for chunk in self.chunks for d in chunk.diagnostics]


def _words(text: str) -> int:
    return len(re.findall(r"\w+", text))


def validate_document(document: DocumentInput, *, max_words: int = 350, preferred_min_words: int = 20,
                      repaired_ids: set[str] | None = None) -> QualityReport:
    """Validate chunk records. Hard errors always result in REJECT and non-indexability."""
    repaired_ids = repaired_ids or set()
    texts = Counter(" ".join(chunk.text.split()).casefold() for chunk in document.chunks if chunk.text.strip())
    source_hashes = {str(c.provenance.get("source_sha256")) for c in document.chunks if c.provenance.get("source_sha256")}
    report=[]
    for chunk in document.chunks:
        ds: list[Diagnostic] = []
        def add(code: str, severity: Literal["INFO", "WARNING", "ERROR"], explanation: str, action: str,
                *, hard: bool = False, **evidence: object) -> None:
            ds.append(Diagnostic(code=code,severity=severity,explanation=explanation,chunk_id=chunk.id or "<missing>",
                evidence=evidence,suggested_action=action,hard=hard))
        if not chunk.id.strip(): add("MISSING_CHUNK_ID","ERROR","Chunk ID is required.","Assign a stable chunk ID.",hard=True)
        if not document.id.strip(): add("MISSING_SOURCE_DOCUMENT","ERROR","Source document ID is required.","Assign a stable document ID.",hard=True)
        if not chunk.text.strip(): add("EMPTY_CHUNK","ERROR","Chunk contains no non-whitespace content.","Reparse or remove the chunk.",hard=True)
        provenance=chunk.provenance
        if not provenance.get("source_sha256"):
            add("MISSING_SOURCE_FINGERPRINT","ERROR","Source fingerprint is required for indexable ingestion.","Re-ingest from a source file.",hard=True)
        if not provenance.get("filename"):
            add("MISSING_SOURCE_FILENAME","ERROR","Source filename is required for provenance.","Re-ingest with source metadata.",hard=True)
        offset=provenance.get("char_start")
        if offset is not None and (not isinstance(offset,int) or offset < 0):
            add("INVALID_SOURCE_OFFSET","ERROR","char_start must be a non-negative integer.","Correct the parser offset.",hard=True,char_start=offset)
        if not chunk.access:
            add("MISSING_ACCESS_ACL","ERROR","Indexable chunks require an explicit access ACL.","Supply at least one access label.",hard=True)
        count=_words(chunk.text)
        if count > max_words: add("CHUNK_EXCEEDS_MAX_SIZE","ERROR","Chunk exceeds configured maximum size.","Split the chunk deterministically.",hard=True,words=count,max_words=max_words)
        elif count < preferred_min_words: add("CHUNK_BELOW_PREFERRED_SIZE","WARNING","Chunk is below the preferred size.","Review with neighboring structure.",words=count,preferred_min_words=preferred_min_words)
        if not chunk.section_id: add("MISSING_HEADING_CONTEXT","WARNING","Chunk has no section reference.","Retain parser heading context.")
        normalized=" ".join(chunk.text.split()).casefold()
        if normalized and texts[normalized] > 1: add("DUPLICATE_CHUNK","WARNING","Equivalent chunk text occurs more than once.","Deduplicate or confirm intentional repetition.")
        if len(source_hashes) > 1: add("SOURCE_FINGERPRINT_MISMATCH","ERROR","Chunks disagree on source fingerprint.","Do not combine chunks from different sources.",hard=True)
        if "media_type" not in provenance: add("MISSING_OPTIONAL_MEDIA_TYPE","WARNING","Media type is absent; traceability is reduced.","Preserve media type when available.")
        if chunk.id in repaired_ids: add("REPAIRED_TRIM_WHITESPACE","INFO","Leading/trailing whitespace was removed and revalidated.","No further action required.")
        hard=any(d.hard for d in ds); warnings=any(d.severity=="WARNING" for d in ds)
        status="REJECT" if hard else "REPAIR" if chunk.id in repaired_ids else "REVIEW" if warnings else "PASS"
        report.append(ChunkQuality(chunk_id=chunk.id,status=status,indexable=not hard,diagnostics=ds))
    return QualityReport(document_id=document.id,chunks=report)


def repair_and_validate(document: DocumentInput, *, max_words: int = 350, preferred_min_words: int = 20) -> tuple[DocumentInput, QualityReport]:
    """Only trims outer whitespace; logs the repair and then performs full revalidation."""
    repaired=document.model_copy(deep=True); repaired_ids=set()
    for chunk in repaired.chunks:
        trimmed=chunk.text.strip()
        if trimmed != chunk.text:
            chunk.text=trimmed; repaired_ids.add(chunk.id)
    report=validate_document(repaired,max_words=max_words,preferred_min_words=preferred_min_words,repaired_ids=repaired_ids)
    by_id={item.chunk_id:item for item in report.chunks}
    for chunk in repaired.chunks:
        result=by_id[chunk.id]; chunk.quality_status=result.status; chunk.indexable=result.indexable
        chunk.diagnostics=[d.model_dump(mode="json") for d in result.diagnostics]
    return repaired, report
