import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SmartChunkConfigPanel } from '../components/config/SmartChunkConfigPanel';
import { API_BASE_URL } from '../services/apiClient';
import {
  Settings,
  Server,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Code2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Terminal,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isDemoMode, setIsDemoMode, backendHealth, refreshHealth, notify } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTestConnection = async () => {
    try {
      setIsRefreshing(true);
      await refreshHealth();
      notify('info', 'Backend connectivity probe completed.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* SmartChunk Parameter Configuration (Part 3) */}
      <SmartChunkConfigPanel
        onSaved={cfg => {
          notify('success', `Configuration applied: ${cfg.max_chunk_size_tokens} tokens / ${cfg.overlap_tokens} overlap`);
        }}
      />

      {/* Backend Connection Card */}
      <Card>
        <CardHeader
          title="FastAPI Backend Connectivity"
          subtitle="Connection parameters used by centralized API client"
          action={
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendHealth.status === 'online'
                    ? 'bg-emerald-400'
                    : backendHealth.status === 'degraded'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span className="text-xs font-mono text-[#F4F4F5] uppercase">
                {backendHealth.status}
              </span>
            </div>
          }
        />
        <CardBody className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-[#0E0E12] border border-[#222227] rounded space-y-1">
              <span className="text-[10px] text-[#71717A] uppercase">Active Base URL:</span>
              <div className="text-violet-400 font-semibold break-all">{API_BASE_URL}</div>
              <p className="text-[10px] text-[#71717A]">
                Configured via <code className="text-zinc-400">VITE_API_BASE_URL</code>
              </p>
            </div>

            <div className="p-3 bg-[#0E0E12] border border-[#222227] rounded space-y-1">
              <span className="text-[10px] text-[#71717A] uppercase">Backend Version / Latency:</span>
              <div className="text-emerald-400 font-semibold">
                {backendHealth.backend_version || 'v2.4.0'} ({backendHealth.api_latency_ms || 12}ms)
              </div>
              <p className="text-[10px] text-[#71717A]">
                Endpoint: <code className="text-zinc-400">GET /api/v1/health</code>
              </p>
            </div>
          </div>

          {/* Demo Mode Switch */}
          <div className="p-4 bg-[#141419] border border-[#222227] rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-[#F4F4F5] flex items-center gap-2">
                Demonstration Mode (Sample Scientific Papers)
                <span className="text-[10px] bg-violet-950/70 text-violet-300 border border-violet-800/60 px-1.5 py-0.2 rounded uppercase">
                  {isDemoMode ? 'Active' : 'Disabled'}
                </span>
              </span>
              <p className="text-[#A1A1AA] text-xs font-sans max-w-lg">
                When enabled, UI uses isolated fixtures for Vaswani et al. and ResNet papers without requiring the FastAPI backend to be running.
              </p>
            </div>

            <button
              onClick={() => setIsDemoMode(!isDemoMode)}
              className="p-1 text-violet-400 hover:text-violet-300 transition-colors"
            >
              {isDemoMode ? (
                <ToggleRight className="w-8 h-8 text-violet-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-zinc-600" />
              )}
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Planned Endpoints Contract for Codex */}
      <Card>
        <CardHeader
          title="Codex Backend Integration Contract"
          subtitle="Expected FastAPI endpoints and payload signatures"
        />
        <div className="p-4 space-y-2 text-xs font-mono">
          <div className="space-y-1">
            {[
              { method: 'GET', path: '/api/v1/health', desc: 'System status, version and DB health' },
              { method: 'POST', path: '/api/v1/documents', desc: 'Multipart file upload (PDF/MD/TXT)' },
              { method: 'GET', path: '/api/v1/documents', desc: 'List documents with metadata' },
              { method: 'GET', path: '/api/v1/documents/{id}/chunks', desc: 'Get chunks for specific paper' },
              { method: 'GET', path: '/api/v1/chunks/{id}', desc: 'Get chunk AST & diagnostics' },
              { method: 'GET', path: '/api/v1/chunks/{id}/relationships', desc: 'Get graph relations' },
              { method: 'POST', path: '/api/v1/evaluations', desc: 'Run Quality Gate validation rules' },
              { method: 'GET', path: '/api/v1/benchmarks', desc: 'Get benchmark comparison runs' },
              { method: 'GET', path: '/api/v1/graph', desc: 'Get knowledge graph nodes and edges' },
              { method: 'POST', path: '/api/v1/chat', desc: 'Grounded conversation with citation cards' },
              { method: 'POST', path: '/api/v1/agent/tasks', desc: 'Trigger multi-step research agent' },
            ].map((ep, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-[#0E0E12] rounded border border-[#222227] flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      ep.method === 'POST' ? 'bg-blue-950 text-blue-400' : 'bg-emerald-950 text-emerald-400'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="text-[#F4F4F5]">{ep.path}</span>
                </div>
                <span className="text-[#71717A] text-[10px] hidden sm:inline">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

