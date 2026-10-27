import React from 'react';
import { useApp, NavigationPage } from '../../context/AppContext';
import {
  LayoutDashboard,
  Files,
  Binary,
  ShieldCheck,
  BarChart3,
  Network,
  MessageSquare,
  Bot,
  Settings,
  Layers,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const { currentPage, setCurrentPage, isDemoMode, backendHealth } = useApp();

  const navItems: {
    id: NavigationPage;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <Files className="w-4 h-4" /> },
    { id: 'inspector', label: 'Chunk Inspector', icon: <Binary className="w-4 h-4" /> },
    { id: 'quality', label: 'Quality Gate', icon: <ShieldCheck className="w-4 h-4" />, badge: 'Gate' },
    { id: 'benchmarks', label: 'Benchmarks', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'graph', label: 'Knowledge Graph', icon: <Network className="w-4 h-4" /> },
    { id: 'chat', label: 'AI Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'agent', label: 'Research Agent', icon: <Bot className="w-4 h-4" />, badge: 'Agentic' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleNavClick = (page: NavigationPage) => {
    setCurrentPage(page);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0D0D10] border-r border-[#29292F] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#222227]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-violet-900/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-[#F4F4F5]">SmartChunk</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 bg-violet-950/80 text-violet-300 border border-violet-800/60 rounded">
                  v2.4
                </span>
              </div>
              <p className="text-[10px] text-[#71717A] tracking-wider uppercase font-mono">
                Scientific RAG
              </p>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          <div className="px-2 pb-1.5 text-[10px] font-mono font-medium text-[#71717A] uppercase tracking-wider">
            Platform Navigation
          </div>
          {navItems.map(item => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-violet-600/15 text-violet-300 border border-violet-600/30'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#15151A] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-violet-400' : 'text-[#71717A]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                      isActive
                        ? 'bg-violet-500/20 text-violet-200'
                        : 'bg-[#1C1C22] text-[#71717A]'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <ChevronRight className="w-3.5 h-3.5 text-violet-400" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* System Footprint & Status */}
        <div className="p-3 border-t border-[#222227] bg-[#0A0A0C]">
          <div className="p-2.5 rounded bg-[#131317] border border-[#222227]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-[#A1A1AA] flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    backendHealth.status === 'online'
                      ? 'bg-emerald-500'
                      : backendHealth.status === 'degraded'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
                {isDemoMode ? 'Demo Simulator' : 'Backend Status'}
              </span>
              <span className="text-[10px] font-mono text-[#71717A]">
                {backendHealth.status.toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] text-[#71717A] leading-tight">
              {isDemoMode
                ? 'Showing gold-standard scientific evaluation fixtures.'
                : 'FastAPI connected via VITE_API_BASE_URL.'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

