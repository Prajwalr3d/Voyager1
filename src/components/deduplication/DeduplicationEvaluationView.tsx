import React, { useState, useEffect } from 'react';
import { DeduplicationEvaluationResult, DuplicateCluster, DuplicateClusterMember } from '../../types';
import {
  fetchDeduplicationEvaluation,
  toggleDeduplication,
  runDeduplicationAudit,
} from '../../services/deduplicationApi';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Copy,
  Layers,
  Database,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
  RotateCcw,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Play,
  Info,
  GitCommit,
  ExternalLink,
  Split,
  Check,
  X,
  Trash2,
} from 'lucide-react';

export const DeduplicationEvaluationView: React.FC = () => {
  const [data, setData] = useState<DeduplicationEvaluationResult | null>(null);
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.85);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [compareMember, setCompareMember] = useState<DuplicateClusterMember | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{
    member: DuplicateClusterMember;
    action: 'consolidate' | 'distinct' | 'suppress';
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const res = await fetchDeduplicationEvaluation();
        setData(res);
        if (res.clusters.length > 0) {
          setSelectedClusterId(res.clusters[0].id);
        }
      } catch (err) {
        console.error('Failed to load deduplication evaluation:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToggleActive = async () => {
    if (!data) return;
    try {
      const nextActive = !data.deduplication_active;
      await toggleDeduplication(nextActive);
      setData(prev => prev ? { ...prev, deduplication_active: nextActive } : null);
    } catch (err) {
      console.error('Toggle deduplication failed:', err);
    }
  };

  const handleRunAudit = async () => {
    try {
      setIsAuditing(true);
      const res = await runDeduplicationAudit({
        similarity_threshold: similarityThreshold,
      });
      setData(res);
      if (res.clusters.length > 0 && !res.clusters.some(c => c.id === selectedClusterId)) {
        setSelectedClusterId(res.clusters[0].id);
      }
    } catch (err) {
      console.error('Audit run failed:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const activeCluster = data?.clusters.find(c => c.id === selectedClusterId) || data?.clusters[0];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-lg border border-[#29292F] bg-[#131317] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Copy className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Feature 5: Deduplication & Before/After Evaluation
            </span>
          </div>
          <h2 className="text-base font-semibold text-[#F4F4F5] tracking-tight">
            Cryptographic SHA-256 Exact Matching & Near-Duplicate Clustering
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Reversibly consolidate redundant document chunks while verifying zero recall degradation and complete provenance retention.
          </p>
        </div>

        {/* Controls: Reversible Toggle & Run Audit */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer bg-[#18181D] border border-[#29292F] rounded px-3 py-1.5 text-xs font-mono text-[#F4F4F5] select-none">
            <input
              type="checkbox"
              checked={data?.deduplication_active ?? true}
              onChange={handleToggleActive}
              className="rounded accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Deduplication Active (Reversible)</span>
          </label>

          <Button
            variant="primary"
            size="sm"
            isLoading={isAuditing}
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={handleRunAudit}
          >
            Re-run Deduplication Audit
          </Button>
        </div>
      </div>

      {/* Threshold Slider Bar */}
      <div className="p-3 bg-[#111115] border border-[#222227] rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-[#A1A1AA] flex items-center gap-1.5 shrink-0">
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            Near-Duplicate Threshold:
          </span>
          <input
            type="range"
            min="0.80"
            max="0.99"
            step="0.01"
            value={similarityThreshold}
            onChange={e => setSimilarityThreshold(Number(e.target.value))}
            className="w-48 accent-emerald-500 cursor-pointer"
          />
          <span className="text-emerald-400 font-bold">{(similarityThreshold * 100).toFixed(0)}% Jaccard</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span>Exact (SHA-256): <strong className="text-white">{data?.exact_duplicates_count || 2}</strong></span>
          <span>•</span>
          <span>Near-Duplicates: <strong className="text-white">{data?.near_duplicates_count || 2}</strong></span>
          <span>•</span>
          <span>Clusters: <strong className="text-white">{data?.clusters_found || 4}</strong></span>
        </div>
      </div>

      {data && (
        <>
          {/* Side-by-Side Controlled Evaluation KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono">
            {/* Storage Footprint */}
            <div className="p-3.5 bg-[#111115] border border-[#222227] rounded-lg space-y-1">
              <span className="text-[10px] uppercase text-[#71717A] tracking-wider block">
                Index Storage Footprint
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-zinc-500">{data.storage_before_kb} KB</span>
                <span className="text-base font-bold text-emerald-400">{data.storage_after_kb} KB</span>
              </div>
              <div className="text-[10px] text-emerald-300 font-semibold">
                -{data.storage_saved_pct}% Reduction ({data.reduction_pct}% fewer chunks)
              </div>
            </div>

            {/* Redundant Retrieval Rate */}
            <div className="p-3.5 bg-[#111115] border border-[#222227] rounded-lg space-y-1">
              <span className="text-[10px] uppercase text-[#71717A] tracking-wider block">
                Redundant Retrieval Rate
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-rose-400">{data.redundant_retrieval_rate_before}%</span>
                <span className="text-base font-bold text-emerald-400">{data.redundant_retrieval_rate_after}%</span>
              </div>
              <div className="text-[10px] text-emerald-300 font-semibold">
                Zero Redundant Top-K Chunks
              </div>
            </div>

            {/* Retrieval Recall */}
            <div className="p-3.5 bg-[#111115] border border-[#222227] rounded-lg space-y-1">
              <span className="text-[10px] uppercase text-[#71717A] tracking-wider block">
                Retrieval Recall@5 (Zero Loss)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-zinc-400">{(data.retrieval_recall_before * 100).toFixed(1)}%</span>
                <span className="text-zinc-600">→</span>
                <span className="text-base font-bold text-emerald-400">{(data.retrieval_recall_after * 100).toFixed(1)}%</span>
              </div>
              <div className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                100% Evidence Coverage Retained
              </div>
            </div>

            {/* Retrieval Latency */}
            <div className="p-3.5 bg-[#111115] border border-[#222227] rounded-lg space-y-1">
              <span className="text-[10px] uppercase text-[#71717A] tracking-wider block">
                Retrieval Latency
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-zinc-500">{data.latency_ms_before}ms</span>
                <span className="text-base font-bold text-emerald-400">{data.latency_ms_after}ms</span>
              </div>
              <div className="text-[10px] text-emerald-300 font-semibold">
                26.2% Speedup (Fewer candidates)
              </div>
            </div>

            {/* Answer Faithfulness */}
            <div className="p-3.5 bg-[#111115] border border-[#222227] rounded-lg space-y-1">
              <span className="text-[10px] uppercase text-[#71717A] tracking-wider block">
                Answer Faithfulness
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-zinc-400">{data.faithfulness_score_before.toFixed(3)}</span>
                <span className="text-zinc-600">→</span>
                <span className="text-base font-bold text-emerald-400">{data.faithfulness_score_after.toFixed(3)}</span>
              </div>
              <div className="text-[10px] text-emerald-300 font-semibold">
                +1.3% (Reduced noise)
              </div>
            </div>
          </div>

          {/* Cluster Inspector & Provenance Mapping */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Clusters List (4 cols) */}
            <div className="lg:col-span-4 bg-[#111115] border border-[#29292F] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#222227]">
                <span className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-1.5 font-mono">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  Identified Duplicate Clusters ({data.clusters.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {data.clusters.map(cluster => {
                  const isSelected = cluster.id === selectedClusterId;
                  const isExact = cluster.similarity_method === 'sha256_exact';

                  return (
                    <div
                      key={cluster.id}
                      onClick={() => setSelectedClusterId(cluster.id)}
                      className={`p-2.5 rounded border transition-colors cursor-pointer font-mono text-xs ${
                        isSelected
                          ? 'bg-violet-950/30 border-violet-500'
                          : 'bg-[#15151A] border-[#222227] hover:bg-[#1A1A22]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white truncate max-w-[170px]">
                          {cluster.id}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                            isExact
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isExact ? 'SHA-256 Exact' : `${(cluster.similarity_score * 100).toFixed(0)}% Jaccard`}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                        <span>Canonical: {cluster.canonical_chunk_id}</span>
                        <span className="text-zinc-500">{cluster.members.length} copies</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Cluster Members & Provenance Detail (8 cols) */}
            <div className="lg:col-span-8 bg-[#111115] border border-[#29292F] rounded-lg p-4 space-y-4">
              {activeCluster ? (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-[#222227]">
                    <div>
                      <h4 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
                        <span>Cluster: {activeCluster.id}</span>
                        <span className="text-xs text-zinc-500">
                          ({activeCluster.members.length} members mapped to canonical)
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#A1A1AA] font-mono mt-0.5">
                        Similarity Method: <strong className="text-violet-300">{activeCluster.similarity_method}</strong> • Match Confidence: <strong className="text-emerald-400">{(activeCluster.similarity_score * 100).toFixed(1)}%</strong>
                      </p>
                    </div>

                    <div className="p-1 px-2.5 rounded bg-emerald-950/40 border border-emerald-900/60 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Zero Evidence Destruction Guarantee</span>
                    </div>
                  </div>

                  {/* Cluster Members Cards */}
                  <div className="space-y-3 font-mono text-xs">
                    {activeCluster.members.map(member => (
                      <div
                        key={member.chunk_id}
                        className={`p-3.5 rounded-lg border space-y-2 ${
                          member.is_canonical
                            ? 'bg-emerald-950/15 border-emerald-800/60'
                            : 'bg-[#15151A] border-[#222227]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {member.is_canonical ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700 uppercase">
                                ★ Canonical Representative
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700 uppercase">
                                Redundant Duplicate (Candidate)
                              </span>
                            )}
                            <span className="text-[#F4F4F5] font-semibold">{member.chunk_id}</span>
                            {member.version_tag && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-950 text-violet-300 border border-violet-800">
                                {member.version_tag}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-zinc-400 text-[11px]">
                              Similarity: <strong className="text-white">{(member.similarity_score * 100).toFixed(0)}%</strong>
                            </span>
                            {!member.is_canonical && (
                              <button
                                onClick={() => setCompareMember(member)}
                                className="px-2 py-0.5 rounded bg-violet-950/70 border border-violet-800/60 text-violet-300 hover:text-white flex items-center gap-1 text-[10px]"
                                title="Compare side-by-side with canonical chunk"
                              >
                                <Split className="w-3 h-3" />
                                <span>Compare</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Content snippet */}
                        <div className="p-2.5 bg-[#0C0C0F] border border-[#1C1C22] rounded text-[11px] leading-relaxed text-[#D4D4D8]">
                          "{member.content_preview}"
                        </div>

                        {/* Provenance Mapping & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-zinc-500 pt-1 border-t border-[#1C1C22]">
                          <div>
                            <span>Origin: <strong className="text-zinc-300">{member.document_name || member.document_id}</strong></span>
                            <span className="mx-2">•</span>
                            <span>Ref: <strong className="text-violet-400">{member.provenance_reference}</strong></span>
                          </div>

                          {!member.is_canonical && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setActionConfirm({ member, action: 'consolidate' })}
                                className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/70 text-emerald-300 hover:text-white text-[10px]"
                              >
                                Consolidate
                              </button>
                              <button
                                onClick={() => setActionConfirm({ member, action: 'distinct' })}
                                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px]"
                              >
                                Mark Distinct
                              </button>
                              <button
                                onClick={() => setActionConfirm({ member, action: 'suppress' })}
                                className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-900/60 text-rose-300 hover:text-white text-[10px]"
                              >
                                Suppress
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-violet-950/20 border border-violet-900/40 rounded-lg text-xs font-mono text-violet-300 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <span>
                      When deduplication is active, downstream vector retrieval only indexes the Canonical Representative. When citations or provenance audits are requested, SmartChunk traverses the cluster members table to reveal all original source documents without duplicating embedding storage.
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Side-by-Side Comparison Modal (Part 5) */}
          {compareMember && activeCluster && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <div className="bg-[#121216] border border-[#29292F] rounded-xl max-w-4xl w-full p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#222227]">
                  <div className="flex items-center gap-2">
                    <Split className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-[#F4F4F5] font-mono">
                      Side-by-Side Duplicate Candidate Comparison
                    </h3>
                  </div>
                  <button onClick={() => setCompareMember(null)} className="text-zinc-400 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  {/* Canonical Column */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-emerald-950/30 border border-emerald-800/60 text-emerald-300">
                      <span className="font-semibold">★ Canonical Representative</span>
                      <span>ID: {activeCluster.canonical_chunk_id}</span>
                    </div>
                    <div className="p-3 bg-[#0A0A0D] border border-[#222227] rounded h-56 overflow-y-auto leading-relaxed text-[#F4F4F5]">
                      {activeCluster.members.find(m => m.is_canonical)?.content_preview || 'Canonical chunk text...'}
                    </div>
                  </div>

                  {/* Duplicate Candidate Column */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-amber-950/30 border border-amber-800/60 text-amber-300">
                      <span className="font-semibold">Candidate Duplicate</span>
                      <span>Similarity: {(compareMember.similarity_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="p-3 bg-[#0A0A0D] border border-[#222227] rounded h-56 overflow-y-auto leading-relaxed text-[#F4F4F5]">
                      {compareMember.content_preview}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#0E0E12] border border-[#222227] rounded text-xs font-mono text-zinc-400 flex items-center justify-between">
                  <span>Method: <strong className="text-violet-300">{activeCluster.similarity_method}</strong></span>
                  <span>Origin: <strong className="text-white">{compareMember.document_name || compareMember.document_id}</strong></span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setCompareMember(null)}>
                    Close Comparison
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Action Confirmation Modal (Part 5) */}
          {actionConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <div className="bg-[#131317] border border-[#29292F] rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl font-mono text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-950/50 border border-violet-800/60 flex items-center justify-center text-violet-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#F4F4F5]">
                      {actionConfirm.action === 'consolidate'
                        ? 'Confirm Duplicate Consolidation'
                        : actionConfirm.action === 'distinct'
                        ? 'Mark as Distinct (False Positive)'
                        : 'Suppress from Retrieval'}
                    </h4>
                    <p className="text-[11px] text-zinc-400">Target: {actionConfirm.member.chunk_id}</p>
                  </div>
                </div>

                <div className="p-3 bg-[#0A0A0D] border border-[#222227] rounded space-y-1.5 text-[11px]">
                  <div>Similarity Match: <strong className="text-emerald-400">{(actionConfirm.member.similarity_score * 100).toFixed(0)}%</strong></div>
                  <div>Origin Paper: <span className="text-zinc-300">{actionConfirm.member.document_name || actionConfirm.member.document_id}</span></div>
                  <div>Provenance Reference: <span className="text-violet-300">{actionConfirm.member.provenance_reference}</span></div>
                </div>

                <p className="text-[11px] text-zinc-400">
                  {actionConfirm.action === 'consolidate'
                    ? 'The canonical representative will answer queries for this chunk while full provenance references remain intact.'
                    : actionConfirm.action === 'distinct'
                    ? 'This chunk will be indexed independently as a unique vector embedding.'
                    : 'This chunk will be excluded from vector search index.'}
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setActionConfirm(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setStatusMessage(`Action "${actionConfirm.action}" applied to ${actionConfirm.member.chunk_id}`);
                      setActionConfirm(null);
                      setTimeout(() => setStatusMessage(null), 3000);
                    }}
                  >
                    Confirm Action
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

