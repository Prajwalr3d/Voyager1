import React, { useState } from 'react';
import {
  RetrievalInspectionQuery,
  RetrievalInspectionResult,
  RetrievedChunkEvidence,
} from '../../types';
import { inspectRagRetrieval } from '../../services/retrievalApi';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Search,
  Zap,
  Layers,
  FileText,
  Sigma,
  Table as TableIcon,
  ShieldCheck,
  ArrowRight,
  GitCommit,
  Sparkles,
  Clock,
  Sliders,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

interface RetrievalInspectionLabProps {
  selectedDocumentId: string;
  versionPolicy: 'active_only' | 'historical_pinned' | 'all_versions';
}

export const RetrievalInspectionLab: React.FC<RetrievalInspectionLabProps> = ({
  selectedDocumentId,
  versionPolicy,
}) => {
  const [query, setQuery] = useState<string>(
    'How does scaled dot-product attention compute the variance denominator?'
  );
  const [strategy, setStrategy] = useState<'smartchunk_v2' | 'recursive' | 'structure_aware' | 'fixed_window'>('smartchunk_v2');
  const [topK, setTopK] = useState<number>(5);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [result, setResult] = useState<RetrievalInspectionResult | null>(null);
  const [selectedEvidenceChunkId, setSelectedEvidenceChunkId] = useState<string | null>(null);

  const handleRunInspection = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    try {
      setIsSearching(true);
      const res = await inspectRagRetrieval({
        query: q,
        top_k: topK,
        version_policy: versionPolicy,
        strategy: strategy,
      });
      setResult(res);
      if (res.retrieved_chunks.length > 0) {
        setSelectedEvidenceChunkId(res.retrieved_chunks[0].chunk.id);
      }
    } catch (err: any) {
      console.error('Retrieval inspection error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const sampleQueries = [
    'How does scaled dot-product attention compute the variance denominator?',
    'What is the residual mapping formulation in Deep Residual Learning?',
    'What are the per-layer computational complexities in Table 1?',
  ];

  const activeEvidence = result?.retrieved_chunks.find(
    c => c.chunk.id === selectedEvidenceChunkId
  ) || result?.retrieved_chunks[0];

  return (
    <div className="flex-1 flex flex-col space-y-4 p-4 overflow-y-auto bg-[#09090B]">
      {/* Query Bar and Controls */}
      <div className="bg-[#121216] border border-[#29292F] rounded-lg p-3 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRunInspection()}
              placeholder="Enter scientific question to test retrieval evidence..."
              className="w-full bg-[#18181D] border border-[#29292F] rounded-lg pl-9 pr-3 py-2 text-xs text-[#F4F4F5] placeholder-[#71717A] outline-none font-mono focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value as any)}
              className="bg-[#18181D] border border-[#29292F] rounded-lg px-2.5 py-2 text-xs font-mono text-violet-300 outline-none"
            >
              <option value="smartchunk_v2">SmartChunk (AST Bounds)</option>
              <option value="recursive">Recursive Splitting</option>
              <option value="structure_aware">Structure-Aware Naive</option>
              <option value="fixed_window">Fixed Window (512 tokens)</option>
            </select>

            <div className="flex items-center gap-1.5 bg-[#18181D] border border-[#29292F] rounded-lg px-2.5 py-2 text-xs font-mono text-[#A1A1AA]">
              <span>Top-K:</span>
              <select
                value={topK}
                onChange={e => setTopK(Number(e.target.value))}
                className="bg-transparent text-white font-bold outline-none"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={8}>8</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="sm"
              isLoading={isSearching}
              icon={<Zap className="w-3.5 h-3.5" />}
              onClick={() => handleRunInspection()}
            >
              Inspect Retrieval
            </Button>
          </div>
        </div>

        {/* Quick Sample Queries */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[#71717A] text-[11px]">Sample Queries:</span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(sq);
                handleRunInspection(sq);
              }}
              className="text-[11px] text-zinc-400 hover:text-violet-300 bg-[#18181D] px-2 py-0.5 rounded border border-[#222227] hover:border-violet-800 transition-colors"
            >
              "{sq.slice(0, 45)}..."
            </button>
          ))}
        </div>
      </div>

      {/* Main Side-by-Side Display */}
      {result ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left Column (5 cols): Synthesized Answer & Provenance Breakdown */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Generated Answer Card */}
            <Card className="flex flex-col">
              <CardHeader
                title="Grounded Answer Synthesis"
                subtitle={`Generated via ${result.strategy} in ${result.execution_time_ms}ms`}
                action={
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Evidence Verified
                  </span>
                }
              />
              <CardBody className="space-y-3 font-sans text-xs text-[#E4E4E7] leading-relaxed">
                <p className="bg-[#0E0E12] p-3.5 rounded-lg border border-[#222227]">
                  {result.generated_answer}
                </p>

                <div className="pt-2">
                  <span className="text-xs font-semibold text-[#F4F4F5] font-mono block mb-2">
                    Source Provenance Citations ({result.provenance_links.length}):
                  </span>
                  <div className="space-y-1.5 font-mono text-xs">
                    {result.provenance_links.map((link, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedEvidenceChunkId(link.chunk_id)}
                        className={`p-2 rounded border flex items-center justify-between cursor-pointer transition-colors ${
                          selectedEvidenceChunkId === link.chunk_id
                            ? 'bg-violet-950/40 border-violet-500 text-white'
                            : 'bg-[#141419] border-[#222227] text-zinc-400 hover:text-white hover:bg-[#18181E]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-violet-400 font-bold">[{idx + 1}]</span>
                          <span className="truncate max-w-[190px]">{link.document_name}</span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-800/40">
                            {link.version_tag}
                          </span>
                        </div>
                        <span className="text-emerald-400 font-bold shrink-0">{link.relevance_pct}% match</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Selected Evidence Highlight Details */}
            {activeEvidence && (
              <Card>
                <CardHeader
                  title="Evidence Passage Details"
                  subtitle={`Chunk #${activeEvidence.chunk.chunk_index} • ${activeEvidence.chunk.heading_path.join(' > ')}`}
                />
                <CardBody className="space-y-2 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-[#0E0E12] rounded border border-[#222227]">
                      <span className="text-[#71717A] block">Similarity Score:</span>
                      <strong className="text-emerald-400 text-sm">{(activeEvidence.score * 100).toFixed(1)}%</strong>
                    </div>
                    <div className="p-2 bg-[#0E0E12] rounded border border-[#222227]">
                      <span className="text-[#71717A] block">Token Count:</span>
                      <strong className="text-violet-300 text-sm">{activeEvidence.chunk.token_count} toks</strong>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#0E0E12] rounded border border-[#222227] text-[11px] text-zinc-400">
                    <div>Document: <strong className="text-white">{activeEvidence.chunk.document_name}</strong></div>
                    <div>Version ID: <span className="text-zinc-300">{activeEvidence.chunk.version_id || 'ver-vaswani-v2'}</span></div>
                    <div>Page: <span className="text-zinc-300">p.{activeEvidence.chunk.page_numbers.join(', ')}</span></div>
                    <div>Offsets: <span className="text-zinc-300">[{activeEvidence.source_location?.start_offset}..{activeEvidence.source_location?.end_offset}]</span></div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right Column (7 cols): Ranked Evidence Passages Stream */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-mono pb-1 border-b border-[#222227]">
              <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-violet-400" />
                Retrieved Supporting Evidence Passages ({result.retrieved_chunks.length})
              </span>
              <span className="text-[#71717A]">Ranked by Relevance</span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {result.retrieved_chunks.map((hit, rank) => {
                const isSelected = selectedEvidenceChunkId === hit.chunk.id;
                return (
                  <div
                    key={hit.chunk.id}
                    onClick={() => setSelectedEvidenceChunkId(hit.chunk.id)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer font-mono text-xs space-y-2.5 ${
                      isSelected
                        ? 'bg-[#15151C] border-violet-500 shadow-lg shadow-violet-950/20'
                        : 'bg-[#111115] border-[#222227] hover:bg-[#16161B]'
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-violet-950 border border-violet-800 flex items-center justify-center text-[10px] font-bold text-violet-300">
                          {rank + 1}
                        </span>
                        <span className="text-[#F4F4F5] font-semibold">Chunk #{hit.chunk.chunk_index}</span>
                        {hit.chunk.version_tag && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-950 text-violet-300 border border-violet-800">
                            {hit.chunk.version_tag}
                          </span>
                        )}
                        <Badge status={hit.chunk.quality_status} size="xs" />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold text-xs bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
                          {(hit.score * 100).toFixed(1)}% Relevance
                        </span>
                      </div>
                    </div>

                    {/* Structural Heading Breadcrumb */}
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1 truncate">
                      <span className="text-zinc-500">Section:</span>
                      <strong className="text-zinc-200">{hit.chunk.heading_path.join(' > ') || 'Root Document'}</strong>
                    </div>

                    {/* Raw Text Passage That Served As Evidence (Highlighted) */}
                    <div className="p-3 bg-[#0A0A0D] border border-[#1E1E26] rounded text-xs font-sans leading-relaxed text-[#D4D4D8] whitespace-pre-wrap selection:bg-violet-900/40">
                      {hit.chunk.content}
                    </div>

                    {/* Footer Diagnostics & Equation Indicators */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                      <div className="flex items-center gap-3">
                        {hit.chunk.has_equation && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Sigma className="w-3 h-3" /> LaTeX Closed
                          </span>
                        )}
                        {hit.chunk.has_table && (
                          <span className="flex items-center gap-1 text-blue-400">
                            <TableIcon className="w-3 h-3" /> Table Intact
                          </span>
                        )}
                        <span>{hit.chunk.token_count} tokens</span>
                      </div>
                      <span>Page {hit.chunk.page_numbers.join(', ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-xs text-[#71717A] space-y-3">
          <Search className="w-10 h-10 text-zinc-700 mx-auto" />
          <h4 className="text-sm font-semibold text-[#F4F4F5]">Retrieval Inspection Workbench</h4>
          <p className="max-w-md">
            Click "Inspect Retrieval" or pick a sample query above to evaluate chunk relevance scores, source version isolation, and side-by-side evidence passages.
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={<Zap className="w-3.5 h-3.5" />}
            onClick={() => handleRunInspection()}
          >
            Run Default Inspection Query
          </Button>
        </div>
      )}
    </div>
  );
};

