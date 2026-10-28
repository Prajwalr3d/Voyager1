import React, { useState } from 'react';
import { BenchmarkConfig } from '../../types';
import { Button } from '../ui/Button';
import {
  Sliders,
  Play,
  X,
  Cpu,
  Database,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface BenchmarkConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (config: BenchmarkConfig) => Promise<void>;
  isRunning: boolean;
}

export const BenchmarkConfigModal: React.FC<BenchmarkConfigModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  isRunning,
}) => {
  const [datasetName, setDatasetName] = useState<string>('SciEval-Gold-500 (Math, CS, Quantum Physics)');
  const [chunkSize, setChunkSize] = useState<number>(512);
  const [overlapTokens, setOverlapTokens] = useState<number>(50);
  const [topK, setTopK] = useState<number>(5);
  const [embeddingModel, setEmbeddingModel] = useState<string>('BAAI/bge-large-en-v1.5');
  const [vectorDb, setVectorDb] = useState<string>('Qdrant (HNSW / Cosine)');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute({
      dataset_name: datasetName,
      document_ids: ['doc-vaswani-2017', 'doc-he-2015-resnet'],
      chunk_size: chunkSize,
      overlap_tokens: overlapTokens,
      top_k: topK,
      embedding_model: embeddingModel,
      vector_db: vectorDb,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-xl bg-[#111115] border border-[#29292F] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#222227] flex items-center justify-between bg-[#141419]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet-400" />
            <div>
              <h3 className="text-sm font-semibold text-[#F4F4F5]">
                Configure Comparative Evaluation Experiment
              </h3>
              <p className="text-[11px] font-mono text-[#71717A]">
                Feature 3: Parameter-controlled benchmark harness across 4 strategy candidates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-1 rounded text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1C1C22]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-mono">
          {/* Dataset Selection */}
          <div className="space-y-1">
            <label className="text-[#A1A1AA] font-semibold block text-[11px]">
              Evaluation Dataset
            </label>
            <select
              value={datasetName}
              onChange={e => setDatasetName(e.target.value)}
              className="w-full bg-[#18181D] border border-[#29292F] rounded p-2 text-xs text-[#F4F4F5] outline-none"
            >
              <option value="SciEval-Gold-500 (Math, CS, Quantum Physics)">
                SciEval-Gold-500 (Math, CS, Quantum Physics) — 500 Queries
              </option>
              <option value="NeurIPS-Transformer-Suite (Vaswani & He et al.)">
                NeurIPS-Transformer-Suite (Vaswani & He et al.) — 250 Queries
              </option>
              <option value="ArXiv-Math-Formulas-Eval-100">
                ArXiv-Math-Formulas-Eval-100 (LaTeX & Matrix Verification)
              </option>
            </select>
          </div>

          {/* Chunk Size & Overlap Sliders */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-[#0C0C0F] border border-[#1C1C22] rounded-lg">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#A1A1AA]">Chunk Size Window:</span>
                <span className="text-violet-400 font-bold">{chunkSize} tokens</span>
              </div>
              <input
                type="range"
                min="128"
                max="1024"
                step="128"
                value={chunkSize}
                onChange={e => setChunkSize(Number(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#71717A]">
                <span>128t</span>
                <span>256t</span>
                <span>512t</span>
                <span>1024t</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#A1A1AA]">Window Overlap:</span>
                <span className="text-violet-400 font-bold">{overlapTokens} tokens</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="25"
                value={overlapTokens}
                onChange={e => setOverlapTokens(Number(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#71717A]">
                <span>0t</span>
                <span>25t</span>
                <span>50t</span>
                <span>100t</span>
              </div>
            </div>
          </div>

          {/* Top-K Retrieval Depth */}
          <div className="p-3 bg-[#0C0C0F] border border-[#1C1C22] rounded-lg space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-[#A1A1AA]">Retrieval Top-K Candidates:</span>
              <span className="text-emerald-400 font-bold">Top-{topK}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 5, 10].map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTopK(k)}
                  className={`py-1.5 text-center rounded border transition-colors ${
                    topK === k
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-[#141418] border-[#222227] text-zinc-400 hover:text-white'
                  }`}
                >
                  k = {k}
                </button>
              ))}
            </div>
          </div>

          {/* Embedding Model & Vector DB */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#A1A1AA] text-[11px] flex items-center gap-1">
                <Cpu className="w-3 h-3 text-violet-400" />
                Embedding Model
              </label>
              <select
                value={embeddingModel}
                onChange={e => setEmbeddingModel(e.target.value)}
                className="w-full bg-[#18181D] border border-[#29292F] rounded p-2 text-xs text-[#F4F4F5] outline-none"
              >
                <option value="BAAI/bge-large-en-v1.5">BAAI/bge-large-en-v1.5 (1024d)</option>
                <option value="text-embedding-3-large">text-embedding-3-large (3072d)</option>
                <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (384d)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[#A1A1AA] text-[11px] flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-400" />
                Vector Indexing Target
              </label>
              <select
                value={vectorDb}
                onChange={e => setVectorDb(e.target.value)}
                className="w-full bg-[#18181D] border border-[#29292F] rounded p-2 text-xs text-[#F4F4F5] outline-none"
              >
                <option value="Qdrant (HNSW / Cosine)">Qdrant (HNSW / Cosine)</option>
                <option value="PGVector (HNSW / Inner Product)">PGVector (HNSW / Inner Product)</option>
                <option value="Milvus v2.4 (IVF-FLAT)">Milvus v2.4 (IVF-FLAT)</option>
              </select>
            </div>
          </div>

          <div className="p-2.5 rounded bg-violet-950/20 border border-violet-900/40 text-[11px] text-violet-300 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
            <span>
              All 4 strategy candidates (Fixed-Size, Structure-Aware, SmartChunk, SmartChunk+Graph) will be evaluated in parallel across identical test questions to isolate chunking effect.
            </span>
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#222227]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRunning}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isRunning}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Run Experiment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

