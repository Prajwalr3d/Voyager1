from __future__ import annotations

import hashlib
import json
import sqlite3
from collections import deque
from pathlib import Path
from typing import Any, Iterable

import networkx as nx

from .models import DocumentInput


NODE_TYPES = {"Document", "Section", "Chunk", "Equation", "Table", "Definition", "Citation", "Header"}


def stable_id(kind: str, document_id: str, local_id: str) -> str:
    """Stable, collision-resistant public ID; input IDs remain visible in its suffix."""
    digest = hashlib.sha256(f"{kind}:{document_id}:{local_id}".encode()).hexdigest()[:16]
    return f"{kind.lower()}:{digest}:{local_id}"


class RelationshipGraph:
    """NetworkX working graph backed by portable SQLite records."""

    def __init__(self, sqlite_path: str | Path = "smartchunk_graph.sqlite3"):
        self.path = str(sqlite_path)
        self.g = nx.MultiDiGraph()
        self._init_db()
        self.load()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as db:
            db.executescript("""
            CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, attrs TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS edges (
              id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL,
              relation TEXT NOT NULL, attrs TEXT NOT NULL
            );
            """)

    def load(self) -> None:
        self.g.clear()
        with self._connect() as db:
            for row in db.execute("SELECT * FROM nodes"):
                self.g.add_node(row["id"], **json.loads(row["attrs"]))
            for row in db.execute("SELECT * FROM edges"):
                self.g.add_edge(row["source_id"], row["target_id"], key=row["id"], **json.loads(row["attrs"]))

    def _node(self, node_id: str, kind: str, **attrs: Any) -> None:
        if kind not in NODE_TYPES:
            raise ValueError(f"unsupported node kind: {kind}")
        attrs = {"kind": kind, "id": node_id, **attrs}
        self.g.add_node(node_id, **attrs)

    def _edge(self, source: str, target: str, relation: str, *, source_kind: str,
              evidence: str, confidence: float = 1.0, inferred: bool = False) -> None:
        # The deterministic hash also makes repeated rebuilds idempotent.
        edge_id = hashlib.sha256(f"{source}|{target}|{relation}|{evidence}".encode()).hexdigest()
        self.g.add_edge(source, target, key=edge_id, id=edge_id, relation=relation,
                        source=source_kind, evidence=evidence, confidence=confidence, inferred=inferred)

    def add_document(self, payload: DocumentInput | dict[str, Any], persist: bool = True) -> None:
        doc = payload if isinstance(payload, DocumentInput) else DocumentInput.model_validate(payload)
        did = stable_id("Document", doc.id, doc.id)
        self._node(did, "Document", external_id=doc.id, text=doc.title, access=doc.access,
                   source_uri=doc.source_uri, provenance={"document_id": doc.id})
        ids: dict[str, str] = {}

        def add_entities(items: Iterable[Any], kind: str) -> None:
            for item in items:
                nid = stable_id(kind, doc.id, item.id)
                ids[item.id] = nid
                self._node(nid, kind, external_id=item.id, document_id=doc.id, text=item.text,
                           ordinal=item.ordinal, access=getattr(item, "access", doc.access),
                           indexable=getattr(item, "indexable", True), quality_status=getattr(item, "quality_status", "PASS"),
                           diagnostics=getattr(item, "diagnostics", []),
                           provenance={"source": item.source, **item.provenance})
                self._edge(did, nid, "CONTAINS", source_kind="parser_structure",
                           evidence=f"{kind} {item.id} supplied by parser", confidence=1.0)

        add_entities(doc.sections, "Section")
        add_entities(doc.chunks, "Chunk")
        add_entities(doc.equations, "Equation")
        add_entities(doc.tables, "Table")
        add_entities(doc.definitions, "Definition")
        add_entities(doc.citations, "Citation")
        for section in doc.sections:
            sid = ids[section.id]
            if section.header:
                hid = stable_id("Header", doc.id, section.id)
                self._node(hid, "Header", document_id=doc.id, text=section.header, access=doc.access,
                           provenance={"source": section.source})
                self._edge(sid, hid, "HAS_HEADER", source_kind="parser_structure", evidence=section.header)
        for chunk in doc.chunks:
            cid = ids[chunk.id]
            if chunk.section_id and chunk.section_id in ids:
                self._edge(ids[chunk.section_id], cid, "CONTAINS", source_kind="parser_structure",
                           evidence=f"chunk.section_id={chunk.section_id}")
            for citation_id in chunk.references:
                if citation_id in ids:
                    self._edge(cid, ids[citation_id], "REFERENCES", source_kind="explicit_reference",
                               evidence=f"chunk.references contains {citation_id}")
        for items in (doc.equations, doc.tables, doc.definitions):
            for item in items:
                if item.section_id and item.section_id in ids:
                    self._edge(ids[item.section_id], ids[item.id], "CONTAINS", source_kind="parser_structure",
                               evidence=f"entity.section_id={item.section_id}")
                if item.explained_by_chunk_id and item.explained_by_chunk_id in ids:
                    relation = "DEFINES" if items is doc.definitions else "EXPLAINED_BY"
                    self._edge(ids[item.id], ids[item.explained_by_chunk_id], relation,
                               source_kind="explicit_source_link", evidence=f"explained_by_chunk_id={item.explained_by_chunk_id}")
        ordered = sorted(doc.chunks, key=lambda x: (x.ordinal if x.ordinal is not None else 10**9, x.id))
        for left, right in zip(ordered, ordered[1:]):
            self._edge(ids[left.id], ids[right.id], "NEXT_CHUNK", source_kind="parser_structure",
                       evidence="adjacent parser chunk ordinals")
        if persist:
            with self._connect() as db:
                db.execute("INSERT OR REPLACE INTO documents VALUES (?, ?)", (doc.id, doc.model_dump_json()))
            self.persist_graph()

    def persist_graph(self) -> None:
        with self._connect() as db:
            db.execute("DELETE FROM nodes"); db.execute("DELETE FROM edges")
            db.executemany("INSERT INTO nodes VALUES (?, ?, ?)", [
                (node_id, data["kind"], json.dumps(data, sort_keys=True)) for node_id, data in self.g.nodes(data=True)])
            db.executemany("INSERT INTO edges VALUES (?, ?, ?, ?, ?)", [
                (data["id"], source, target, data["relation"], json.dumps(data, sort_keys=True))
                for source, target, _, data in self.g.edges(keys=True, data=True)])

    def rebuild(self) -> None:
        with self._connect() as db:
            payloads = [json.loads(r["payload"]) for r in db.execute("SELECT payload FROM documents ORDER BY id")]
        self.g.clear()
        for payload in payloads:
            self.add_document(payload, persist=False)
        self.persist_graph()

    @staticmethod
    def permitted(data: dict[str, Any], access: set[str]) -> bool:
        acl = set(data.get("access", ["public"]))
        return "public" in acl or bool(acl & access)

    def nearby(self, chunk_id: str, access: list[str], hops: int = 1, limit: int = 30) -> dict[str, Any]:
        start = self.resolve_chunk(chunk_id)
        if not start or not self.permitted(self.g.nodes[start], set(access)):
            return {"nodes": [], "relationships": []}
        seen, queue = {start}, deque([(start, 0)])
        while queue and len(seen) < limit:
            node, depth = queue.popleft()
            if depth >= hops: continue
            for neighbor in set(self.g.predecessors(node)) | set(self.g.successors(node)):
                if neighbor not in seen and self.permitted(self.g.nodes[neighbor], set(access)):
                    seen.add(neighbor); queue.append((neighbor, depth + 1))
                    if len(seen) >= limit: break
        edges = [dict(from_node=s, to_node=t, **data) for s, t, _, data in self.g.edges(keys=True, data=True)
                 if s in seen and t in seen]
        return {"nodes": [self.g.nodes[n] for n in sorted(seen)], "relationships": edges}

    def resolve_chunk(self, value: str) -> str | None:
        if value in self.g and self.g.nodes[value].get("kind") == "Chunk": return value
        return next((n for n, d in self.g.nodes(data=True) if d.get("kind") == "Chunk" and d.get("external_id") == value), None)
