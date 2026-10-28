"""Labelled, reproducible retrieval evaluation. Labels are supplied by human review."""
from __future__ import annotations

import json
import statistics
import uuid
from datetime import datetime, timezone
from time import perf_counter
from typing import Callable

from .benchmark_lab import map_evidence, reproducibility_metadata


def load_dataset_jsonl(text: str) -> list[dict]:
    cases=[]
    for line_number,line in enumerate(text.splitlines(),1):
        if not line.strip(): continue
        row=json.loads(line)
        if not row.get("query_id") or not row.get("query"): raise ValueError(f"line {line_number}: query_id and query are required")
        labels=row.get("relevance",row.get("relevant_chunk_ids"))
        if labels is not None and not isinstance(labels,(dict,list)): raise ValueError(f"line {line_number}: relevance must be an object or list")
        cases.append(row)
    return cases


def _labels(case: dict) -> dict[str,float] | None:
    value=case.get("relevance")
    if isinstance(value,dict): return {str(key):float(score) for key,score in value.items()}
    if isinstance(value,list): return {str(key):1.0 for key in value}
    value=case.get("relevant_chunk_ids")
    return {str(key):1.0 for key in value} if isinstance(value,list) else None


def run_evaluation(cases: list[dict], retrieve: Callable[[str, dict], tuple[list[dict],dict]], *, configuration: dict,
                   warmup_trials: int = 0, measured_trials: int = 1) -> dict:
    """Missing labels are reported separately and excluded from aggregate metrics."""
    if measured_trials < 1 or warmup_trials < 0: raise ValueError("invalid warm-up or measured trial count")
    per_query=[]; recalls=[]; mrrs=[]; ndcgs=[]; latencies=[]; missing=[]; invalid=[]; failures=[]
    for case in cases:
        try:
            for _ in range(warmup_trials): retrieve(case["query"],case)
            trials=[]
            for _ in range(measured_trials):
                started=perf_counter(); rows,meta=retrieve(case["query"],case); trials.append((perf_counter()-started)*1000)
            latency=statistics.mean(trials)
        except Exception as exc:
            failures.append(case["query_id"]); per_query.append({"query_id":case["query_id"],"status":"failed","error":str(exc)}); continue
        labels=_labels(case)
        ideal_labels=labels
        if case.get("evidence") is not None:
            labels,reason=map_evidence(rows,case["evidence"])
            if reason:
                invalid.append(case["query_id"]); per_query.append({"query_id":case["query_id"],"status":"invalid_mapping","reason":reason}); continue
            # Source-span labels remain the ideal ranking even when this strategy retrieves no overlap.
            # That is an ordinary miss, not missing annotation.
            ideal_labels={f"evidence-{i}":float(item.get("grade",1)) for i,item in enumerate(case["evidence"])}
        ids=[row["chunk_id"] for row in rows[:5]]
        item={"query_id":case["query_id"],"status":"completed","retrieved_chunk_ids":ids,"latency_ms":latency,"metadata":meta}
        if labels is None:
            item["label_status"]="missing"; missing.append(case["query_id"]); per_query.append(item); continue
        relevant=set(labels or {}); item["label_status"]="scored"
        recall=float(bool(relevant & set(ids))); mrr=next((1/(i+1) for i,key in enumerate(ids) if key in relevant),0.0)
        gains=[(labels or {}).get(key,0.0) for key in ids]; ideal=sorted((ideal_labels or {}).values(),reverse=True)[:5]
        dcg=sum((2**gain-1)/__import__('math').log2(i+2) for i,gain in enumerate(gains))
        idcg=sum((2**gain-1)/__import__('math').log2(i+2) for i,gain in enumerate(ideal))
        item.update({"recall_at_5":recall,"mrr_at_5":mrr,"ndcg_at_5":dcg/idcg if idcg else None})
        recalls.append(recall); mrrs.append(mrr); latencies.append(latency)
        if idcg: ndcgs.append(dcg/idcg)
        per_query.append(item)
    run_status="failed" if failures and not recalls else "partial" if failures or invalid else "completed"
    return {"run_id":str(uuid.uuid4()),"timestamp":datetime.now(timezone.utc).isoformat(),"status":run_status,
      "configuration":{**configuration,"warmup_trials":warmup_trials,"measured_trials":measured_trials,"software":reproducibility_metadata()},
      "metrics":{"Recall@5":statistics.mean(recalls) if recalls else None,"MRR@5":statistics.mean(mrrs) if mrrs else None,
                 "nDCG@5":statistics.mean(ndcgs) if ndcgs else None,"latency_ms_mean":statistics.mean(latencies) if latencies else None,
                 "latency_ms_median":statistics.median(latencies) if latencies else None,"scored_queries":len(recalls),"missing_label_queries":len(missing)},
      "missing_labels":missing,"invalid_mappings":invalid,"failed_queries":failures,"per_query":per_query}


def validate_fair_comparison(configurations: list[dict]) -> None:
    """Only chunking_strategy may vary across an advertised fair strategy comparison."""
    if not configurations: raise ValueError("at least one configuration is required")
    baseline={k:v for k,v in configurations[0].items() if k!="chunking_strategy"}
    for config in configurations[1:]:
        if {k:v for k,v in config.items() if k!="chunking_strategy"} != baseline:
            raise ValueError("fair comparisons must keep dataset, retrieval, model, and graph configuration identical")
