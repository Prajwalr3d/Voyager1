import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Menu,
  FileText,
  Activity,
  CheckCircle2,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface TopNavProps {
  onToggleMobileSidebar: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleMobileSidebar }) => {
  const {
    currentPage,
    documents,
    selectedDocumentId,
    setSelectedDocumentId,
    selectedDocument,
    isDemoMode,
    setIsDemoMode,
    backendHealth,
  } = useApp();

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    overview: {
      title: 'Overview Dashboard',
      subtitle: 'System metrics, chunk distribution, and retrieval evaluation summary',
    },
    documents: {
      title: 'Document Workspace',
      subtitle: 'Scientific paper upload, structural block extraction, and processing queue',
    },
    inspector: {
      title: 'Chunk Inspector',
      subtitle: 'Multi-panel AST inspection, equation preservation, and metadata provenance',
    },
    quality: {
      title: 'Quality Gate & Repair',
      subtitle: 'Automated validation rules, equation boundary checks, and repair records',
    },
    benchmarks: {
      title: 'Retrieval Benchmarks',
      subtitle: 'Comparative evaluation: Fixed-Size vs Structure-Aware vs SmartChunk RAG',
    },
    graph: {
      title: 'Knowledge Graph Explorer',
      subtitle: 'Relational entity map connecting sections, equations, tables, and citations',
    },
    chat: {
      title: 'Source-Grounded AI Chat',
      subtitle: 'Interactive RAG with strict chunk provenance and citation cards',
    },
    agent: {
      title: 'Research Agent Assistant',
      subtitle: 'Multi-step autonomous scientific query execution and evidence synthesis',
    },
    settings: {
      title: 'System Settings',
      subtitle: 'API configuration, model bindings, and evaluation harness parameters',
    },
  };

  const currentInfo = pageTitles[currentPage] || {
    title: 'SmartChunk',
    subtitle: 'Scientific Document Chunking Platform',
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#09090B]/90 backdrop-blur-md border-b border-[#29292F] px-4 flex items-center justify-between">
      {/* Left: Mobile trigger & breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="p-1.5 -ml-1 text-[#A1A1AA] hover:text-[#F4F4F5] rounded-md hover:bg-[#18181B] lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-[#F4F4F5] tracking-tight">
              {currentInfo.title}
            </h1>
            {isDemoMode && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-800/60 uppercase">
                Demo Mode
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#71717A] hidden sm:block truncate max-w-md">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Document context switcher & demo toggle */}
      <div className="flex items-center gap-3">
        {/* Document Selector */}
        <div className="relative flex items-center">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#131316] border border-[#29292F] text-xs">
            <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="text-[#71717A] font-mono text-[11px]">Doc:</span>
            <select
              value={selectedDocumentId}
              onChange={e => setSelectedDocumentId(e.target.value)}
              className="bg-transparent text-[#F4F4F5] text-xs font-medium outline-none cursor-pointer max-w-[180px] truncate"
            >
              {documents.map(doc => (
                <option key={doc.id} value={doc.id} className="bg-[#131316] text-[#F4F4F5]">
                  {doc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Demo Mode Toggle */}
        <button
          onClick={() => setIsDemoMode(!isDemoMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
            isDemoMode
              ? 'bg-violet-950/40 text-violet-300 border-violet-800/60 hover:bg-violet-900/50'
              : 'bg-[#18181B] text-[#A1A1AA] border-[#29292F] hover:bg-[#222226]'
          }`}
          title="Toggle between isolated Demo Fixtures and live FastAPI Backend"
        >
          {isDemoMode ? (
            <ToggleRight className="w-4 h-4 text-violet-400" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-[#71717A]" />
          )}
          <span className="hidden sm:inline font-mono text-[11px]">
            {isDemoMode ? 'Demo Fixtures' : 'Live Backend'}
          </span>
        </button>

        {/* Backend health status indicator */}
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border ${
            backendHealth.status === 'online'
              ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40'
              : backendHealth.status === 'degraded'
              ? 'bg-amber-950/30 text-amber-400 border-amber-900/40'
              : 'bg-rose-950/30 text-rose-400 border-rose-900/40'
          }`}
          title={`Backend status: ${backendHealth.status} (${backendHealth.api_latency_ms || 0}ms)`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendHealth.status === 'online'
                ? 'bg-emerald-400'
                : backendHealth.status === 'degraded'
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`}
          />
          <span className="hidden md:inline">{backendHealth.api_latency_ms || 12}ms</span>
        </div>
      </div>
    </header>
  );
};

