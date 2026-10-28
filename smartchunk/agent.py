"""Bounded LangGraph research workflow with retrieval-only tools."""
from __future__ import annotations

import time
from typing import Any, Callable, TypedDict

from langgraph.graph import END, START, StateGraph

from .ai import AIProvider
from .models import AgentLimits
from .rag import chat


class ResearchState(TypedDict, total=False):
    question: str
    request: dict[str, Any]
    limits: AgentLimits
    started: float
    steps: int
    tool_calls: int
    retries: int
    subquestions: list[str]
    rows: list[dict[str, Any]]
    retrieval: dict[str, Any]
    relationships: list[dict[str, Any]]
    result: dict[str, Any]
    error: str


SearchTool = Callable[[Any], tuple[list[dict[str, Any]], dict[str, Any]]]
RelationshipTool = Callable[[str, list[str], int, int], dict[str, Any]]


class ResearchAssistant:
    """An explicit, finite graph. It has no filesystem, web, shell, or mutation tools."""

    tool_allowlist = frozenset({"search_documents", "get_chunk_context", "inspect_relationships", "evaluate_evidence"})

    def __init__(self, provider: AIProvider, search_documents: SearchTool, inspect_relationships: RelationshipTool):
        self.provider = provider
        self.search_documents = search_documents
        self.inspect_relationships = inspect_relationships
        self.graph = self._build_graph()

    @staticmethod
    def _guard(state: ResearchState) -> str | None:
        limits = state["limits"]
        if state["steps"] >= limits.max_steps:
            return "research step limit reached"
        if time.monotonic() - state["started"] > limits.max_duration_seconds:
            return "research duration limit reached"
        return None

    def _count_step(self, state: ResearchState) -> dict[str, Any]:
        error = self._guard(state)
        return {"steps": state["steps"] + 1, **({"error": error} if error else {})}

    def validate_request(self, state: ResearchState) -> dict[str, Any]:
        update = self._count_step(state)
        if not state["question"].strip(): update["error"] = "question must not be empty"
        return update

    def plan_research(self, state: ResearchState) -> dict[str, Any]:
        update = self._count_step(state)
        # Deterministic planning avoids letting the model expand scope or call unapproved tools.
        update["subquestions"] = [state["question"]][:state["limits"].max_subquestions]
        return update

    def retrieve_evidence(self, state: ResearchState) -> dict[str, Any]:
        update = self._count_step(state)
        if update.get("error"): return update
        if state["tool_calls"] >= state["limits"].max_tool_calls:
            return {**update, "error": "research tool-call limit reached"}
        rows, metadata = self.search_documents(state["request"])
        return {**update, "rows": rows, "retrieval": metadata, "tool_calls": state["tool_calls"] + 1}

    def inspect_evidence_relationships(self, state: ResearchState) -> dict[str, Any]:
        update = self._count_step(state)
        if update.get("error") or not state.get("rows"): return update
        if state["tool_calls"] >= state["limits"].max_tool_calls: return {**update, "error": "research tool-call limit reached"}
        first = state["rows"][0]
        related = self.inspect_relationships(first["chunk_id"], state["request"]["access"], 1, 10)
        return {**update, "relationships": related.get("relationships", []), "tool_calls": state["tool_calls"] + 1}

    def assess_coverage(self, state: ResearchState) -> dict[str, Any]:
        update = self._count_step(state)
        if not state.get("rows") and state["retries"] >= state["limits"].max_retrieval_retries:
            update["error"] = "insufficient permitted evidence"
        return update

    def retry_retrieval(self, state: ResearchState) -> dict[str, Any]:
        # The graph only reaches this node while a configured retry remains.
        return {**self._count_step(state), "retries": state["retries"] + 1}

    def synthesize(self, state: ResearchState) -> dict[str, Any]:
        update = self._count_step(state)
        if update.get("error"): return update
        result = chat(state["question"], state.get("rows", []), state.get("retrieval", {}), self.provider,
                      max_tokens=state["limits"].max_context_tokens)
        return {**update, "result": result}

    def validate_citations(self, state: ResearchState) -> dict[str, Any]:
        update = self._count_step(state)
        if state.get("error"):
            return {**update, "result": {"answer": "I cannot complete this research task from the permitted evidence.", "citations": [], "abstained": True, "uncertainty": state["error"], "retrieval": state.get("retrieval", {}), "conflicting_evidence": False}}
        return update

    @staticmethod
    def _after_validate(state: ResearchState) -> str: return "finish" if state.get("error") else "plan"
    @staticmethod
    def _after_retrieve(state: ResearchState) -> str: return "finish" if state.get("error") else "inspect"
    @staticmethod
    def _after_assess(state: ResearchState) -> str:
        return "retry" if not state.get("rows") and state["retries"] < state["limits"].max_retrieval_retries else "synthesize"

    def _build_graph(self):
        graph = StateGraph(ResearchState)
        graph.add_node("validate", self.validate_request)
        graph.add_node("plan", self.plan_research)
        graph.add_node("retrieve", self.retrieve_evidence)
        graph.add_node("inspect", self.inspect_evidence_relationships)
        graph.add_node("assess", self.assess_coverage)
        graph.add_node("retry", self.retry_retrieval)
        graph.add_node("synthesize", self.synthesize)
        graph.add_node("validate_citations", self.validate_citations)
        graph.add_edge(START, "validate")
        graph.add_conditional_edges("validate", self._after_validate, {"finish": "validate_citations", "plan": "plan"})
        graph.add_edge("plan", "retrieve")
        graph.add_conditional_edges("retrieve", self._after_retrieve, {"finish": "validate_citations", "inspect": "inspect"})
        graph.add_edge("inspect", "assess")
        graph.add_conditional_edges("assess", self._after_assess, {"retry": "retry", "synthesize": "synthesize"})
        graph.add_edge("retry", "retrieve")
        graph.add_edge("synthesize", "validate_citations")
        graph.add_edge("validate_citations", END)
        return graph.compile()

    def run(self, request: dict[str, Any], limits: AgentLimits) -> dict[str, Any]:
        return self.graph.invoke({"question": request["question"], "request": request, "limits": limits,
                                  "started": time.monotonic(), "steps": 0, "tool_calls": 0, "retries": 0,
                                  "subquestions": [], "rows": [], "retrieval": {}, "relationships": []})
