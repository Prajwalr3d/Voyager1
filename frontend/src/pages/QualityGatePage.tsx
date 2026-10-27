import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { QualityPieChart } from '../components/charts/QualityPieChart';
import { fetchQualityResult, triggerChunkRepair, runQualityEvaluation } from '../services/qualityApi';
import { QualityResult, ChunkDiagnostic } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Wrench,
  RotateCcw,
  Sliders,
  Filter,
  ArrowRight,
  ExternalLink,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const QualityGatePage: React.FC = () => {
  const { selectedDocumentId, selectedDocument, setCurrentPage, notify } = useApp();

  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [activeRepairRecord, setActiveRepairRecord] = useState<ChunkDiagnostic | null>(null);

  useEffect(() => {
    async function loadQuality() {
      try {
        const res = await fetchQualityResult(selectedDocumentId);
        setQualityResult(res);
      } catch (err: any) {
        notify('error', `Failed to load quality results: ${err.message}`);
      }
    }
    loadQuality();
  }, [selectedDocumentId]);

  const handleRunEvaluation = async () => {
    try {
      setIsEvaluating(true);
      notify('info', `Running Quality Gate validation suite on "${selectedDocument?.name}"...`);
      const res = await runQualityEvaluation(selectedDocumentId);
      setQualityResult(res);
      notify('success', 'Quality Gate evaluation completed. Rules verified.');
    } catch (err: any) {
      notify('error', `Evaluation failed: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRepair = async (diag: ChunkDiagnostic) => {
    try {
      setRepairingId(diag.id);
      const res = await triggerChunkRepair(diag.chunk_id, diag.id);
      if (res.success) {
        notify('success', res.message);
        // Reload quality
        const updated = await fetchQualityResult(selectedDocumentId);
        setQualityResult(updated);
      }
    } catch (err: any) {
      notify('error', `Repair failed: ${err.message}`);
    } finally {
      setRepairingId(null);
    }
  };

  const allDiagnostics = qualityResult?.diagnostics || [];
  const filteredDiagnostics = allDiagnostics.filter(d => {
    const matchesSeverity =
      selectedSeverityFilter === 'all' || d.severity === selectedSeverityFilter;
    const matchesCategory =
      selectedCategoryFilter === 'all' || d.category === selectedCategoryFilter;
    return matchesSeverity && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-lg border border-[#29292F] bg-[#131317] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Quality Gate & Post-Split Verification
            </span>
          </div>
          <h2 className="text-base font-semibold text-[#F4F4F5] tracking-tight">
            Structure-Aware Validation Rules for Scientific Documents
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5 max-w-2xl">
            Hard gates quarantine corrupt mathematical formulas and severed tables. Soft gates trigger automated AST boundary repair or human review flags.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="primary"
            size="sm"
            isLoading={isEvaluating}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleRunEvaluation}
          >
            Re-evaluate Document
          </Button>
        </div>
      </div>

      {/* Overview Stats & Donut Grid */}
      {qualityResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Quality Distribution Chart */}
          <Card className="lg:col-span-6">
            <CardHeader
              title="Status Breakdown"
              subtitle={`Distribution across ${qualityResult.total_chunks} generated chunks`}
            />
            <CardBody>
              <QualityPieChart summary={qualityResult.status_summary} />
            </CardBody>
          </Card>

          {/* Hard Gates vs Soft Warnings */}
          <Card className="lg:col-span-6 flex flex-col justify-between">
            <CardHeader
              title="Gate Severity Health"
              subtitle="Distinct classification of fatal vs repairable anomalies"
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg">
                  <div className="flex items-center justify-between text-xs font-mono text-rose-400 mb-1">
                    <span>Hard Gate Failures</span>
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#F4F4F5]">
                    {qualityResult.hard_gate_failures}
                  </div>
                  <p className="text-[10px] text-[#A1A1AA] mt-1">
                    Fatal AST truncation. Automatically quarantined from retriever index.
                  </p>
                </div>

                <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-lg">
                  <div className="flex items-center justify-between text-xs font-mono text-amber-400 mb-1">
                    <span>Soft Warnings</span>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#F4F4F5]">
                    {qualityResult.soft_warnings}
                  </div>
                  <p className="text-[10px] text-[#A1A1AA] mt-1">
                    Heading orphan or cross-page table. Repairable by AST boundary stitch.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#0E0E12] rounded border border-[#222227] flex items-center justify-between text-xs font-mono">
                <span className="text-[#A1A1AA]">Overall Quality Index:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {qualityResult.overall_score.toFixed(1)} / 100.0
                </span>
              </div>
            </CardBody>
            <div className="p-3 bg-[#0E0E12] border-t border-[#222227] text-[11px] text-[#71717A] rounded-b-lg font-mono">
              Harness Profile: scientific_strict_v2 (LaTeX AST + Markdown Column Strictness)
            </div>
          </Card>
        </div>
      )}

      {/* Filter and Diagnostics List */}
      <Card>
        <CardHeader
          title={`Diagnostic Records (${filteredDiagnostics.length})`}
          subtitle="Detailed rule evaluations, root causes, and suggested remediation"
          action={
            <div className="flex items-center gap-2">
              <select
                value={selectedSeverityFilter}
                onChange={e => setSelectedSeverityFilter(e.target.value)}
                className="bg-[#18181D] border border-[#29292F] rounded px-2.5 py-1 text-xs text-[#F4F4F5] outline-none font-mono"
              >
                <option value="all">All Severities</option>
                <option value="hard_gate">Hard Gate Only</option>
                <option value="warning">Warning Only</option>
                <option value="info">Info Only</option>
              </select>

              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="bg-[#18181D] border border-[#29292F] rounded px-2.5 py-1 text-xs text-[#F4F4F5] outline-none font-mono"
              >
                <option value="all">All Categories</option>
                <option value="equation_split">Equation Splits</option>
                <option value="table_severed">Table Severing</option>
                <option value="context_orphan">Heading Orphans</option>
                <option value="broken_cross_ref">Broken Cross-References</option>
              </select>
            </div>
          }
        />

        <div className="divide-y divide-[#1C1C22]">
          {filteredDiagnostics.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#71717A]">
              No diagnostics found matching filter criteria.
            </div>
          ) : (
            filteredDiagnostics.map(diag => (
              <div key={diag.id} className="p-4 space-y-2.5 hover:bg-[#141419] transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Badge severity={diag.severity} size="xs" />
                    <span className="font-mono font-semibold text-xs text-[#F4F4F5]">
                      {diag.rule_name}
                    </span>
                    <span className="text-[10px] font-mono text-[#71717A] bg-[#1C1C22] px-1.5 py-0.5 rounded">
                      {diag.rule_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-violet-400">
                      Target: {diag.chunk_id}
                    </span>
                    {diag.repair_record && (
                      <Button
                        variant="outline"
                        size="xs"
                        icon={<Sparkles className="w-3 h-3 text-blue-400" />}
                        onClick={() => setActiveRepairRecord(diag)}
                      >
                        View Repair Diff
                      </Button>
                    )}
                    {!diag.repaired && diag.severity === 'warning' && (
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={<Wrench className="w-3 h-3 text-emerald-400" />}
                        isLoading={repairingId === diag.id}
                        onClick={() => handleRepair(diag)}
                      >
                        Auto-Repair AST
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#D4D4D8] leading-relaxed font-sans">
                  {diag.message}
                </p>

                <div className="p-2.5 rounded bg-[#0A0A0C] border border-[#222227] text-xs font-mono space-y-1">
                  <div className="text-[11px] text-[#A1A1AA]">
                    <strong className="text-[#F4F4F5]">Technical Cause:</strong> {diag.details}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA]">
                    <strong className="text-violet-400">Prescribed Action:</strong> {diag.suggested_action}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Repair Record Diff Modal */}
      {activeRepairRecord?.repair_record && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-[#29292F] rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#222227] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Automated AST Repair Record
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-[#1C1C22] px-2 py-0.5 rounded">
                Strategy: {activeRepairRecord.repair_record.strategy_used}
              </span>
            </div>

            <p className="text-xs text-[#A1A1AA]">
              {activeRepairRecord.repair_record.diff_summary}
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-[11px] text-rose-400 uppercase tracking-wider font-semibold block mb-1">
                  Before Split (Severed):
                </span>
                <div className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded text-rose-300 overflow-x-auto">
                  <code>{activeRepairRecord.repair_record.original_content}</code>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold block mb-1">
                  After SmartChunk Repair (AST Closure):
                </span>
                <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/40 rounded text-emerald-300 overflow-x-auto">
                  <code>{activeRepairRecord.repair_record.repaired_content}</code>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveRepairRecord(null)}
              >
                Close Diff
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

