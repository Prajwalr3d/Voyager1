from __future__ import annotations

import re
import time
from collections import deque

from .graph import RelationshipGraph


def token_count(text: str) -> int:
    return len(re.findall(r"\w+", text))


def _score(query: str, text: str) -> float:
    q, t = set(re.findall(r"\w+", query.lower())), set(re.findall(r"\w+", text.lower()))
    return len(q & t) / max(1, len(q))


def search(graph: RelationshipGraph, query: str, access: list[str], *, top_k: int = 5,
           expand_graph: bool = False, max_hops: int = 1, max_nodes: int = 10,
           max_added_tokens: int = 500) -> tuple[list[dict], dict]:
    """Lexical Phase-05-compatible baseline plus optional bounded graph context."""
    started = time.perf_counter(); acl = set(access)
    chunks = [(n, d) for n, d in graph.g.nodes(data=True)
              if d.get("kind") == "Chunk" and d.get("indexable", True) and graph.permitted(d, acl)]
    baseline = sorted(({"node": n, "chunk_id": d["external_id"], "document_id": d["document_id"],
                         "text": d.get("text", ""), "score": _score(query, d.get("text", "")), "graph_added": False,
                         "relationship_path": []} for n, d in chunks), key=lambda r: (-r["score"], r["chunk_id"]))[:top_k]
    if not expand_graph:
        return baseline, {"latency_ms": (time.perf_counter()-started)*1000, "added_tokens": 0, "added_nodes": 0}
    result, seen = list(baseline), {r["node"] for r in baseline}
    added_tokens = 0; added_nodes = 0; queue = deque((r["node"], 0, []) for r in baseline)
    while queue and added_nodes < max_nodes:
        node, depth, path = queue.popleft()
        if depth >= max_hops: continue
        for nxt in sorted(set(graph.g.predecessors(node)) | set(graph.g.successors(node))):
            if nxt in seen or not graph.permitted(graph.g.nodes[nxt], acl): continue
            # max_nodes covers every discovered graph node, not only chunks.
            if added_nodes >= max_nodes: break
            seen.add(nxt); added_nodes += 1; data = graph.g.nodes[nxt]; edge = path + [nxt]
            queue.append((nxt, depth+1, edge))
            if data.get("kind") != "Chunk": continue
            cost = token_count(data.get("text", ""))
            if added_tokens + cost > max_added_tokens: continue
            added_tokens += cost
            result.append({"node": nxt, "chunk_id": data["external_id"], "document_id": data["document_id"],
                           "text": data.get("text", ""), "score": _score(query, data.get("text", "")) - 0.01*(depth+1),
                           "graph_added": True, "relationship_path": edge})
    result.sort(key=lambda r: (-r["score"], r["chunk_id"]))
    return result[:top_k], {"latency_ms": (time.perf_counter()-started)*1000, "added_tokens": added_tokens,
                              "added_nodes": added_nodes}


def expand_ranked(graph: RelationshipGraph, ranked: list[dict], access: list[str], *, top_k: int,
                  max_hops: int, max_nodes: int, max_added_tokens: int) -> tuple[list[dict], dict]:
    """Apply the existing bounded traversal to candidates from any retrieval mode."""
    if not ranked: return [], {"added_nodes":0,"added_tokens":0}
    original=[dict(row) for row in ranked]; seed={row.get("node") for row in original}; added_tokens=0; added_nodes=0
    queue=deque((row["node"],0,[]) for row in original if row.get("node"))
    while queue and added_nodes < max_nodes:
        node,depth,path=queue.popleft()
        if depth>=max_hops: continue
        for nxt in sorted(set(graph.g.predecessors(node))|set(graph.g.successors(node))):
            if nxt in seed or not graph.permitted(graph.g.nodes[nxt],set(access)): continue
            if added_nodes >= max_nodes: break
            seed.add(nxt); added_nodes+=1; data=graph.g.nodes[nxt]; queue.append((nxt,depth+1,path+[nxt]))
            if data.get("kind")!="Chunk" or not data.get("indexable",True): continue
            cost=token_count(data.get("text",""))
            if added_tokens+cost>max_added_tokens: continue
            added_tokens+=cost; original.append({"node":nxt,"chunk_id":data["external_id"],"document_id":data["document_id"],"text":data.get("text",""),
                "score":-0.01*(depth+1),"ranking_method":"graph_context","graph_added":True,"relationship_path":path+[nxt]})
            if added_nodes>=max_nodes: break
    return sorted(original,key=lambda row:(-row["score"],row["chunk_id"]))[:top_k],{"added_nodes":added_nodes,"added_tokens":added_tokens}
