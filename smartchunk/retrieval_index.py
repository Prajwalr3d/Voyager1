"""Persistent FTS5 and embedding retrieval, kept independent of FastAPI and chunking."""
from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from datetime import datetime, timezone
from typing import Any

from .embeddings import EmbeddingAdapter, ModelUnavailable
from .graph import RelationshipGraph, stable_id
from .models import DocumentInput


def _hash(value: str) -> str: return hashlib.sha256(value.encode("utf-8")).hexdigest()


class PersistentRetrievalIndex:
    def __init__(self, graph: RelationshipGraph):
        self.graph=graph; self.fts_available=True; self._init()

    def _init(self) -> None:
        with self.graph._connect() as db:
            try:
                db.execute("CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(chunk_id UNINDEXED, document_id UNINDEXED, text)")
            except sqlite3.OperationalError:
                self.fts_available=False
            db.execute("""CREATE TABLE IF NOT EXISTS embedding_records (
                chunk_id TEXT NOT NULL, model_id TEXT NOT NULL, config_id TEXT NOT NULL, dimension INTEGER NOT NULL,
                content_hash TEXT NOT NULL, vector_json TEXT NOT NULL, created_at TEXT NOT NULL,
                PRIMARY KEY(chunk_id, model_id, config_id))""")
            db.execute("CREATE TABLE IF NOT EXISTS evaluation_runs (run_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")

    def sync_document(self, document: DocumentInput) -> int:
        """Replace an individual document's FTS rows; only eligible chunks are indexed."""
        if not self.fts_available: return 0
        with self.graph._connect() as db:
            db.execute("DELETE FROM chunk_fts WHERE document_id=?",(document.id,))
            rows=[(stable_id("Chunk",document.id,chunk.id),document.id,chunk.text) for chunk in document.chunks if chunk.indexable]
            db.executemany("INSERT INTO chunk_fts(chunk_id,document_id,text) VALUES (?,?,?)",rows)
        return len(rows)

    def sync_all(self) -> int:
        total=0
        with self.graph._connect() as db: payloads=[row["payload"] for row in db.execute("SELECT payload FROM documents")]
        for payload in payloads: total += self.sync_document(DocumentInput.model_validate_json(payload))
        return total

    def _eligible(self, chunk_id: str, access: list[str]) -> tuple[str,dict] | None:
        node=self.graph.resolve_chunk(chunk_id)
        if not node: return None
        data=self.graph.g.nodes[node]
        if not data.get("indexable",True) or not self.graph.permitted(data,set(access)): return None
        return node,data

    @staticmethod
    def _query(query: str) -> str:
        terms=[]
        for term in query.split():
            cleaned="".join(c for c in term if c.isalnum() or c=="_")
            if cleaned: terms.append('"'+cleaned.replace('"','')+'"')
        if not terms: raise ValueError("query must contain searchable text")
        return " OR ".join(terms)

    def keyword(self, query: str, access: list[str], limit: int = 5) -> list[dict]:
        if not self.fts_available: raise RuntimeError("SQLite FTS5 is unavailable")
        if limit < 1: raise ValueError("limit must be positive")
        with self.graph._connect() as db:
            rows=db.execute("SELECT chunk_id, bm25(chunk_fts) AS rank FROM chunk_fts WHERE chunk_fts MATCH ? ORDER BY rank LIMIT ?",(self._query(query),limit*5)).fetchall()
        output=[]; seen=set()
        for row in rows:
            found=self._eligible(row["chunk_id"],access)
            if not found or row["chunk_id"] in seen: continue
            node,data=found; seen.add(row["chunk_id"])
            output.append({"node":node,"chunk_id":data["external_id"],"document_id":data["document_id"],"text":data.get("text", ""),
                           "score":-float(row["rank"]),"ranking_method":"fts5_bm25","source_provenance":data.get("provenance",{}),"graph_added":False,"relationship_path":[]})
            if len(output)>=limit: break
        return output

    def ensure_embeddings(self, adapter: EmbeddingAdapter) -> dict[str,int]:
        targets=[]
        for node,data in self.graph.g.nodes(data=True):
            if data.get("kind")!="Chunk" or not data.get("indexable",True): continue
            content_hash=_hash(data.get("text",""))
            with self.graph._connect() as db:
                row=db.execute("SELECT dimension,content_hash FROM embedding_records WHERE chunk_id=? AND model_id=? AND config_id=?",(node,adapter.model_id,adapter.config_id)).fetchone()
            if row and row["content_hash"]==content_hash and row["dimension"]==adapter.dimension and adapter.dimension:
                continue
            targets.append((node,data.get("text",""),content_hash))
        if not targets: return {"created":0,"reused":sum(1 for _,d in self.graph.g.nodes(data=True) if d.get("kind")=="Chunk" and d.get("indexable",True))}
        vectors=adapter.embed([text for _,text,_ in targets])
        if len(vectors)!=len(targets) or not vectors: raise RuntimeError("embedding adapter returned an invalid vector count")
        dimension=len(vectors[0])
        if any(len(v)!=dimension for v in vectors): raise RuntimeError("embedding adapter returned inconsistent dimensions")
        if adapter.dimension and adapter.dimension != dimension: raise RuntimeError("embedding adapter dimension mismatch")
        adapter.dimension=dimension
        with self.graph._connect() as db:
            for (chunk_id,_,content_hash),vector in zip(targets,vectors):
                db.execute("INSERT OR REPLACE INTO embedding_records VALUES (?,?,?,?,?,?,?)",(chunk_id,adapter.model_id,adapter.config_id,dimension,content_hash,json.dumps(vector),datetime.now(timezone.utc).isoformat()))
        return {"created":len(targets),"reused":0}

    def semantic(self, query: str, access: list[str], adapter: EmbeddingAdapter, limit: int = 5) -> list[dict]:
        if not query.strip(): raise ValueError("query must not be empty")
        self.ensure_embeddings(adapter)
        vector=adapter.embed([query])[0]
        with self.graph._connect() as db:
            rows=db.execute("SELECT chunk_id,dimension,vector_json FROM embedding_records WHERE model_id=? AND config_id=?",(adapter.model_id,adapter.config_id)).fetchall()
        output=[]
        for row in rows:
            if row["dimension"] != len(vector): raise RuntimeError("persisted embedding dimension is incompatible with query model")
            found=self._eligible(row["chunk_id"],access)
            if not found: continue
            stored=json.loads(row["vector_json"]); score=sum(a*b for a,b in zip(vector,stored))
            node,data=found
            output.append({"node":node,"chunk_id":data["external_id"],"document_id":data["document_id"],"text":data.get("text",""),"score":score,
              "ranking_method":"cosine_embedding","source_provenance":data.get("provenance",{}),"graph_added":False,"relationship_path":[]})
        return sorted(output,key=lambda item:(-item["score"],item["chunk_id"]))[:limit]

    def status(self, adapter: EmbeddingAdapter | None = None) -> dict[str,Any]:
        with self.graph._connect() as db: count=db.execute("SELECT COUNT(*) AS n FROM embedding_records").fetchone()["n"]
        result={"fts5_available":self.fts_available,"embedding_records":count}
        if adapter:
            result.update({"model_id":adapter.model_id,"configuration":adapter.config_id,"dimension":adapter.dimension})
            try: adapter.embed(["status"]); result["semantic_available"]=True
            except ModelUnavailable: result["semantic_available"]=False
        return result


def reciprocal_rank_fusion(*rankings: list[dict], k: int = 60, limit: int = 5) -> list[dict]:
    if k < 1: raise ValueError("rrf k must be positive")
    merged: dict[str,dict]={}; scores: dict[str,float]={}
    for ranking in rankings:
        for position,row in enumerate(ranking,1):
            key=row["chunk_id"]; scores[key]=scores.get(key,0)+1/(k+position); merged.setdefault(key,dict(row))
    for key,row in merged.items(): row["score"]=scores[key]; row["ranking_method"]="rrf"
    return sorted(merged.values(),key=lambda row:(-row["score"],row["chunk_id"]))[:limit]
