import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { uploadDocument, fetchDocumentBlocks, deleteDocument } from '../services/documentsApi';
import { triggerFileDownload } from '../services/exportApi';
import { Document, ExtractedBlock, FileType } from '../types';
import { VersionHistoryDrawer } from '../components/documents/VersionHistoryDrawer';
import { VersionComparisonModal } from '../components/documents/VersionComparisonModal';
import {
  UploadCloud,
  FileText,
  Search,
  Filter,
  Trash2,
  Binary,
  Layers,
  ChevronRight,
  X,
  FileCode,
  AlertCircle,
  Clock,
  CheckCircle,
  Loader2,
  Table,
  BookOpen,
  History,
  GitBranch,
  Download,
  ArrowUpDown,
  RotateCw,
  AlertTriangle,
} from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const {
    documents,
    refreshDocuments,
    selectedDocumentId,
    setSelectedDocumentId,
    setCurrentPage,
    notify,
    isDemoMode,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'chunks' | 'size'>('newest');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeDrawerDoc, setActiveDrawerDoc] = useState<Document | null>(null);
  const [versionDrawerDoc, setVersionDrawerDoc] = useState<Document | null>(null);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [compareModalState, setCompareModalState] = useState<{
    isOpen: boolean;
    documentId: string;
    documentName: string;
    baseVersionId: string;
    targetVersionId: string;
    baseVersionTag: string;
    targetVersionTag: string;
  }>({
    isOpen: false,
    documentId: '',
    documentName: '',
    baseVersionId: '',
    targetVersionId: '',
    baseVersionTag: '',
    targetVersionTag: '',
  });

  const [extractedBlocks, setExtractedBlocks] = useState<ExtractedBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDrawer = async (doc: Document) => {
    setActiveDrawerDoc(doc);
    try {
      setLoadingBlocks(true);
      const blocks = await fetchDocumentBlocks(doc.id);
      setExtractedBlocks(blocks);
    } catch (err: any) {
      notify('error', `Failed to load extracted structure: ${err.message}`);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFileUpload(e.target.files[0]);
    }
  };

  const processFileUpload = async (file: File) => {
    const validExtensions = ['.md', '.markdown', '.txt', '.pdf'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => lowerName.endsWith(ext));

    if (!hasValidExt) {
      notify('error', 'Unsupported format. Markdown (.md), Plaintext (.txt), and PDF documents are supported.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setFailedFile(null);
      setUploadProgress(20);
      notify('info', `Uploading "${file.name}" and extracting Markdown / AST structure...`);

      const pTimer = setInterval(() => {
        setUploadProgress(p => (p < 85 ? p + 20 : p));
      }, 300);

      const newDoc = await uploadDocument(file);
      clearInterval(pTimer);
      setUploadProgress(100);

      await refreshDocuments();
      setSelectedDocumentId(newDoc.id);
      notify('success', `"${file.name}" uploaded successfully. Structural AST parsed.`);
    } catch (err: any) {
      setFailedFile(file);
      setUploadError(err.message || 'Network upload timeout');
      notify('error', `Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    try {
      setIsDeleting(true);
      await deleteDocument(docToDelete.id);
      await refreshDocuments();
      if (activeDrawerDoc?.id === docToDelete.id) setActiveDrawerDoc(null);
      notify('info', `Document "${docToDelete.name}" removed from corpus.`);
      setDocToDelete(null);
    } catch (err: any) {
      notify('error', `Failed to delete document: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadDocument = async (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    try {
      notify('info', `Preparing download for "${doc.name}"...`);
      const blocks = await fetchDocumentBlocks(doc.id);
      const textContent = blocks.length > 0
        ? `# ${doc.name}\n\n` +
          `> Extracted by SmartChunk v2.4 (AST Structural Parser)\n` +
          `> Source file: ${doc.filename} | Type: ${doc.file_type.toUpperCase()} | Version: ${doc.active_version_tag || 'v1.0.0'}\n\n` +
          blocks.map(b => b.content).join('\n\n')
        : `# ${doc.name}\n\n${doc.metadata.abstract || 'Document text extracted from corpus.'}`;

      const ext = doc.file_type === 'markdown' ? 'md' : doc.file_type === 'txt' ? 'txt' : 'md';
      triggerFileDownload(textContent, `${doc.filename.replace(/\.[^/.]+$/, '')}_smartchunk.${ext}`, 'text/markdown');
      notify('success', `Downloaded "${doc.name}".`);
    } catch (err: any) {
      notify('error', `Failed to download: ${err.message}`);
    }
  };

  const filteredDocs = documents
    .filter(doc => {
      const matchesSearch =
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.metadata.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.metadata.arxiv_id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedTypeFilter === 'all' || doc.file_type === selectedTypeFilter;
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        case 'oldest':
          return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'chunks':
          return (b.chunk_count || 0) - (a.chunk_count || 0);
        case 'size':
          return b.size_bytes - a.size_bytes;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleFileDrop}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragActive
            ? 'border-violet-500 bg-violet-950/20'
            : 'border-[#29292F] hover:border-[#3F3F46] bg-[#0E0E12]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#18181F] border border-[#29292F] flex items-center justify-center text-violet-400 mb-3 shadow-inner">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>

          <h3 className="text-sm font-semibold text-[#F4F4F5]">
            Upload Markdown Document, Technical Spec, or Research Paper
          </h3>
          <p className="text-xs text-[#A1A1AA] mt-1 max-w-md">
            Drag & drop Markdown (<span className="text-violet-300 font-mono">.md</span>), Plaintext (<span className="text-violet-300 font-mono">.txt</span>), or PDF. SmartChunk prioritizes Markdown heading trees, LaTeX equations, and matrix tables.
          </p>

          {isUploading && uploadProgress > 0 && (
            <div className="w-64 mt-3 space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-[#A1A1AA]">
                <span>Ingesting AST...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#27272A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              isLoading={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
            <span className="text-xs text-[#71717A] font-mono">
              Max file size: 50MB (Markdown prioritized)
            </span>
          </div>
        </div>
      </div>

      {/* Upload Failure Retry Banner */}
      {uploadError && failedFile && (
        <div className="p-3.5 bg-rose-950/30 border border-rose-900/60 rounded-lg flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Upload of <strong>"{failedFile.name}"</strong> failed: {uploadError}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="xs"
              icon={<RotateCw className="w-3 h-3" />}
              onClick={() => processFileUpload(failedFile)}
            >
              Retry Upload
            </Button>
            <button
              onClick={() => {
                setUploadError(null);
                setFailedFile(null);
              }}
              className="text-zinc-500 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Filter, Sort, and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search documents by title, arXiv ID, or domain..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#131316] border border-[#29292F] rounded pl-9 pr-3 py-1.5 text-xs text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-violet-500 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#71717A]" />
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="bg-[#131316] border border-[#29292F] rounded px-2.5 py-1.5 text-xs text-[#F4F4F5] outline-none font-mono"
            >
              <option value="all">All Formats</option>
              <option value="markdown">Markdown (.md)</option>
              <option value="pdf">PDF Document</option>
              <option value="txt">Plaintext (.txt)</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#131316] border border-[#29292F] rounded px-2.5 py-1.5 text-xs text-[#F4F4F5] outline-none font-mono"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Indexed</option>
            <option value="processing">Processing</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>

          {/* Sorting */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3 h-3 text-[#71717A]" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-[#131316] border border-[#29292F] rounded px-2.5 py-1.5 text-xs text-[#F4F4F5] outline-none font-mono"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Title (A-Z)</option>
              <option value="name-desc">Title (Z-A)</option>
              <option value="chunks">Most Chunks</option>
              <option value="size">Largest Size</option>
            </select>
          </div>
        </div>
      </div>

      {/* Document Table */}
      <Card>
        <CardHeader
          title={`Corpus Documents (${filteredDocs.length})`}
          subtitle="Select any document to preview extracted structural elements or inspect generated chunks"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0E0E12] text-[#71717A] border-b border-[#222227]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Document</th>
                <th className="py-2.5 px-3 font-medium">Domain / Metadata</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium">Size</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">Quality Gate</th>
                <th className="py-2.5 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C22]">
              {filteredDocs.map(doc => {
                const isSelected = selectedDocumentId === doc.id;
                return (
                  <tr
                    key={doc.id}
                    onClick={() => handleOpenDrawer(doc)}
                    className={`hover:bg-[#16161B] transition-colors cursor-pointer ${
                      isSelected ? 'bg-violet-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-[#F4F4F5] font-sans font-medium">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs text-[#F4F4F5] flex items-center gap-2">
                            <span>{doc.name}</span>
                            {doc.active_version_tag && (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                                {doc.active_version_tag}
                              </span>
                            )}
                            {doc.metadata.arxiv_id && (
                              <span className="text-[10px] font-mono text-zinc-400 bg-[#1C1C22] px-1.5 py-0.2 rounded">
                                arXiv:{doc.metadata.arxiv_id}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-[#71717A] block truncate max-w-xs">
                            {doc.filename}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-[#A1A1AA]">
                      <span className="truncate max-w-[150px] block">
                        {doc.metadata.domain || 'Scientific Paper'}
                      </span>
                    </td>

                    <td className="py-3 px-3 uppercase text-[#A1A1AA]">{doc.file_type}</td>

                    <td className="py-3 px-3 text-[#71717A]">
                      {(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </td>

                    <td className="py-3 px-3">
                      {doc.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Indexed</span>
                        </span>
                      ) : doc.status === 'processing' ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{doc.processing_progress || 50}%</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#71717A] text-xs">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Queued</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <Badge status={doc.quality_status} size="xs" />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="xs"
                          icon={<History className="w-3 h-3 text-emerald-400" />}
                          onClick={() => setVersionDrawerDoc(doc)}
                          title="Manage Document Versions & Provenance"
                        >
                          Versions ({doc.versions_count || 1})
                        </Button>
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={<Binary className="w-3 h-3 text-violet-400" />}
                          onClick={() => {
                            setSelectedDocumentId(doc.id);
                            setCurrentPage('inspector');
                          }}
                          title="Inspect Chunks"
                        >
                          Chunks ({doc.chunk_count})
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<Download className="w-3 h-3 text-zinc-400" />}
                          onClick={e => handleDownloadDocument(e, doc)}
                          title="Download document text / markdown"
                        />
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={e => {
                            e.stopPropagation();
                            setDocToDelete(doc);
                          }}
                          title="Delete document"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Document Details & Extracted Structure Drawer */}
      {activeDrawerDoc && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] bg-[#0E0E12] border-l border-[#29292F] shadow-2xl flex flex-col animate-fade-in">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#222227] flex items-center justify-between bg-[#121216]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F5] truncate max-w-sm">
                  {activeDrawerDoc.name}
                </h3>
                <p className="text-[11px] font-mono text-[#71717A]">
                  Extracted Document Structure & AST Diagnostics
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveDrawerDoc(null)}
              className="p-1 rounded text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1C1C22]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Metadata Summary */}
            <div className="p-3 bg-[#131317] rounded border border-[#222227] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#71717A]">arXiv ID:</span>
                <span className="font-mono text-violet-400">{activeDrawerDoc.metadata.arxiv_id || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">Page Count:</span>
                <span className="font-mono text-[#F4F4F5]">{activeDrawerDoc.page_count} pages</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">Chunks Generated:</span>
                <span className="font-mono text-emerald-400">{activeDrawerDoc.chunk_count} valid chunks</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">Quality Gate Status:</span>
                <Badge status={activeDrawerDoc.quality_status} size="xs" />
              </div>
              {activeDrawerDoc.metadata.abstract && (
                <div className="pt-2 border-t border-[#222227]">
                  <span className="text-[11px] text-[#71717A] uppercase font-mono block mb-1">Abstract</span>
                  <p className="text-[#A1A1AA] text-[11px] leading-relaxed italic">
                    {activeDrawerDoc.metadata.abstract}
                  </p>
                </div>
              )}
            </div>

            {/* Extracted Structure Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  Extracted Structural Blocks ({extractedBlocks.length})
                </h4>
                <span className="text-[10px] font-mono text-[#71717A]">AST Parse Tree</span>
              </div>

              {loadingBlocks ? (
                <div className="p-6 text-center text-xs text-[#71717A]">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-400" />
                  Extracting document blocks...
                </div>
              ) : extractedBlocks.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#71717A] border border-dashed border-[#29292F] rounded">
                  No blocks extracted for this file yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {extractedBlocks.map(block => (
                    <div
                      key={block.id}
                      className="p-3 bg-[#131317] rounded border border-[#222227] text-xs font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-violet-400 font-semibold uppercase">
                          [{block.type}] {block.level ? `Level ${block.level}` : ''}
                        </span>
                        <span className="text-[#71717A]">Page {block.page_number}</span>
                      </div>

                      {block.type === 'equation' ? (
                        <div className="p-2 bg-[#0A0A0C] border border-[#29292F] rounded text-emerald-400 text-xs overflow-x-auto">
                          <code>{block.latex || block.content}</code>
                        </div>
                      ) : block.type === 'table' ? (
                        <div className="space-y-1">
                          <p className="text-[#A1A1AA] text-[11px] italic">{block.caption}</p>
                          {block.table_rows && (
                            <div className="overflow-x-auto border border-[#29292F] rounded">
                              <table className="w-full text-[10px]">
                                <tbody>
                                  {block.table_rows.map((row, rIdx) => (
                                    <tr key={rIdx} className={rIdx === 0 ? 'bg-[#1C1C22] font-bold text-white' : 'border-t border-[#222227] text-[#A1A1AA]'}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-1 px-2 border-r border-[#222227]">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[#D4D4D8] font-sans leading-relaxed text-xs">
                          {block.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-3 bg-[#121216] border-t border-[#222227] flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDrawerDoc(null)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Binary className="w-3.5 h-3.5" />}
              onClick={() => {
                setSelectedDocumentId(activeDrawerDoc.id);
                setCurrentPage('inspector');
              }}
            >
              Inspect Chunks ({activeDrawerDoc.chunk_count})
            </Button>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {versionDrawerDoc && (
        <VersionHistoryDrawer
          document={versionDrawerDoc}
          isOpen={!!versionDrawerDoc}
          onClose={() => setVersionDrawerDoc(null)}
          onOpenCompare={(baseVerId, targetVerId, baseTag, targetTag) => {
            setCompareModalState({
              isOpen: true,
              documentId: versionDrawerDoc.id,
              documentName: versionDrawerDoc.name,
              baseVersionId: baseVerId,
              targetVersionId: targetVerId,
              baseVersionTag: baseTag,
              targetVersionTag: targetTag,
            });
          }}
          onDocumentUpdated={async () => {
            await refreshDocuments();
          }}
          notify={notify}
        />
      )}

      {/* Version Comparison / Diff Modal */}
      {compareModalState.isOpen && (
        <VersionComparisonModal
          documentId={compareModalState.documentId}
          documentName={compareModalState.documentName}
          baseVersionId={compareModalState.baseVersionId}
          targetVersionId={compareModalState.targetVersionId}
          baseVersionTag={compareModalState.baseVersionTag}
          targetVersionTag={compareModalState.targetVersionTag}
          isOpen={compareModalState.isOpen}
          onClose={() =>
            setCompareModalState(prev => ({ ...prev, isOpen: false }))
          }
          onVersionRolledBack={async () => {
            await refreshDocuments();
          }}
        />
      )}

      {/* Delete Confirmation Modal (Part 2) */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131317] border border-[#29292F] rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-950/50 border border-rose-900/60 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F5]">Delete Document from Corpus</h3>
                <p className="text-xs text-[#A1A1AA]">This action will permanently remove the paper and its chunks.</p>
              </div>
            </div>

            <div className="p-3 bg-[#0E0E12] border border-[#222227] rounded text-xs font-mono space-y-1">
              <div>Title: <strong className="text-white">{docToDelete.name}</strong></div>
              <div>File: <span className="text-zinc-400">{docToDelete.filename}</span></div>
              <div>Chunks: <span className="text-violet-400">{docToDelete.chunk_count} chunks</span></div>
              <div>Active Version: <span className="text-emerald-400">{docToDelete.active_version_tag || 'v1.0.0'}</span></div>
            </div>

            <div className="text-[11px] text-amber-300/80 bg-amber-950/20 border border-amber-900/40 p-2.5 rounded">
              Warning: Vector embeddings in Qdrant/pgvector and knowledge graph relationships linked to this document will be pruned.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDocToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                isLoading={isDeleting}
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

