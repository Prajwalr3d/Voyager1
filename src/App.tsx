import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ChunkInspectorPage } from './pages/ChunkInspectorPage';
import { QualityGatePage } from './pages/QualityGatePage';
import { BenchmarksPage } from './pages/BenchmarksPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { ChatPage } from './pages/ChatPage';
import { ResearchAgentPage } from './pages/ResearchAgentPage';
import { SettingsPage } from './pages/SettingsPage';

const PageRenderer: React.FC = () => {
  const { currentPage } = useApp();

  switch (currentPage) {
    case 'overview':
      return <OverviewPage />;
    case 'documents':
      return <DocumentsPage />;
    case 'inspector':
      return <ChunkInspectorPage />;
    case 'quality':
      return <QualityGatePage />;
    case 'benchmarks':
      return <BenchmarksPage />;
    case 'graph':
      return <KnowledgeGraphPage />;
    case 'chat':
      return <ChatPage />;
    case 'agent':
      return <ResearchAgentPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <OverviewPage />;
  }
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppLayout>
        <PageRenderer />
      </AppLayout>
    </AppProvider>
  );
};

export default App;

