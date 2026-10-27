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
