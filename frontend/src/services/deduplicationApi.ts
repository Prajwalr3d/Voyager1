import { apiRequest, getDemoModePreference } from './apiClient';
import {
  DeduplicationEvaluationResult,
  DuplicateCluster,
  DeduplicationMethod,
} from '../types';
import { DEMO_DEDUPLICATION_DATA } from '../demo/demoData';

let currentDedupState: DeduplicationEvaluationResult = { ...DEMO_DEDUPLICATION_DATA };

/**
 * FEATURE 5: Deduplication Engine & Before/After Evaluation Service
 * Evaluates storage reduction, redundant retrieval elimination, and verifies
 * that retrieval recall and evidence coverage are preserved.
 */
export async function fetchDeduplicationEvaluation(): Promise<DeduplicationEvaluationResult> {
  if (getDemoModePreference()) {
    return Promise.resolve({ ...currentDedupState });
  }
  return apiRequest<DeduplicationEvaluationResult>('/api/v1/deduplication/evaluation');
}

export async function fetchDuplicateClusters(): Promise<DuplicateCluster[]> {
  if (getDemoModePreference()) {
    return Promise.resolve([...currentDedupState.clusters]);
  }
  return apiRequest<DuplicateCluster[]>('/api/v1/deduplication/clusters');
}

/**
 * Reversible Deduplication Toggle
 * Allows users to activate or deactivate deduplication at query/indexing time
 * without destroying original chunks or source provenance mappings.
 */
export async function toggleDeduplication(active: boolean): Promise<{ success: boolean; active: boolean }> {
  if (getDemoModePreference()) {
    currentDedupState = {
      ...currentDedupState,
      deduplication_active: active,
    };
    return Promise.resolve({ success: true, active });
  }
  return apiRequest<{ success: boolean; active: boolean }>('/api/v1/deduplication/toggle', {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

/**
 * Executes a controlled Deduplication Audit across corpus
 * Computes exact SHA-256 matches and near-duplicate Jaccard clusters.
 */
export async function runDeduplicationAudit(config: {
  similarity_threshold: number;
  method?: DeduplicationMethod;
}): Promise<DeduplicationEvaluationResult> {
  const threshold = config.similarity_threshold || 0.85;

  if (getDemoModePreference()) {
    // If threshold is very high (e.g. 0.95), only exact duplicates are clustered
    const exactCount = 2;
    const nearCount = threshold <= 0.90 ? 2 : 1;
    const totalDups = exactCount + nearCount;
    const origCount = 78;
    const dedupCount = origCount - totalDups;
    const reductionPct = +(((totalDups) / origCount) * 100).toFixed(1);

    const updated: DeduplicationEvaluationResult = {
      ...currentDedupState,
      id: `dedup-${Date.now().toString(36)}`,
      similarity_threshold: threshold,
      original_chunk_count: origCount,
      deduplicated_chunk_count: dedupCount,
      reduction_pct: reductionPct,
      storage_before_kb: 142.8,
      storage_after_kb: +(142.8 * (1 - reductionPct / 100)).toFixed(1),
      storage_saved_pct: reductionPct,
      redundant_retrieval_rate_before: 18.2,
      redundant_retrieval_rate_after: 0.0,
      retrieval_recall_before: 0.942,
      retrieval_recall_after: 0.942, // Guaranteed recall preservation
      faithfulness_score_before: 0.961,
      faithfulness_score_after: 0.974,
      latency_ms_before: 71.0,
      latency_ms_after: +(71.0 * (1 - (reductionPct * 0.8) / 100)).toFixed(1),
      clusters_found: exactCount + nearCount,
      exact_duplicates_count: exactCount,
      near_duplicates_count: nearCount,
      created_at: new Date().toISOString(),
    };

    currentDedupState = updated;
    return Promise.resolve(updated);
  }

  return apiRequest<DeduplicationEvaluationResult>('/api/v1/deduplication/run', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

