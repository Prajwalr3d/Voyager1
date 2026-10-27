import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fetchResearchTasks, createResearchTask } from '../services/agentApi';
import { ResearchTask, Citation } from '../types';
import {
  Bot,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Sigma,
  Wrench,
  Search,
  BookOpen,
  HelpCircle,
  ChevronRight,
  Layers,
  Terminal,
  Download,
  Share2,
} from 'lucide-react';

export const ResearchAgentPage: React.FC = () => {
  const { documents, isDemoMode, notify, setCurrentPage } = useApp();

  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [taskQuery, setTaskQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'tools' | 'report'>('report');

  useEffect(() => {
    async function loadTasks() {
      try {
        const data = await fetchResearchTasks();
        setTasks(data);
        if (data.length > 0 && !selectedTaskId) {
          setSelectedTaskId(data[0].id);
        }
      } catch (err: any) {
        notify('error', `Failed to load research tasks: ${err.message}`);
      }
    }
    loadTasks();
  }, []);

  const activeTask = tasks.find(t => t.id === selectedTaskId) || tasks[0];

  const handleStartTask = async () => {
    if (!taskQuery.trim()) return;

    try {
      setIsSubmitting(true);
      notify('info', 'Allocating research agent workers & generating execution plan...');
      const newTask = await createResearchTask(
        taskQuery,
        documents.map(d => d.id)
      );
      setTasks(prev => [newTask, ...prev]);
      setSelectedTaskId(newTask.id);
      setTaskQuery('');
      notify('success', 'Autonomous research task completed successfully.');
    } catch (err: any) {
      notify('error', `Task execution failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-lg border border-[#29292F] bg-[#131317] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-violet-400 font-semibold">
              Autonomous Scientific Research Assistant
            </span>
          </div>
          <h2 className="text-base font-semibold text-[#F4F4F5] tracking-tight">
            Evidence-Driven Multi-Step Scientific Investigation
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5 max-w-2xl">
            Controlled agentic workflows orchestrate AST parsing, Quality Gate verification, mathematical derivation checks, and synthesized report generation.
          </p>
        </div>

        {isDemoMode && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-800/60 uppercase">
            Demo Execution Trace
          </span>
        )}
      </div>

      {/* Task Input Composer */}
      <Card className="p-4 space-y-3">
        <label className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-violet-400" />
          Specify Research Objective or Hypothesis
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Compare mathematical equation AST preservation between fixed-size chunking and SmartChunk..."
            value={taskQuery}
            onChange={e => setTaskQuery(e.target.value)}
            className="flex-1 bg-[#18181D] border border-[#29292F] rounded px-3 py-2 text-xs text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-violet-500 font-sans"
          />
          <Button
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={!taskQuery.trim() || isSubmitting}
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={handleStartTask}
          >
            Launch Agent
          </Button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#71717A] font-mono">
          <span>Active Corpus Scope: {documents.length} scientific papers selected</span>
          <span>Harness: AST Multi-Step Agent</span>
        </div>
      </Card>

      {/* Active Task Workspace */}
      {activeTask && (
        <div className="space-y-4">
          {/* Task Status & Sub-Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#29292F] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#F4F4F5]">
                Task: {activeTask.id}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 uppercase">
                <CheckCircle2 className="w-3 h-3" />
                Completed (100%)
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#131316] p-1 rounded border border-[#29292F]">
              <button
                onClick={() => setActiveTab('report')}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  activeTab === 'report' ? 'bg-[#27272A] text-white font-semibold' : 'text-[#71717A]'
                }`}
              >
                Synthesized Report
              </button>
              <button
                onClick={() => setActiveTab('plan')}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  activeTab === 'plan' ? 'bg-[#27272A] text-white font-semibold' : 'text-[#71717A]'
                }`}
              >
                Execution Plan ({activeTask.steps.length})
              </button>
              <button
                onClick={() => setActiveTab('tools')}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  activeTab === 'tools' ? 'bg-[#27272A] text-white font-semibold' : 'text-[#71717A]'
                }`}
              >
                Tool Calls ({activeTask.tool_calls.length})
              </button>
            </div>
          </div>

          {/* TAB 1: Synthesized Final Research Report */}
          {activeTab === 'report' && activeTask.final_report && (
            <Card className="p-6 space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400 font-semibold block mb-1">
                  Agentic Synthesis
                </span>
                <h3 className="text-lg font-bold text-[#F4F4F5] tracking-tight">
                  {activeTask.final_report.title}
                </h3>
                <p className="text-xs text-[#71717A] font-mono mt-1">
                  Generated at {new Date(activeTask.final_report.generated_at).toLocaleString()}
                </p>
              </div>

              {/* Abstract */}
              <div className="p-4 bg-[#0E0E12] border border-[#29292F] rounded-lg text-xs leading-relaxed text-[#D4D4D8] space-y-1">
                <span className="font-mono text-[11px] font-semibold text-white uppercase tracking-wider block">
                  Executive Abstract
                </span>
                <p className="italic">{activeTask.final_report.abstract}</p>
              </div>

              {/* Key Findings with Citations */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A1A1AA]">
                  Empirical Findings & Evidence
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {activeTask.final_report.key_findings.map((finding, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded bg-[#131317] border border-[#222227] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-[#F4F4F5] flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-violet-950/80 text-violet-400 border border-violet-800/60 flex items-center justify-center font-mono text-[10px]">
                            {idx + 1}
                          </span>
                          {finding.title}
                        </h5>
                      </div>
                      <p className="text-[#D4D4D8] font-sans leading-relaxed">
                        {finding.statement}
                      </p>
                      <div className="p-2.5 bg-[#0A0A0C] border border-[#222227] rounded text-[11px] text-[#A1A1AA] font-mono">
                        <strong className="text-violet-400">Scientific Evidence:</strong>{' '}
                        {finding.scientific_evidence}
                      </div>

                      {finding.citations.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-[#71717A] font-mono">Citations:</span>
                          {finding.citations.map(c => (
                            <span
                              key={c.id}
                              className="text-[10px] font-mono bg-[#1C1C22] text-violet-300 px-2 py-0.5 rounded border border-[#29292F]"
                            >
                              {c.chunk_id} ({c.document_name}, p.{c.page_number})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mathematical Formulation & Synthesis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3.5 bg-[#0E0E12] border border-[#222227] rounded space-y-1.5">
                  <span className="text-[11px] text-emerald-400 font-semibold block">
                    Mathematical Metric Derivation
                  </span>
                  <div className="p-2 bg-[#0A0A0C] border border-[#222227] rounded text-emerald-300">
                    <code>{activeTask.final_report.mathematical_formulation}</code>
                  </div>
                </div>

                <div className="p-3.5 bg-[#0E0E12] border border-[#222227] rounded space-y-1.5">
                  <span className="text-[11px] text-blue-400 font-semibold block">
                    Sources & Chunks Consulted
                  </span>
                  <div className="space-y-1">
                    {activeTask.final_report.sources_consulted.map((src, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-[#A1A1AA] truncate max-w-[240px]">
                          {src.document_name}
                        </span>
                        <span className="text-[#F4F4F5] font-semibold">{src.chunks_used} chunks</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Unresolved Questions */}
              {activeTask.unresolved_questions.length > 0 && (
                <div className="p-3.5 bg-amber-950/20 border border-amber-900/40 rounded space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-400 font-mono font-semibold">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Unresolved Scientific Inquiries / Next Steps</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[#A1A1AA] text-[11px]">
                    {activeTask.unresolved_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* TAB 2: Progress Timeline / Plan */}
          {activeTab === 'plan' && (
            <Card className="p-6">
              <div className="space-y-4">
                {activeTask.steps.map((step, idx) => (
                  <div key={step.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-mono text-xs">
                        {idx + 1}
                      </div>
                      {idx < activeTask.steps.length - 1 && (
                        <div className="w-0.5 flex-1 bg-[#222227] my-1" />
                      )}
                    </div>

                    <div className="flex-1 pb-4 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#F4F4F5]">{step.title}</span>
                        <span className="text-[10px] font-mono text-[#71717A]">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[#A1A1AA] text-xs leading-relaxed">{step.description}</p>
                      {step.output_summary && (
                        <div className="p-2 bg-[#0E0E12] border border-[#222227] rounded text-[11px] font-mono text-emerald-300 mt-1">
                          Output: {step.output_summary}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TAB 3: Tool Execution Trace */}
          {activeTab === 'tools' && (
            <Card className="p-6 space-y-3 font-mono text-xs">
              {activeTask.tool_calls.map(tool => (
                <div
                  key={tool.id}
                  className="p-3.5 rounded bg-[#0E0E12] border border-[#222227] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-violet-400 font-semibold flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5" />
                      {tool.tool_name}
                    </span>
                    <span className="text-[10px] text-[#71717A]">{tool.duration_ms}ms</span>
                  </div>

                  <div className="p-2 bg-[#070709] rounded border border-[#1C1C22] text-[11px] text-[#71717A] overflow-x-auto">
                    Params: {JSON.stringify(tool.input_params)}
                  </div>

                  <div className="text-[11px] text-[#D4D4D8]">
                    <strong className="text-emerald-400">Result:</strong> {tool.output_summary}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

