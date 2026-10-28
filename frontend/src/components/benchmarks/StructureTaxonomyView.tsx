import React, { useState, useEffect } from 'react';
import { StructureBenchmarkReport, StructureCategoryMetric } from '../../types';
import { fetchStructureBenchmarkReport, triggerStructureEvaluation } from '../../services/benchmarksApi';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Sigma,
  Table as TableIcon,
  Layers,
  Code2,
  List,
  AlertTriangle,
  CheckCircle,
  Play,
  Info,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export const StructureTaxonomyView: React.FC = () => {
  const [report, setReport] = useState<StructureBenchmarkReport | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('formulas');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const data = await fetchStructureBenchmarkReport();
        setReport(data);
      } catch (err) {
        console.error('Failed to load structure benchmark report:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleRunEvaluation = async () => {
    try {
      setIsRunning(true);
      const res = await triggerStructureEvaluation();
      setReport(res);
    } catch (err) {
      console.error('Structure evaluation failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'formulas':
        return <Sigma className="w-4 h-4 text-emerald-400" />;
      case 'tables':
        return <TableIcon className="w-4 h-4 text-amber-400" />;
      case 'sections':
        return <Layers className="w-4 h-4 text-blue-400" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-violet-400" />;
      case 'lists':
        return <List className="w-4 h-4 text-pink-400" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  const activeMetric: StructureCategoryMetric | undefined = report?.categories.find(
    c => c.category === selectedCategory
  ) || report?.categories[0];

  return (
    <div className="space-y-6">
      {/* Feature 4 Header Card */}
      <div className="rounded-lg border border-[#29292F] bg-[#131317] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-semibold">
              Feature 4: Structure-Aware Document Benchmark
            </span>
          </div>
          <h2 className="text-base font-semibold text-[#F4F4F5] tracking-tight">
            Structure Taxonomy: Formulas, Tables, Heading Trees, Code & Lists
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Empirical measurement of AST fracture rate, formula truncation, and context orphan rates across structural categories.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          isLoading={isRunning}
          icon={<Play className="w-3.5 h-3.5" />}
          onClick={handleRunEvaluation}
        >
          Evaluate Structural Taxonomy
        </Button>
      </div>

      {/* Category Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {report?.categories.map(cat => {
          const isSelected = cat.category === selectedCategory;
          const delta = (cat.smartchunk_preservation_pct - cat.fixed_preservation_pct).toFixed(1);

          return (
            <div
              key={cat.category}
              onClick={() => setSelectedCategory(cat.category)}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-violet-950/25 border-violet-500 shadow-md shadow-violet-950/30'
                  : 'bg-[#111115] border-[#222227] hover:border-[#33333F]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(cat.category)}
                  <span className="text-xs font-bold text-[#F4F4F5] uppercase tracking-wider font-mono">
                    {cat.category}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">{cat.total_samples} test items</span>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#71717A] text-[11px]">SmartChunk:</span>
                  <span className="text-emerald-400 font-bold">{cat.smartchunk_preservation_pct}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#71717A] text-[11px]">Fixed-Window:</span>
                  <span className="text-rose-400 font-semibold">{cat.fixed_preservation_pct}%</span>
                </div>
                <div className="pt-1 border-t border-[#1C1C22] flex justify-between items-center text-[10px]">
                  <span className="text-zinc-500">AST Delta:</span>
                  <span className="text-emerald-300 font-bold">+{delta}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Category Deep-Dive Inspection */}
      {activeMetric && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel: Metrics Breakdown (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader
                title={`Structural Preservation Breakdown: ${activeMetric.category_label}`}
                subtitle={`Evaluated across ${activeMetric.total_samples} ground-truth instances`}
              />
              <CardBody className="space-y-4 font-mono text-xs">
                {/* 3 Strategy Comparison Progress Bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        SmartChunk (AST Preservation & Quality Gate)
                      </span>
                      <span className="text-emerald-400 font-bold">{activeMetric.smartchunk_preservation_pct}% Intact</span>
                    </div>
                    <div className="w-full bg-[#1A1A22] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${activeMetric.smartchunk_preservation_pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                      <span>Truncation: {activeMetric.smartchunk_truncation_rate_pct}%</span>
                      <span>AST Fracture: {activeMetric.smartchunk_fracture_rate_pct}%</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-blue-400 font-semibold">
                        Structure-Aware Naive (Section Splitter)
                      </span>
                      <span className="text-blue-300 font-bold">{activeMetric.structure_preservation_pct}% Intact</span>
                    </div>
                    <div className="w-full bg-[#1A1A22] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${activeMetric.structure_preservation_pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                      <span>Truncation: {activeMetric.structure_truncation_rate_pct}%</span>
                      <span>AST Fracture: {activeMetric.structure_fracture_rate_pct}%</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-rose-400 font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Fixed-Size Window (512 tokens / 50 overlap)
                      </span>
                      <span className="text-rose-400 font-bold">{activeMetric.fixed_preservation_pct}% Intact</span>
                    </div>
                    <div className="w-full bg-[#1A1A22] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${activeMetric.fixed_preservation_pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                      <span className="text-rose-400">Truncation: {activeMetric.fixed_truncation_rate_pct}%</span>
                      <span className="text-rose-400">AST Fracture: {activeMetric.fixed_fracture_rate_pct}%</span>
                    </div>
                  </div>
                </div>

                {/* Key Failure Mode Box */}
                <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-300 font-semibold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Primary Failure Mode in Sliding-Window Chunking</span>
                  </div>
                  <p className="text-[11px] text-rose-200/90 leading-relaxed">
                    {activeMetric.key_failure_mode}
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Right Panel: Test Case Evidence Inspector (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader
                title="Gold Test Case Inspection"
                subtitle="Side-by-side ground truth vs baseline fracture"
              />
              <CardBody className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] uppercase text-[#71717A] font-semibold block mb-1">
                    Evaluation Query
                  </span>
                  <div className="p-2.5 bg-[#0C0C0F] border border-[#222227] rounded text-white text-xs">
                    "{activeMetric.test_case.query}"
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-emerald-400 font-semibold block mb-1">
                    SmartChunk Output (Preserved Context)
                  </span>
                  <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/40 rounded text-emerald-300 text-[11px] leading-relaxed break-all">
                    {activeMetric.test_case.smartchunk_result}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-rose-400 font-semibold block mb-1">
                    Fixed-Size Window Output (Severed Context)
                  </span>
                  <div className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded text-rose-300 text-[11px] leading-relaxed break-all">
                    {activeMetric.test_case.fixed_size_result}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1C1C22] flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Target Element:</span>
                  <span className="text-zinc-200">{activeMetric.test_case.expected_element}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

