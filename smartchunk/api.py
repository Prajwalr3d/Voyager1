import re
import uuid
from pathlib import Path
from threading import Lock
from typing import Callable

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse

from .graph import RelationshipGraph
from .ingest import UnsupportedSource, ingest_bytes
from .embeddings import ModelUnavailable, default_adapter
from .evaluation import run_evaluation
from .export import export_jsonl
from .models import DocumentInput, EvaluationRequest, IngestOptions, SearchRequest, SearchResponse, SearchResult
from .models import AgentTaskRequest, AgentTaskResponse, ChatRequest, ChatResponse
from .quality import repair_and_validate
from .retrieval import expand_ranked, search
from .retrieval_index import PersistentRetrievalIndex, reciprocal_rank_fusion
from .ai import AIProvider, GeminiProvider, ProviderUnavailable
from .rag import chat
from .agent import ResearchAssistant


def create_app(db_path: str = "smartchunk_graph.sqlite3", provider_factory: Callable[[], AIProvider] | None = None) -> FastAPI:
    app = FastAPI(title="SmartChunk", version="0.6")
    graph = RelationshipGraph(db_path)
    index = PersistentRetrievalIndex(graph)
    index.sync_all()
    adapter = default_adapter()
    provider_factory = provider_factory or GeminiProvider
    tasks: dict[str, dict] = {}
    document_write_lock = Lock()

    def document_exists(document_id: str) -> bool:
        with graph._connect() as db:
            return db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone() is not None

    def perform_search(request: SearchRequest) -> tuple[list[dict], dict]:
        if not request.query.strip(): raise HTTPException(422,"query must not be empty")
        semantic_available=True
        try:
            if request.mode == "baseline":
                rows, meta=search(graph,request.query,request.access,top_k=request.top_k,expand_graph=False)
            elif request.mode == "keyword":
                rows=index.keyword(request.query,request.access,request.top_k); meta={}
            elif request.mode == "semantic":
                rows=index.semantic(request.query,request.access,adapter,request.top_k); meta={}
            else:
                keyword=index.keyword(request.query,request.access,request.top_k*3)
                try: semantic=index.semantic(request.query,request.access,adapter,request.top_k*3)
                except ModelUnavailable: semantic=[]; semantic_available=False
                rows=reciprocal_rank_fusion(keyword,semantic,k=request.rrf_k,limit=request.top_k); meta={}
        except ModelUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if request.graph:
            rows, graph_meta=expand_ranked(graph,rows,request.access,top_k=request.top_k,max_hops=request.max_hops,
                max_nodes=request.max_nodes,max_added_tokens=request.max_added_tokens)
            meta.update(graph_meta)
        meta.update({"mode":request.mode,"graph_enabled":request.graph,"top_k":request.top_k,"rrf_k":request.rrf_k,
                     "semantic_available":semantic_available,"fts5_available":index.fts_available})
        return rows,meta

    @app.post("/documents")
    def ingest(document: DocumentInput):
        with document_write_lock:
            if document_exists(document.id): raise HTTPException(409, "document_id already exists; replacement is not supported")
            graph.add_document(document)
            index.sync_document(document)
        return {"document_id": document.id, "nodes": graph.g.number_of_nodes(), "relationships": graph.g.number_of_edges()}

    @app.post("/documents/upload")
    async def upload_document(
        file: UploadFile = File(...),
        options: str = Form("{}"),
        document_id: str | None = Form(None),
        title: str | None = Form(None),
    ):
        """Parse PDF/TXT/Markdown, preserve provenance, chunk deterministically, then index it."""
        try:
            parsed_options = IngestOptions.model_validate_json(options)
        except Exception as exc:
            raise HTTPException(422, "options must be a JSON IngestOptions object") from exc
        content = await file.read()
        if not content: raise HTTPException(422, "uploaded file is empty")
        if len(content) > 20 * 1024 * 1024: raise HTTPException(413, "maximum upload size is 20 MiB")
        try:
            document = ingest_bytes(content, file.filename or "upload", parsed_options, document_id=document_id,
                                    title=title, content_type=file.content_type)
        except UnsupportedSource as exc:
            raise HTTPException(415, str(exc)) from exc
        except Exception as exc:
            raise HTTPException(422, f"could not parse source: {exc}") from exc
        document, report = repair_and_validate(document, max_words=parsed_options.chunk_size)
        with document_write_lock:
            if document_exists(document.id): raise HTTPException(409, "document_id already exists; replacement is not supported")
            graph.add_document(document)
            index.sync_document(document)
        return {"document_id": document.id, "chunks": len(document.chunks), "sections": len(document.sections),
                "source_sha256": document.chunks[0].provenance.get("source_sha256") if document.chunks else None,
                "quality": report.model_dump(mode="json")}

    @app.get("/documents/{document_id}/export.jsonl")
    def export_document(document_id: str):
        with graph._connect() as db:
            row=db.execute("SELECT payload FROM documents WHERE id=?",(document_id,)).fetchone()
        if not row: raise HTTPException(404,"document not found")
        document=DocumentInput.model_validate_json(row["payload"])
        filename=re.sub(r"[^A-Za-z0-9._-]","_",document_id) + ".jsonl"
        return Response(export_jsonl(document),media_type="application/x-ndjson; charset=utf-8",
                        headers={"Content-Disposition":f'attachment; filename="{filename}"'})

    @app.post("/graph/rebuild")
    def rebuild():
        graph.rebuild(); return {"nodes": graph.g.number_of_nodes(), "relationships": graph.g.number_of_edges()}

    @app.get("/chunks/{chunk_id}/relationships")
    def relationships(chunk_id: str, access: str = "public", hops: int = 1, limit: int = 30):
        result = graph.nearby(chunk_id, access.split(","), hops, limit)
        if not result["nodes"]: raise HTTPException(404, "chunk not found or not permitted")
        return result

    @app.post("/search", response_model=list[SearchResult])
    def graph_search(request: SearchRequest):
        rows, _ = perform_search(request)
        return rows

    @app.post("/search/detailed", response_model=SearchResponse)
    def detailed_search(request: SearchRequest):
        rows, metadata=perform_search(request)
        return {"results":rows,"retrieval":metadata}

    def get_provider() -> AIProvider:
        try:
            return provider_factory()
        except ProviderUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

    def chat_search(request: ChatRequest | dict) -> tuple[list[dict], dict]:
        if isinstance(request, dict):
            request = ChatRequest.model_validate(request)
        payload = SearchRequest(query=request.question, access=request.access, top_k=request.top_k, graph=request.graph,
                                max_hops=request.max_hops, max_nodes=request.max_nodes,
                                max_added_tokens=request.max_added_tokens, mode=request.mode, rrf_k=request.rrf_k)
        return perform_search(payload)

    @app.post("/chat", response_model=ChatResponse)
    def evidence_chat(request: ChatRequest):
        rows, metadata = chat_search(request)
        try:
            return chat(request.question, rows, metadata, get_provider(), max_tokens=request.max_context_tokens)
        except ProviderUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

    @app.post("/agent/tasks", response_model=AgentTaskResponse)
    def create_agent_task(request: AgentTaskRequest):
        task_id = str(uuid.uuid4())
        try:
            provider = get_provider()
            assistant = ResearchAssistant(provider, chat_search,
                lambda chunk_id, access, hops, limit: graph.nearby(chunk_id, access, hops, limit))
            state = assistant.run(request.model_dump(mode="python"), request.limits)
            result = state.get("result")
            if result is None:
                result = {"answer": "I cannot complete this research task.", "citations": [], "abstained": True,
                          "uncertainty": state.get("error", "workflow failed"), "retrieval": state.get("retrieval", {}),
                          "conflicting_evidence": False}
            record = {"task_id": task_id, "status": "completed", "result": result, "error": None}
        except (ProviderUnavailable, ValueError, RuntimeError) as exc:
            record = {"task_id": task_id, "status": "failed", "result": None, "error": str(exc)}
        tasks[task_id] = record
        return record

    @app.get("/agent/tasks/{task_id}", response_model=AgentTaskResponse)
    def get_agent_task(task_id: str):
        if task_id not in tasks: raise HTTPException(404, "task not found")
        return tasks[task_id]

    @app.get("/retrieval/status")
    def retrieval_status():
        return index.status(adapter)

    @app.post("/evaluations")
    def evaluate(request: EvaluationRequest):
        def retrieve(query: str, case: dict):
            effective=SearchRequest(query=query,access=case.get("access",request.access),top_k=request.top_k,mode=request.mode,graph=request.graph)
            return perform_search(effective)
        configuration={"dataset_id":request.dataset_id,"dataset_version":request.dataset_version,"chunking_strategy":request.chunking_strategy,
                       "retrieval_mode":request.mode,"top_k":request.top_k,"graph_enabled":request.graph,"embedding_model":adapter.model_id,
                       "embedding_configuration":adapter.config_id,
                       "chunk_count":sum(1 for _,d in graph.g.nodes(data=True) if d.get("kind")=="Chunk" and d.get("indexable",True)),
                       "token_count":sum(len((d.get("text") or "").split()) for _,d in graph.g.nodes(data=True) if d.get("kind")=="Chunk" and d.get("indexable",True)),
                       "quality_diagnostic_count":sum(len(d.get("diagnostics",[])) for _,d in graph.g.nodes(data=True) if d.get("kind")=="Chunk")}
        try: result=run_evaluation(request.cases,retrieve,configuration=configuration,warmup_trials=request.warmup_trials,measured_trials=request.measured_trials)
        except ValueError as exc: raise HTTPException(422,str(exc)) from exc
        with graph._connect() as db: db.execute("INSERT INTO evaluation_runs VALUES (?,?)",(result["run_id"],__import__('json').dumps(result)))
        return result

    @app.get("/evaluations/{run_id}")
    def get_evaluation(run_id: str):
        with graph._connect() as db: row=db.execute("SELECT payload FROM evaluation_runs WHERE run_id=?",(run_id,)).fetchone()
        if not row: raise HTTPException(404,"evaluation not found")
        return __import__('json').loads(row["payload"])

    @app.get("/evaluations/{run_id}/export.json")
    def export_evaluation(run_id: str):
        result=get_evaluation(run_id)
        return Response(__import__('json').dumps(result,ensure_ascii=False,sort_keys=True),media_type="application/json; charset=utf-8",
                        headers={"Content-Disposition":f'attachment; filename="evaluation-{run_id}.json"'})

    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    @app.get("/app")
    def serve_frontend():
        return FileResponse(frontend_dir / "index.html")

    return app


app = create_app()
