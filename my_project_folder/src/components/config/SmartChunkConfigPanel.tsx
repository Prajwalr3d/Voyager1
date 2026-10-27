import React, { useState, useEffect } from 'react';
import { SmartChunkConfig } from '../../types';
import {
  fetchSmartChunkConfig,
  saveSmartChunkConfig,
  resetSmartChunkConfigToDefaults,
  validateSmartChunkConfig,
  ConfigValidationResult,
} from '../../services/configApi';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Sigma,
  Table as TableIcon,
  Code2,
  ListTree,
  FileText,
  Copy,
  Cpu,
  Database,
  Sparkles,
  Info,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface SmartChunkConfigPanelProps {
  onSaved?: (config: SmartChunkConfig) => void;
}

export const SmartChunkConfigPanel: React.FC<SmartChunkConfigPanelProps> = ({ onSaved }) => {
  const [config, setConfig] = useState<SmartChunkConfig | null>(null);
  const [validation, setValidation] = useState<ConfigValidationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const cfg = await fetchSmartChunkConfig();
      setConfig(cfg);
      setValidation(validateSmartChunkConfig(cfg));
    }
    load();
  }, []);

  const handleChange = <K extends keyof SmartChunkConfig>(key: K, value: SmartChunkConfig[K]) => {
    if (!config) return;
    const updated = { ...config, [key]: value };
    setConfig(updated);
    setValidation(validateSmartChunkConfig(updated));
    setFeedbackMsg(null);
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setIsSaving(true);
      await saveSmartChunkConfig(config);
      setFeedbackMsg({ type: 'success', text: 'SmartChunk configuration saved and applied to ingestion pipeline.' });
      if (onSaved) onSaved(config);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const defaults = resetSmartChunkConfigToDefaults();
    setConfig(defaults);
    setValidation(validateSmartChunkConfig(defaults));
    setFeedbackMsg({ type: 'success', text: 'Reset to default production parameters.' });
  };

  const applyPreset = (preset: 'scientific' | 'code' | 'dense') => {
    if (!config) return;
    let presetValues: Partial<SmartChunkConfig> = {};
    if (preset === 'scientific') {
      presetValues = {
        max_chunk_size_tokens: 512,
        overlap_tokens: 50,
        preserve_formulas: true,
        preserve_tables: true,
        preserve_headings: true,
        preserve_lists: true,
        preserve_paragraphs: true,
        preserve_code_blocks: true,
        semantic_fallback_enabled: true,
        semantic_similarity_threshold: 0.75,
        enable_deduplication: true,
        deduplication_threshold: 0.85,
      };
    } else if (preset === 'code') {
      presetValues = {
        max_chunk_size_tokens: 768,
        overlap_tokens: 60,
        preserve_formulas: false,
        preserve_tables: true,
        preserve_headings: true,
        preserve_lists: true,
        preserve_paragraphs: false,
        preserve_code_blocks: true,
        semantic_fallback_enabled: false,
        enable_deduplication: true,
        deduplication_threshold: 0.90,
      };
    } else if (preset === 'dense') {
      presetValues = {
        max_chunk_size_tokens: 384,
        overlap_tokens: 30,
        preserve_formulas: true,
        preserve_tables: true,
        preserve_headings: true,
        preserve_lists: true,
        preserve_paragraphs: true,
        preserve_code_blocks: false,
        semantic_fallback_enabled: true,
        semantic_similarity_threshold: 0.80,
        enable_deduplication: true,
        deduplication_threshold: 0.85,
      };
    }
    const updated = { ...config, ...presetValues };
    setConfig(updated);
    setValidation(validateSmartChunkConfig(updated));
    setFeedbackMsg({ type: 'success', text: `Loaded "${preset}" preset configuration.` });
  };

  if (!config || !validation) {
    return <div className="p-6 text-xs text-[#71717A] text-center">Loading SmartChunk configuration...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Configuration Header Card */}
      <div className="rounded-lg border border-[#29292F] bg-[#131317] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sliders className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-violet-400 font-semibold">
              Part 3: SmartChunk Parameter Configuration
            </span>
          </div>
          <h3 className="text-sm font-semibold text-[#F4F4F5]">
            Structure-Aware Splitting, Token Boundaries & AST Rules
          </h3>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Configure dynamic chunk sizing, overlap boundaries, structural preservation toggles, and deduplication thresholds.
          </p>
        </div>

        {/* Preset Buttons & Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center bg-[#18181D] border border-[#29292F] rounded p-0.5 text-xs font-mono">
            <button
              onClick={() => applyPreset('scientific')}
              className="px-2 py-1 rounded text-violet-300 hover:text-white hover:bg-violet-950/50"
            >
              Scientific
            </button>
            <button
              onClick={() => applyPreset('code')}
              className="px-2 py-1 rounded text-blue-300 hover:text-white hover:bg-blue-950/50"
            >
              Code Spec
            </button>
            <button
              onClick={() => applyPreset('dense')}
              className="px-2 py-1 rounded text-emerald-300 hover:text-white hover:bg-emerald-950/50"
            >
              Dense Prose
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleReset}
          >
            Defaults
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSaving}
            disabled={!validation.isValid}
            icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSave}
          >
            Apply Config
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-lg text-xs font-mono flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/30 border border-emerald-900/60 text-emerald-300'
              : 'bg-rose-950/30 border border-rose-900/60 text-rose-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-zinc-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column: Sizing, Overlap, and Fallbacks */}
        <Card>
          <CardHeader
            title="Token Budget & Window Sizing"
            subtitle="Configures target token limits and sliding overlap bounds"
          />
          <CardBody className="space-y-4 text-xs font-mono">
            {/* Max Chunk Size Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[#F4F4F5] font-semibold">Max Chunk Size (Tokens):</span>
                <span className="text-violet-400 font-bold text-sm">{config.max_chunk_size_tokens} tokens</span>
              </div>
              <input
                type="range"
                min="128"
                max="1024"
                step="32"
                value={config.max_chunk_size_tokens}
                onChange={e => handleChange('max_chunk_size_tokens', Number(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#71717A]">
                <span>128 (Fine-grained)</span>
                <span>512 (Standard Recommended)</span>
                <span>1024 (Context Heavy)</span>
              </div>
            </div>

            {/* Overlap Tokens Slider */}
            <div className="space-y-1.5 pt-2 border-t border-[#222227]">
              <div className="flex justify-between items-center">
                <span className="text-[#F4F4F5] font-semibold">Overlap Size (Tokens):</span>
                <span className="text-violet-400 font-bold text-sm">{config.overlap_tokens} tokens</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.overlap_tokens}
                onChange={e => handleChange('overlap_tokens', Number(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#71717A]">
                <span>0 (No overlap)</span>
                <span>50 (Recommended)</span>
                <span>100 (Max overlap)</span>
              </div>
            </div>

            {/* Token Counting Method */}
            <div className="space-y-1.5 pt-2 border-t border-[#222227]">
              <label className="text-[#F4F4F5] font-semibold block">Tokenizer Scheme:</label>
              <select
                value={config.token_method}
                onChange={e => handleChange('token_method', e.target.value as any)}
                className="w-full bg-[#18181D] border border-[#29292F] rounded p-2 text-xs text-[#F4F4F5] outline-none"
              >
                <option value="cl100k_base">cl100k_base (OpenAI GPT-4 / text-embedding-3)</option>
                <option value="o200k_base">o200k_base (GPT-4o & Omni Models)</option>
                <option value="p50k_base">p50k_base (Legacy Codex / Text-Davinci)</option>
              </select>
            </div>

            {/* Semantic Fallback Settings */}
            <div className="space-y-2 pt-2 border-t border-[#222227]">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-[#F4F4F5] font-semibold block">Semantic Fallback Splitting</span>
                  <span className="text-[11px] text-[#71717A] font-sans">
                    Falls back to semantic boundary splitting when explicit headings are absent
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={config.semantic_fallback_enabled}
                  onChange={e => handleChange('semantic_fallback_enabled', e.target.checked)}
                  className="rounded accent-violet-500 w-4 h-4 cursor-pointer"
                />
              </label>

              {config.semantic_fallback_enabled && (
                <div className="pl-3 border-l-2 border-violet-900/50 space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#A1A1AA]">Similarity Threshold:</span>
                    <span className="text-violet-300 font-bold">{(config.semantic_similarity_threshold * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.95"
                    step="0.05"
                    value={config.semantic_similarity_threshold}
                    onChange={e => handleChange('semantic_similarity_threshold', Number(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Right Column: Structure-Aware Splitting Toggles & Deduplication */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Structure-Aware AST Splitting Toggles"
              subtitle="Enforces atomic preservation of scientific and markdown elements"
            />
            <CardBody className="space-y-2.5 text-xs font-mono">
              <label className="flex items-center justify-between p-2 rounded bg-[#16161B] border border-[#222227] cursor-pointer hover:bg-[#1A1A22]">
                <div className="flex items-center gap-2">
                  <ListTree className="w-4 h-4 text-violet-400" />
                  <div>
                    <span className="text-[#F4F4F5] font-semibold block">Respect Heading Hierarchy</span>
                    <span className="text-[10px] text-[#71717A]">Preserves H1/H2/H3 breadcrumb paths</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.preserve_headings}
                  onChange={e => handleChange('preserve_headings', e.target.checked)}
                  className="rounded accent-violet-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-[#16161B] border border-[#222227] cursor-pointer hover:bg-[#1A1A22]">
                <div className="flex items-center gap-2">
                  <Sigma className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[#F4F4F5] font-semibold block">Keep Formulas / Equations Intact</span>
                    <span className="text-[10px] text-[#71717A]">Guarantees LaTeX AST equation closure</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.preserve_formulas}
                  onChange={e => handleChange('preserve_formulas', e.target.checked)}
                  className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-[#16161B] border border-[#222227] cursor-pointer hover:bg-[#1A1A22]">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className="text-[#F4F4F5] font-semibold block">Keep Tables Intact</span>
                    <span className="text-[10px] text-[#71717A]">Preserves table headers & matrix columns</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.preserve_tables}
                  onChange={e => handleChange('preserve_tables', e.target.checked)}
                  className="rounded accent-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-[#16161B] border border-[#222227] cursor-pointer hover:bg-[#1A1A22]">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-[#F4F4F5] font-semibold block">Keep Code Blocks Intact</span>
                    <span className="text-[10px] text-[#71717A]">Prevents mid-block syntax fragmentation</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.preserve_code_blocks}
                  onChange={e => handleChange('preserve_code_blocks', e.target.checked)}
                  className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-[#16161B] border border-[#222227] cursor-pointer hover:bg-[#1A1A22]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <div>
                    <span className="text-[#F4F4F5] font-semibold block">Respect Paragraph Boundaries</span>
                    <span className="text-[10px] text-[#71717A]">Avoids mid-sentence token slices</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.preserve_paragraphs}
                  onChange={e => handleChange('preserve_paragraphs', e.target.checked)}
                  className="rounded accent-violet-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </CardBody>
          </Card>

          {/* Deduplication Settings Card */}
          <Card>
            <CardHeader
              title="Duplicate Detection & Clustered Pruning"
              subtitle="SHA-256 exact matching and MinHash near-duplicate clustering"
            />
            <CardBody className="space-y-3 text-xs font-mono">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-[#F4F4F5] font-semibold block">Enable Deduplication</span>
                  <span className="text-[11px] text-[#71717A]">Prunes redundant chunks while retaining provenance</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enable_deduplication}
                  onChange={e => handleChange('enable_deduplication', e.target.checked)}
                  className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              {config.enable_deduplication && (
                <div className="space-y-1.5 pt-2 border-t border-[#222227]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#A1A1AA]">Near-Duplicate Similarity Threshold:</span>
                    <span className="text-emerald-400 font-bold">{(config.deduplication_threshold * 100).toFixed(0)}% Jaccard</span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="0.99"
                    step="0.01"
                    value={config.deduplication_threshold}
                    onChange={e => handleChange('deduplication_threshold', Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#71717A]">
                    <span>80% (Aggressive)</span>
                    <span>85% (Balanced)</span>
                    <span>99% (Strict Exact)</span>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Configuration Validation Summary (Part 3 Requirement) */}
      <Card className="border border-violet-900/40 bg-gradient-to-br from-[#121217] to-[#0D0D11]">
        <CardHeader
          title="Configuration Validation Summary"
          subtitle="Pre-flight analysis for active chunking configuration"
          action={
            validation.isValid ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Valid Configuration
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" /> Invalid Parameters
              </span>
            )
          }
        />
        <CardBody className="space-y-3 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#0A0A0D] border border-[#222227] rounded">
              <span className="text-[10px] text-[#71717A] uppercase block">Effective Step Size:</span>
              <div className="text-violet-300 font-bold text-sm">
                {Math.max(1, config.max_chunk_size_tokens - config.overlap_tokens)} tokens / step
              </div>
            </div>
            <div className="p-3 bg-[#0A0A0D] border border-[#222227] rounded">
              <span className="text-[10px] text-[#71717A] uppercase block">Est. Chunks (10k words):</span>
              <div className="text-emerald-400 font-bold text-sm">
                ~{validation.estimatedChunksPer10kWords} chunks
              </div>
            </div>
            <div className="p-3 bg-[#0A0A0D] border border-[#222227] rounded">
              <span className="text-[10px] text-[#71717A] uppercase block">AST Integrity Level:</span>
              <div className="text-cyan-400 font-bold text-sm">
                {config.preserve_formulas && config.preserve_tables ? 'Full (Math + Tables)' : 'Partial'}
              </div>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="p-3 bg-rose-950/30 border border-rose-900/60 rounded text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Configuration Errors:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="p-3 bg-amber-950/30 border border-amber-900/60 rounded text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" /> Parameter Warnings:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {validation.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

