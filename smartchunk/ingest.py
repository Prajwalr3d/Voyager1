"""Deterministic, local document ingestion with source-level provenance."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import pypdf
from pypdf import PdfReader

from .models import Chunk, DocumentInput, IngestOptions, Section
from .provider_config import QwenChunkingConfig
from .qwen_chunking import ChunkAnalysisProvider, ChunkAnalysisRequest, SourceBlock, analyze_or_fallback
from .qwen_dashscope import provider_from_config


class UnsupportedSource(ValueError):
    pass


@dataclass(frozen=True)
class SourceText:
    text: str
    parser: str
    pages: list[tuple[int, int, int]]  # page, start offset, end offset


def _source_text(content: bytes, filename: str, content_type: str | None = None) -> SourceText:
    extension = Path(filename).suffix.lower()
    if extension == ".pdf" or content_type == "application/pdf":
        reader = PdfReader(BytesIO(content))
        pieces: list[str] = []; pages: list[tuple[int, int, int]] = []; offset = 0
        for number, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            pieces.append(text)
            pages.append((number, offset, offset + len(text)))
            offset += len(text) + 1
        return SourceText("\n".join(pieces), "pypdf", pages)
    if extension in {".txt", ".md", ".markdown"} or (content_type or "").startswith("text/"):
        return SourceText(content.decode("utf-8", errors="replace"), "utf8_text", [])
    raise UnsupportedSource("Supported sources are PDF, TXT, Markdown, and plain text")


def canonical_source_text(content: bytes, filename: str, content_type: str | None = None) -> str:
    """Exact parser output used to create ingestion character offsets."""
    return _source_text(content, filename, content_type).text


def _words(text: str) -> list[str]:
    return re.findall(r"\S+", text.strip())


def _fixed(text: str, size: int, overlap: int) -> list[tuple[str, int, int]]:
    words = _words(text); result=[]; start=0; step=max(1, size-overlap)
    while start < len(words):
        group=words[start:start+size]
        result.append((" ".join(group), start, start+len(group)))
        if start + size >= len(words): break
        start += step
    return result


def _sections(text: str) -> list[tuple[str, str, int]]:
    """Markdown/numbered/all-caps headers; text without headers remains one section."""
    lines=text.splitlines(); result=[]; title="Document"; body=[]; start=0; offset=0
    header=re.compile(r"^(?:#{1,6}\s+|(?:\d+(?:\.\d+)*[.)]?\s+))(.+)$")
    for line in lines:
        match=header.match(line.strip())
        if match:
            if body: result.append((title,"\n".join(body).strip(),start))
            title=match.group(1).strip(); body=[]; start=offset+len(line)+1
        else: body.append(line)
        offset += len(line)+1
    if body: result.append((title,"\n".join(body).strip(),start))
    return [(h,b,o) for h,b,o in result if b.strip()] or [("Document",text.strip(),0)]


def _page_for_offset(pages: list[tuple[int, int, int]], offset: int) -> int | None:
    return next((page for page, start, end in pages if start <= offset <= end), None)


def ingest_bytes(content: bytes, filename: str, options: IngestOptions, *, document_id: str | None = None,
                 title: str | None = None, content_type: str | None = None,
                 qwen_config: QwenChunkingConfig | None = None,
                 chunk_analyzer: ChunkAnalysisProvider | None = None) -> DocumentInput:
    """Create a reproducible DocumentInput. No semantic entities are inferred."""
    source=_source_text(content, filename, content_type)
    digest=hashlib.sha256(content).hexdigest()
    doc_id=document_id or f"doc-{digest[:16]}"
    doc_title=title or Path(filename).stem or doc_id
    sections=[]; chunks=[]; ordinal=0; block_ordinal=0; analysis_calls=0
    analysis_config=qwen_config or QwenChunkingConfig.from_env()
    if chunk_analyzer is None and analysis_config.enabled:
        chunk_analyzer=provider_from_config(analysis_config)
    source_sections=_sections(source.text)
    if options.strategy == "fixed": source_sections=[("Document",source.text,0)]
    for s_index, (header, body, body_offset) in enumerate(source_sections, 1):
        sid=f"section-{s_index}"
        sections.append(Section(id=sid, header=header, text=header, ordinal=s_index, source=source.parser,
            provenance={"source_sha256":digest,"filename":filename,"char_start":body_offset,"page":_page_for_offset(source.pages,body_offset)}))
        # Structure-aware preserves section boundaries. Smart currently uses the same deterministic
        # boundary rule rather than pretending to derive semantic links from an LLM.
        groups=_fixed(body, options.chunk_size, options.overlap if options.strategy == "fixed" else 0)
        block_data=[]
        for text, word_start, word_end in groups:
            block_ordinal += 1
            prefix_words=_words(body)[:word_start]
            char_start=body_offset + len(" ".join(prefix_words)) + (1 if prefix_words else 0)
            block=SourceBlock(id=f"{digest[:16]}:block-{block_ordinal}",text=text,char_start=char_start,char_end=char_start+len(text),
                section_id=sid,ordinal=block_ordinal)
            block_data.append((block,word_start,word_end))
        # Only a parser fallback section is ambiguous enough to justify optional model analysis.
        ambiguous=options.strategy == "smart" and header == "Document" and bool(block_data)
        metadata={"used":False,"fallback_reason":"not_ambiguous"}
        selected=[[item[0]] for item in block_data]
        if ambiguous:
            request=ChunkAnalysisRequest(document_id=doc_id,source_fingerprint=digest,blocks=tuple(item[0] for item in block_data),
                max_input_tokens=analysis_config.max_input_tokens,max_output_tokens=analysis_config.max_output_tokens,
                prompt_version=analysis_config.prompt_version,timeout_seconds=analysis_config.timeout_seconds)
            if analysis_calls < analysis_config.max_calls_per_document:
                selected,metadata=analyze_or_fallback(request,analysis_config,chunk_analyzer); analysis_calls += 1
            else:
                metadata={"used":False,"fallback_reason":"call_limit"}
        source_words={block.id:(word_start,word_end) for block,word_start,word_end in block_data}
        for selected_blocks in selected:
            text=" ".join(block.text for block in selected_blocks)
            word_start=source_words[selected_blocks[0].id][0]; word_end=source_words[selected_blocks[-1].id][1]
            ordinal += 1
            char_start=selected_blocks[0].char_start; char_end=selected_blocks[-1].char_end
            chunks.append(Chunk(id=f"chunk-{ordinal}", text=text, ordinal=ordinal, section_id=sid, access=options.access,
                source=source.parser, provenance={"source_sha256":digest,"filename":filename,"media_type":content_type,
                "parser_version":getattr(pypdf,"__version__","utf8_text_v1") if source.parser=="pypdf" else "utf8_text_v1",
                "chunker_version":"smartchunk-ingest/1","chunk_strategy":options.strategy,"chunk_strategy_version":"smartchunk-strategy/1",
                "token_count_method":"unicode_word_regex_v1",
                "char_start":char_start,"char_end":char_end,"word_start":word_start,"word_end":word_end,
                "source_block_id":f"{digest}:{char_start}:{char_end}","page":_page_for_offset(source.pages,char_start),
                "chunk_analysis":metadata if options.strategy == "smart" else {}}))
    return DocumentInput(id=doc_id,title=doc_title,source_uri=options.source_uri,access=options.access,sections=sections,chunks=chunks)
