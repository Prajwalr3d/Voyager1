import { apiRequest, getDemoModePreference } from './apiClient';
import { Document, ExtractedBlock, DocumentVersion, DocumentVersionComparison } from '../types';
import {
  DEMO_DOCUMENTS,
  DEMO_EXTRACTED_BLOCKS,
  DEMO_DOCUMENT_VERSIONS,
  DEMO_VERSION_COMPARISONS,
} from '../demo/demoData';

export async function fetchDocuments(): Promise<Document[]> {
  if (getDemoModePreference()) {
    // Return demo documents
    return Promise.resolve([...DEMO_DOCUMENTS]);
  }
  return apiRequest<Document[]>('/api/v1/documents');
}

export async function fetchDocumentById(id: string): Promise<Document> {
  if (getDemoModePreference()) {
    const doc = DEMO_DOCUMENTS.find(d => d.id === id);
    if (!doc) throw new Error(`Document with ID "${id}" not found.`);
    return Promise.resolve(doc);
  }
  return apiRequest<Document>(`/api/v1/documents/${id}`);
}

export async function uploadDocument(file: File, domain?: string): Promise<Document> {
  if (getDemoModePreference()) {
    const docId = `doc-${Date.now().toString(36)}`;
    const verId = `ver-${Date.now().toString(36)}`;
    const initialVersion: DocumentVersion = {
      id: verId,
      document_id: docId,
      version_tag: 'v1.0.0',
      version_number: 1,
      content_hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      created_at: new Date().toISOString(),
      is_active: true,
      change_summary: 'Initial document ingest and AST parsing run.',
      chunk_count: Math.max(4, Math.ceil(file.size / 40000)),
      page_count: Math.max(1, Math.ceil(file.size / 60000)),
      quality_status: 'pass',
      raw_filename: file.name,
      size_bytes: file.size,
      uploaded_by: 'researcher@graphite.org',
    };

    DEMO_DOCUMENT_VERSIONS[docId] = [initialVersion];

    // In demo mode, simulate an uploaded scientific document
    const newDoc: Document = {
      id: docId,
      name: file.name.replace(/\.[^/.]+$/, ''),
      filename: file.name,
      file_type: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.md') ? 'markdown' : 'txt',
      size_bytes: file.size,
      page_count: Math.max(1, Math.ceil(file.size / 60000)),
      uploaded_at: new Date().toISOString(),
      status: 'completed',
      chunk_count: initialVersion.chunk_count,
      quality_status: 'pass',
      active_version_id: verId,
      active_version_tag: 'v1.0.0',
      versions_count: 1,
      versions: [initialVersion],
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        domain: domain || 'Scientific Research',
        language: 'en',
        extracted_headings_count: 8,
        extracted_equations_count: 5,
        extracted_tables_count: 2,
      },
    };
    DEMO_DOCUMENTS.unshift(newDoc);
    return Promise.resolve(newDoc);
  }

  const formData = new FormData();
  formData.append('file', file);
  if (domain) {
    formData.append('domain', domain);
  }

  return apiRequest<Document>('/api/v1/documents', {
    method: 'POST',
    body: formData,
  });
}

export async function fetchDocumentBlocks(documentId: string): Promise<ExtractedBlock[]> {
  if (getDemoModePreference()) {
    const blocks = DEMO_EXTRACTED_BLOCKS[documentId] || DEMO_EXTRACTED_BLOCKS['doc-vaswani-2017'] || [];
    return Promise.resolve(blocks);
  }
  return apiRequest<ExtractedBlock[]>(`/api/v1/documents/${documentId}/blocks`);
}

export async function deleteDocument(id: string): Promise<{ success: boolean }> {
  if (getDemoModePreference()) {
    const idx = DEMO_DOCUMENTS.findIndex(d => d.id === id);
    if (idx !== -1) DEMO_DOCUMENTS.splice(idx, 1);
    delete DEMO_DOCUMENT_VERSIONS[id];
    return Promise.resolve({ success: true });
  }
  return apiRequest<{ success: boolean }>(`/api/v1/documents/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// DOCUMENT VERSIONING & PROVENANCE APIS
// ============================================================================

export async function fetchDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  if (getDemoModePreference()) {
    const list = DEMO_DOCUMENT_VERSIONS[documentId] || [];
    return Promise.resolve([...list]);
  }
  return apiRequest<DocumentVersion[]>(`/api/v1/documents/${documentId}/versions`);
}

export async function fetchDocumentVersionById(
  documentId: string,
  versionId: string
): Promise<DocumentVersion> {
  if (getDemoModePreference()) {
    const list = DEMO_DOCUMENT_VERSIONS[documentId] || [];
    const ver = list.find(v => v.id === versionId);
    if (!ver) throw new Error(`Version "${versionId}" not found for document "${documentId}".`);
    return Promise.resolve(ver);
  }
  return apiRequest<DocumentVersion>(`/api/v1/documents/${documentId}/versions/${versionId}`);
}

export async function createDocumentVersion(
  documentId: string,
  file: File,
  versionTag: string,
  changeSummary: string
): Promise<DocumentVersion> {
  if (getDemoModePreference()) {
    const existing = DEMO_DOCUMENT_VERSIONS[documentId] || [];
    const nextVerNumber = existing.length + 1;
    const cleanTag = versionTag.startsWith('v') ? versionTag : `v${versionTag}`;

    // Mark previous versions as inactive
    existing.forEach(v => {
      v.is_active = false;
    });

    const newVersion: DocumentVersion = {
      id: `ver-${Date.now().toString(36)}`,
      document_id: documentId,
      version_tag: cleanTag,
      version_number: nextVerNumber,
      content_hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      created_at: new Date().toISOString(),
      is_active: true,
      change_summary: changeSummary || `Revision ${cleanTag} ingest.`,
      chunk_count: Math.max(4, Math.ceil(file.size / 40000)),
      page_count: Math.max(1, Math.ceil(file.size / 60000)),
      quality_status: 'pass',
      raw_filename: file.name,
      size_bytes: file.size,
      uploaded_by: 'researcher@graphite.org',
    };

    existing.unshift(newVersion);
    DEMO_DOCUMENT_VERSIONS[documentId] = existing;

    // Update parent doc reference
    const doc = DEMO_DOCUMENTS.find(d => d.id === documentId);
    if (doc) {
      doc.active_version_id = newVersion.id;
      doc.active_version_tag = newVersion.version_tag;
      doc.versions_count = existing.length;
      doc.versions = existing;
      doc.chunk_count = newVersion.chunk_count;
    }

    return Promise.resolve(newVersion);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('version_tag', versionTag);
  formData.append('change_summary', changeSummary);

  return apiRequest<DocumentVersion>(`/api/v1/documents/${documentId}/versions`, {
    method: 'POST',
    body: formData,
  });
}

export async function rollbackDocumentVersion(
  documentId: string,
  targetVersionId: string
): Promise<{ success: boolean; active_version: DocumentVersion }> {
  if (getDemoModePreference()) {
    const list = DEMO_DOCUMENT_VERSIONS[documentId] || [];
    const targetVer = list.find(v => v.id === targetVersionId);
    if (!targetVer) {
      throw new Error(`Target version "${targetVersionId}" does not exist for rollback.`);
    }

    list.forEach(v => {
      v.is_active = v.id === targetVersionId;
    });

    const doc = DEMO_DOCUMENTS.find(d => d.id === documentId);
    if (doc) {
      doc.active_version_id = targetVer.id;
      doc.active_version_tag = targetVer.version_tag;
      doc.versions = list;
      doc.chunk_count = targetVer.chunk_count;
    }

    return Promise.resolve({ success: true, active_version: targetVer });
  }

  return apiRequest<{ success: boolean; active_version: DocumentVersion }>(
    `/api/v1/documents/${documentId}/versions/${targetVersionId}/rollback`,
    {
      method: 'POST',
    }
  );
}

export async function compareDocumentVersions(
  documentId: string,
  baseVersionId: string,
  targetVersionId: string
): Promise<DocumentVersionComparison> {
  if (getDemoModePreference()) {
    const key = `${documentId}:${baseVersionId}:${targetVersionId}`;
    const reverseKey = `${documentId}:${targetVersionId}:${baseVersionId}`;

    if (DEMO_VERSION_COMPARISONS[key]) {
      return Promise.resolve(DEMO_VERSION_COMPARISONS[key]);
    }
    if (DEMO_VERSION_COMPARISONS[reverseKey]) {
      return Promise.resolve(DEMO_VERSION_COMPARISONS[reverseKey]);
    }

    // Dynamic fallback comparison for custom uploads
    const list = DEMO_DOCUMENT_VERSIONS[documentId] || [];
    const base = list.find(v => v.id === baseVersionId);
    const target = list.find(v => v.id === targetVersionId);

    const fallbackComparison: DocumentVersionComparison = {
      document_id: documentId,
      base_version_id: baseVersionId,
      target_version_id: targetVersionId,
      base_version_tag: base?.version_tag || 'v1.0.0',
      target_version_tag: target?.version_tag || 'v2.0.0',
      added_chunks_count: 2,
      modified_chunks_count: 3,
      removed_chunks_count: 0,
      unchanged_chunks_count: Math.max(1, (base?.chunk_count || 10) - 3),
      chunks_diff: [
        {
          chunk_id: 'chk-diff-01',
          chunk_index: 2,
          status: 'modified',
          heading_path: ['Methodology', 'Mathematical Formalization'],
          old_content: 'Preliminary formulation lacking parameter regularization.',
          new_content: 'Extended formulation with strict AST delimiter closure and parameter bounds.',
          old_tokens: 120,
          new_tokens: 185,
          diff_summary: 'Incorporated boundary invariants and updated scalar normalization.',
        },
        {
          chunk_id: 'chk-diff-02',
          chunk_index: 5,
          status: 'added',
          heading_path: ['Evaluation', 'Ablation Study'],
          new_content: 'Comparative ablation against fixed-window splitters over 100 queries.',
          new_tokens: 140,
          diff_summary: 'Newly added experimental evaluation section.',
        },
      ],
    };

    return Promise.resolve(fallbackComparison);
  }

  return apiRequest<DocumentVersionComparison>(
    `/api/v1/documents/${documentId}/compare?base=${baseVersionId}&target=${targetVersionId}`
  );
}


