# SmartChunk backend

SmartChunk ingests PDF, TXT, and Markdown into provenance-bearing chunks, validates chunk quality, persists graph/retrieval data in SQLite, and exposes FastAPI search, evaluation, evidence-grounded chat, and bounded research endpoints. This repository does not contain the frontend.

## Install and run

Use the supplied virtual environment/dependency lock, then create a local `.env` from `.env.example`. `.env` is ignored and must never be returned by the API. Set both `GEMINI_API_KEY` and a Gemini model identifier supported by your account in `GEMINI_MODEL`.

```powershell
.\.venv\Scripts\python.exe -m uvicorn smartchunk.api:app --reload
```

The relevant installed dependencies are `langchain-core==1.7.0`, `langchain-google-genai==4.4.2`, and `langgraph==1.2.17`.

## Evidence chatbot

`POST /chat` accepts the regular retrieval controls plus `question` and `max_context_tokens`. It returns `answer`, verified chunk citations, retrieval metadata, `abstained`, `uncertainty`, and a conservative conflicting-evidence flag. Citation IDs emitted by Gemini must be from the retrieved, permitted evidence; an unknown citation or an uncited non-abstaining answer is converted to an abstention.

```json
{"question":"What does the document say?","access":["team-a"],"mode":"keyword","top_k":5}
```

If there is no permitted evidence, the response abstains. Retrieved text is untrusted: the Gemini system message tells the model to treat embedded instructions as data and the backend supplies no document-controlled tools.

## Research assistant

`POST /agent/tasks` takes the chat schema plus optional limits:

```json
{"question":"Summarize the evidence","access":["team-a"],"limits":{"max_steps":12,"max_tool_calls":8,"max_subquestions":3,"max_retrieval_retries":1,"max_duration_seconds":20,"max_context_tokens":1500}}
```

Fetch its in-memory result with `GET /agent/tasks/{task_id}`. Tasks are intentionally not persisted. The typed LangGraph workflow is: validate → plan → retrieve → inspect relationships → assess coverage → bounded retry → synthesize → validate citations. Its allowlisted capabilities are document search, chunk context, relationship inspection, and evidence assessment. It has no shell, filesystem, Python execution, web, secret, or document-mutation capability. Caller access labels filter retrieval; they are metadata and are not authentication or production authorization.

LangChain owns Gemini invocation and prompt construction; LangGraph owns the bounded state-machine orchestration. Provider configuration errors, timeouts, and malformed model JSON produce safe failures/abstentions without logging keys or document text.

## Tests and optional smoke test

Tests use mocked providers and never call Gemini:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m compileall -q smartchunk scripts
.\.venv\Scripts\python.exe scripts\run_local_smoke.py
```

The local smoke script uses an injected mock provider and a temporary SQLite database; it makes no Gemini or network request. For an optional manual smoke test only after setting `.env` in your shell, upload a small permitted document and `POST /chat`; this can consume Gemini API credits. No live request is made automatically. Current limitations: tasks run synchronously and remain only in process memory; there is no user authentication, background queue, or semantic relationship inference. Agent task status is a process-wide, UUID-capability lookup: without authentication, anyone who obtains a task ID can read its result. Retrieval access labels are still applied during task execution, but they are caller-provided metadata rather than identity-backed authorization.
