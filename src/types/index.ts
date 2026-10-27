// ============================================================================
// SMARTCHUNK DOMAIN TYPE DEFINITIONS
// Structure-first, quality-aware document chunking and scientific RAG platform
// ============================================================================

export type DocumentStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type FileType = 'pdf' | 'markdown' | 'txt';
export type QualityStatus = 'pass' | 'repair' | 'review' | 'reject';
export type DiagnosticSeverity = 'hard_gate' | 'warning' | 'info';
export type ChunkContentType = 'text' | 'formula' | 'table_composite' | 'mixed' | 'section';
export type TokenCountMethod = 'cl100k_base' | 'o200k_base' | 'p50k_base';

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_tag: string; // e.g. "v1.0.0", "v2.0.0"
  version_number: number; // 1, 2, 3...
  content_hash: string; // SHA-256 fingerprint of the version content
  created_at: string;
  is_active: boolean;
  change_summary: string;
  chunk_count: number;
  page_count: number;
  quality_status: QualityStatus;
  raw_filename: string;
  size_bytes: number;
  uploaded_by?: string;
}

export interface ChunkVersionDiff {
  chunk_id: string;
  chunk_index: number;
  status: 'added' | 'modified' | 'removed' | 'unchanged';
  heading_path: string[];
  old_content?: string;
  new_content?: string;
  old_tokens?: number;
  new_tokens?: number;
  diff_summary?: string;
}

export interface DocumentVersionComparison {
  document_id: string;
  base_version_id: string;
  target_version_id: string;
  base_version_tag: string;
  target_version_tag: string;
  added_chunks_count: number;
  modified_chunks_count: number;
  removed_chunks_count: number;
  unchanged_chunks_count: number;
  chunks_diff: ChunkVersionDiff[];
}

export interface Document {
  id: string;
  name: string;
  filename: string;
  file_type: FileType;
  size_bytes: number;
  page_count: number;
  uploaded_at: string;
  status: DocumentStatus;
  chunk_count: number;
  quality_status: QualityStatus;
  error_message?: string;
  processing_progress?: number;
  active_version_id?: string;
  active_version_tag?: string;
  versions_count?: number;
  versions?: DocumentVersion[];
  metadata: {
    title?: string;
    authors?: string[];
    arxiv_id?: string;
    doi?: string;
    abstract?: string;
    domain?: string;
    language?: string;
    extracted_headings_count?: number;
    extracted_equations_count?: number;
    extracted_tables_count?: number;
  };
}

export interface ExtractedBlock {
  id: string;
  document_id: string;
  type: 'heading' | 'paragraph' | 'equation' | 'table' | 'citation' | 'code' | 'caption';
  content: string;
  page_number: number;
  order: number;
  level?: number; // For headings (1, 2, 3...)
  latex?: string; // For math equations
  table_rows?: string[][]; // For extracted tables
  caption?: string;
}

export interface ChunkRelationship {
  id: string;
  target_chunk_id: string;
  target_document_id: string;
  relation_type: 
    | 'hierarchical_parent'
    | 'continuation'
    | 'references_equation'
    | 'references_table'
    | 'cites_paper'
    | 'semantic_similar';
  strength: number; // 0.0 - 1.0
  label: string;
}

export interface RepairRecord {
  original_content: string;
  repaired_content: string;
  diff_summary: string;
  repaired_at: string;
  strategy_used: string;
}

export interface ChunkDiagnostic {
  id: string;
  chunk_id: string;
  rule_id: string;
  rule_name: string;
  severity: DiagnosticSeverity;
  category: 
    | 'equation_split'
    | 'table_severed'
    | 'context_orphan'
    | 'token_overflow'
    | 'broken_cross_ref'
    | 'syntax_malformed'
    | 'heading_disconnected';
  message: string;
  details: string;
  suggested_action: string;
  repaired?: boolean;
  repair_record?: RepairRecord;
}

export interface Chunk {
  id: string;
  document_id: string;
  document_name?: string;
  version_id?: string;
  version_tag?: string;
  chunk_index: number;
  content: string;
  content_type: ChunkContentType;
  token_count: number;
  token_method: TokenCountMethod;
  heading_path: string[];
  page_numbers: number[];
  strategy: 'fixed_window' | 'structure_aware' | 'smartchunk_v2';
  version: string;
  quality_status: QualityStatus;
  diagnostics: ChunkDiagnostic[];
  source_block_ids: string[];
  relationships: ChunkRelationship[];
  has_equation?: boolean;
  has_table?: boolean;
  created_at: string;
  char_start_offset?: number;
  char_end_offset?: number;
  original_passage?: string;
  parent_chunk_id?: string;
  child_chunk_ids?: string[];
  is_orphan?: boolean;
  duplicate_cluster_id?: string;
}

export interface QualitySummary {
  pass_count: number;
  repair_count: number;
  review_count: number;
  reject_count: number;
  pass_pct: number;
  repair_pct: number;
  review_pct: number;
  reject_pct: number;
}

export interface QualityResult {
  document_id: string;
  document_name: string;
  evaluated_at: string;
  total_chunks: number;
  overall_score: number; // 0 - 100
  hard_gate_failures: number;
  soft_warnings: number;
  repaired_chunks_count: number;
  status_summary: QualitySummary;
  diagnostics: ChunkDiagnostic[];
}

export interface BenchmarkMetricSet {
  name: string;
  tag: 'fixed' | 'recursive' | 'structure_aware' | 'smartchunk' | 'smartchunk_graph';
  recall_at_1?: number;
  recall_at_3?: number;
  recall_at_5: number;
  mrr_at_5: number;
  ndcg_at_5: number;
  chunk_count: number;
  avg_token_count: number;
  processing_time_sec: number;
  indexing_latency_ms?: number;
  retrieval_latency_ms: number;
  generation_latency_ms?: number;
  total_latency_ms?: number;
  token_usage_per_query?: number;
  estimated_cost_usd_per_1k?: number;
  provenance_completeness_pct: number;
  equation_integrity_pct: number;
  table_integrity_pct: number;
  duplicate_rate_pct?: number;
  token_violations_count?: number;
  structure_integrity_pct?: number;
}

export interface BenchmarkConfig {
  dataset_name: string;
  document_ids: string[];
  chunk_size?: number;
  overlap_tokens?: number;
  top_k?: number;
  embedding_model?: string;
  vector_db?: string;
  reranker?: string;
}

export interface BenchmarkRun {
  id: string;
  title: string;
  dataset_name: string;
  description: string;
  document_count: number;
  total_queries_tested: number;
  chunk_size?: number;
  overlap_tokens?: number;
  top_k?: number;
  is_demo_data: boolean;
  created_at: string;
  metrics: {
    fixed_size: BenchmarkMetricSet;
    recursive?: BenchmarkMetricSet;
    structure_aware: BenchmarkMetricSet;
    smartchunk: BenchmarkMetricSet;
    smartchunk_graph: BenchmarkMetricSet;
  };
  run_metadata: {
    embedding_model: string;
    vector_db: string;
    reranker: string;
    eval_suite_version: string;
    hardware_target: string;
  };
}

// FEATURE 4: Structure-Aware Document Benchmark Types
export type StructureCategory = 'formulas' | 'tables' | 'sections' | 'code' | 'lists';

export interface StructureCategoryMetric {
  category: StructureCategory;
  category_label: string;
  total_samples: number;
  fixed_preservation_pct: number;
  fixed_truncation_rate_pct: number;
  fixed_fracture_rate_pct: number;
  structure_preservation_pct: number;
  structure_truncation_rate_pct: number;
  structure_fracture_rate_pct: number;
  smartchunk_preservation_pct: number;
  smartchunk_truncation_rate_pct: number;
  smartchunk_fracture_rate_pct: number;
  key_failure_mode: string;
  test_case: {
    query: string;
    expected_element: string;
    fixed_size_result: string;
    smartchunk_result: string;
  };
}

export interface StructureBenchmarkReport {
  id: string;
  run_id: string;
  dataset_name: string;
  total_categories_evaluated: number;
  categories: StructureCategoryMetric[];
  created_at: string;
}

// FEATURE 5: Deduplication and Before/After Evaluation Types
export type DeduplicationMethod = 'sha256_exact' | 'minhash_token_jaccard';

export interface DuplicateClusterMember {
  chunk_id: string;
  document_id: string;
  document_name?: string;
  version_tag?: string;
  is_canonical: boolean;
  similarity_score: number;
  content_preview: string;
  provenance_reference: string;
}

export interface DuplicateCluster {
  id: string;
  canonical_chunk_id: string;
  similarity_method: DeduplicationMethod;
  similarity_score: number;
  duplicate_count: number;
  members: DuplicateClusterMember[];
  created_at: string;
}

export interface DeduplicationEvaluationResult {
  id: string;
  run_title: string;
  dataset_name: string;
  similarity_threshold: number;
  deduplication_active: boolean;
  original_chunk_count: number;
  deduplicated_chunk_count: number;
  reduction_pct: number;
  storage_before_kb: number;
  storage_after_kb: number;
  storage_saved_pct: number;
  redundant_retrieval_rate_before: number;
  redundant_retrieval_rate_after: number;
  retrieval_recall_before: number;
  retrieval_recall_after: number;
  faithfulness_score_before: number;
  faithfulness_score_after: number;
  latency_ms_before: number;
  latency_ms_after: number;
  clusters_found: number;
  exact_duplicates_count: number;
  near_duplicates_count: number;
  clusters: DuplicateCluster[];
  created_at: string;
}

export type GraphNodeType = 
  | 'document'
  | 'section'
  | 'chunk'
  | 'equation'
  | 'table'
  | 'definition'
  | 'citation';

export type GraphEdgeType = 
  | 'CONTAINS'
  | 'DEFINES'
  | 'DEPENDS_ON'
  | 'REFERENCES'
  | 'FOLLOWS'
  | 'CITES'
  | 'CALCULATES'
  | 'PARENT_CHILD'
  | 'PREVIOUS_NEXT'
  | 'SEMANTIC_SIMILAR';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  document_id?: string;
  version_id?: string;
  properties: {
    title?: string;
    page?: number;
    tokens?: number;
    latex?: string;
    category?: string;
    quality_status?: QualityStatus;
    [key: string]: any;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
  weight?: number;
  evidence?: string;
  version_id?: string;
}

export interface ContextExpansionConfig {
  max_expansion_tokens: number;
  max_hop_depth: number;
  allowed_edge_types?: GraphEdgeType[];
  min_edge_weight?: number;
  avoid_cycles?: boolean;
  version_id?: string;
}

export interface ContextExpansionPath {
  source_id: string;
  target_id: string;
  edge_type: GraphEdgeType;
  hop_depth: number;
  justification: string;
  weight: number;
}

export interface ExpandedContextResult {
  seed_chunk_ids: string[];
  expanded_chunks: Chunk[];
  traversal_paths: ContextExpansionPath[];
  initial_tokens: number;
  expanded_tokens: number;
  total_tokens: number;
  token_budget: number;
  cycles_detected: number;
  pruned_candidates_count: number;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    document_id: string;
    version_id?: string;
    node_count: number;
    edge_count: number;
    is_demo_data: boolean;
  };
}

export interface Citation {
  id: string;
  document_id: string;
  document_name: string;
  document_version_id?: string;
  version_tag?: string;
  chunk_id: string;
  page_number: number;
  heading_path: string[];
  snippet: string;
  relevance_score: number;
  content_type?: ChunkContentType;
  expansion_justification?: string;
  is_graph_expanded?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: Citation[];
  follow_ups?: string[];
  is_streaming?: boolean;
  error?: string;
  strategy_used?: string;
  target_version_policy?: 'active_only' | 'historical_pinned' | 'all_versions';
  target_version_id?: string;
  target_version_tag?: string;
}

export interface SearchResult {
  query: string;
  execution_time_ms: number;
  strategy: string;
  hits: {
    chunk: Chunk;
    score: number;
    relevance_explanation?: string;
    rerank_score?: number;
  }[];
}

export interface ResearchStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
  output_summary?: string;
}

export interface ResearchToolCall {
  id: string;
  tool_name: string;
  input_params: Record<string, any>;
  output_summary: string;
  duration_ms: number;
  status: 'success' | 'failure';
  timestamp: string;
}

export interface KeyFinding {
  title: string;
  statement: string;
  scientific_evidence: string;
  citations: Citation[];
}

export interface ResearchReport {
  task_id: string;
  title: string;
  abstract: string;
  key_findings: KeyFinding[];
  methodology_analysis: string;
  mathematical_formulation: string;
  synthesis: string;
  unresolved_questions: string[];
  sources_consulted: {
    document_id: string;
    document_name: string;
    chunks_used: number;
  }[];
  generated_at: string;
}

export interface ResearchTask {
  id: string;
  query: string;
  document_ids: string[];
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress_pct: number;
  created_at: string;
  completed_at?: string;
  current_step_index: number;
  steps: ResearchStep[];
  tool_calls: ResearchToolCall[];
  unresolved_questions: string[];
  final_report?: ResearchReport;
  error_message?: string;
}

export interface SystemHealth {
  status: 'online' | 'degraded' | 'offline';
  backend_version?: string;
  embedding_model?: string;
  vector_store?: string;
  api_latency_ms?: number;
  is_demo_mode: boolean;
}

// Processing Job Pipeline Status (Part 1)
export interface ProcessingJob {
  id: string;
  document_id: string;
  document_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_pct: number;
  stage: string;
  chunks_created: number;
  latency_ms: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

// SmartChunk Config Parameters (Part 3)
export interface SmartChunkConfig {
  max_chunk_size_tokens: number; // 128 - 1024
  overlap_tokens: number; // 0 - 100
  token_method: TokenCountMethod;
  preserve_headings: boolean;
  preserve_paragraphs: boolean;
  preserve_tables: boolean;
  preserve_lists: boolean;
  preserve_code_blocks: boolean;
  preserve_formulas: boolean;
  semantic_fallback_enabled: boolean;
  semantic_similarity_threshold: number; // 0.50 - 0.95
  enable_deduplication: boolean;
  deduplication_threshold: number; // 0.80 - 0.99
  target_vector_store: 'qdrant' | 'pgvector';
  embedding_model: string;
}

// RAG Retrieval Inspection (Part 8)
export interface RetrievalInspectionQuery {
  query: string;
  top_k: number;
  version_policy: 'active_only' | 'historical_pinned' | 'all_versions';
  target_version_id?: string;
  strategy: 'fixed_window' | 'recursive' | 'structure_aware' | 'smartchunk_v2';
}

export interface RetrievedChunkEvidence {
  chunk: Chunk;
  score: number;
  relevance_explanation?: string;
  is_direct_evidence: boolean;
  source_location?: {
    page_numbers: number[];
    heading_path: string[];
    start_offset?: number;
    end_offset?: number;
  };
}

export interface RetrievalInspectionResult {
  query: string;
  execution_time_ms: number;
  strategy: string;
  retrieved_chunks: RetrievedChunkEvidence[];
  generated_answer: string;
  provenance_links: {
    chunk_id: string;
    document_id: string;
    document_name: string;
    version_tag?: string;
    relevance_pct: number;
  }[];
}

// JSONL Export Schema (Part 7)
export interface ChunkExportOptions {
  documentId?: string;
  versionId?: string;
  format: 'jsonl' | 'json';
  includeDiagnostics: boolean;
  includeRelationships: boolean;
}


