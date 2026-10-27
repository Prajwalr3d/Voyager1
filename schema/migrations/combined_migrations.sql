
-- MIGRATION 001_document_versioning.sql
-- ============================================================================
-- SMARTCHUNK RAG PLATFORM: SCHEMA MIGRATION 001
-- FEATURE 1: Version-Aware Evidence & Document Provenance Tracking
-- Compatible with SQLite, PostgreSQL, and standard relational RAG stores
-- ============================================================================

-- 1. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(16) NOT NULL CHECK (file_type IN ('pdf', 'markdown', 'txt')),
    size_bytes BIGINT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    quality_status VARCHAR(16) NOT NULL DEFAULT 'pass' CHECK (quality_status IN ('pass', 'repair', 'review', 'reject')),
    active_version_id VARCHAR(64),
    active_version_tag VARCHAR(32) DEFAULT 'v1.0.0',
    versions_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Document Versions Table (Preserves immutable historical versions)
CREATE TABLE IF NOT EXISTS document_versions (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_tag VARCHAR(32) NOT NULL,            -- e.g. 'v1.0.0', 'v2.0.0'
    version_number INTEGER NOT NULL,             -- Sequential integer: 1, 2, 3...
    content_hash VARCHAR(64) NOT NULL,           -- SHA-256 cryptographic digest of document content
    is_active BOOLEAN NOT NULL DEFAULT 0,        -- Flag indicating if this is the active retrieval target
    change_summary TEXT NOT NULL,                -- User-provided or auto-generated change log
    chunk_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    quality_status VARCHAR(16) NOT NULL DEFAULT 'pass' CHECK (quality_status IN ('pass', 'repair', 'review', 'reject')),
    raw_filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    uploaded_by VARCHAR(128) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, version_tag),
    UNIQUE (document_id, version_number)
);

-- Partial index ensuring at most one active version per document
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_single_active_version 
ON document_versions(document_id) 
WHERE is_active = 1;

-- 3. Chunks Table (Linked strictly to a specific document version to eliminate evidence leakage)
CREATE TABLE IF NOT EXISTS chunks (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    version_tag VARCHAR(32) NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(32) NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'formula', 'table_composite', 'mixed', 'section')),
    token_count INTEGER NOT NULL,
    token_method VARCHAR(32) NOT NULL DEFAULT 'cl100k_base',
    heading_path_json TEXT NOT NULL DEFAULT '[]', -- JSON array of section breadcrumbs
    page_numbers_json TEXT NOT NULL DEFAULT '[]', -- JSON array of page numbers
    strategy VARCHAR(32) NOT NULL DEFAULT 'smartchunk_v2',
    quality_status VARCHAR(16) NOT NULL DEFAULT 'pass' CHECK (quality_status IN ('pass', 'repair', 'review', 'reject')),
    has_equation BOOLEAN NOT NULL DEFAULT 0,
    has_table BOOLEAN NOT NULL DEFAULT 0,
    content_hash VARCHAR(64) NOT NULL,           -- SHA-256 hash of chunk content for deduplication
    source_block_ids_json TEXT DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (version_id, chunk_index)
);

-- Compound index for version-isolated vector & keyword retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_doc_version_lookup 
ON chunks(document_id, version_id, quality_status);

-- 4. Chunk Version Diffs Table (Tracks semantic and structural differences between document versions)
CREATE TABLE IF NOT EXISTS chunk_version_diffs (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    base_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    target_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    chunk_id VARCHAR(64) NOT NULL,
    chunk_index INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('added', 'modified', 'removed', 'unchanged')),
    heading_path_json TEXT NOT NULL DEFAULT '[]',
    old_content TEXT,
    new_content TEXT,
    old_tokens INTEGER,
    new_tokens INTEGER,
    diff_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Chat Citations Table (Guarantees verifiable provenance from generated answer back to document version)
CREATE TABLE IF NOT EXISTS chat_citations (
    id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    version_tag VARCHAR(32) NOT NULL,
    chunk_id VARCHAR(64) NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    heading_path_json TEXT NOT NULL DEFAULT '[]',
    snippet TEXT NOT NULL,
    relevance_score REAL NOT NULL,
    content_type VARCHAR(32) DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citations_provenance 
ON chat_citations(document_id, document_version_id, chunk_id);


-- MIGRATION 002_context_dependency_graph.sql
-- ============================================================================
-- SMARTCHUNK RAG PLATFORM: SCHEMA MIGRATION 002
-- FEATURE 2: Context Dependency Graph & Multi-Hop Traversal Schema
-- Supports AST structural relations, explicit cross-references, and token-bounded expansion
-- ============================================================================

-- 1. Graph Nodes Table
CREATE TABLE IF NOT EXISTS graph_nodes (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('document', 'section', 'chunk', 'equation', 'table', 'definition', 'citation')),
    chunk_id VARCHAR(64) REFERENCES chunks(id) ON DELETE SET NULL,
    page_number INTEGER DEFAULT 1,
    token_count INTEGER DEFAULT 0,
    latex TEXT,
    category VARCHAR(64),
    properties_json TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_lookup 
ON graph_nodes(document_id, version_id, type);

-- 2. Graph Edges Table (Directed dependencies with justified relationship semantics)
CREATE TABLE IF NOT EXISTS graph_edges (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    source_node_id VARCHAR(64) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    target_node_id VARCHAR(64) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    edge_type VARCHAR(32) NOT NULL CHECK (
        edge_type IN (
            'CONTAINS',
            'DEFINES',
            'DEPENDS_ON',
            'REFERENCES',
            'FOLLOWS',
            'CITES',
            'CALCULATES',
            'PARENT_CHILD',
            'PREVIOUS_NEXT',
            'SEMANTIC_SIMILAR'
        )
    ),
    label VARCHAR(128),
    weight REAL NOT NULL DEFAULT 1.0,           -- Relevance / dependency confidence weight (0.0 to 1.0)
    evidence TEXT,                              -- Textual proof of reference or structural bond
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_node_id, target_node_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_traversal 
ON graph_edges(document_id, version_id, source_node_id, edge_type);

CREATE INDEX IF NOT EXISTS idx_graph_edges_incoming 
ON graph_edges(document_id, version_id, target_node_id, edge_type);


-- MIGRATION 003_comparative_benchmark.sql
-- ============================================================================
-- SMARTCHUNK RAG PLATFORM: SCHEMA MIGRATION 003
-- FEATURE 3 & 4: Built-In Comparative Benchmark & Structure-Aware Taxonomy
-- Stores parameter-configurable evaluation experiments, IR metrics, latency breakdowns, and structure taxonomy
-- ============================================================================

-- 1. Benchmark Runs Table (Configurable evaluation experiments)
CREATE TABLE IF NOT EXISTS benchmark_runs (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    dataset_name VARCHAR(255) NOT NULL,
    description TEXT,
    chunk_size INTEGER DEFAULT 512,
    overlap_tokens INTEGER DEFAULT 50,
    top_k INTEGER DEFAULT 5,
    embedding_model VARCHAR(128) DEFAULT 'BAAI/bge-large-en-v1.5',
    vector_db VARCHAR(64) DEFAULT 'PGVector (HNSW / Cosine)',
    reranker VARCHAR(128) DEFAULT 'BAAI/bge-reranker-large',
    eval_suite_version VARCHAR(32) DEFAULT 'v2.4.0',
    hardware_target VARCHAR(64) DEFAULT 'NVIDIA A100-SXM4-80GB',
    total_queries_tested INTEGER DEFAULT 500,
    is_demo_data BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Benchmark Metrics Table (Strategy comparison results across fixed, structure, smartchunk, and graph)
CREATE TABLE IF NOT EXISTS benchmark_metrics (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    strategy VARCHAR(32) NOT NULL CHECK (strategy IN ('fixed_size', 'structure_aware', 'smartchunk', 'smartchunk_graph')),
    strategy_label VARCHAR(128) NOT NULL,
    recall_at_1 REAL DEFAULT 0.0,
    recall_at_3 REAL DEFAULT 0.0,
    recall_at_5 REAL NOT NULL,
    mrr_at_5 REAL NOT NULL,
    ndcg_at_5 REAL NOT NULL,
    chunk_count INTEGER NOT NULL,
    avg_token_count INTEGER NOT NULL,
    indexing_latency_ms REAL NOT NULL,
    retrieval_latency_ms REAL NOT NULL,
    generation_latency_ms REAL NOT NULL,
    total_latency_ms REAL NOT NULL,
    token_usage_per_query INTEGER NOT NULL,
    estimated_cost_usd_per_1k REAL NOT NULL,
    equation_integrity_pct REAL NOT NULL,
    table_integrity_pct REAL NOT NULL,
    provenance_completeness_pct REAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (run_id, strategy)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_metrics_run 
ON benchmark_metrics(run_id, strategy);

-- 3. Structure Taxonomy Evaluation Table (Feature 4: Granular structural category metrics)
CREATE TABLE IF NOT EXISTS structure_benchmark_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL CHECK (category IN ('formulas', 'tables', 'sections', 'code', 'lists')),
    total_samples INTEGER NOT NULL,
    fixed_preservation_pct REAL NOT NULL,
    fixed_truncation_rate_pct REAL NOT NULL,
    fixed_fracture_rate_pct REAL NOT NULL,
    structure_preservation_pct REAL NOT NULL,
    structure_truncation_rate_pct REAL NOT NULL,
    structure_fracture_rate_pct REAL NOT NULL,
    smartchunk_preservation_pct REAL NOT NULL,
    smartchunk_truncation_rate_pct REAL NOT NULL,
    smartchunk_fracture_rate_pct REAL NOT NULL,
    key_failure_mode TEXT NOT NULL,
    test_case_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (run_id, category)
);

CREATE INDEX IF NOT EXISTS idx_structure_eval_run 
ON structure_benchmark_evaluations(run_id, category);



-- MIGRATION 004_deduplication_clusters.sql
-- ============================================================================
-- SMARTCHUNK RAG PLATFORM: SCHEMA MIGRATION 004
-- FEATURE 5: Deduplication Engine & Before/After Evaluation Schema
-- Exact match hashing, near-duplicate clustering, and reversible evaluation state
-- ============================================================================

-- 1. Duplicate Clusters Table (Cryptographic SHA-256 and MinHash Jaccard groups)
CREATE TABLE IF NOT EXISTS duplicate_clusters (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    canonical_chunk_id VARCHAR(64) NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    similarity_method VARCHAR(32) NOT NULL CHECK (similarity_method IN ('sha256_exact', 'minhash_token_jaccard')),
    similarity_threshold REAL NOT NULL DEFAULT 0.85,
    duplicate_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'bypassed', 'merged')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Duplicate Cluster Members Table (Tracks mapped duplicates while preserving provenance)
CREATE TABLE IF NOT EXISTS duplicate_cluster_members (
    id VARCHAR(64) PRIMARY KEY,
    cluster_id VARCHAR(64) NOT NULL REFERENCES duplicate_clusters(id) ON DELETE CASCADE,
    chunk_id VARCHAR(64) NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    is_canonical BOOLEAN NOT NULL DEFAULT FALSE,
    similarity_score REAL NOT NULL,
    provenance_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cluster_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_members_lookup 
ON duplicate_cluster_members(cluster_id, chunk_id, is_canonical);

-- 3. Deduplication Before/After Evaluation Runs Table (Controlled comparative audit)
CREATE TABLE IF NOT EXISTS deduplication_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    run_title VARCHAR(255) NOT NULL,
    dataset_name VARCHAR(255) NOT NULL,
    similarity_threshold REAL NOT NULL,
    original_chunk_count INTEGER NOT NULL,
    deduplicated_chunk_count INTEGER NOT NULL,
    reduction_pct REAL NOT NULL,
    storage_before_kb REAL NOT NULL,
    storage_after_kb REAL NOT NULL,
    storage_saved_pct REAL NOT NULL,
    redundant_retrieval_rate_before REAL NOT NULL,
    redundant_retrieval_rate_after REAL NOT NULL,
    retrieval_recall_before REAL NOT NULL,
    retrieval_recall_after REAL NOT NULL,
    faithfulness_score_before REAL NOT NULL,
    faithfulness_score_after REAL NOT NULL,
    latency_ms_before REAL NOT NULL,
    latency_ms_after REAL NOT NULL,
    clusters_found INTEGER NOT NULL,
    exact_duplicates_count INTEGER NOT NULL,
    near_duplicates_count INTEGER NOT NULL,
    is_reversible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


