"""
Chunking & The Quality Gate Service for SmartChunk.
Implements structure-aware text splitting, deterministic quality evaluation,
repair rules, and cryptographic chunk provenance metadata.
"""

import re
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Any

from app.models.schemas import QualityStatus, QualityReport


def compute_chunk_hash(text: str) -> str:
    """Generate SHA-256 cryptographic hash of the chunk text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def evaluate_quality_gate(raw_chunk: str) -> Tuple[QualityStatus, str, List[str]]:
    """
    Deterministic Quality Gate function evaluating each candidate chunk.

    Rules:
    1. REJECT: Text length under 50 characters (e.g., page numbers, orphaned headers).
    2. REJECT: Alphanumeric ratio below 35% (symbolic noise, OCR artifacts, broken tables).
    3. REPAIR: Broken or unclosed Markdown code blocks (```), unclosed bold markers (**),
       or unbalanced brackets ('[', '(', '{').
    4. REVIEW: High repetition or suspicious OCR sequence patterns.
    5. PASS: Clean, structurally intact chunk ready for indexing.

    Returns:
        (status, processed_chunk_text, notes_or_reasons)
    """
    text = raw_chunk.strip()
    notes: List[str] = []

    # Rule 1: Minimum character length check
    if len(text) < 50:
        return (
            QualityStatus.REJECT,
            text,
            [f"Chunk under 50 characters (length: {len(text)})"],
        )

    # Rule 2: Alphanumeric density check (detects noise/garbage)
    alnum_count = sum(1 for ch in text if ch.isalnum())
    alnum_ratio = alnum_count / len(text)
    if alnum_ratio < 0.35:
        return (
            QualityStatus.REJECT,
            text,
            [f"Low alphanumeric ratio ({alnum_ratio:.1%}): potential noise or binary artifact"],
        )

    repaired_text = text
    was_repaired = False

    # Rule 3a: Repair unclosed code fences (```)
    code_fence_count = repaired_text.count("```")
    if code_fence_count % 2 != 0:
        repaired_text += "\n```"
        notes.append("Repaired unclosed code fence (```)")
        was_repaired = True

    # Rule 3b: Repair unclosed bold markdown markers (**)
    bold_marker_count = repaired_text.count("**")
    if bold_marker_count % 2 != 0:
        # If it ends with dangling **, remove it; otherwise close it
        if repaired_text.endswith("**"):
            repaired_text = repaired_text[:-2]
            notes.append("Removed dangling trailing bold marker (**)")
        else:
            repaired_text += "**"
            notes.append("Closed unclosed bold marker (**)")
        was_repaired = True

    # Rule 3c: Balance square brackets '[' and ']'
    open_sq = repaired_text.count("[")
    close_sq = repaired_text.count("]")
    if open_sq > close_sq:
        repaired_text += "]" * (open_sq - close_sq)
        notes.append(f"Balanced {open_sq - close_sq} unclosed square bracket(s)")
        was_repaired = True

    # Rule 3d: Balance parentheses '(' and ')'
    open_paren = repaired_text.count("(")
    close_paren = repaired_text.count(")")
    if open_paren > close_paren:
        repaired_text += ")" * (open_paren - close_paren)
        notes.append(f"Balanced {open_paren - close_paren} unclosed parenthes(es)")
        was_repaired = True

    # Rule 4: Suspicious repetition check -> REVIEW
    words = repaired_text.split()
    if len(words) >= 10:
        # Check if a single 3-word phrase repeats excessively
        trigrams = [" ".join(words[i : i + 3]) for i in range(len(words) - 2)]
        if trigrams:
            most_common_freq = max(trigrams.count(tg) for tg in set(trigrams))
            if most_common_freq > len(words) // 4 and most_common_freq > 3:
                return (
                    QualityStatus.REVIEW,
                    repaired_text,
                    ["Suspicious high phrase repetition detected"],
                )

    if was_repaired:
        # Re-verify that repaired chunk still satisfies minimum length
        if len(repaired_text.strip()) >= 50:
            return QualityStatus.REPAIR, repaired_text.strip(), notes
        else:
            return QualityStatus.REJECT, text, ["Length dropped under 50 chars post-repair"]

    return QualityStatus.PASS, text, ["Structurally valid"]


def structure_aware_split(text: str, max_chars: int = 1000, min_chars: int = 250) -> List[str]:
    """
    Splits text along natural structural boundaries:
    1. Headers (Markdown # or numbered scientific sections like '1. Introduction').
    2. Paragraphs separated by blank lines.
    3. Sentence boundaries when paragraphs exceed max_chars.
    Merges smaller adjacent blocks to maintain contextual coherence.
    """
    # Regex matching headers or paragraph breaks
    section_pattern = re.compile(
        r"(?:\n\s*\n)|(?:\n(?=[A-Z0-9][A-Za-z0-9\.\s]{1,40}\n))|(?:\n(?=#{1,4}\s))"
    )

    raw_sections = [s.strip() for s in section_pattern.split(text) if s.strip()]
    if not raw_sections:
        return []

    chunks: List[str] = []
    current_chunk = ""

    for section in raw_sections:
        # If single section exceeds max_chars, split by sentences
        if len(section) > max_chars:
            # Flush current accumulator
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""

            sentences = re.split(r"(?<=[.!?])\s+", section)
            sent_accum = ""
            for sent in sentences:
                if len(sent_accum) + len(sent) + 1 <= max_chars:
                    sent_accum = f"{sent_accum} {sent}".strip() if sent_accum else sent
                else:
                    if sent_accum:
                        chunks.append(sent_accum.strip())
                    sent_accum = sent
            if sent_accum:
                chunks.append(sent_accum.strip())
            continue

        # If adding section exceeds max_chars, start new chunk
        if len(current_chunk) + len(section) + 2 > max_chars and len(current_chunk) >= min_chars:
            chunks.append(current_chunk.strip())
            current_chunk = section
        else:
            current_chunk = f"{current_chunk}\n\n{section}".strip() if current_chunk else section

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


def process_and_filter_chunks(
    doc_id: str,
    pages_data: List[Dict[str, Any]],
    max_chunk_chars: int = 900,
) -> Tuple[List[Dict[str, Any]], QualityReport]:
    """
    Executes structure-aware chunking and applies the deterministic Quality Gate.
    Only chunks with status PASS or REPAIR are accepted for indexing.

    Returns:
        (accepted_chunks, quality_report)
    """
    accepted_chunks: List[Dict[str, Any]] = []
    rejection_reasons: List[str] = []
    repairs_applied: List[str] = []

    passed_count = 0
    repaired_count = 0
    reviewed_count = 0
    rejected_count = 0
    total_generated = 0
    chunk_index = 0

    now_iso = datetime.now(timezone.utc).isoformat()

    for page in pages_data:
        page_num = page["page_num"]
        page_text = page["text"]

        raw_candidates = structure_aware_split(page_text, max_chars=max_chunk_chars)

        for candidate in raw_candidates:
            total_generated += 1
            status, final_text, notes = evaluate_quality_gate(candidate)

            if status == QualityStatus.PASS:
                passed_count += 1
                chunk_index += 1
                chunk_hash = compute_chunk_hash(final_text)
                accepted_chunks.append(
                    {
                        "chunk_id": f"chk_{doc_id}_{chunk_index:03d}",
                        "doc_id": doc_id,
                        "page_num": page_num,
                        "chunk_index": chunk_index,
                        "chunk_hash": chunk_hash,
                        "quality_status": status.value,
                        "content": final_text,
                        "vector": None,  # Computed in retrieval service
                        "created_at": now_iso,
                    }
                )

            elif status == QualityStatus.REPAIR:
                repaired_count += 1
                repairs_applied.extend(notes)
                chunk_index += 1
                chunk_hash = compute_chunk_hash(final_text)
                accepted_chunks.append(
                    {
                        "chunk_id": f"chk_{doc_id}_{chunk_index:03d}",
                        "doc_id": doc_id,
                        "page_num": page_num,
                        "chunk_index": chunk_index,
                        "chunk_hash": chunk_hash,
                        "quality_status": status.value,
                        "content": final_text,
                        "vector": None,
                        "created_at": now_iso,
                    }
                )

            elif status == QualityStatus.REVIEW:
                reviewed_count += 1
                rejection_reasons.extend(notes)

            elif status == QualityStatus.REJECT:
                rejected_count += 1
                rejection_reasons.extend(notes)

    report = QualityReport(
        total_generated=total_generated,
        passed=passed_count,
        repaired=repaired_count,
        reviewed=reviewed_count,
        rejected=rejected_count,
        rejection_reasons=rejection_reasons[:10],  # sample
        repairs_applied=repairs_applied[:10],
    )

    return accepted_chunks, report

