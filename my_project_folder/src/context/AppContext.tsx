import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Document, SystemHealth } from '../types';
import { fetchDocuments } from '../services/documentsApi';
import { checkBackendHealth } from '../services/healthApi';
import { getDemoModePreference, setDemoModePreference } from '../services/apiClient';

export type NavigationPage =
  | 'overview'
  | 'documents'
  | 'inspector'
  | 'quality'
  | 'benchmarks'
  | 'graph'
  | 'chat'
  | 'agent'
  | 'settings';

interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
}

interface AppContextType {
  currentPage: NavigationPage;
  setCurrentPage: (page: NavigationPage) => void;
  documents: Document[];
  selectedDocumentId: string;
  setSelectedDocumentId: (id: string) => void;
  selectedDocument: Document | undefined;
  isLoadingDocuments: boolean;
  refreshDocuments: () => Promise<void>;
  isDemoMode: boolean;
  setIsDemoMode: (enabled: boolean) => void;
  backendHealth: SystemHealth;
  refreshHealth: () => Promise<void>;
  notifications: AppNotification[];
  notify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  dismissNotification: (id: string) => void;
  searchFilter: string;
  setSearchFilter: (term: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('overview');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('doc-vaswani-2017');
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(true);
  const [isDemoMode, setDemoModeState] = useState<boolean>(getDemoModePreference());
  const [backendHealth, setBackendHealth] = useState<SystemHealth>({
    status: 'online',
    is_demo_mode: true,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const notify = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setNotifications(prev => [...prev, { id, type, message, timestamp: Date.now() }]);
    setTimeout(() => {
      dismissNotification(id);
    }, 5000);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const setIsDemoMode = (enabled: boolean) => {
    setDemoModePreference(enabled);
    setDemoModeState(enabled);
    notify(
      enabled ? 'info' : 'warning',
      enabled
        ? 'Demo mode active: Using isolated local scientific research fixtures.'
        : 'Live mode active: Requests will target the FastAPI backend at VITE_API_BASE_URL.'
    );
    loadDocs();
    loadHealth();
  };

  const loadDocs = async () => {
    try {
      setIsLoadingDocuments(true);
      const docs = await fetchDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !docs.some(d => d.id === selectedDocumentId)) {
        setSelectedDocumentId(docs[0].id);
      }
    } catch (err: any) {
      notify('error', `Failed to load documents: ${err.message}`);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const loadHealth = async () => {
    try {
      const health = await checkBackendHealth();
      setBackendHealth(health);
    } catch {
      setBackendHealth({ status: 'offline', is_demo_mode: isDemoMode });
    }
  };

  useEffect(() => {
    loadDocs();
    loadHealth();

    const interval = setInterval(() => {
      loadHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, [isDemoMode]);

  const selectedDocument = documents.find(d => d.id === selectedDocumentId) || documents[0];

  return (
    <AppContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        documents,
        selectedDocumentId,
        setSelectedDocumentId,
        selectedDocument,
        isLoadingDocuments,
        refreshDocuments: loadDocs,
        isDemoMode,
        setIsDemoMode,
        backendHealth,
        refreshHealth: loadHealth,
        notifications,
        notify,
        dismissNotification,
        searchFilter,
        setSearchFilter,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

