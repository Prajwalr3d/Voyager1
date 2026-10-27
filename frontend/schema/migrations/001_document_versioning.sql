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
