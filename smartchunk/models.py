from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class Entity(BaseModel):
    id: str
    text: str = ""
    ordinal: int | None = None
    section_id: str | None = None
    explained_by_chunk_id: str | None = None
    source: str = "parser"
    provenance: dict[str, Any] = Field(default_factory=dict)


class Chunk(Entity):
    access: list[str] = Field(default_factory=lambda: ["public"])
    references: list[str] = Field(default_factory=list)
    quality_status: Literal["PASS", "REPAIR", "REVIEW", "REJECT"] = "PASS"
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)
    indexable: bool = True


class Section(Entity):
    header: str | None = None


class DocumentInput(BaseModel):
    id: str
    title: str = ""
    source_uri: str | None = None
    access: list[str] = Field(default_factory=lambda: ["public"])
    sections: list[Section] = Field(default_factory=list)
    chunks: list[Chunk] = Field(default_factory=list)
    equations: list[Entity] = Field(default_factory=list)
    tables: list[Entity] = Field(default_factory=list)
    definitions: list[Entity] = Field(default_factory=list)
    citations: list[Entity] = Field(default_factory=list)


class IngestOptions(BaseModel):
    """Deterministic source-to-chunk settings exposed to clients."""
    strategy: Literal["fixed", "structure", "smart"] = "smart"
    chunk_size: int = Field(default=350, ge=50, le=4000, description="Maximum words per chunk")
    overlap: int = Field(default=40, ge=0, le=1000, description="Overlapping words for fixed chunks")
    access: list[str] = Field(default_factory=lambda: ["public"])
    source_uri: str | None = None


class SearchRequest(BaseModel):
    query: str
    access: list[str] = Field(default_factory=lambda: ["public"])
    top_k: int = 5
    graph: bool = False
    max_hops: int = 1
    max_nodes: int = 10
    max_added_tokens: int = 500
    mode: Literal["keyword", "semantic", "hybrid", "baseline"] = "keyword"
    rrf_k: int = Field(default=60, ge=1, le=1000)


class EvaluationRequest(BaseModel):
    dataset_id: str = "inline"
    dataset_version: str = "unspecified"
    cases: list[dict[str, Any]]
    mode: Literal["keyword", "semantic", "hybrid"] = "keyword"
    access: list[str] = Field(default_factory=lambda: ["public"])
    top_k: int = Field(default=5, ge=1, le=100)
    graph: bool = False
    chunking_strategy: str = "unknown"
    warmup_trials: int = Field(default=1, ge=0, le=20)
    measured_trials: int = Field(default=3, ge=1, le=20)


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    text: str
    score: float
    graph_added: bool = False
    relationship_path: list[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    results: list[SearchResult]
    retrieval: dict[str, Any]


class ChatRequest(SearchRequest):
    """Evidence-grounded chat request; access remains server-enforced retrieval scope."""
    query: str = ""
    question: str = Field(min_length=1, max_length=8_000)
    max_context_tokens: int = Field(default=1_000, ge=100, le=8_000)


class ChatResponse(BaseModel):
    answer: str
    citations: list[dict[str, Any]] = Field(default_factory=list)
    retrieval: dict[str, Any] = Field(default_factory=dict)
    abstained: bool = False
    uncertainty: str | None = None
    conflicting_evidence: bool = False


class AgentLimits(BaseModel):
    max_steps: int = Field(default=12, ge=1, le=50)
    max_tool_calls: int = Field(default=8, ge=1, le=30)
    max_subquestions: int = Field(default=3, ge=1, le=10)
    max_retrieval_retries: int = Field(default=1, ge=0, le=5)
    max_duration_seconds: float = Field(default=20, ge=1, le=120)
    max_context_tokens: int = Field(default=1_500, ge=100, le=8_000)


class AgentTaskRequest(ChatRequest):
    limits: AgentLimits = Field(default_factory=AgentLimits)


class AgentTaskResponse(BaseModel):
    task_id: str
    status: Literal["completed", "failed"]
    result: ChatResponse | None = None
    error: str | None = None
