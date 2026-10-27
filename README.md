# SmartChunk Frontend — Structure-First Scientific Chunking & RAG Platform
**Graphite 26 | Problem Statement 8**

> "SmartChunk doesn't just split documents; it checks what it splits and measures whether the result helps retrieve the right information."

---

## 1. Overview & Vision

**SmartChunk** is a developer and research-engineering platform tailored for scientific and mathematical papers (LaTeX formulas, relational tables, multi-level section trees).

Standard sliding-window chunkers cut mathematical formulas mid-expression (e.g., separating numerators from denominators) and orphan table headers, destroying contextual retrieval in scientific RAG. SmartChunk solves this by:
1. **AST-Guided Chunking:** Enforcing atomic boundaries around equations, tables, and sections.
2. **Post-Split Quality Gate:** Categorizing chunks into `PASS`, `REPAIR`, `REVIEW`, and `REJECT/QUARANTINE`.
3. **Automated AST Boundary Repair:** Re-stitching orphaned equations across soft page breaks.
4. **Knowledge Graph Grounding:** Linking chunks to their equations, theorems, and citations.
5. **Rigorous Retrieval Benchmarking:** Measuring empirical gains in Recall@5, MRR@5, and Equation/Table integrity.

---

## 2. Visual Design System

Built with a **developer-tool & scientific IDE aesthetic**:
- **Backgrounds:** `#09090B` (Canvas), `#0D0D10` (Sidebar), `#131316` / `#17171B` (Cards).
- **Borders:** Subtle `#29292F` and `#222227`.
- **Primary Text:** `#F4F4F5`, Secondary: `#A1A1AA`, Muted: `#71717A`.
- **Accent:** Restrained Electric Violet (`#8B5CF6`).
- **Semantic Statuses:**
  - `PASS`: Emerald (`#10B981`)
  - `REPAIR`: Blue (`#3B82F6`)
  - `REVIEW`: Amber (`#F59E0B`)
  - `REJECT / QUARANTINE`: Rose (`#EF4444`)
- **Typography:** JetBrains Mono for IDs, tokens, LaTeX ASTs, and metrics; Inter for prose.

---

## 3. Application Architecture

```
src/
├── types/
│   ├── index.ts               # Complete TypeScript domain contracts (Document, Chunk, Benchmark, etc.)
│   └── lucide-react.d.ts      # Self-contained icon typing
├── services/
│   ├── apiClient.ts           # Central fetch wrapper with timeout, base URL & demo mode toggle
│   ├── documentsApi.ts        # File upload, corpus listing, structural blocks
│   ├── chunksApi.ts           # Chunk browsing, diagnostics, relationships
│   ├── qualityApi.ts          # Quality Gate rules, evaluations, repair records
│   ├── benchmarksApi.ts       # Scientific RAG evaluation suite & metric comparisons
│   ├── graphApi.ts            # Knowledge graph entities & relation edges
│   ├── chatApi.ts             # Source-grounded RAG chat & citations
│   ├── agentApi.ts            # Autonomous multi-step scientific research tasks
│   └── healthApi.ts           # Backend healthcheck probe (GET /api/v1/health)
├── demo/
│   └── demoData.ts            # High-fidelity scientific fixtures (Attention Is All You Need, ResNet)
├── context/
│   └── AppContext.tsx         # Global document context, demo mode, and notifications
├── components/
│   ├── layout/                # Sidebar (9 destinations), TopNav, AppLayout
│   ├── ui/                    # Badge, Button, Card, MetricCard, JsonViewer, Toast, Icons
│   └── charts/                # BenchmarkBarChart, QualityPieChart
├── pages/
│   ├── OverviewPage.tsx       # Research-engineering dashboard & KPI matrix
│   ├── DocumentsPage.tsx      # Drag-and-drop paper ingestion & AST block preview
│   ├── ChunkInspectorPage.tsx # 3-panel IDE: tree, equation/table content, diagnostics
│   ├── QualityGatePage.tsx    # PASS/REPAIR/REVIEW/REJECT gate & before/after repair diff
│   ├── BenchmarksPage.tsx     # Fixed vs Structure-Aware vs SmartChunk comparison
│   ├── KnowledgeGraphPage.tsx # Interactive entity canvas with equation and citation nodes
│   ├── ChatPage.tsx           # Source-cited chat with chunk provenance inspector
│   ├── ResearchAgentPage.tsx  # Multi-step autonomous research assistant with tool trace
│   └── SettingsPage.tsx       # Backend URL binding, latency probe & demo toggle
├── styles/
│   └── index.css              # Dark theme base & custom technical scrollbars
├── App.tsx
└── main.tsx
```

---

## 4. Setup & Running

### Prerequisites
- Node.js >= 18 (Tested on Node.js v26.7.0)
- npm or pnpm

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Contents:
```env
# URL for the FastAPI backend (e.g. http://localhost:8000)
VITE_API_BASE_URL=http://localhost:8000

# Set to 'true' for preview mode with demo fixtures, or 'false' for live backend
VITE_DEFAULT_DEMO_MODE=true
```

### Development Server
```bash
npm run dev
# Server starts at http://localhost:3000
```

### Type Checking & Production Build
```bash
# Type check with TypeScript compiler
node node_modules/typescript/bin/tsc --noEmit

# Production bundle with Vite
node node_modules/vite/bin/vite.js build
```

---

## 5. Codex Backend Integration Guide

The frontend communicates exclusively through `src/services/`. When Codex connects the Python/FastAPI backend, no component modification is required.

### Step 1: Run the Backend
Ensure the FastAPI server is running on `http://localhost:8000` (or update `VITE_API_BASE_URL` in `.env`).

### Step 2: Implement FastAPI Endpoints

| Method | Endpoint | Description | Request Body / Params | Expected Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Healthcheck & DB status | None | `{"status": "online", "version": "v2.4.0", "embedding_model": "...", "vector_store": "..."}` |
| `GET` | `/api/v1/documents` | List corpus papers | Query params: `q`, `file_type` | Array of `Document` objects |
| `POST` | `/api/v1/documents` | Upload scientific paper | `multipart/form-data`: `file`, `domain` (optional) | Single `Document` object |
| `GET` | `/api/v1/documents/{id}/blocks` | Extracted AST blocks | None | Array of `ExtractedBlock` (equations, tables, headings) |
| `GET` | `/api/v1/chunks` | List chunks | Query params: `document_id`, `status`, `content_type`, `q` | Array of `Chunk` objects |
| `GET` | `/api/v1/chunks/{id}` | Get single chunk | None | Single `Chunk` object with diagnostics |
| `GET` | `/api/v1/chunks/{id}/relationships` | Get cross-chunk relations | None | Array of `ChunkRelationship` |
| `POST` | `/api/v1/chunks/{id}/repair` | Auto-repair chunk AST | `{"diagnostic_id": "..."}` | `{"success": true, "repairedChunk": {...}, "message": "..."}` |
| `GET` | `/api/v1/quality/{documentId}` | Get Quality Gate evaluation | None | `QualityResult` with status breakdown |
| `POST` | `/api/v1/evaluations` | Trigger Quality Gate run | `{"document_id": "...", "rule_profile": "scientific_strict_v2"}` | `QualityResult` |
| `GET` | `/api/v1/benchmarks` | List benchmark runs | None | Array of `BenchmarkRun` |
| `POST` | `/api/v1/benchmarks/run` | Execute benchmark evaluation | `{"dataset_name": "...", "document_ids": [...]}` | `BenchmarkRun` |
| `GET` | `/api/v1/graph` | Knowledge graph data | Query param: `document_id` (optional) | `KnowledgeGraphData` (`nodes`, `edges`) |
| `POST` | `/api/v1/chat` | Grounded RAG conversation | `{"message": "...", "document_id": "...", "history": [...]}` | `ChatMessage` with `citations` |
| `POST` | `/api/v1/agent/tasks` | Multi-step research task | `{"query": "...", "document_ids": [...]}` | `ResearchTask` with `steps`, `tool_calls`, `final_report` |

### Step 3: Switch Off Demo Mode
In the UI, click the **Demo Fixtures / Live Backend** toggle in the top bar or in **Settings**, or set `VITE_DEFAULT_DEMO_MODE=false` in `.env`. All queries will now seamlessly hit the FastAPI backend.

