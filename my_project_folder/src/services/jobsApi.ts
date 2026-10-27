// ============================================================================
// PROCESSING JOBS API SERVICE
// Ingestion pipeline tracking, stages, and job retry controls
// ============================================================================

import { ProcessingJob } from '../types';
import { apiGet, apiPost } from './apiClient';
import { DEMO_PROCESSING_JOBS } from '../demo/demoData';

let inMemoryJobs: ProcessingJob[] = [...DEMO_PROCESSING_JOBS];

export async function fetchProcessingJobs(): Promise<ProcessingJob[]> {
  try {
    const data = await apiGet<ProcessingJob[]>('/api/v1/jobs');
    return data;
  } catch {
    return inMemoryJobs;
  }
}

export async function retryFailedJob(jobId: string): Promise<ProcessingJob> {
  try {
    const data = await apiPost<ProcessingJob>(`/api/v1/jobs/${jobId}/retry`, {});
    return data;
  } catch {
    const jobIndex = inMemoryJobs.findIndex(j => j.id === jobId);
    if (jobIndex !== -1) {
      inMemoryJobs[jobIndex] = {
        ...inMemoryJobs[jobIndex],
        status: 'processing',
        progress_pct: 45,
        stage: 'Retrying PDF Extraction with OCR fallback...',
        error_message: undefined,
      };
      return inMemoryJobs[jobIndex];
    }
    throw new Error(`Job ${jobId} not found`);
  }
}

export async function triggerReprocessJob(documentId: string): Promise<ProcessingJob> {
  try {
    return await apiPost<ProcessingJob>(`/api/v1/documents/${documentId}/reprocess`, {});
  } catch {
    const newJob: ProcessingJob = {
      id: `job-reprocess-${Date.now()}`,
      document_id: documentId,
      document_name: `Reprocessing ${documentId}`,
      status: 'processing',
      progress_pct: 20,
      stage: 'AST Parsing & Heading Normalization',
      chunks_created: 0,
      latency_ms: 120,
      created_at: new Date().toISOString(),
    };
    inMemoryJobs.unshift(newJob);
    return newJob;
  }
}

