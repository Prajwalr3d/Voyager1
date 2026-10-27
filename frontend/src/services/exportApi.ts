// ============================================================================
// CHUNK METADATA & JSONL EXPORT SERVICE
// Prepares normalized JSONL files with complete schema attributes
// ============================================================================

import { Chunk, ChunkExportOptions } from '../types';

export function serializeChunksToJsonl(chunks: Chunk[], options: ChunkExportOptions): string {
  return chunks
    .map(chunk => {
      const record: Record<string, any> = {
        chunk_id: chunk.id,
        document_id: chunk.document_id,
        document_name: chunk.document_name || 'Scientific Paper',
        version_id: chunk.version_id || 'ver-initial',
        version_tag: chunk.version_tag || 'v1.0.0',
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        content_type: chunk.content_type,
        token_count: chunk.token_count,
        token_method: chunk.token_method,
        heading_path: chunk.heading_path,
        page_numbers: chunk.page_numbers,
        char_start_offset: chunk.char_start_offset ?? null,
        char_end_offset: chunk.char_end_offset ?? null,
        strategy: chunk.strategy,
        quality_status: chunk.quality_status,
        has_equation: !!chunk.has_equation,
        has_table: !!chunk.has_table,
        created_at: chunk.created_at,
        provenance: {
          source_block_ids: chunk.source_block_ids,
          parent_chunk_id: chunk.parent_chunk_id ?? null,
          child_chunk_ids: chunk.child_chunk_ids ?? [],
        },
      };

      if (options.includeDiagnostics) {
        record.diagnostics = chunk.diagnostics;
      }

      if (options.includeRelationships) {
        record.relationships = chunk.relationships;
      }

      return JSON.stringify(record);
    })
    .join('\n');
}

export function triggerFileDownload(content: string, filename: string, mimeType: string = 'application/x-ndjson'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

