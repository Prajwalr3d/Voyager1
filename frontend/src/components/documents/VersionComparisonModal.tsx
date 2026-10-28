import React, { useState, useEffect } from 'react';
import { DocumentVersionComparison, ChunkVersionDiff } from '../../types';
import { compareDocumentVersions, rollbackDocumentVersion } from '../../services/documentsApi';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  X,
  Split,
  GitCommit,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowRight,
  Hash,
  Loader2,
} from 'lucide-react';

interface VersionComparisonModalProps {
  documentId: string;
  documentName: string;
  baseVersionId: string;
  targetVersionId: string;
  baseVersionTag: string;
  targetVersionTag: string;
  isOpen: boolean;
  onClose: () => void;
  onVersionRolledBack?: () => void;
}

export const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({
  documentId,
  documentName,
  baseVersionId,
  targetVersionId,
  baseVersionTag,
  targetVersionTag,
  isOpen,
  onClose,
  onVersionRolledBack,
}) => {
  const [comparison, setComparison] = useState<DocumentVersionComparison | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'modified' | 'added' | 'removed' | 'unchanged'>('all');
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [rollbackSuccess, setRollbackSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    async function loadDiff() {
      try {
        setIsLoading(true);
        const data = await compareDocumentVersions(documentId, baseVersionId, targetVersionId);
        setComparison(data);
      } catch (err) {
        console.error('Failed to load version comparison:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDiff();
  }, [documentId, baseVersionId, targetVersionId, isOpen]);

  if (!isOpen) return null;

  const handleRollbackToBase = async () => {
    if (window.confirm(`Are you sure you want to rollback active retrieval to version ${baseVersionTag}?`)) {
      try {
        setIsRollingBack(true);
        await rollbackDocumentVersion(documentId, baseVersionId);
        setRollbackSuccess(true);
        if (onVersionRolledBack) onVersionRolledBack();
        setTimeout(() => {
          setRollbackSuccess(false);
          onClose();
        }, 1500);
      } catch (err) {
        console.error('Rollback failed:', err);
      } finally {
        setIsRollingBack(false);
      }
    }
  };

  const filteredDiffs = (comparison?.chunks_diff || []).filter(diff => {
    if (activeTab === 'all') return true;
    return diff.status === activeTab;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0E0E12] border border-[#29292F] rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#222227] flex items-center justify-between bg-[#131317]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-950/50 border border-violet-800/40 flex items-center justify-center text-violet-400">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#F4F4F5]">{documentName}</h3>
                <span className="text-xs font-mono text-zinc-500">•</span>
                <span className="text-xs font-mono text-violet-400">Version Diff</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-[#A1A1AA]">
                <span className="px-1.5 py-0.5 rounded bg-[#1C1C22] text-zinc-300 border border-[#29292F]">
                  Base: {baseVersionTag}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                <span className="px-1.5 py-0.5 rounded bg-violet-950/40 text-violet-300 border border-violet-800/30">
                  Target: {targetVersionTag}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              icon={<RotateCcw className="w-3 h-3 text-amber-400" />}
              isLoading={isRollingBack}
              disabled={rollbackSuccess}
              onClick={handleRollbackToBase}
              title={`Rollback active version to ${baseVersionTag}`}
            >
              {rollbackSuccess ? 'Rolled Back!' : `Rollback to ${baseVersionTag}`}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1C1C22]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metric Summary Bar */}
        {comparison && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#111115] border-b border-[#222227] text-xs font-mono">
            <div className="p-2 bg-[#16161B] rounded border border-[#222227] flex items-center justify-between">
              <span className="text-emerald-400">Added Chunks:</span>
              <strong className="text-emerald-300">+{comparison.added_chunks_count}</strong>
            </div>
            <div className="p-2 bg-[#16161B] rounded border border-[#222227] flex items-center justify-between">
              <span className="text-amber-400">Modified Chunks:</span>
              <strong className="text-amber-300">{comparison.modified_chunks_count}</strong>
            </div>
            <div className="p-2 bg-[#16161B] rounded border border-[#222227] flex items-center justify-between">
              <span className="text-rose-400">Removed Chunks:</span>
              <strong className="text-rose-300">{comparison.removed_chunks_count}</strong>
            </div>
            <div className="p-2 bg-[#16161B] rounded border border-[#222227] flex items-center justify-between">
              <span className="text-zinc-400">Unchanged Chunks:</span>
              <strong className="text-zinc-300">{comparison.unchanged_chunks_count}</strong>
            </div>
          </div>
        )}

        {/* Diff Tabs Filter */}
        <div className="px-4 py-2 border-b border-[#222227] flex items-center gap-2 bg-[#0E0E12] text-xs font-mono">
          <span className="text-[#71717A] text-[11px]">Filter by change:</span>
          {(['all', 'modified', 'added', 'removed', 'unchanged'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded text-xs transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-violet-950/60 text-violet-300 border border-violet-700/50'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181D]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body: Diff List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-[#71717A]">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
              Computing structural chunk AST diff between {baseVersionTag} and {targetVersionTag}...
            </div>
          ) : filteredDiffs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#71717A] border border-dashed border-[#29292F] rounded-lg">
              No chunk diffs match the current filter.
            </div>
          ) : (
            filteredDiffs.map(diff => (
              <div
                key={diff.chunk_id}
                className="bg-[#121216] border border-[#222227] rounded-lg p-3.5 space-y-3"
              >
                {/* Chunk Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-[#18181D] text-violet-400 border border-[#29292F]">
                      Chunk #{diff.chunk_index}
                    </span>
                    <span className="text-[#71717A]">
                      {diff.heading_path.join(' > ') || 'Root Section'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {diff.status === 'modified' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950/50 text-amber-300 border border-amber-800/40">
                        Modified
                      </span>
                    )}
                    {diff.status === 'added' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/50 text-emerald-300 border border-emerald-800/40">
                        Added
                      </span>
                    )}
                    {diff.status === 'removed' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950/50 text-rose-300 border border-rose-800/40">
                        Removed
                      </span>
                    )}
                    {diff.status === 'unchanged' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-900 text-zinc-400 border border-zinc-800">
                        Unchanged
                      </span>
                    )}

                    {diff.old_tokens !== undefined && diff.new_tokens !== undefined && (
                      <span className="text-[11px] text-[#A1A1AA]">
                        Tokens: {diff.old_tokens} → {diff.new_tokens} (
                        {diff.new_tokens - diff.old_tokens >= 0 ? '+' : ''}
                        {diff.new_tokens - diff.old_tokens})
                      </span>
                    )}
                  </div>
                </div>

                {/* Diff Explanation */}
                {diff.diff_summary && (
                  <p className="text-xs text-[#D4D4D8] italic bg-[#0A0A0D] p-2 rounded border border-[#1C1C22]">
                    <strong className="text-violet-400 not-italic">Provenance Note: </strong>
                    {diff.diff_summary}
                  </p>
                )}

                {/* Content Comparison View */}
                {diff.status === 'modified' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="space-y-1">
                      <div className="text-[11px] text-rose-400 flex items-center justify-between">
                        <span>Previous ({baseVersionTag})</span>
                        <span className="text-zinc-500">Base</span>
                      </div>
                      <div className="p-3 rounded bg-rose-950/15 border border-rose-900/30 text-rose-200/90 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-56">
                        {diff.old_content}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-emerald-400 flex items-center justify-between">
                        <span>Updated ({targetVersionTag})</span>
                        <span className="text-zinc-500">Target</span>
                      </div>
                      <div className="p-3 rounded bg-emerald-950/15 border border-emerald-900/30 text-emerald-200/90 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-56">
                        {diff.new_content}
                      </div>
                    </div>
                  </div>
                )}

                {diff.status === 'added' && (
                  <div className="space-y-1 text-xs font-mono">
                    <span className="text-[11px] text-emerald-400">Newly Introduced Content ({targetVersionTag})</span>
                    <div className="p-3 rounded bg-emerald-950/15 border border-emerald-900/30 text-emerald-200/90 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-56">
                      {diff.new_content}
                    </div>
                  </div>
                )}

                {diff.status === 'unchanged' && (
                  <div className="p-2.5 rounded bg-[#0D0D11] text-[#71717A] text-xs font-mono truncate">
                    {diff.new_content || diff.old_content || 'Content matches identically across both versions.'}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#222227] bg-[#131317] flex items-center justify-between text-xs font-mono text-[#71717A]">
          <span>
            Document ID: <strong className="text-zinc-400">{documentId}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  );
};
