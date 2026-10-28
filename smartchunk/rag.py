from __future__ import annotations
from .ai import AIProvider

def chat(question: str, rows: list[dict], metadata: dict, provider: AIProvider, max_tokens: int = 1000) -> dict:
    evidence=[]; used=0
    for row in rows:
        text=row.get("text", ""); count=len(text.split())
        if used+count > max_tokens: break
        used += count; p=row.get("source_provenance", {})
        evidence.append({"chunk_id":row["chunk_id"],"document_id":row["document_id"],"text":text,"page":p.get("page"),"section_id":p.get("section_id")})
    if not evidence: return {"answer":"I cannot answer from the permitted evidence.","citations":[],"abstained":True,"uncertainty":"insufficient evidence","retrieval":metadata,"conflicting_evidence":False}
    draft=provider.answer(question,evidence); citations=draft.get("citations",[]); valid={e["chunk_id"] for e in evidence}
    if not isinstance(draft, dict) or not isinstance(citations,list) or any(not isinstance(c, str) or c not in valid for c in citations):
        return {"answer":"I cannot provide a verified cited answer.","citations":[],"abstained":True,"uncertainty":"invalid model citations","retrieval":metadata}
    abstained=bool(draft.get("abstained",False))
    if not abstained and not citations:
        return {"answer":"I cannot provide a verified cited answer.","citations":[],"abstained":True,"uncertainty":"answer lacked evidence citations","retrieval":metadata,"conflicting_evidence":False}
    texts=" ".join(item["text"].lower() for item in evidence)
    conflict=(" not " in f" {texts} " and len(evidence) > 1)
    return {"answer":str(draft.get("answer", "")),"citations":[e for e in evidence if e["chunk_id"] in citations],"abstained":abstained,"uncertainty":draft.get("uncertainty","model output"),"retrieval":metadata,"conflicting_evidence":conflict}
