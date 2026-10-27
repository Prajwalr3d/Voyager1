import { apiRequest, getDemoModePreference } from './apiClient';
import { Chunk, ChunkRelationship } from '../types';
import { DEMO_CHUNKS } from '../demo/demoData';

export async function fetchChunks(params?: {
  documentId?: string;
  versionId?: string;
  versionTag?: string;
  query?: string;
  status?: string;
  contentType?: string;
}): Promise<Chunk[]> {
  if (getDemoModePreference()) {
    let result = [...DEMO_CHUNKS];
    if (params?.documentId) {
      result = result.filter(c => c.document_id === params.documentId);
    }
    if (params?.versionId && params.versionId !== 'all') {
      result = result.filter(c => c.version_id === params.versionId);
    }
    if (params?.versionTag && params.versionTag !== 'all') {
      result = result.filter(c => c.version_tag === params.versionTag);
    }
    if (params?.status && params.status !== 'all') {
      result = result.filter(c => c.quality_status === params.status);
    }
    if (params?.contentType && params.contentType !== 'all') {
      result = result.filter(c => c.content_type === params.contentType);
    }
    if (params?.query) {
      const q = params.query.toLowerCase();
      result = result.filter(
        c =>
          c.content.toLowerCase().includes(q) ||
          c.heading_path.some(h => h.toLowerCase().includes(q))
      );
    }
    return Promise.resolve(result);
  }

  const queryParams = new URLSearchParams();
  if (params?.documentId) queryParams.set('document_id', params.documentId);
  if (params?.versionId) queryParams.set('version_id', params.versionId);
  if (params?.versionTag) queryParams.set('version_tag', params.versionTag);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.contentType) queryParams.set('content_type', params.contentType);
  if (params?.query) queryParams.set('q', params.query);

  const endpoint = `/api/v1/chunks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<Chunk[]>(endpoint);
}

export async function fetchChunkById(id: string): Promise<Chunk> {
  if (getDemoModePreference()) {
    const chunk = DEMO_CHUNKS.find(c => c.id === id);
    if (!chunk) throw new Error(`Chunk with ID "${id}" not found.`);
    return Promise.resolve(chunk);
  }
  return apiRequest<Chunk>(`/api/v1/chunks/${id}`);
}

export async function fetchChunkRelationships(id: string): Promise<ChunkRelationship[]> {
  if (getDemoModePreference()) {
    const chunk = DEMO_CHUNKS.find(c => c.id === id);
    return Promise.resolve(chunk?.relationships || []);
  }
  return apiRequest<ChunkRelationship[]>(`/api/v1/chunks/${id}/relationships`);
}

