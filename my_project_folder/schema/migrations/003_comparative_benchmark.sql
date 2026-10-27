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

