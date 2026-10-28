from __future__ import annotations

import statistics
from time import perf_counter

from .graph import RelationshipGraph
from .retrieval import search


def evaluate(graph: RelationshipGraph, cases: list[dict], graph_enabled: bool = False) -> dict:
    recalls=[]; reciprocal=[]; latencies=[]; tokens=[]
    for case in cases:
        start=perf_counter(); rows, meta = search(graph, case["query"], case.get("access", ["public"]), top_k=5,
            expand_graph=graph_enabled, max_hops=case.get("max_hops", 1), max_nodes=case.get("max_nodes", 10),
            max_added_tokens=case.get("max_added_tokens", 500)); latencies.append((perf_counter()-start)*1000)
        ids=[r["chunk_id"] for r in rows]; gold=set(case["relevant_chunk_ids"])
        recalls.append(float(bool(gold & set(ids))))
        reciprocal.append(next((1/(i+1) for i,x in enumerate(ids) if x in gold), 0.0)); tokens.append(meta["added_tokens"])
    return {"Recall@5": statistics.mean(recalls) if recalls else 0, "MRR@5": statistics.mean(reciprocal) if reciprocal else 0,
            "latency_ms_mean": statistics.mean(latencies) if latencies else 0, "added_tokens_mean": statistics.mean(tokens) if tokens else 0}
