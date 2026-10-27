import { apiRequest, getDemoModePreference } from './apiClient';
import {
  BenchmarkRun,
  BenchmarkConfig,
  StructureBenchmarkReport,
  StructureCategory,
} from '../types';
import {
  DEMO_BENCHMARKS,
  DEMO_STRUCTURE_BENCHMARK,
} from '../demo/demoData';

export async function fetchBenchmarkRuns(): Promise<BenchmarkRun[]> {
  if (getDemoModePreference()) {
    return Promise.resolve([...DEMO_BENCHMARKS]);
  }
  return apiRequest<BenchmarkRun[]>('/api/v1/benchmarks');
}

export async function fetchBenchmarkRunById(id: string): Promise<BenchmarkRun> {
  if (getDemoModePreference()) {
    const run = DEMO_BENCHMARKS.find(b => b.id === id);
    if (!run) throw new Error(`Benchmark run with ID "${id}" not found.`);
    return Promise.resolve(run);
  }
  return apiRequest<BenchmarkRun>(`/api/v1/benchmarks/${id}`);
}

/**
 * FEATURE 3: Parameter-Configurable Comparative Benchmark Execution
 * Evaluates Fixed, Structure-Aware, SmartChunk, and SmartChunk+Graph
 * across identical datasets, queries, and embedding models.
 */
export async function triggerNewBenchmarkRun(config: BenchmarkConfig): Promise<BenchmarkRun> {
  const chunkSize = config.chunk_size || 512;
  const overlap = config.overlap_tokens || 50;
  const topK = config.top_k || 5;
  const embModel = config.embedding_model || 'BAAI/bge-large-en-v1.5';
  const vectorDb = config.vector_db || 'Qdrant (HNSW / Cosine)';

  if (getDemoModePreference()) {
    // Dynamically calculate metrics based on parameters
    const sizeMultiplier = 512 / chunkSize;
    const baseChunks = 2190;
    const computedChunks = Math.round(baseChunks * sizeMultiplier * (1 + overlap / 500));

    // Fixed chunking suffers higher formula fracture at smaller chunk sizes
    const fixedEqIntegrity = Math.max(25, Math.min(65, 44.2 * (chunkSize / 512)));
    const fixedRecall = Math.max(0.45, Math.min(0.72, 0.612 * (chunkSize / 512) * (topK / 5) ** 0.3));
    const smartchunkRecall = Math.max(0.85, Math.min(0.96, 0.896 * (topK / 5) ** 0.15));
    const graphRecall = Math.max(0.90, Math.min(0.985, 0.942 * (topK / 5) ** 0.12));

    const newRun: BenchmarkRun = {
      id: `bench-custom-${Date.now().toString(36)}`,
      title: `Configured Run: ${config.dataset_name} (${chunkSize}t / ${overlap}ov / top-${topK})`,
      dataset_name: config.dataset_name || 'SciEval-Gold-500 (Math, CS, Quantum Physics)',
      description: `Evaluation with chunk size ${chunkSize} tokens, overlap ${overlap} tokens, top-${topK} retrieval on ${embModel}.`,
      document_count: config.document_ids.length || 50,
      total_queries_tested: 500,
      chunk_size: chunkSize,
      overlap_tokens: overlap,
      top_k: topK,
      is_demo_data: true,
      created_at: new Date().toISOString(),
      metrics: {
        fixed_size: {
          name: `Fixed-Size Window (${chunkSize}t / ${overlap}ov)`,
          tag: 'fixed',
          recall_at_1: +(fixedRecall * 0.62).toFixed(3),
          recall_at_3: +(fixedRecall * 0.84).toFixed(3),
          recall_at_5: +fixedRecall.toFixed(3),
          mrr_at_5: +(fixedRecall * 0.89).toFixed(3),
          ndcg_at_5: +(fixedRecall * 0.94).toFixed(3),
          chunk_count: Math.round(computedChunks * 1.6),
          avg_token_count: Math.round(chunkSize * 0.96),
          processing_time_sec: +(24.2 * sizeMultiplier).toFixed(1),
          indexing_latency_ms: +(18.5 * sizeMultiplier).toFixed(1),
          retrieval_latency_ms: Math.round(42 + topK * 1.5),
          generation_latency_ms: 280,
          total_latency_ms: +(340.5 + topK * 1.5).toFixed(1),
          token_usage_per_query: Math.round(chunkSize * topK * 0.96),
          estimated_cost_usd_per_1k: +(0.048 * (chunkSize / 512)).toFixed(3),
          provenance_completeness_pct: 38.5,
          equation_integrity_pct: +fixedEqIntegrity.toFixed(1),
          table_integrity_pct: +(51.0 * (chunkSize / 512)).toFixed(1),
        },
        structure_aware: {
          name: `Structure-Aware Naive (${chunkSize}t cap)`,
          tag: 'structure_aware',
          recall_at_1: 0.521,
          recall_at_3: 0.662,
          recall_at_5: +(0.744 * (topK / 5) ** 0.2).toFixed(3),
          mrr_at_5: 0.691,
          ndcg_at_5: 0.718,
          chunk_count: Math.round(computedChunks * 1.15),
          avg_token_count: Math.round(chunkSize * 0.75),
          processing_time_sec: +(38.6 * (sizeMultiplier ** 0.8)).toFixed(1),
          indexing_latency_ms: 22.4,
          retrieval_latency_ms: Math.round(48 + topK * 1.2),
          generation_latency_ms: 260,
          total_latency_ms: 330.4,
          token_usage_per_query: Math.round(chunkSize * topK * 0.75),
          estimated_cost_usd_per_1k: 0.038,
          provenance_completeness_pct: 79.1,
          equation_integrity_pct: 68.4,
          table_integrity_pct: 72.8,
        },
        smartchunk: {
          name: 'SmartChunk Standard (AST Bounds + Quality Gate)',
          tag: 'smartchunk',
          recall_at_1: 0.768,
          recall_at_3: 0.852,
          recall_at_5: +smartchunkRecall.toFixed(3),
          mrr_at_5: 0.862,
          ndcg_at_5: 0.884,
          chunk_count: computedChunks,
          avg_token_count: 320,
          processing_time_sec: +(52.4 * (sizeMultiplier ** 0.5)).toFixed(1),
          indexing_latency_ms: 26.1,
          retrieval_latency_ms: Math.round(54 + topK * 0.8),
          generation_latency_ms: 240,
          total_latency_ms: 320.1,
          token_usage_per_query: 1600,
          estimated_cost_usd_per_1k: 0.032,
          provenance_completeness_pct: 98.2,
          equation_integrity_pct: 99.1,
          table_integrity_pct: 97.6,
        },
        smartchunk_graph: {
          name: 'SmartChunk + Knowledge Graph Multi-Hop',
          tag: 'smartchunk_graph',
          recall_at_1: 0.842,
          recall_at_3: 0.912,
          recall_at_5: +graphRecall.toFixed(3),
          mrr_at_5: 0.918,
          ndcg_at_5: 0.935,
          chunk_count: computedChunks,
          avg_token_count: 320,
          processing_time_sec: +(76.8 * (sizeMultiplier ** 0.5)).toFixed(1),
          indexing_latency_ms: 31.8,
          retrieval_latency_ms: Math.round(71 + topK * 1.0),
          generation_latency_ms: 250,
          total_latency_ms: 352.8,
          token_usage_per_query: 1850,
          estimated_cost_usd_per_1k: 0.036,
          provenance_completeness_pct: 99.4,
          equation_integrity_pct: 99.1,
          table_integrity_pct: 98.9,
        },
      },
      run_metadata: {
        embedding_model: embModel,
        vector_db: vectorDb,
        reranker: config.reranker || 'bge-reranker-large',
        eval_suite_version: 'Graphite-RAG-Eval v3.1',
        hardware_target: 'NVIDIA A100-80GB (Local Cluster)',
      },
    };

    DEMO_BENCHMARKS.unshift(newRun);
    return Promise.resolve(newRun);
  }

  return apiRequest<BenchmarkRun>('/api/v1/benchmarks/run', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * FEATURE 4: Structure-Aware Document Benchmark Service
 * Returns granular preservation, truncation, and fracture metrics across
 * Formulas, Tables, Sections, Code, and Lists.
 */
export async function fetchStructureBenchmarkReport(_runId?: string): Promise<StructureBenchmarkReport> {
  if (getDemoModePreference()) {
    return Promise.resolve({ ...DEMO_STRUCTURE_BENCHMARK });
  }
  return apiRequest<StructureBenchmarkReport>('/api/v1/benchmarks/structure');
}

export async function triggerStructureEvaluation(runId?: string): Promise<StructureBenchmarkReport> {
  if (getDemoModePreference()) {
    return Promise.resolve({ ...DEMO_STRUCTURE_BENCHMARK, created_at: new Date().toISOString() });
  }
  return apiRequest<StructureBenchmarkReport>('/api/v1/benchmarks/structure/run', {
    method: 'POST',
    body: JSON.stringify({ run_id: runId }),
  });
}

