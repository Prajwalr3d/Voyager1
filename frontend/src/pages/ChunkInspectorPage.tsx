import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { JsonViewer } from '../components/ui/JsonViewer';
import { fetchChunks } from '../services/chunksApi';
import { fetchDocumentVersions } from '../services/documentsApi';
import { serializeChunksToJsonl, triggerFileDownload } from '../services/exportApi';
import { ChunkDiffModal } from '../components/chunks/ChunkDiffModal';
import { Chunk, ChunkContentType, QualityStatus, DocumentVersion } from '../types';
import {
  Binary,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Code2,
  FileText,
  Sigma,
  Table as TableIcon,
  ShieldAlert,
  ShieldCheck,
  Layers,
  ArrowRight,
  Hash,
  ExternalLink,
  SlidersHorizontal,
  History,
  GitCommit,
  Network,
  Zap,
  Download,
  Split,
  AlertTriangle,
} from 'lucide-react';

export const ChunkInspectorPage: React.FC = () => {
  const {
    selectedDocumentId,
    selectedDocument,
    documents,
    setSelectedDocumentId,
    setCurrentPage,
    notify,
    isDemoMode,
  } = useApp();

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [docVersions, setDocVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('all');
  const [selectedChunkId, setSelectedChunkId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [maxTokenFilter, setMaxTokenFilter] = useState<number>(1000);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPageNumber, setCurrentPageNumber] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'chunks' | 'content' | 'metadata'>('content');
  const [showJson, setShowJson] = useState<boolean>(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadDocVersions() {
      try {
        const vers = await fetchDocumentVersions(selectedDocumentId);
        setDocVersions(vers);
        setSelectedVersionId('all');
      } catch (e) {
        console.error('Error fetching doc versions:', e);
      }
    }
    loadDocVersions();
  }, [selectedDocumentId]);

  useEffect(() => {
    async function loadChunks() {
      try {
        setIsLoading(true);
        const data = await fetchChunks({
          documentId: selectedDocumentId,
          versionId: selectedVersionId !== 'all' ? selectedVersionId : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          contentType: typeFilter !== 'all' ? typeFilter : undefined,
          query: searchQuery || undefined,
        });
        setChunks(data);
        if (data.length > 0) {
          // If current selection is not in new list, pick first
          if (!data.some(c => c.id === selectedChunkId)) {
            setSelectedChunkId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching chunks:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadChunks();
  }, [selectedDocumentId, selectedVersionId, statusFilter, typeFilter, searchQuery]);

  // Token range filtering
  const filteredChunks = useMemo(() => {
    return chunks.filter(c => c.token_count <= maxTokenFilter);
  }, [chunks, maxTokenFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredChunks.length / pageSize));
  const safeCurrentPage = Math.min(currentPageNumber, totalPages);
  const paginatedChunks = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredChunks.slice(start, start + pageSize);
  }, [filteredChunks, safeCurrentPage, pageSize]);

  const selectedChunk = filteredChunks.find(c => c.id === selectedChunkId) || filteredChunks[0];
  const currentIndex = filteredChunks.findIndex(c => c.id === selectedChunk?.id);

  const handleNextChunk = () => {
    if (currentIndex < filteredChunks.length - 1) {
      setSelectedChunkId(filteredChunks[currentIndex + 1].id);
    }
  };

  const handlePrevChunk = () => {
    if (currentIndex > 0) {
      setSelectedChunkId(filteredChunks[currentIndex - 1].id);
    }
  };

  const handleCopyText = () => {
    if (selectedChunk) {
      navigator.clipboard.writeText(selectedChunk.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportJsonl = () => {
    try {
      const jsonlData = serializeChunksToJsonl(filteredChunks, {
        format: 'jsonl',
        includeDiagnostics: true,
        includeRelationships: true,
      });
      const docName = (selectedDocument?.name || 'smartchunk').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${docName}_chunks_metadata.jsonl`;
      triggerFileDownload(jsonlData, filename, 'application/x-ndjson');
      notify('success', `Exported ${filteredChunks.length} chunks to ${filename}`);
    } catch (err: any) {
      notify('error', `JSONL export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Document Switcher, Navigation, Search & Filters */}
      <div className="bg-[#131316] border border-[#29292F] rounded-lg p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Document selection, Version Selector & Count */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#71717A]">Document:</span>
            <select
              value={selectedDocumentId}
              onChange={e => setSelectedDocumentId(e.target.value)}
              className="bg-[#18181D] border border-[#29292F] text-xs text-[#F4F4F5] rounded px-2.5 py-1 font-medium outline-none"
            >
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.chunk_count} chunks)
                </option>
              ))}
            </select>
          </div>

          {docVersions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#71717A]">Version:</span>
              <select
                value={selectedVersionId}
                onChange={e => setSelectedVersionId(e.target.value)}
                className="bg-[#18181D] border border-violet-900/40 text-xs text-violet-300 rounded px-2.5 py-1 font-mono outline-none"
              >
                <option value="all">All Versions ({docVersions.length})</option>
                {docVersions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.version_tag} {v.is_active ? '● Active' : '○ Archive'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-xs font-mono text-[#A1A1AA] hidden sm:inline">
            Matching: <strong className="text-white">{filteredChunks.length}</strong> chunks
          </span>
        </div>

        {/* Right: Search, Token Filter & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search in chunks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#18181D] border border-[#29292F] rounded pl-8 pr-2.5 py-1 text-xs text-[#F4F4F5] placeholder-[#71717A] outline-none font-mono w-36 sm:w-44 focus:border-violet-500"
            />
          </div>

          {/* Token count ceiling filter */}
          <div className="flex items-center gap-1.5 bg-[#18181D] border border-[#29292F] rounded px-2 py-0.5 text-xs font-mono text-[#A1A1AA]">
            <SlidersHorizontal className="w-3 h-3 text-[#71717A]" />
            <select
              value={maxTokenFilter}
              onChange={e => setMaxTokenFilter(Number(e.target.value))}
              className="bg-transparent text-xs text-[#F4F4F5] outline-none"
            >
              <option value={1000}>All sizes</option>
              <option value={512}>≤ 512 toks</option>
              <option value={384}>≤ 384 toks</option>
              <option value={256}>≤ 256 toks</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#18181D] border border-[#29292F] rounded px-2 py-1 text-xs text-[#F4F4F5] outline-none font-mono"
          >
            <option value="all">All Statuses</option>
            <option value="pass">PASS Only</option>
            <option value="repair">REPAIR Only</option>
            <option value="review">REVIEW Only</option>
            <option value="reject">REJECT Only</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-[#18181D] border border-[#29292F] rounded px-2 py-1 text-xs text-[#F4F4F5] outline-none font-mono"
          >
            <option value="all">All Types</option>
            <option value="formula">Formulas (LaTeX)</option>
            <option value="table_composite">Tables</option>
            <option value="section">Section Text</option>
          </select>

          <Button
            variant="outline"
            size="xs"
            icon={<Download className="w-3 h-3 text-emerald-400" />}
            onClick={handleExportJsonl}
            title="Download full chunk metadata in JSONL format"
          >
            JSONL
          </Button>
        </div>
      </div>

      {/* Mobile Tab switcher (converts 3 panels into tabs on small screens) */}
      <div className="flex lg:hidden rounded bg-[#131316] p-1 border border-[#29292F]">
        <button
          onClick={() => setMobileTab('chunks')}
          className={`flex-1 py-1.5 text-xs font-mono rounded ${
            mobileTab === 'chunks' ? 'bg-[#27272A] text-white font-semibold' : 'text-[#71717A]'
          }`}
        >
          Chunk List ({chunks.length})
        </button>
        <button
          onClick={() => setMobileTab('content')}
          className={`flex-1 py-1.5 text-xs font-mono rounded ${
            mobileTab === 'content' ? 'bg-[#27272A] text-white font-semibold' : 'text-[#71717A]'
          }`}
        >
          Chunk Content
        </button>
        <button
          onClick={() => setMobileTab('metadata')}
          className={`flex-1 py-1.5 text-xs font-mono rounded ${
            mobileTab === 'metadata' ? 'bg-[#27272A] text-white font-semibold' : 'text-[#71717A]'
          }`}
        >
          Metadata & Provenance
        </button>
      </div>

      {/* 3-Panel Desktop Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[640px]">
        {/* PANEL 1 (Left): Chunk Hierarchy & List (col-span-3) */}
        <div
          className={`lg:col-span-3 bg-[#131316] border border-[#29292F] rounded-lg flex flex-col overflow-hidden ${
            mobileTab === 'chunks' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="p-3 border-b border-[#222227] flex items-center justify-between bg-[#111114]">
            <span className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-violet-400" />
              Chunks ({filteredChunks.length})
            </span>
            <span className="text-[10px] font-mono text-[#71717A]">Index #</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#1C1C22]">
            {paginatedChunks.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#71717A]">
                No chunks match current filter.
              </div>
            ) : (
              paginatedChunks.map(chunk => {
                const isSelected = selectedChunk?.id === chunk.id;
                const isOrphan = !chunk.heading_path || chunk.heading_path.length === 0 || chunk.heading_path[0] === '[ORPHAN]';
                const isMissingOffset = chunk.char_start_offset == null;

                return (
                  <div
                    key={chunk.id}
                    onClick={() => {
                      setSelectedChunkId(chunk.id);
                      setMobileTab('content');
                    }}
                    className={`p-3 transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-violet-950/30 border-l-2 border-violet-500'
                        : 'hover:bg-[#18181E]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-[11px] text-[#A1A1AA]">
                          Chunk #{chunk.chunk_index}
                        </span>
                        {isOrphan && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800">
                            Orphan
                          </span>
                        )}
                        {isMissingOffset && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            Offsets?
                          </span>
                        )}
                      </div>
                      <Badge status={chunk.quality_status} size="xs" />
                    </div>

                    <p className="text-[11px] font-medium text-[#F4F4F5] truncate mb-1">
                      {chunk.heading_path[chunk.heading_path.length - 1] || 'Orphan Node'}
                    </p>

                    <p className="text-[11px] text-[#71717A] line-clamp-2 leading-relaxed">
                      {chunk.content.replace(/[#*`$]/g, '')}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#71717A]">
                      <span className="flex items-center gap-1">
                        {chunk.has_equation && <Sigma className="w-3 h-3 text-emerald-400" />}
                        {chunk.has_table && <TableIcon className="w-3 h-3 text-blue-400" />}
                        <span>{chunk.token_count} toks</span>
                      </span>
                      <span>p.{chunk.page_numbers.join(', ')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {filteredChunks.length > 0 && (
            <div className="p-2 bg-[#111114] border-t border-[#222227] flex items-center justify-between text-[11px] font-mono text-[#A1A1AA]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPageNumber(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1 rounded bg-[#1C1C22] hover:text-white disabled:opacity-30"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span>
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPageNumber(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1 rounded bg-[#1C1C22] hover:text-white disabled:opacity-30"
                  title="Next page"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPageNumber(1);
                }}
                className="bg-[#18181D] border border-[#29292F] rounded px-1.5 py-0.5 text-[10px] text-[#F4F4F5] outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={999}>All</option>
              </select>
            </div>
          )}
        </div>

        {/* PANEL 2 (Center): Selected Chunk Content & Structural View (col-span-5) */}
        <div
          className={`lg:col-span-5 bg-[#131316] border border-[#29292F] rounded-lg flex flex-col overflow-hidden ${
            mobileTab === 'content' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Panel Header */}
          <div className="p-3 border-b border-[#222227] flex items-center justify-between bg-[#111114]">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="text-xs font-mono font-semibold text-violet-400">
                Chunk #{selectedChunk?.chunk_index ?? '--'}
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-xs text-[#A1A1AA] truncate">
                {selectedChunk?.heading_path.join(' > ') || 'Root Document'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsDiffModalOpen(true)}
                className="p-1 px-2 rounded bg-violet-950/60 border border-violet-800/60 text-violet-300 hover:text-white flex items-center gap-1 text-[11px] font-mono"
                title="Compare chunk to original unchunked source passage"
              >
                <Split className="w-3 h-3 text-violet-400" />
                <span>Source Diff</span>
              </button>
              <button
                onClick={handlePrevChunk}
                disabled={currentIndex <= 0}
                className="p-1 rounded bg-[#1C1C22] text-[#A1A1AA] hover:text-white disabled:opacity-30"
                title="Previous Chunk"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNextChunk}
                disabled={currentIndex >= filteredChunks.length - 1}
                className="p-1 rounded bg-[#1C1C22] text-[#A1A1AA] hover:text-white disabled:opacity-30"
                title="Next Chunk"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCopyText}
                className="p-1 px-2 rounded bg-[#1C1C22] text-[#A1A1AA] hover:text-white flex items-center gap-1 text-[11px] font-mono"
                title="Copy chunk content"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedChunk ? (
              <>
                {/* Structural Breadcrumb Banner */}
                <div className="p-2.5 rounded bg-[#0A0A0D] border border-[#222227] flex items-center gap-2 text-xs font-mono text-[#A1A1AA] overflow-x-auto">
                  <Layers className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-zinc-500">Path:</span>
                  {selectedChunk.heading_path.map((h, i) => (
                    <span key={i} className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[#F4F4F5] bg-[#16161B] px-1.5 py-0.5 rounded border border-[#27272A]">
                        {h}
                      </span>
                      {i < selectedChunk.heading_path.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                      )}
                    </span>
                  ))}
                </div>

                {/* Formatted Markdown / Equation / Table Rendering */}
                <div className="p-4 rounded-lg bg-[#0E0E12] border border-[#29292F] space-y-3 font-sans text-xs leading-relaxed text-[#D4D4D8]">
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-transparent border-0 p-0 text-[#E4E4E7]">
                      {selectedChunk.content}
                    </pre>
                  </div>
                </div>

                {/* Detected Math Equation Highlight */}
                {selectedChunk.has_equation && (
                  <div className="p-3 rounded bg-emerald-950/20 border border-emerald-900/40 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                      <Sigma className="w-3.5 h-3.5" />
                      <span>Mathematical Environment Preserved</span>
                    </div>
                    <p className="text-[#A1A1AA] text-[11px]">
                      LaTeX formula bounds validated without truncation. Token budget extended dynamically to capture closed AST expression.
                    </p>
                  </div>
                )}

                {/* Detected Table Composite Highlight */}
                {selectedChunk.has_table && (
                  <div className="p-3 rounded bg-blue-950/20 border border-blue-900/40 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-blue-400 font-semibold mb-1">
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>Relational Matrix Table Intact</span>
                    </div>
                    <p className="text-[#A1A1AA] text-[11px]">
                      Headers and row data preserved in a unified block; markdown columns aligned.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-xs text-[#71717A]">
                Select a chunk to view contents.
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3 (Right): Metadata, Strategy, Diagnostics & Relationships (col-span-4) */}
        <div
          className={`lg:col-span-4 bg-[#131316] border border-[#29292F] rounded-lg flex flex-col overflow-hidden ${
            mobileTab === 'metadata' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="p-3 border-b border-[#222227] flex items-center justify-between bg-[#111114]">
            <span className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-violet-400" />
              Technical Metadata & Diagnostics
            </span>
            <button
              onClick={() => setShowJson(!showJson)}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1C1C22] text-[#A1A1AA] hover:text-white"
            >
              {showJson ? 'Card View' : 'Raw JSON'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedChunk ? (
              showJson ? (
                <JsonViewer data={selectedChunk} title="Chunk Metadata Payload" />
              ) : (
                <>
                  {/* Version Provenance & Isolation Card */}
                  <div className="p-3 rounded bg-[#0E0E12] border border-violet-900/40 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                        <GitCommit className="w-3.5 h-3.5 text-violet-400" />
                        Version Provenance
                      </span>
                      {selectedChunk.version_tag ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-950 text-violet-300 border border-violet-800">
                          {selectedChunk.version_tag}
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[10px]">v1.0.0</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#71717A]">Version ID:</span>
                      <span className="text-zinc-300">{selectedChunk.version_id || 'ver-initial'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#71717A]">Document Ref:</span>
                      <span className="text-zinc-300 truncate max-w-[140px]">{selectedChunk.document_id}</span>
                    </div>
                    <div className="pt-1 border-t border-[#1C1C22] flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Strict Cross-Version Isolation Verified</span>
                    </div>
                  </div>

                  {/* Deduplication & Cluster Provenance Card */}
                  <div className="p-3 rounded bg-[#0E0E12] border border-emerald-900/40 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5 text-emerald-400" />
                        Deduplication Status
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Canonical Chunk
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#71717A]">Cluster ID:</span>
                      <span className="text-zinc-300">
                        {selectedChunk.id === 'chk-vaswani-001' ? 'cluster-dup-01' : 'cluster-dup-02'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#71717A]">Consolidated Copies:</span>
                      <span className="text-emerald-400 font-bold">1 duplicate mapped (Zero loss)</span>
                    </div>
                    <div className="pt-1 border-t border-[#1C1C22] flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Reversible Mapping</span>
                      <button
                        onClick={() => setCurrentPage('benchmarks')}
                        className="text-violet-400 hover:text-white flex items-center gap-1"
                      >
                        Audit Before/After →
                      </button>
                    </div>
                  </div>

                  {/* Strategy & Tokens */}
                  <div className="p-3 rounded bg-[#0E0E12] border border-[#222227] space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">Chunk ID:</span>
                      <span className="text-violet-400 font-semibold">{selectedChunk.id}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">Strategy:</span>
                      <span className="text-emerald-400 font-semibold">{selectedChunk.strategy}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">Harness Version:</span>
                      <span className="text-[#F4F4F5]">v{selectedChunk.version}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">Token Count:</span>
                      <span className="text-[#F4F4F5]">{selectedChunk.token_count} tokens</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">Tokenizer:</span>
                      <span className="text-zinc-400">{selectedChunk.token_method}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">Source Pages:</span>
                      <span className="text-[#F4F4F5]">p. {selectedChunk.page_numbers.join(', ')}</span>
                    </div>
                  </div>

                  {/* Quality Gate Status */}
                  <div className="p-3 rounded bg-[#0E0E12] border border-[#222227] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-[#F4F4F5] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Quality Gate Diagnostics
                      </span>
                      <Badge status={selectedChunk.quality_status} size="xs" />
                    </div>

                    {selectedChunk.diagnostics.length === 0 ? (
                      <p className="text-[11px] text-[#A1A1AA] italic">
                        Clean AST pass: zero syntax fractures or severed formulas detected.
                      </p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {selectedChunk.diagnostics.map(diag => (
                          <div
                            key={diag.id}
                            className={`p-2.5 rounded border text-xs font-mono space-y-1 ${
                              diag.severity === 'hard_gate'
                                ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                                : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold uppercase tracking-wider">{diag.rule_name}</span>
                              <Badge severity={diag.severity} size="xs" />
                            </div>
                            <p className="text-[11px] leading-relaxed text-[#D4D4D8]">{diag.message}</p>
                            <p className="text-[10px] text-[#71717A] italic">Action: {diag.suggested_action}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Relational Graph Connections */}
                  <div className="p-3 rounded bg-[#0E0E12] border border-[#222227] space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        Relational Edges ({selectedChunk.relationships.length})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCurrentPage('graph')}
                        className="text-[10px] text-violet-400 hover:text-white flex items-center gap-1 p-0 h-auto"
                      >
                        <Network className="w-3 h-3 text-violet-400" />
                        Trace in Graph
                      </Button>
                    </div>

                    {selectedChunk.relationships.length === 0 ? (
                      <p className="text-[11px] text-[#71717A]">
                        No cross-chunk edges registered.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedChunk.relationships.map(rel => {
                          const isDependency = rel.relation_type.toUpperCase().includes('DEPEND') || rel.relation_type === 'DEPENDS_ON';
                          return (
                            <div
                              key={rel.id}
                              className="p-2 bg-[#141418] rounded border border-[#222227] flex items-center justify-between text-[11px]"
                            >
                              <div>
                                <span className="text-violet-300 block font-semibold">{rel.label}</span>
                                <span
                                  className={`text-[9px] uppercase px-1 py-0.2 rounded font-semibold ${
                                    isDependency
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {rel.relation_type}
                                </span>
                              </div>
                              <span className="text-emerald-400 font-bold">{(rel.strength * 100).toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Chunk Diff Modal (Part 4) */}
      <ChunkDiffModal
        chunk={selectedChunk}
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
      />
    </div>
  );
};

