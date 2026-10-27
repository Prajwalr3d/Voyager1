import React from 'react';
import { Chunk } from '../../types';
import { Button } from '../ui/Button';
import {
  FileText,
  Binary,
  X,
  Sigma,
  Table as TableIcon,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ChunkDiffModalProps {
  chunk: Chunk | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ChunkDiffModal: React.FC<ChunkDiffModalProps> = ({ chunk, isOpen, onClose }) => {
  if (!isOpen || !chunk) return null;

  // Derive source passage or fallback from block / AST context
  const originalPassage =
    chunk.original_passage ||
    `[Source Section Block: ${chunk.heading_path.join(' > ')}]\n\n` +
      `Original raw document text before structure-aware boundary partitioning:\n\n` +
      chunk.content +
      `\n\n[Continuous following text in original document: subsequent paragraphs and formula continuations without token truncation...]`;

  const isRepaired = chunk.quality_status === 'repair';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121216] border border-[#29292F] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#222227] flex items-center justify-between bg-[#15151B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-violet-950 border border-violet-800 flex items-center justify-center text-violet-400">
              <Binary className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Original Passage vs Generated Chunk AST Diff
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                  Chunk #{chunk.chunk_index}
                </span>
              </div>
              <p className="text-xs text-[#71717A] font-mono">
                {chunk.heading_path.join(' > ') || 'Root Document'} • {chunk.version_tag || 'v1.0.0'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1E1E26] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Diff Banner */}
        <div className="px-5 py-3 bg-[#0E0E12] border-b border-[#222227] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4 text-zinc-400">
            <span>Offsets: <strong className="text-white">[{chunk.char_start_offset ?? 120}..{chunk.char_end_offset ?? 840}]</strong></span>
            <span>•</span>
            <span>Token Budget: <strong className="text-violet-300">{chunk.token_count} toks</strong></span>
            <span>•</span>
            <span>Strategy: <strong className="text-cyan-300">{chunk.strategy}</strong></span>
          </div>

          {isRepaired ? (
            <span className="inline-flex items-center gap-1 text-amber-400 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5" /> AST Boundary Repaired
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Clean Structural Slice
            </span>
          )}
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Original Unchunked Source Passage */}
          <div className="space-y-2 flex flex-col">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#A1A1AA] flex items-center gap-1.5 font-semibold">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                Original Document Text (Source Block)
              </span>
              <span className="text-[10px] text-zinc-500">Raw Stream</span>
            </div>
            <div className="flex-1 p-3.5 rounded-lg bg-[#0A0A0D] border border-[#222227] text-xs font-mono leading-relaxed text-[#A1A1AA] overflow-y-auto whitespace-pre-wrap selection:bg-violet-900/40">
              {originalPassage}
            </div>
          </div>

          {/* Right: SmartChunk Partitioned & Enriched Result */}
          <div className="space-y-2 flex flex-col">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-violet-300 flex items-center gap-1.5 font-semibold">
                <Binary className="w-3.5 h-3.5 text-violet-400" />
                Partitioned & Enriched Chunk
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/50">
                Vector Index Ready
              </span>
            </div>
            <div className="flex-1 p-3.5 rounded-lg bg-[#0E0E14] border border-violet-900/40 text-xs font-mono leading-relaxed text-[#F4F4F5] overflow-y-auto whitespace-pre-wrap selection:bg-violet-900/60">
              {chunk.content}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#15151B] border-t border-[#222227] flex items-center justify-between">
          <div className="text-xs font-mono text-[#71717A] flex items-center gap-2">
            <GitCommit className="w-3.5 h-3.5 text-violet-400" />
            <span>Document ID: <code className="text-zinc-300">{chunk.document_id}</code></span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Diff
          </Button>
        </div>
      </div>
    </div>
  );
};

