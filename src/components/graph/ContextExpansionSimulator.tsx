import React, { useState } from 'react';
import { ExpandedContextResult, ContextExpansionConfig, GraphEdgeType } from '../../types';
import { expandContextWithDependencies } from '../../services/graphApi';
import { Button } from '../ui/Button';
import {
  Network,
  Zap,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface ContextExpansionSimulatorProps {
  seedNodeId: string;
  seedLabel: string;
  documentId: string;
  versionId?: string;
  onNavigateToChunk?: (chunkId: string) => void;
  onHighlightNodes?: (nodeIds: string[]) => void;
}

export const ContextExpansionSimulator: React.FC<ContextExpansionSimulatorProps> = ({
  seedNodeId,
  seedLabel,
  documentId,
  versionId,
  onNavigateToChunk,
  onHighlightNodes,
}) => {
  const [tokenBudget, setTokenBudget] = useState<number>(512);
  const [maxHops, setMaxHops] = useState<number>(2);
  const [allowedTypes, setAllowedTypes] = useState<GraphEdgeType[]>([
    'DEPENDS_ON',
    'DEFINES',
    'REFERENCES',
    'PARENT_CHILD',
  ]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [expansionResult, setExpansionResult] = useState<ExpandedContextResult | null>(null);

  const handleToggleEdgeType = (type: GraphEdgeType) => {
    if (allowedTypes.includes(type)) {
      if (allowedTypes.length > 1) {
        setAllowedTypes(prev => prev.filter(t => t !== type));
      }
    } else {
      setAllowedTypes(prev => [...prev, type]);
    }
  };

  const handleRunExpansion = async () => {
    try {
      setIsRunning(true);
      const config: ContextExpansionConfig = {
        max_expansion_tokens: tokenBudget,
        max_hop_depth: maxHops,
        allowed_edge_types: allowedTypes,
        avoid_cycles: true,
        version_id: versionId,
      };

      const result = await expandContextWithDependencies([seedNodeId], config);
      setExpansionResult(result);

      if (onHighlightNodes) {
        const highlighted = [
          seedNodeId,
          ...result.traversal_paths.map(p => p.target_id),
          ...result.expanded_chunks.map(c => c.id),
        ];
        onHighlightNodes(highlighted);
      }
    } catch (err) {
      console.error('Context expansion failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-[#111115] border border-[#222227] rounded-lg p-3 space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-violet-400 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Bounded Dependency Expansion
        </span>
        <span className="text-[10px] text-zinc-500">Feature 2 Engine</span>
      </div>

      <div className="p-2 rounded bg-[#0A0A0D] border border-[#1C1C22] text-[11px] text-[#A1A1AA]">
        <span className="text-zinc-500">Seed Entity: </span>
        <strong className="text-white">{seedLabel}</strong>
      </div>

      {/* Sliders */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#71717A]">Token Budget Limit:</span>
          <span className="text-emerald-400 font-bold">{tokenBudget} tokens</span>
        </div>
        <input
          type="range"
          min="128"
          max="1024"
          step="64"
          value={tokenBudget}
          onChange={e => setTokenBudget(Number(e.target.value))}
          className="w-full accent-violet-500 h-1 bg-[#1F1F26] rounded cursor-pointer"
        />

        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#71717A]">Max Hop Depth:</span>
          <span className="text-violet-400 font-bold">{maxHops} hops</span>
        </div>
        <input
          type="range"
          min="1"
          max="3"
          step="1"
          value={maxHops}
          onChange={e => setMaxHops(Number(e.target.value))}
          className="w-full accent-violet-500 h-1 bg-[#1F1F26] rounded cursor-pointer"
        />
      </div>

      {/* Allowed Edge Types Filter */}
      <div className="space-y-1">
        <span className="text-[10px] text-[#71717A] block">Allowed Dependency Types:</span>
        <div className="flex flex-wrap gap-1">
          {(['DEPENDS_ON', 'DEFINES', 'REFERENCES', 'PARENT_CHILD', 'PREVIOUS_NEXT'] as GraphEdgeType[]).map(
            type => {
              const active = allowedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => handleToggleEdgeType(type)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                    active
                      ? 'bg-violet-950 text-violet-300 border border-violet-700/60'
                      : 'bg-[#18181F] text-zinc-500 border border-[#27272E]'
                  }`}
                >
                  {type}
                </button>
              );
            }
          )}
        </div>
      </div>

      <Button
        variant="primary"
        size="xs"
        className="w-full"
        isLoading={isRunning}
        icon={<Network className="w-3 h-3" />}
        onClick={handleRunExpansion}
      >
        Traverse & Expand Dependencies
      </Button>

      {/* Expansion Results */}
      {expansionResult && (
        <div className="p-2.5 rounded bg-[#0A0A0E] border border-violet-900/30 space-y-2 animate-fade-in text-xs">
          <div className="flex justify-between items-center text-[11px] pb-1 border-b border-[#1A1A22]">
            <span className="text-[#71717A]">Token Consumption:</span>
            <span className="text-white font-bold">
              {expansionResult.total_tokens} / {expansionResult.token_budget} tokens
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#A1A1AA]">
            <div>
              Initial: <strong className="text-zinc-300">{expansionResult.initial_tokens} tokens</strong>
            </div>
            <div>
              Expanded: <strong className="text-emerald-400">+{expansionResult.expanded_tokens} tokens</strong>
            </div>
            <div>
              Cycles Avoided: <strong className="text-violet-400">{expansionResult.cycles_detected}</strong>
            </div>
            <div>
              Pruned (Over Budget): <strong className="text-amber-400">{expansionResult.pruned_candidates_count}</strong>
            </div>
          </div>

          {/* Justified Path Trace */}
          {expansionResult.traversal_paths.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-zinc-400 block font-semibold">
                Inclusion Justifications ({expansionResult.traversal_paths.length}):
              </span>
              <div className="space-y-1">
                {expansionResult.traversal_paths.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-[#131318] border border-[#222228] text-[10px] text-[#D4D4D8] leading-tight"
                  >
                    <div className="flex items-center gap-1 text-violet-400 mb-0.5">
                      <span className="font-bold uppercase">[{p.edge_type}]</span>
                      <span className="text-zinc-500">Hop {p.hop_depth}</span>
                    </div>
                    <p className="italic text-[#A1A1AA]">{p.justification}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expanded Chunks Quick Links */}
          {expansionResult.expanded_chunks.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-zinc-400 block font-semibold">
                Expanded Supporting Chunks:
              </span>
              <div className="space-y-1">
                {expansionResult.expanded_chunks.map(chunk => (
                  <div
                    key={chunk.id}
                    className="p-1.5 rounded bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-between text-[10px]"
                  >
                    <span className="text-emerald-300 font-semibold">{chunk.id}</span>
                    <span className="text-zinc-400">{chunk.token_count} tokens</span>
                    {onNavigateToChunk && (
                      <button
                        onClick={() => onNavigateToChunk(chunk.id)}
                        className="text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                      >
                        <span>View</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
