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

