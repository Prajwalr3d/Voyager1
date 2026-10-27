import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { sendChatMessage, fetchChatHistory } from '../services/chatApi';
import { RetrievalInspectionLab } from '../components/retrieval/RetrievalInspectionLab';
import { ChatMessage, Citation } from '../types';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  BookOpen,
  FileText,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Loader2,
  X,
  Sigma,
  Table as TableIcon,
  HelpCircle,
  Copy,
  Check,
  Network,
  Zap,
  Layers,
} from 'lucide-react';

export const ChatPage: React.FC = () => {
  const {
    selectedDocumentId,
    selectedDocument,
    documents,
    setSelectedDocumentId,
    setCurrentPage,
    notify,
    isDemoMode,
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [versionPolicy, setVersionPolicy] = useState<'active_only' | 'historical_pinned' | 'all_versions'>('active_only');
  const [activeMode, setActiveMode] = useState<'chat' | 'inspection'>('chat');
  const [enableGraphExpansion, setEnableGraphExpansion] = useState<boolean>(true);
  const [expansionBudget, setExpansionBudget] = useState<number>(512);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await fetchChatHistory();
        setMessages(history);
      } catch (err: any) {
        notify('error', `Failed to load chat history: ${err.message}`);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async (queryText?: string) => {
    const text = queryText || inputValue;
    if (!text.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputValue('');
    setIsSending(true);

    try {
      const response = await sendChatMessage(text, {
        documentId: selectedDocumentId,
        versionPolicy: versionPolicy,
        conversationHistory: messages,
        enableGraphExpansion,
        expansionBudget,
      });
      setMessages(prev => [...prev, response]);
    } catch (err: any) {
      notify('error', `Chat error: ${err.message}`);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error communicating with retrieval engine: ${err.message}`,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyCitation = () => {
    if (activeCitation) {
      navigator.clipboard.writeText(activeCitation.snippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-170px)] min-h-[640px]">
      {/* Top Context & Document Bar */}
      <div className="bg-[#131316] border border-[#29292F] rounded-t-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-[#F4F4F5]">Source-Grounded Chat</span>

          {/* Mode Selector: Dialogue vs Retrieval Inspection Lab (Part 8) */}
          <div className="flex items-center bg-[#18181D] border border-[#29292F] rounded p-0.5 text-xs font-mono">
            <button
              onClick={() => setActiveMode('chat')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeMode === 'chat'
                  ? 'bg-violet-950/80 text-violet-300 font-semibold border border-violet-800/60'
                  : 'text-[#71717A] hover:text-white'
              }`}
            >
              Dialogue
            </button>
            <button
              onClick={() => setActiveMode('inspection')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeMode === 'inspection'
                  ? 'bg-violet-950/80 text-violet-300 font-semibold border border-violet-800/60'
                  : 'text-[#71717A] hover:text-white'
              }`}
            >
              Retrieval Lab
            </button>
          </div>

          <span className="text-zinc-600">|</span>
          <span className="text-xs font-mono text-[#71717A]">Scope:</span>
          <select
            value={selectedDocumentId}
            onChange={e => setSelectedDocumentId(e.target.value)}
            className="bg-[#18181D] border border-[#29292F] text-xs text-[#F4F4F5] rounded px-2.5 py-1 font-medium outline-none"
          >
            {documents.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Graph Context Expansion Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-zinc-300 hover:text-white bg-[#18181D] px-2.5 py-1 rounded border border-[#29292F] select-none">
            <input
              type="checkbox"
              checked={enableGraphExpansion}
              onChange={e => setEnableGraphExpansion(e.target.checked)}
              className="rounded accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <Network className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Graph Context Expansion</span>
            <span className="text-[10px] text-emerald-400 font-bold">512 tok</span>
          </label>

          <span className="text-xs font-mono text-[#71717A]">Version Policy:</span>
          <select
            value={versionPolicy}
            onChange={e => setVersionPolicy(e.target.value as any)}
            className="bg-[#18181D] border border-violet-900/40 text-xs text-violet-300 rounded px-2.5 py-1 font-mono outline-none"
          >
            <option value="active_only">Active Version (Isolated)</option>
            <option value="historical_pinned">Preprint Pinned (v1.0.0)</option>
            <option value="all_versions">All Versions (Audit)</option>
          </select>
        </div>
      </div>

      {activeMode === 'inspection' ? (
        <RetrievalInspectionLab
          selectedDocumentId={selectedDocumentId}
          versionPolicy={versionPolicy}
        />
      ) : (
        <>
          {/* Messages Thread Container */}
      <div className="flex-1 bg-[#09090B] border-x border-[#29292F] p-4 overflow-y-auto space-y-5">
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto' : 'mr-auto'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                  isUser
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#18181E] border border-[#29292F] text-violet-400'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div className="flex-1 space-y-2">
                <div
                  className={`p-4 rounded-lg text-xs leading-relaxed ${
                    isUser
                      ? 'bg-violet-950/40 border border-violet-800/40 text-[#F4F4F5]'
                      : 'bg-[#131316] border border-[#29292F] text-[#E4E4E7]'
                  }`}
                >
                  <div className="prose prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>
                </div>

                {/* Source Citations Beneath Answer */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono uppercase text-[#71717A] font-semibold tracking-wider block">
                      Retrieved Evidence & Provenance:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map(cit => (
                        <button
                          key={cit.id}
                          onClick={() => setActiveCitation(cit)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                            cit.is_graph_expanded
                              ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/70 text-emerald-300'
                              : 'bg-[#131317] hover:bg-[#18181F] border-[#29292F] hover:border-violet-600/50 text-violet-300'
                          }`}
                        >
                          {cit.is_graph_expanded ? (
                            <Network className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <BookOpen className="w-3 h-3 text-violet-400 shrink-0" />
                          )}
                          <span className="font-semibold">{cit.chunk_id}</span>
                          {cit.is_graph_expanded && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 uppercase font-semibold">
                              Graph Dep
                            </span>
                          )}
                          {cit.version_tag && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-950/80 text-violet-300 border border-violet-800/50">
                              {cit.version_tag}
                            </span>
                          )}
                          <span className="text-[#71717A]">(p. {cit.page_number})</span>
                          <span className="text-emerald-400 font-bold">
                            {(cit.relevance_score * 100).toFixed(0)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up question pills */}
                {msg.follow_ups && (
                  <div className="space-y-1 pt-1.5">
                    <span className="text-[10px] font-mono uppercase text-[#71717A] block">
                      Suggested Follow-Ups:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.follow_ups.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(q)}
                          className="text-[11px] text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#141418] hover:bg-[#1C1C22] border border-[#27272A] px-2.5 py-1 rounded transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-7 h-7 rounded-full bg-[#18181E] border border-[#29292F] flex items-center justify-center shrink-0 text-violet-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="p-3 bg-[#131316] border border-[#29292F] rounded-lg text-xs font-mono text-[#A1A1AA] flex items-center gap-2">
              <span>Retrieving AST-preserved chunks & synthesizing grounded response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <div className="bg-[#131316] border border-[#29292F] rounded-b-lg p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a scientific or mathematical question (e.g. 'How is Scaled Dot-Product formulated?')..."
            rows={2}
            className="flex-1 bg-[#18181D] border border-[#29292F] rounded p-2.5 text-xs text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-violet-500 resize-none font-sans"
          />

          <Button
            variant="primary"
            size="md"
            disabled={!inputValue.trim() || isSending}
            isLoading={isSending}
            icon={<Send className="w-3.5 h-3.5" />}
            onClick={() => handleSend()}
          >
            Send
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#71717A] font-mono px-1">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>Strategy: SmartChunk Structure Grounding</span>
        </div>
      </div>

      {/* Citation Source Inspection Drawer */}
      {activeCitation && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#0E0E12] border-l border-[#29292F] shadow-2xl flex flex-col animate-fade-in">
          <div className="p-4 border-b border-[#222227] flex items-center justify-between bg-[#121216]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Source Citation: {activeCitation.chunk_id}
                </h3>
                <p className="text-[11px] font-mono text-[#71717A]">
                  Page {activeCitation.page_number} | {activeCitation.document_name}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveCitation(null)}
              className="p-1 rounded text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1C1C22]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="p-3 bg-[#131317] rounded border border-[#222227] text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#71717A]">Document:</span>
                <span className="text-[#F4F4F5]">{activeCitation.document_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">Document Version:</span>
                <span className="text-emerald-400 font-semibold">{activeCitation.version_tag || 'v1.0.0'}</span>
              </div>
              {activeCitation.document_version_id && (
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Version ID:</span>
                  <span className="text-zinc-400 text-[11px]">{activeCitation.document_version_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#71717A]">Heading Path:</span>
                <span className="text-violet-400">{activeCitation.heading_path?.join(' > ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">Relevance Score:</span>
                <span className="text-emerald-400 font-bold">
                  {(activeCitation.relevance_score * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {activeCitation.is_graph_expanded && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-lg space-y-1.5 font-mono text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Context Dependency Expansion Justification</span>
                </div>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  {activeCitation.expansion_justification || 'Multi-Hop dependency expansion via graph traversal within token budget.'}
                </p>
                <div className="pt-1 flex items-center gap-2 text-[10px] text-emerald-400/70">
                  <span>Traversal Type: Topological Dependency</span>
                  <span>•</span>
                  <span>Isolation: Preserved</span>
                </div>
              </div>
            )}

            <div>
              <span className="text-[11px] font-mono uppercase text-[#71717A] block mb-2">
                Ground Truth Chunk Snippet
              </span>
              <div className="p-4 bg-[#0A0A0C] border border-[#29292F] rounded-lg text-xs leading-relaxed text-[#D4D4D8] font-mono">
                {activeCitation.snippet}
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#121216] border-t border-[#222227] flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              icon={copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              onClick={copyCitation}
            >
              {copiedSnippet ? 'Copied' : 'Copy Snippet'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActiveCitation(null);
                setCurrentPage('inspector');
              }}
            >
              Open in Chunk Inspector
            </Button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

