import React, { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { ToastContainer } from '../ui/Toast';
import { useApp } from '../../context/AppContext';
import { Info, AlertTriangle } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isDemoMode } = useApp();

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex flex-col selection:bg-violet-600/30 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main content wrapper */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        {/* Top Navigation */}
        <TopNav onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)} />

        {/* Demo banner if active */}
        {isDemoMode && (
          <div className="bg-violet-950/40 border-b border-violet-800/40 px-4 py-1.5 flex items-center justify-between text-xs text-violet-300">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span>
                <strong>Demonstration Mode:</strong> Displaying benchmark evaluations on seminal papers (Transformer, ResNet). To integrate with your local FastAPI server, toggle to <strong>Live Backend</strong> in Top Nav or Settings.
              </span>
            </div>
            <span className="font-mono text-[10px] bg-violet-900/60 px-1.5 py-0.5 rounded border border-violet-700/50 uppercase">
              Isolated Fixtures
            </span>
          </div>
        )}

        {/* Main page content container */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Notification Toasts */}
      <ToastContainer />
    </div>
  );
};

