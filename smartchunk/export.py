"""Deterministic JSONL metadata export for SmartChunk records."""
from __future__ import annotations

import json
import re

from .models import DocumentInput


def _token_count(text: str) -> int:
    return len(re.findall(r"\w+", text))


def export_jsonl(document: DocumentInput) -> str:
    sections={section.id:section for section in document.sections}
    lines=[]
    for chunk in sorted(document.chunks,key=lambda c:(c.ordinal if c.ordinal is not None else 10**9,c.id)):
        p=chunk.provenance; section=sections.get(chunk.section_id or "")
        record={"chunk_id":chunk.id,"source_document":document.id,"text":chunk.text,
          "source_fingerprint":p.get("source_sha256"),"parser":chunk.source,"parser_version":p.get("parser_version","unknown"),
          "chunker_version":p.get("chunker_version","unknown"),"chunk_strategy":p.get("chunk_strategy","unknown"),
          "token_count":_token_count(chunk.text),"token_count_method":p.get("token_count_method","unicode_word_regex_v1"),
          "source_offsets":{"char_start":p.get("char_start"),"char_end":p.get("char_end"),"word_start":p.get("word_start"),"word_end":p.get("word_end")},
          "page":p.get("page"),"heading_path":[section.header] if section and section.header else [],
          "quality_status":chunk.quality_status,"indexable":chunk.indexable,"diagnostics":chunk.diagnostics}
        lines.append(json.dumps(record,ensure_ascii=False,sort_keys=True,separators=(",",":")))
    return "\n".join(lines) + ("\n" if lines else "")


def import_jsonl(text: str) -> list[dict]:
    return [json.loads(line) for line in text.splitlines() if line.strip()]
