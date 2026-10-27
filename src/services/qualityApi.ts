import { apiRequest, getDemoModePreference } from './apiClient';
import { QualityResult, ChunkDiagnostic } from '../types';
import { DEMO_QUALITY_RESULTS, DEMO_CHUNKS } from '../demo/demoData';

export async function fetchQualityResult(documentId: string): Promise<QualityResult> {
  if (getDemoModePreference()) {
    const result = DEMO_QUALITY_RESULTS[documentId] || DEMO_QUALITY_RESULTS['doc-vaswani-2017'];
    return Promise.resolve(result);
  }
  return apiRequest<QualityResult>(`/api/v1/quality/${documentId}`);
}

export async function runQualityEvaluation(documentId: string, ruleProfile?: string): Promise<QualityResult> {
  if (getDemoModePreference()) {
    const result = DEMO_QUALITY_RESULTS[documentId] || DEMO_QUALITY_RESULTS['doc-vaswani-2017'];
    return Promise.resolve(result);
  }
  return apiRequest<QualityResult>(`/api/v1/evaluations`, {
    method: 'POST',
    body: JSON.stringify({ document_id: documentId, rule_profile: ruleProfile || 'scientific_strict_v2' }),
  });
}

export async function triggerChunkRepair(chunkId: string, diagnosticId: string): Promise<{
  success: boolean;
  repairedChunk: any;
  message: string;
}> {
  if (getDemoModePreference()) {
    const chunk = DEMO_CHUNKS.find(c => c.id === chunkId);
    if (chunk) {
      chunk.quality_status = 'pass';
      const diag = chunk.diagnostics.find(d => d.id === diagnosticId);
      if (diag) {
        diag.repaired = true;
      }
    }
    return Promise.resolve({
      success: true,
      repairedChunk: chunk,
      message: 'Chunk successfully repaired via SmartChunk AST boundary fusion.',
    });
  }

  return apiRequest<{ success: boolean; repairedChunk: any; message: string }>(
    `/api/v1/chunks/${chunkId}/repair`,
    {
      method: 'POST',
      body: JSON.stringify({ diagnostic_id: diagnosticId }),
    }
  );
}

