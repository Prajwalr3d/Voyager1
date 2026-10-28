"""Versioned benchmark contract and stable source-span evidence mapping."""
from __future__ import annotations

import json
import hashlib
from pathlib import Path
from typing import Any

from .ingest import canonical_source_text


class DatasetValidationError(ValueError): pass


REQUIRED_QUERY_FIELDS={"query_id","query","source_documents"}
REQUIRED_SOURCE_FIELDS={"document_id","path","source_url","license","source_sha256","canonical_text_sha256","canonical_text_location"}
REQUIRED_VERIFICATION_FIELDS={"bibliographic","license_review","local_file_review","extraction_review","manual_review"}
ANNOTATION_REVIEW_STATUSES={"draft","reviewed","approved"}


def load_benchmark_jsonl(text: str) -> list[dict[str,Any]]:
    rows=[]
    for line_number,line in enumerate(text.splitlines(),1):
        if not line.strip(): continue
        try: row=json.loads(line)
        except json.JSONDecodeError as exc: raise DatasetValidationError(f"line {line_number}: invalid JSON") from exc
        missing=REQUIRED_QUERY_FIELDS-set(row)
        if missing: raise DatasetValidationError(f"line {line_number}: missing {sorted(missing)}")
        if not isinstance(row["source_documents"],list) or not row["source_documents"]: raise DatasetValidationError(f"line {line_number}: source_documents must be non-empty")
        if not row["query_id"] or not row["query"]: raise DatasetValidationError(f"line {line_number}: query_id and query must be non-empty")
        for key in ("expected_answer","answer_criteria"):
            if key in row and (not isinstance(row[key],str) or not row[key].strip()):
                raise DatasetValidationError(f"line {line_number}: {key} must be a non-empty string when supplied")
        fingerprints=row.get("source_fingerprints")
        if fingerprints is not None:
            if not isinstance(fingerprints,dict): raise DatasetValidationError(f"line {line_number}: source_fingerprints must be an object")
            for document_id, value in fingerprints.items():
                if not isinstance(document_id,str) or not isinstance(value,dict): raise DatasetValidationError(f"line {line_number}: invalid source fingerprint")
                for key in ("source_sha256","canonical_text_sha256"):
                    digest=value.get(key)
                    if not isinstance(digest,str) or len(digest)!=64 or any(char not in "0123456789abcdef" for char in digest.lower()):
                        raise DatasetValidationError(f"line {line_number}: invalid {key} in source_fingerprints")
        review=row.get("review")
        if review is not None:
            if not isinstance(review,dict) or not all(isinstance(review.get(key),str) and review[key].strip() for key in ("reviewer_id","status","review_notes","reviewed_at")):
                raise DatasetValidationError(f"line {line_number}: review must contain reviewer_id/status/review_notes/reviewed_at")
            if review["status"].lower() not in ANNOTATION_REVIEW_STATUSES:
                raise DatasetValidationError(f"line {line_number}: invalid review status")
        evidence=row.get("evidence")
        if evidence is not None:
            if not isinstance(evidence,list): raise DatasetValidationError(f"line {line_number}: evidence must be a list")
            for item in evidence:
                if not isinstance(item,dict) or not {"document_id","char_start","char_end"} <= set(item):
                    raise DatasetValidationError(f"line {line_number}: evidence must use document_id/char_start/char_end")
                if not isinstance(item["char_start"],int) or not isinstance(item["char_end"],int) or item["char_start"] >= item["char_end"]:
                    raise DatasetValidationError(f"line {line_number}: invalid evidence span")
        if row.get("split") not in {None,"development","evaluation"}: raise DatasetValidationError(f"line {line_number}: split must be development or evaluation")
        rows.append(row)
    if len({r['query_id'] for r in rows}) != len(rows): raise DatasetValidationError("query_id values must be unique")
    return rows


def map_evidence(rows: list[dict], evidence: list[dict]) -> tuple[dict[str,float] | None,str | None]:
    """Maps human-labelled source spans to any overlapping retrieved chunk span.

    Returns (labels, reason). A missing source span is invalid rather than scored as irrelevant.
    """
    labels={}
    for row in rows:
        provenance=row.get("source_provenance") or {}
        start,end=provenance.get("char_start"),provenance.get("char_end")
        if not isinstance(start,int) or not isinstance(end,int) or start >= end:
            return None,f"chunk {row.get('chunk_id')} has no valid source span"
        for item in evidence:
            if row.get("document_id") != item["document_id"]: continue
            if start < item["char_end"] and item["char_start"] < end:
                labels[row["chunk_id"]]=max(labels.get(row["chunk_id"],0.0),float(item.get("grade",1)))
    return labels,None


def validate_leakage(records: list[dict]) -> None:
    """A query must be explicitly assigned a split when both dev and evaluation questions exist."""
    splits={r.get("split") for r in records}
    if "development" in splits and "evaluation" in splits and None in splits:
        raise DatasetValidationError("mixed development/evaluation datasets require a split for every query")
    by_question={}
    for row in records:
        split=row.get("split")
        if split not in {"development","evaluation"}: continue
        normalized=" ".join(str(row.get("query","")).casefold().split())
        previous=by_question.get(normalized)
        if previous is not None and previous != split:
            raise DatasetValidationError("the same question cannot appear in both development and evaluation")
        by_question[normalized]=split


def load_source_manifest_jsonl(text: str) -> list[dict[str, Any]]:
    """Validate provenance records without opening paths or downloading any source."""
    records=[]
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip(): continue
        try: row=json.loads(line)
        except json.JSONDecodeError as exc: raise DatasetValidationError(f"source line {line_number}: invalid JSON") from exc
        missing=REQUIRED_SOURCE_FIELDS-set(row)
        if missing: raise DatasetValidationError(f"source line {line_number}: missing {sorted(missing)}")
        if not all(isinstance(row[key], str) and row[key].strip() for key in REQUIRED_SOURCE_FIELDS):
            raise DatasetValidationError(f"source line {line_number}: required fields must be non-empty strings")
        for key in ("source_sha256", "canonical_text_sha256"):
            if len(row[key]) != 64 or any(char not in "0123456789abcdef" for char in row[key].lower()):
                raise DatasetValidationError(f"source line {line_number}: {key} must be a SHA-256 hex digest")
        records.append(row)
    if not records: raise DatasetValidationError("source manifest must contain at least one record")
    if len({row["document_id"] for row in records}) != len(records): raise DatasetValidationError("source manifest document_id values must be unique")
    return records


def validate_production_source_reviews(sources: list[dict[str, Any]]) -> None:
    """Require auditable human evidence before a source may enter a production benchmark.

    This deliberately does not verify a publisher URL over the network. It requires the
    reviewer to record the evidence and binds local-file evidence to the verified hashes.
    """
    for source in sources:
        if source["document_id"].startswith("TEMPLATE_ONLY_"):
            raise DatasetValidationError(f"source {source['document_id']}: template records cannot be production sources")
        verification=source.get("verification")
        if not isinstance(verification, dict) or REQUIRED_VERIFICATION_FIELDS-set(verification):
            raise DatasetValidationError(f"source {source['document_id']}: missing production verification evidence")
        for field in REQUIRED_VERIFICATION_FIELDS:
            value=verification[field]
            if not isinstance(value, dict) or not all(isinstance(item, str) and item.strip() for item in value.values()):
                raise DatasetValidationError(f"source {source['document_id']}: {field} must contain non-empty evidence fields")
        bibliographic=verification["bibliographic"]
        license_review=verification["license_review"]
        file_review=verification["local_file_review"]
        extraction=verification["extraction_review"]
        manual=verification["manual_review"]
        required={
            "bibliographic": {"title", "canonical_url", "reviewed_by", "reviewed_at"},
            "license_review": {"rights_basis", "evidence_url", "reviewed_by", "reviewed_at"},
            "local_file_review": {"source_sha256", "reviewed_by", "reviewed_at"},
            "extraction_review": {"parser", "parser_version", "diagnostics", "reviewed_by", "reviewed_at"},
            "manual_review": {"status", "reviewed_by", "reviewed_at"},
        }
        values={"bibliographic":bibliographic,"license_review":license_review,"local_file_review":file_review,
                "extraction_review":extraction,"manual_review":manual}
        for name, keys in required.items():
            if not keys <= set(values[name]):
                raise DatasetValidationError(f"source {source['document_id']}: {name} is incomplete")
        if bibliographic["canonical_url"] != source["source_url"]:
            raise DatasetValidationError(f"source {source['document_id']}: bibliographic canonical_url must match source_url")
        if file_review["source_sha256"].lower() != source["source_sha256"].lower():
            raise DatasetValidationError(f"source {source['document_id']}: local-file review hash does not match source_sha256")
        if manual["status"].lower() != "approved":
            raise DatasetValidationError(f"source {source['document_id']}: manual_review status must be approved")


def validate_production_annotation_review(case: dict[str, Any], sources: dict[str, dict[str, Any]]) -> None:
    """Bind an approved human annotation to the exact reviewed source/parser bytes."""
    if not any(isinstance(case.get(key),str) and case[key].strip() for key in ("expected_answer","answer_criteria")):
        raise DatasetValidationError(f"query {case['query_id']}: production annotations need expected_answer or answer_criteria")
    review=case.get("review")
    review_fields=("reviewer_id","status","review_notes","reviewed_at")
    if not isinstance(review,dict) or not all(isinstance(review.get(key),str) and review[key].strip() for key in review_fields):
        raise DatasetValidationError(f"query {case['query_id']}: production annotation review needs reviewer_id/status/review_notes/reviewed_at")
    if review["status"].lower() != "approved":
        raise DatasetValidationError(f"query {case['query_id']}: production annotation review status must be approved")
    normalized_notes=" ".join(review["review_notes"].casefold().split())
    if len(normalized_notes)<12 or normalized_notes in {"n/a","na","none","tbd","approved","reviewed"}:
        raise DatasetValidationError(f"query {case['query_id']}: production annotation review_notes must record a meaningful review finding")
    fingerprints=case.get("source_fingerprints")
    if not isinstance(fingerprints,dict): raise DatasetValidationError(f"query {case['query_id']}: production annotations need source_fingerprints")
    allowed=set(case["source_documents"])
    if set(fingerprints) != allowed: raise DatasetValidationError(f"query {case['query_id']}: source_fingerprints must match source_documents")
    for document_id in allowed:
        fingerprint=fingerprints[document_id]; source=sources[document_id]
        if not isinstance(fingerprint,dict) or any(not isinstance(fingerprint.get(key),str) for key in ("source_sha256","canonical_text_sha256")):
            raise DatasetValidationError(f"query {case['query_id']}: invalid source fingerprint")
        if fingerprint["source_sha256"].lower()!=source["source_sha256"].lower() or fingerprint["canonical_text_sha256"].lower()!=source["canonical_text_sha256"].lower():
            raise DatasetValidationError(f"query {case['query_id']}: source fingerprint does not match manifest")
    if case.get("answerability")=="answerable" and not case.get("evidence"):
        raise DatasetValidationError(f"query {case['query_id']}: answerable production annotations need evidence")


def validate_benchmark_bundle(cases: list[dict[str, Any]], sources: list[dict[str, Any]], *, base_dir: str | Path = ".",
                              production: bool = False) -> dict[str, Any]:
    """Offline validation of labels, source fingerprints, and parser-relative spans."""
    validate_leakage(cases)
    if production: validate_production_source_reviews(sources)
    root=Path(base_dir); by_id={item["document_id"]: item for item in sources}; lengths={}
    for item in sources:
        path=(root / item["path"]).resolve()
        if not path.is_file(): raise DatasetValidationError(f"source {item['document_id']}: path does not exist: {item['path']}")
        content=path.read_bytes()
        if hashlib.sha256(content).hexdigest() != item["source_sha256"]:
            raise DatasetValidationError(f"source {item['document_id']}: source_sha256 does not match path")
        text=canonical_source_text(content, path.name)
        if hashlib.sha256(text.encode("utf-8")).hexdigest() != item["canonical_text_sha256"]:
            raise DatasetValidationError(f"source {item['document_id']}: canonical_text_sha256 does not match parser output")
        lengths[item["document_id"]]=len(text)
    missing_labels=[]
    for case in cases:
        if production and case["query_id"].startswith("TEMPLATE_ONLY_"):
            raise DatasetValidationError(f"query {case['query_id']}: template records cannot be production annotations")
        if case.get("answerability") not in {"answerable", "abstain"}:
            raise DatasetValidationError(f"query {case['query_id']}: answerability must be answerable or abstain")
        if case.get("split") not in {"development", "evaluation"}:
            raise DatasetValidationError(f"query {case['query_id']}: split is required")
        unknown=set(case["source_documents"])-set(by_id)
        if unknown: raise DatasetValidationError(f"query {case['query_id']}: unknown source documents {sorted(unknown)}")
        if production: validate_production_annotation_review(case,by_id)
        evidence=case.get("evidence")
        if evidence is None:
            missing_labels.append(case["query_id"]); continue
        for span in evidence:
            document_id=span["document_id"]
            if document_id not in case["source_documents"]: raise DatasetValidationError(f"query {case['query_id']}: evidence outside document scope")
            if document_id not in lengths or span["char_end"] > lengths[document_id]:
                raise DatasetValidationError(f"query {case['query_id']}: evidence span is outside canonical text")
            if "grade" in span and (not isinstance(span["grade"], (int, float)) or span["grade"] < 0):
                raise DatasetValidationError(f"query {case['query_id']}: evidence grade must be non-negative")
    if missing_labels: raise DatasetValidationError(f"missing evidence labels for query_id values: {missing_labels}")
    return {"sources": len(sources), "queries": len(cases), "canonical_text_lengths": lengths}


def reproducibility_metadata() -> dict[str,str]:
    import platform, sys, sqlite3
    import networkx, pydantic
    return {"python":sys.version.split()[0],"platform":platform.platform(),"sqlite":sqlite3.sqlite_version,
            "networkx":networkx.__version__,"pydantic":pydantic.__version__}
