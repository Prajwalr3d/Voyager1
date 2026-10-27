# SmartChunk — Backend Integration Contract & Developer Handoff

**Project:** SmartChunk — Structure-Aware RAG Chunking (Graphite 26 / Problem Statement 8)  
**Target Backend Framework:** Python 3.11+ / FastAPI  
**Primary Databases:** PostgreSQL 16 with `pgvector` & Qdrant Vector Database (v1.12+)  
**Frontend Client:** React 18, TypeScript, Tailwind CSS, Vite  
**API Specification Version:** `v2.4.0`  
**Base URL:** `http://localhost:8000` (Configurable via `VITE_API_BASE_URL`)

---

## 1. Architectural Overview & System Topology

SmartChunk replaces naive token-window chunking with an AST-driven structural parser tailored for scientific and technical documents (Markdown prioritized, plus LaTeX-heavy PDFs and plain text). The platform ensures that equations, tables, code blocks, and section hierarchies remain intact, verified by a multi-stage Quality Gate and deduplicated before vector indexing.

```
                      ┌───────────────────────────────────────┐
                      │    React 18 Frontend (Vite, Port 3000) │
                      └──────────────────┬────────────────────┘
                                         │ JSON REST API
                                         ▼
                      ┌───────────────────────────────────────┐
                      │    FastAPI Application (Port 8000)     │
                      └───────┬──────────────┬──────────────┬─┘
                              │              │              │
       SQL Relational State   │              │ Dense Vector │ Graph Traversal
       (Docs, Chunks, AST)    │              │ (3072 dims)  │ (BFS Multi-Hop)
                              ▼              ▼              ▼
                     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                     │ PostgreSQL 16│ │ Qdrant Vector│ │ Topological  │
                     │  (pgvector)  │ │   Database   │ │ Dependency   │
                     │  Port 5432   │ │  Port 6333   │ │ Graph Engine │
                     └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 2. Centralized Frontend API Client Architecture

All network traffic from the frontend passes through the unified client located at:
`src/services/apiClient.ts`

### Request Conventions:
- **Default Timeout:** 15,000 ms (configurable per request)
- **Content-Type:** `application/json` (automatically omitted when sending `FormData` for multipart file uploads)
- **Accept:** `application/json`
- **CORS:** Backend must allow `GET, POST, PUT, DELETE, OPTIONS` with `Access-Control-Allow-Origin: *` or `http://localhost:3000`.

### Standard Error Envelope:
When an endpoint encounters an error, it MUST return an HTTP 4xx or 5xx code with a JSON payload conforming to:
```json
{
  "detail": "Human-readable explanation of error or validation failure",
  "error_code": "ERR_AST_EQUATION_SPLIT",
  "status_code": 422,
  "context": {
    "document_id": "doc-vaswani-2017",
    "version_id": "ver-vaswani-v2"
  }
}
```
The frontend wraps this response into a JavaScript `ApiError` instance with `.status` and `.data` fields.

---

## 3. Complete API Endpoint Catalog

### 3.1. System Health & Infrastructure Probe
- **Method & Path:** `GET /api/v1/health`
- **Description:** Verifies service health, database connectivity, active embedding model, and vector store engine.
- **Query Parameters:** None
- **Response (200 OK):**
```json
{
  "status": "online",
  "version": "v2.4.0",
  "embedding_model": "text-embedding-3-large (3072 dims)",
  "vector_store": "PostgreSQL (pgvector / HNSW) + Qdrant",
  "api_latency_ms": 12,
  "is_demo_mode": false,
  "timestamp": "2026-10-27T19:30:00Z",
  "services": {
    "database": "online",
    "vector_index": "online",
    "parser_worker": "online"
  }
}
```

---

### 3.2. Document Upload & Corpus Management

#### `POST /api/v1/documents`
- **Description:** Upload a Markdown (`.md`), Plaintext (`.txt`), or PDF file to create a new document in the corpus.
- **Request:** `multipart/form-data`
  - `file`: Binary file stream
  - `title` *(optional)*: String
  - `domain` *(optional)*: String (e.g. "Computer Science / NLP")
  - `arxiv_id` *(optional)*: String (e.g. "1706.03762")
- **Response (201 Created):**
```json
{
  "id": "doc-attention-2017",
  "name": "Attention Is All You Need",
  "filename": "vaswani_2017.md",
  "file_type": "markdown",
  "size_bytes": 142580,
  "page_count": 15,
  "uploaded_at": "2026-10-27T19:35:00Z",
  "status": "processing",
  "chunk_count": 0,
  "quality_status": "pass",
  "active_version_id": "ver-vaswani-v1",
  "active_version_tag": "v1.0.0",
  "versions_count": 1,
  "metadata": {
    "title": "Attention Is All You Need",
    "domain": "Natural Language Processing",
    "arxiv_id": "1706.03762"
  }
}
```

#### `GET /api/v1/documents`
- **Description:** Lists all corpus documents with pagination, sorting, and format filtering.
- **Query Parameters:**
  - `type` *(optional)*: `all | markdown | pdf | txt`
  - `status` *(optional)*: `all | completed | processing | queued | failed`
  - `sort_by` *(optional)*: `newest | oldest | name_asc | name_desc | chunks | size`
  - `search` *(optional)*: String
  - `page` *(optional, default 1)*: Integer
  - `limit` *(optional, default 50)*: Integer
- **Response (200 OK):** Array of `Document` objects.

#### `GET /api/v1/documents/{document_id}`
- **Description:** Returns single document metadata, active version, and extracted block counts.

#### `DELETE /api/v1/documents/{document_id}`
- **Description:** Deletes a document, all associated versions, chunk embeddings, and graph relations.
- **Response (200 OK):** `{"deleted": true, "document_id": "doc-attention-2017"}`

#### `GET /api/v1/documents/{document_id}/blocks`
- **Description:** Returns extracted raw AST blocks (headings, paragraphs, equations, tables, code blocks).
- **Response (200 OK):** Array of `ExtractedBlock` objects:
```json
[
  {
    "id": "blk-001",
    "document_id": "doc-attention-2017",
    "type": "heading",
    "content": "3. Model Architecture",
    "page_number": 3,
    "order": 1,
    "level": 1
  },
  {
    "id": "blk-002",
    "document_id": "doc-attention-2017",
    "type": "equation",
    "content": "$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$",
    "page_number": 4,
    "order": 2,
    "latex": "\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V"
  }
]
```

---

### 3.3. Document Versioning & Provenance Management (Feature 1)

#### `GET /api/v1/documents/{document_id}/versions`
- **Description:** Fetches all historical and active versions of a document.
- **Response (200 OK):**
```json
[
  {
    "id": "ver-vaswani-v2",
    "document_id": "doc-vaswani-2017",
    "version_tag": "v2.0.0",
    "version_number": 2,
    "content_hash": "e9a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef",
    "created_at": "2026-10-25T09:30:00Z",
    "is_active": true,
    "change_summary": "NeurIPS 2017 camera-ready. Corrected variance denominator.",
    "chunk_count": 42,
    "page_count": 15,
    "quality_status": "pass",
    "raw_filename": "vaswani_2017_attention.pdf",
    "size_bytes": 2211840
  }
]
```

#### `POST /api/v1/documents/{document_id}/versions`
- **Description:** Upload a new revision of an existing document. Recomputes SHA-256 hash and isolates chunks.
- **Request:** `multipart/form-data` with `file`, `version_tag`, `change_summary`.

#### `POST /api/v1/documents/{document_id}/versions/{version_id}/activate`
- **Description:** Sets specified version as active; updates `is_active` flag atomically in PostgreSQL.

#### `GET /api/v1/documents/{document_id}/versions/compare?base={base_id}&target={target_id}`
- **Description:** Computes structural diff between two versions (`added_chunks`, `modified_chunks`, `removed_chunks`, `unchanged_chunks`).

---

### 3.4. Background Ingestion & Processing Jobs (Part 1)

#### `GET /api/v1/jobs`
- **Description:** Returns the queue of document ingestion jobs.
- **Response (200 OK):**
```json
[
  {
    "id": "job-vaswani-001",
    "document_id": "doc-vaswani-2017",
    "document_name": "Attention Is All You Need",
    "status": "completed",
    "progress_pct": 100,
    "stage": "Indexed in Vector Store (Qdrant HNSW)",
    "chunks_created": 42,
    "latency_ms": 1240,
    "created_at": "2026-10-27T10:14:20Z",
    "completed_at": "2026-10-27T10:14:21Z"
  },
  {
    "id": "job-corrupt-005",
    "document_id": "doc-scanned",
    "document_name": "raw_scanned_ocr_draft.pdf",
    "status": "failed",
    "progress_pct": 15,
    "stage": "PDF Stream Extraction Failed",
    "chunks_created": 0,
    "latency_ms": 410,
    "created_at": "2026-10-27T09:12:00Z",
    "completed_at": "2026-10-27T09:12:01Z",
    "error_message": "Non-conformant font encoding on page 4."
  }
]
```

#### `POST /api/v1/jobs/{job_id}/retry`
- **Description:** Re-queues a failed or aborted job with fallback parameters.

---

### 3.5. SmartChunk Configuration (Part 3)

#### `GET /api/v1/config`
- **Description:** Returns active chunking parameters.
- **Response (200 OK):**
```json
{
  "max_chunk_size_tokens": 512,
  "overlap_tokens": 50,
  "token_method": "cl100k_base",
  "preserve_headings": true,
  "preserve_paragraphs": true,
  "preserve_tables": true,
  "preserve_lists": true,
  "preserve_code_blocks": true,
  "preserve_formulas": true,
  "semantic_fallback_enabled": true,
  "semantic_similarity_threshold": 0.75,
  "enable_deduplication": true,
  "deduplication_threshold": 0.85,
  "target_vector_store": "qdrant",
  "embedding_model": "text-embedding-3-large (3072 dims)"
}
```

#### `POST /api/v1/config`
- **Description:** Validates and saves new chunking parameters. Rejects invalid settings (e.g. `overlap_tokens >= max_chunk_size_tokens`).

---

### 3.6. Chunk Explorer, Metadata & JSONL Export (Part 4 & Part 7)

#### `GET /api/v1/documents/{document_id}/chunks`
- **Query Parameters:**
  - `version_id` *(optional)*: Version filter (e.g. `ver-vaswani-v2`)
  - `status` *(optional)*: `pass | repair | review | reject`
  - `content_type` *(optional)*: `text | formula | table_composite | section`
  - `max_tokens` *(optional)*: Integer ceiling
  - `query` *(optional)*: Text search string
  - `page` *(optional, default 1)*: Integer
  - `limit` *(optional, default 25)*: Integer
- **Response (200 OK):** Array of `Chunk` objects:
```json
[
  {
    "id": "chk-vaswani-005",
    "document_id": "doc-vaswani-2017",
    "document_name": "Attention Is All You Need",
    "version_id": "ver-vaswani-v2",
    "version_tag": "v2.0.0",
    "chunk_index": 5,
    "content": "### 3.2 Attention > 3.2.1 Scaled Dot-Product Attention\n\n$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$",
    "content_type": "formula",
    "token_count": 94,
    "token_method": "cl100k_base",
    "heading_path": ["3. Model Architecture", "3.2 Attention", "3.2.1 Scaled Dot-Product Attention"],
    "page_numbers": [3],
    "char_start_offset": 4520,
    "char_end_offset": 5120,
    "strategy": "smartchunk_v2",
    "version": "2.4.0",
    "quality_status": "pass",
    "has_equation": true,
    "has_table": false,
    "created_at": "2026-10-25T09:30:15Z",
    "diagnostics": [],
    "relationships": [
      {
        "id": "rel-01",
        "target_chunk_id": "chk-vaswani-006",
        "target_document_id": "doc-vaswani-2017",
        "relation_type": "DEPENDS_ON",
        "strength": 0.98,
        "label": "Defines Q, K, V dimensions for Multi-Head Attention"
      }
    ]
  }
]
```

#### `GET /api/v1/chunks/export/jsonl?document_id={id}&version_id={ver}`
- **Description:** Streams valid JSONL file (one JSON object per line) containing full chunk metadata and provenance.

---

### 3.7. Deduplication & Provenance Auditing (Feature 5 / Part 5)

#### `GET /api/v1/deduplication/evaluation`
- **Description:** Returns exact SHA-256 and near-duplicate MinHash cluster metrics with before/after benchmarks.
- **Response (200 OK):**
```json
{
  "id": "dedup-eval-q4",
  "run_title": "Automated Near-Duplicate Audit",
  "similarity_threshold": 0.85,
  "deduplication_active": true,
  "original_chunk_count": 2420,
  "deduplicated_chunk_count": 2190,
  "reduction_pct": 9.5,
  "storage_before_kb": 14200,
  "storage_after_kb": 12850,
  "storage_saved_pct": 9.5,
  "redundant_retrieval_rate_before": 18.2,
  "redundant_retrieval_rate_after": 0.0,
  "retrieval_recall_before": 0.896,
  "retrieval_recall_after": 0.896,
  "faithfulness_score_before": 0.884,
  "faithfulness_score_after": 0.896,
  "clusters_found": 4,
  "exact_duplicates_count": 2,
  "near_duplicates_count": 2,
  "clusters": [
    {
      "id": "cluster-attn-01",
      "canonical_chunk_id": "chk-vaswani-005",
      "similarity_method": "sha256_exact",
      "similarity_score": 1.0,
      "duplicate_count": 2,
      "members": [
        {
          "chunk_id": "chk-vaswani-005",
          "document_id": "doc-vaswani-2017",
          "is_canonical": true,
          "similarity_score": 1.0,
          "content_preview": "Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V",
          "provenance_reference": "doc-vaswani-2017#ver-v2:chunk-5"
        },
        {
          "chunk_id": "chk-vaswani-dup-005b",
          "document_id": "doc-vaswani-2017-duplicate",
          "is_canonical": false,
          "similarity_score": 1.0,
          "content_preview": "Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V",
          "provenance_reference": "doc-vaswani-2017-duplicate#ver-v1:chunk-5"
        }
      ]
    }
  ]
}
```

#### `POST /api/v1/deduplication/toggle`
- **Request:** `{"active": true}`
- **Description:** Reversibly enables or disables duplicate pruning in vector search queries.

---

### 3.8. Built-In Comparative & Structure Benchmarks (Feature 3 & 4 / Part 6)

#### `GET /api/v1/benchmarks`
- **Description:** Returns benchmark runs comparing Fixed-Size, Recursive, Structure-Aware Naive, SmartChunk, and SmartChunk+Graph across Recall@k, MRR, latency, token violations, and cost.

#### `POST /api/v1/benchmarks/run`
- **Request Body:**
```json
{
  "dataset_name": "SciEval-Gold-500",
  "document_ids": ["doc-vaswani-2017", "doc-he-2015-resnet"],
  "chunk_size": 512,
  "overlap_tokens": 50,
  "top_k": 5
}
```

---

### 3.9. RAG Retrieval Inspection & Citation Tracing (Part 8)

#### `POST /api/v1/retrieval/inspect`
- **Request Body:**
```json
{
  "query": "How does scaled dot-product attention compute the variance denominator?",
  "top_k": 5,
  "version_policy": "active_only",
  "strategy": "smartchunk_v2"
}
```
- **Response (200 OK):**
```json
{
  "query": "How does scaled dot-product attention compute the variance denominator?",
  "execution_time_ms": 48,
  "strategy": "smartchunk_v2",
  "generated_answer": "In Scaled Dot-Product Attention, the variance denominator scales the dot products by sqrt(d_k) to prevent softmax from vanishing into regions with small gradients for large dimensions.",
  "provenance_links": [
    {
      "chunk_id": "chk-vaswani-005",
      "document_id": "doc-vaswani-2017",
      "document_name": "Attention Is All You Need",
      "version_tag": "v2.0.0",
      "relevance_pct": 98
    }
  ],
  "retrieved_chunks": [
    {
      "score": 0.984,
      "relevance_explanation": "Matched query terms with formula AST preservation in '3.2 Attention'",
      "is_direct_evidence": true,
      "source_location": {
        "page_numbers": [3],
        "heading_path": ["3. Model Architecture", "3.2 Attention", "3.2.1 Scaled Dot-Product Attention"],
        "start_offset": 4520,
        "end_offset": 5120
      },
      "chunk": {
        "id": "chk-vaswani-005",
        "document_id": "doc-vaswani-2017",
        "document_name": "Attention Is All You Need",
        "version_tag": "v2.0.0",
        "chunk_index": 5,
        "content": "Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V",
        "content_type": "formula",
        "token_count": 94
      }
    }
  ]
}
```

---

## 4. Database Migrations Reference

All required tables, indexes, and triggers are defined in `schema/migrations/`:
1. `001_document_versioning.sql`: `document_versions` table, SHA-256 hash constraints, active version pointer.
2. `002_context_dependency_graph.sql`: `graph_nodes`, `graph_edges`, BFS traversal indexes.
3. `003_comparative_benchmark.sql`: `benchmark_runs`, `benchmark_metrics`, `structure_benchmark_evaluations`.
4. `004_deduplication_clusters.sql`: `duplicate_clusters`, `duplicate_cluster_members`, `deduplication_evaluations`.

A cumulative runner script is provided at: `scripts/migrate.cjs` which generates `schema/migrations/combined_migrations.sql`.

---

## 5. Frontend Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Points to the live FastAPI backend |
| `VITE_DEFAULT_DEMO_MODE` | `false` | When `false`, always routes API requests to backend |

---

## 6. How to Run Frontend and Verify Backend Handoff

```bash
# 1. Start Frontend Development Server (Port 3000)
node node_modules/vite/bin/vite.js --port 3000 --host

# 2. Build Frontend for Production Deployment
node node_modules/vite/bin/vite.js build

# 3. Run Automated 5-Feature Test Suite
node tests/all_features_test.cjs
```

