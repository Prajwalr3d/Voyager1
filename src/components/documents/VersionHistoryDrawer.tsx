import React, { useState, useEffect, useRef } from 'react';
import { Document, DocumentVersion } from '../../types';
import {
  fetchDocumentVersions,
  createDocumentVersion,
  rollbackDocumentVersion,
} from '../../services/documentsApi';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  X,
  History,
  GitCommit,
  Copy,
  Check,
  RotateCcw,
  Split,
  UploadCloud,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Hash,
} from 'lucide-react';

interface VersionHistoryDrawerProps {
  document: Document;
  isOpen: boolean;
  onClose: () => void;
  onOpenCompare: (baseVerId: string, targetVerId: string, baseTag: string, targetTag: string) => void;
  onDocumentUpdated: () => void;
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  document,
  isOpen,
  onClose,
  onOpenCompare,
  onDocumentUpdated,
  notify,
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isRollbackingId, setIsRollbackingId] = useState<string | null>(null);

  // New version upload state
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [newVersionTag, setNewVersionTag] = useState<string>('v2.1.0');
  const [changeSummary, setChangeSummary] = useState<string>('');
  const [isSubmittingVersion, setIsSubmittingVersion] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadVersions();
  }, [document.id, isOpen]);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDocumentVersions(document.id);
      setVersions(data);
    } catch (err: any) {
      notify('error', `Failed to load versions: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleRollback = async (targetVer: DocumentVersion) => {
    if (window.confirm(`Activate version ${targetVer.version_tag} for all subsequent retrievals?`)) {
      try {
        setIsRollbackingId(targetVer.id);
        await rollbackDocumentVersion(document.id, targetVer.id);
        notify('success', `Active retrieval target set to ${targetVer.version_tag}`);
        await loadVersions();
        onDocumentUpdated();
      } catch (err: any) {
        notify('error', `Rollback failed: ${err.message}`);
      } finally {
        setIsRollbackingId(null);
      }
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      notify('warning', 'Please choose a document file to upload as the new revision.');
      return;
    }
    if (!newVersionTag.trim()) {
      notify('warning', 'Please provide a version identifier (e.g. v2.1.0).');
      return;
    }

    try {
      setIsSubmittingVersion(true);
      notify('info', `Ingesting revision ${newVersionTag} with AST structure checks...`);
      await createDocumentVersion(document.id, uploadFile, newVersionTag, changeSummary);
      notify('success', `Revision ${newVersionTag} created and set as active retrieval target.`);
      setShowUploadForm(false);
      setUploadFile(null);
      setChangeSummary('');
      await loadVersions();
      onDocumentUpdated();
    } catch (err: any) {
      notify('error', `Failed to ingest new version: ${err.message}`);
    } finally {
      setIsSubmittingVersion(false);
    }
  };

  const activeVersion = versions.find(v => v.is_active) || versions[0];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-[#0E0E12] border-l border-[#29292F] shadow-2xl flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[#222227] flex items-center justify-between bg-[#121216]">
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-sm font-semibold text-[#F4F4F5] truncate max-w-sm">
              {document.name}
            </h3>
            <p className="text-[11px] font-mono text-[#71717A]">
              Document Version History & Evidence Provenance
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1C1C22]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Bar: Upload Revision Trigger */}
      <div className="p-3 bg-[#111115] border-b border-[#222227] flex items-center justify-between">
        <div className="text-xs font-mono text-[#A1A1AA]">
          Total Versions: <strong className="text-white">{versions.length}</strong>
        </div>
        <Button
          variant={showUploadForm ? 'secondary' : 'primary'}
          size="xs"
          icon={<UploadCloud className="w-3.5 h-3.5" />}
          onClick={() => setShowUploadForm(!showUploadForm)}
        >
          {showUploadForm ? 'Cancel Revision' : 'Upload New Version'}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Upload Form (Expandable) */}
        {showUploadForm && (
          <form
            onSubmit={handleCreateVersion}
            className="p-4 bg-[#141419] border border-violet-900/40 rounded-lg space-y-3 font-mono text-xs animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-violet-400 text-xs">
                Ingest New Document Revision
              </span>
              <span className="text-[10px] text-zinc-500">Immutable Version Tag</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-[#A1A1AA] block">Document File (.pdf, .md, .txt)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.md,.txt"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
                className="w-full bg-[#0E0E12] border border-[#29292F] rounded p-1.5 text-xs text-[#F4F4F5] file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-violet-950 file:text-violet-300 hover:file:bg-violet-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-[#A1A1AA] block">Version Tag</label>
                <input
                  type="text"
                  value={newVersionTag}
                  onChange={e => setNewVersionTag(e.target.value)}
                  placeholder="e.g. v2.1.0"
                  className="w-full bg-[#0E0E12] border border-[#29292F] rounded px-2.5 py-1 text-xs text-[#F4F4F5] focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#A1A1AA] block">Author / Submitter</label>
                <input
                  type="text"
                  disabled
                  value="researcher@graphite.org"
                  className="w-full bg-[#0E0E12] border border-[#222227] rounded px-2.5 py-1 text-xs text-zinc-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-[#A1A1AA] block">Change Summary</label>
              <textarea
                rows={2}
                value={changeSummary}
                onChange={e => setChangeSummary(e.target.value)}
                placeholder="Describe key structural, mathematical, or textual changes in this version..."
                className="w-full bg-[#0E0E12] border border-[#29292F] rounded p-2 text-xs text-[#F4F4F5] focus:outline-none focus:border-violet-500"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingVersion}
              className="w-full"
            >
              Parse & Deploy Version {newVersionTag}
            </Button>
          </form>
        )}

        {/* Version List */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#71717A]">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-400" />
            Loading version ledger...
          </div>
        ) : versions.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#71717A] border border-dashed border-[#29292F] rounded-lg">
            No version history recorded.
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map(ver => {
              const isActive = ver.is_active;
              return (
                <div
                  key={ver.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-violet-950/20 border-violet-600/40 shadow-sm'
                      : 'bg-[#121216] border-[#222227] hover:border-[#2D2D35]'
                  }`}
                >
                  {/* Version Top Bar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white bg-[#18181F] px-2 py-0.5 rounded border border-[#29292F]">
                        {ver.version_tag}
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                          <CheckCircle className="w-3 h-3" />
                          <span>Active Target</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-500 bg-[#16161B] px-1.5 py-0.5 rounded">
                          Historical Archive
                        </span>
                      )}
                    </div>

                    <Badge status={ver.quality_status} size="xs" />
                  </div>

                  {/* Change Log Summary */}
                  <p className="text-xs text-[#D4D4D8] leading-relaxed mb-2.5 font-sans">
                    {ver.change_summary}
                  </p>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#A1A1AA] bg-[#0A0A0D] p-2 rounded border border-[#1A1A20] mb-3">
                    <div>
                      <span className="text-[#71717A]">Chunks: </span>
                      <strong className="text-zinc-300">{ver.chunk_count} blocks</strong>
                    </div>
                    <div>
                      <span className="text-[#71717A]">Pages: </span>
                      <strong className="text-zinc-300">{ver.page_count}</strong>
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-[#71717A] truncate max-w-[80px]">Hash:</span>
                      <button
                        onClick={() => handleCopyHash(ver.content_hash)}
                        className="text-violet-400 hover:text-violet-300 flex items-center gap-1 font-mono text-[10px]"
                        title="Click to copy SHA-256 fingerprint"
                      >
                        <span>{ver.content_hash.slice(0, 16)}...</span>
                        {copiedHash === ver.content_hash ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="col-span-2 text-[10px] text-[#71717A] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(ver.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#1C1C22]">
                    {!isActive && activeVersion && (
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<Split className="w-3 h-3 text-violet-400" />}
                        onClick={() =>
                          onOpenCompare(ver.id, activeVersion.id, ver.version_tag, activeVersion.version_tag)
                        }
                      >
                        Diff vs Active
                      </Button>
                    )}

                    {!isActive && (
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={<RotateCcw className="w-3 h-3 text-amber-400" />}
                        isLoading={isRollbackingId === ver.id}
                        onClick={() => handleRollback(ver)}
                      >
                        Set as Active
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-[#121216] border-t border-[#222227] flex items-center justify-between text-xs font-mono text-[#71717A]">
        <span>Strict isolation enforced against cross-version evidence leakage</span>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};
