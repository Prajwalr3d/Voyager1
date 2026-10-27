import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fetchKnowledgeGraph } from '../services/graphApi';
import { KnowledgeGraphData, GraphNode, GraphEdge, GraphNodeType } from '../types';
import { ContextExpansionSimulator } from '../components/graph/ContextExpansionSimulator';
import {
  Network,
  Search,
  Filter,
  Layers,
  Sigma,
  Table as TableIcon,
  BookOpen,
  FileText,
  Bookmark,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  ChevronRight,
  Info,
  Zap,
  RotateCcw,
} from 'lucide-react';

// Curated 2D layout coordinates for core Vaswani attention entities
const BASE_CURATED_POSITIONS: Record<string, { x: number; y: number }> = {
  'doc-node-1': { x: 380, y: 65 },
  'sec-arch': { x: 380, y: 165 },
  'sec-attn': { x: 260, y: 270 },
  'tbl-complexity': { x: 520, y: 270 },
  'sec-scaled': { x: 180, y: 390 },
  'sec-multihead': { x: 340, y: 390 },
  'cit-bahdanau': { x: 540, y: 390 },
  'eq-scaled': { x: 140, y: 510 },
  'def-scaling': { x: 240, y: 510 },
  'def-queries': { x: 50, y: 510 },
  'eq-multihead': { x: 340, y: 510 },
  'chk-5': { x: 180, y: 630 },
  'chk-6': { x: 340, y: 630 },
  'chk-8': { x: 520, y: 510 },
};

/**
 * Deterministic layout generator.
 * Computes initial coordinates once when graph data changes.
 * Preserves known coordinates and positions any dynamic/unmapped nodes
 * in structured, non-overlapping horizontal tiers.
 */
function computeStableGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  existingPositions: Record<string, { x: number; y: number }> = {}
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = { ...existingPositions };

  // 1. Assign known curated coordinates if available and not yet set
  nodes.forEach(node => {
    if (!positions[node.id] && BASE_CURATED_POSITIONS[node.id]) {
      positions[node.id] = { ...BASE_CURATED_POSITIONS[node.id] };
    }
  });

  // 2. Identify unplaced nodes
  const unplaced = nodes.filter(n => !positions[n.id]);
  if (unplaced.length === 0) return positions;

  const tierY: Record<string, number> = {
    document: 65,
    section: 165,
    equation: 330,
    table: 330,
    definition: 480,
    citation: 480,
    chunk: 630,
  };

  const byTier: Record<string, GraphNode[]> = {};
  unplaced.forEach(node => {
    const tier = node.type || 'chunk';
    if (!byTier[tier]) byTier[tier] = [];
    byTier[tier].push(node);
  });

  Object.entries(byTier).forEach(([tier, tierNodes]) => {
    const y = tierY[tier] || 740;
    const count = tierNodes.length;
    const startX = 100;
    const endX = 660;
    const spacing = (endX - startX) / (count + 1);

    tierNodes.forEach((node, idx) => {
      positions[node.id] = {
        x: Math.round(startX + spacing * (idx + 1)),
        y,
      };
    });
  });

  // 3. Fast deterministic 25-step repulsion pass to resolve overlapping positions
  const nodeIds = nodes.map(n => n.id);
  const minDistance = 55;

  for (let iter = 0; iter < 25; iter++) {
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const idA = nodeIds[i];
        const idB = nodeIds[j];
        const posA = positions[idA];
        const posB = positions[idB];
        if (!posA || !posB) continue;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.hypot(dx, dy) || 0.1;

        if (dist < minDistance) {
          const overlap = (minDistance - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          if (!BASE_CURATED_POSITIONS[idA]) {
            posA.x -= nx * overlap * 0.5;
            posA.y -= ny * overlap * 0.5;
          }
          if (!BASE_CURATED_POSITIONS[idB]) {
            posB.x += nx * overlap * 0.5;
            posB.y += ny * overlap * 0.5;
          }
        }
      }
    }
  }

  return positions;
}

export const KnowledgeGraphPage: React.FC = () => {
  const { selectedDocumentId, selectedDocument, setCurrentPage, notify } = useApp();

  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('sec-scaled');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [activeRightTab, setActiveRightTab] = useState<'details' | 'expansion'>('details');

  // Track dragging state cleanly to prevent click vs pan conflicts
  const dragTrackerRef = useRef<{
    mode: 'idle' | 'pan' | 'node';
    startX: number;
    startY: number;
    initialPan: { x: number; y: number };
    nodeId?: string;
    initialNodePos?: { x: number; y: number };
    hasMoved: boolean;
  }>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    initialPan: { x: 0, y: 0 },
    hasMoved: false,
  });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load graph data once per document change
  useEffect(() => {
    let isCancelled = false;

    async function loadGraph() {
      try {
        const data = await fetchKnowledgeGraph(selectedDocumentId);
        if (isCancelled) return;
        setGraphData(data);

        // Compute stable layout once for this dataset
        setNodePositions(prev => computeStableGraphLayout(data.nodes, data.edges, prev));

        // Auto-select seed node if present, otherwise first node
        if (data.nodes.length > 0) {
          const hasScaled = data.nodes.some(n => n.id === 'sec-scaled');
          setSelectedNodeId(hasScaled ? 'sec-scaled' : data.nodes[0].id);
        }
      } catch (err: any) {
        if (!isCancelled) {
          notify('error', `Failed to load Knowledge Graph: ${err.message}`);
        }
      }
    }

    loadGraph();

    return () => {
      isCancelled = true;
    };
  }, [selectedDocumentId]);

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!graphData) return null;
    return graphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [graphData, selectedNodeId]);

  // Connected edges to selected node
  const connectedEdges = useMemo(() => {
    if (!graphData || !selectedNodeId) return [];
    return graphData.edges.filter(
      e => e.source === selectedNodeId || e.target === selectedNodeId
    );
  }, [graphData, selectedNodeId]);

  const connectedEdgeIdSet = useMemo(() => {
    return new Set(connectedEdges.map(e => e.id));
  }, [connectedEdges]);

  // Related neighbor node IDs
  const neighborNodeIdSet = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    connectedEdges.forEach(e => {
      if (e.source === selectedNodeId) set.add(e.target);
      if (e.target === selectedNodeId) set.add(e.source);
    });
    return set;
  }, [connectedEdges, selectedNodeId]);

  const neighborNodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes.filter(n => neighborNodeIdSet.has(n.id));
  }, [graphData, neighborNodeIdSet]);

  const getNodeColor = useCallback((type: GraphNodeType): string => {
    switch (type) {
      case 'document':
        return '#8B5CF6'; // Violet
      case 'section':
        return '#3B82F6'; // Blue
      case 'equation':
        return '#10B981'; // Emerald
      case 'table':
        return '#F59E0B'; // Amber
      case 'definition':
        return '#EC4899'; // Pink
      case 'citation':
        return '#06B6D4'; // Cyan
      case 'chunk':
      default:
        return '#71717A'; // Zinc
    }
  }, []);

  // Filtered nodes based on search and type selector
  const filteredNodes = useMemo(() => {
    if (!graphData) return [];
    const query = searchQuery.trim().toLowerCase();
    return graphData.nodes.filter(node => {
      const matchesSearch =
        !query ||
        node.label.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query);
      const matchesType = selectedTypeFilter === 'all' || node.type === selectedTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [graphData, searchQuery, selectedTypeFilter]);

  // Sort nodes so selected and highlighted ones are rendered last (on top of canvas)
  const renderedNodes = useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
      const isSelectedA = a.id === selectedNodeId;
      const isSelectedB = b.id === selectedNodeId;
      if (isSelectedA) return 1;
      if (isSelectedB) return -1;
      const isNeighborA = neighborNodeIdSet.has(a.id);
      const isNeighborB = neighborNodeIdSet.has(b.id);
      if (isNeighborA && !isNeighborB) return 1;
      if (!isNeighborA && isNeighborB) return -1;
      return 0;
    });
  }, [filteredNodes, selectedNodeId, neighborNodeIdSet]);

  // Window pointer listeners to ensure smooth drag without missing events outside SVG
  const handlePointerMove = useCallback((e: PointerEvent) => {
    const tracker = dragTrackerRef.current;
    if (tracker.mode === 'idle') return;

    const dx = e.clientX - tracker.startX;
    const dy = e.clientY - tracker.startY;

    // Apply movement threshold to cleanly distinguish clicks from drags
    if (!tracker.hasMoved && Math.hypot(dx, dy) > 4) {
      tracker.hasMoved = true;
    }

    if (!tracker.hasMoved) return;

    if (tracker.mode === 'pan') {
      setPanOffset({
        x: tracker.initialPan.x + dx,
        y: tracker.initialPan.y + dy,
      });
    } else if (tracker.mode === 'node' && tracker.nodeId && tracker.initialNodePos) {
      const curZoom = zoomLevel || 1;
      const updatedX = Math.round(tracker.initialNodePos.x + dx / curZoom);
      const updatedY = Math.round(tracker.initialNodePos.y + dy / curZoom);

      setNodePositions(prev => ({
        ...prev,
        [tracker.nodeId!]: { x: updatedX, y: updatedY },
      }));
    }
  }, [zoomLevel]);

  const handlePointerUp = useCallback((_e: PointerEvent) => {
    const tracker = dragTrackerRef.current;

    if (!tracker.hasMoved) {
      // Pure click event (stationary)
      if (tracker.mode === 'node' && tracker.nodeId) {
        setSelectedNodeId(prev => (prev === tracker.nodeId ? tracker.nodeId : tracker.nodeId!));
      } else if (tracker.mode === 'pan') {
        // Clicking empty canvas deselects active node
        setSelectedNodeId(null);
      }
    }

    tracker.mode = 'idle';
    tracker.hasMoved = false;

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  }, [handlePointerMove]);

  // Pointer down on background canvas (pan)
  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only primary mouse button

    dragTrackerRef.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      initialPan: { ...panOffset },
      hasMoved: false,
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Pointer down on individual node (node drag or click)
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const currentPos = nodePositions[nodeId] || { x: 300, y: 300 };

    dragTrackerRef.current = {
      mode: 'node',
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      initialPan: { ...panOffset },
      initialNodePos: { ...currentPos },
      hasMoved: false,
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = -e.deltaY * 0.0012;
    setZoomLevel(prev => {
      const next = prev + zoomDelta;
      return Math.min(Math.max(+next.toFixed(2), 0.4), 2.5);
    });
  };

  // Clean reset view handler
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const hasSelection = !!selectedNodeId;

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="rounded-lg border border-[#29292F] bg-[#131317] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-violet-400 font-semibold">
              Scientific Knowledge Graph
            </span>
          </div>
          <h2 className="text-base font-semibold text-[#F4F4F5] tracking-tight">
            Multi-Hop Entity Hierarchy: Equations, Sections, Tables & Definitions
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            SmartChunk binds chunks to their parent theorems, formula ASTs, and reference papers to power multi-hop graph retrieval.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search graph entities..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#18181D] border border-[#29292F] rounded pl-8 pr-2.5 py-1 text-xs text-[#F4F4F5] placeholder-[#71717A] outline-none font-mono w-40 sm:w-48 focus:border-violet-500"
            />
          </div>

          <select
            value={selectedTypeFilter}
            onChange={e => setSelectedTypeFilter(e.target.value)}
            className="bg-[#18181D] border border-[#29292F] rounded px-2.5 py-1 text-xs text-[#F4F4F5] outline-none font-mono"
          >
            <option value="all">All Entity Types</option>
            <option value="document">Documents</option>
            <option value="section">Sections</option>
            <option value="equation">Equations</option>
            <option value="table">Tables</option>
            <option value="definition">Definitions</option>
            <option value="citation">Citations</option>
          </select>
        </div>
      </div>

      {/* Main Graph Grid: Interactive Canvas (8 cols) + Selected Entity Detail Drawer (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[640px]">
        {/* Canvas Area */}
        <div className="lg:col-span-8 bg-[#0D0D10] border border-[#29292F] rounded-lg relative overflow-hidden flex flex-col">
          {/* Canvas Controls */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#141418]/90 backdrop-blur border border-[#29292F] rounded-lg p-1">
            <button
              onClick={() => setZoomLevel(prev => Math.min(+(prev + 0.15).toFixed(2), 2.5))}
              className="p-1.5 rounded hover:bg-[#222228] text-[#A1A1AA] hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(+(prev - 0.15).toFixed(2), 0.4))}
              className="p-1.5 rounded hover:bg-[#222228] text-[#A1A1AA] hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 rounded hover:bg-[#222228] text-[#A1A1AA] hover:text-white transition-colors"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-[#71717A] px-1.5 border-l border-[#29292F]">
              {(zoomLevel * 100).toFixed(0)}%
            </span>
          </div>

          {/* Quick Node Hint */}
          <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-2 bg-[#141418]/90 backdrop-blur border border-[#29292F] rounded-lg px-2.5 py-1 text-[10px] font-mono text-[#71717A]">
            <span>Click node to inspect</span>
            <span className="text-[#3A3A42]">•</span>
            <span>Drag node to reposition</span>
            <span className="text-[#3A3A42]">•</span>
            <span>Drag background to pan</span>
          </div>

          {/* Graph Legend */}
          <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-3 bg-[#141418]/90 backdrop-blur border border-[#29292F] rounded-lg px-3 py-1.5 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-[#8B5CF6]">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" /> Doc
            </span>
            <span className="flex items-center gap-1 text-[#3B82F6]">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Section
            </span>
            <span className="flex items-center gap-1 text-[#10B981]">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Equation
            </span>
            <span className="flex items-center gap-1 text-[#F59E0B]">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Table
            </span>
            <span className="flex items-center gap-1 text-[#EC4899]">
              <span className="w-2 h-2 rounded-full bg-[#EC4899]" /> Symbol
            </span>
            <span className="flex items-center gap-1 text-[#06B6D4]">
              <span className="w-2 h-2 rounded-full bg-[#06B6D4]" /> Citation
            </span>
          </div>

          {/* SVG Interactive Canvas */}
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handleCanvasPointerDown}
            onWheel={handleWheel}
          >
            {/* Background Grid Pattern & Arrowhead Markers */}
            <defs>
              <pattern id="graphGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#202026" />
              </pattern>
              {/* Default edge marker */}
              <marker
                id="edge-arrow"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3A3A48" />
              </marker>
              {/* Connected edge marker */}
              <marker
                id="edge-arrow-connected"
                viewBox="0 0 10 10"
                refX="24"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#8B5CF6" />
              </marker>
              {/* Highlighted expansion marker */}
              <marker
                id="edge-arrow-highlighted"
                viewBox="0 0 10 10"
                refX="24"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10B981" />
              </marker>
            </defs>

            <rect width="100%" height="100%" fill="url(#graphGrid)" />

            <g transform={`translate(${panOffset.x + 80}, ${panOffset.y + 20}) scale(${zoomLevel})`}>
              {/* Edges */}
              {graphData?.edges.map(edge => {
                const src = nodePositions[edge.source] || { x: 300, y: 300 };
                const tgt = nodePositions[edge.target] || { x: 350, y: 350 };
                const isConnected =
                  edge.source === selectedNodeId || edge.target === selectedNodeId;
                const isHighlightedEdge =
                  highlightedNodeIds.includes(edge.source) &&
                  highlightedNodeIds.includes(edge.target);
                const isEdgeHovered = hoveredEdgeId === edge.id;

                // Color and opacity hierarchy
                let strokeColor = '#24242F';
                let strokeWidth = 1.2;
                let strokeOpacity = 0.5;
                let markerId = 'url(#edge-arrow)';

                if (isHighlightedEdge) {
                  strokeColor = '#10B981';
                  strokeWidth = 2.5;
                  strokeOpacity = 1.0;
                  markerId = 'url(#edge-arrow-highlighted)';
                } else if (isConnected) {
                  strokeColor = '#8B5CF6';
                  strokeWidth = 2.2;
                  strokeOpacity = 0.95;
                  markerId = 'url(#edge-arrow-connected)';
                } else if (hasSelection) {
                  // Dim unrelated edges when a node is selected
                  strokeOpacity = 0.18;
                  strokeColor = '#1C1C24';
                }

                if (isEdgeHovered && !isHighlightedEdge && !isConnected) {
                  strokeColor = '#4B5563';
                  strokeOpacity = 0.8;
                }

                return (
                  <g
                    key={edge.id}
                    onPointerEnter={() => setHoveredEdgeId(edge.id)}
                    onPointerLeave={() => setHoveredEdgeId(null)}
                    className="transition-colors"
                  >
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={edge.type === 'REFERENCES' ? '4 2' : undefined}
                      opacity={strokeOpacity}
                      markerEnd={markerId}
                    />
                    {edge.label && (
                      <g transform={`translate(${(src.x + tgt.x) / 2}, ${(src.y + tgt.y) / 2 - 4})`}>
                        <text
                          fill={
                            isHighlightedEdge
                              ? '#34D399'
                              : isConnected
                              ? '#C4B5FD'
                              : isEdgeHovered
                              ? '#D4D4D8'
                              : '#52525B'
                          }
                          fontSize="9"
                          fontWeight={isHighlightedEdge || isConnected ? '600' : 'normal'}
                          fontFamily="monospace"
                          textAnchor="middle"
                          opacity={isHighlightedEdge || isConnected || isEdgeHovered ? 1 : hasSelection ? 0.2 : 0.75}
                          className="pointer-events-none select-none"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {renderedNodes.map(node => {
                const pos = nodePositions[node.id] || { x: 300, y: 300 };
                const isSelected = selectedNodeId === node.id;
                const isNeighbor = neighborNodeIdSet.has(node.id);
                const isHighlighted = highlightedNodeIds.includes(node.id);
                const isHovered = hoveredNodeId === node.id;
                const color = getNodeColor(node.type);

                // Visual dimming hierarchy
                let nodeOpacity = 1.0;
                if (hasSelection && !isSelected && !isNeighbor && !isHighlighted) {
                  nodeOpacity = isHovered ? 0.6 : 0.28;
                }

                const baseRadius = node.type === 'document' ? 18 : 14;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onPointerDown={e => handleNodePointerDown(e, node.id)}
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() => setHoveredNodeId(null)}
                    opacity={nodeOpacity}
                    className="cursor-pointer"
                  >
                    {/* Invisible hit-testing circle (prevents hover flicker on edges) */}
                    <circle r={baseRadius + 10} fill="transparent" />

                    {/* Context expansion highlight halo (emerald) */}
                    {isHighlighted && (
                      <circle
                        r={baseRadius + 10}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        opacity="0.9"
                      />
                    )}

                    {/* Selection halo ring (clean, stationary double-ring) */}
                    {isSelected && (
                      <circle
                        r={baseRadius + 7}
                        fill="none"
                        stroke="#F4F4F5"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                        opacity="0.85"
                      />
                    )}

                    {/* Subtle hover ring without layout shifts or scale jitter */}
                    {isHovered && !isSelected && (
                      <circle
                        r={baseRadius + 4}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeOpacity="0.5"
                      />
                    )}

                    {/* Main node body */}
                    <circle
                      r={baseRadius}
                      fill="#121216"
                      stroke={isSelected ? '#F4F4F5' : isNeighbor ? '#A78BFA' : color}
                      strokeWidth={isSelected ? 2.5 : isNeighbor ? 2 : 1.8}
                    />

                    {/* Inner entity type indicator dot */}
                    <circle r="4" fill={color} />

                    {/* Label below node */}
                    <text
                      y={baseRadius + 13}
                      fill={isSelected ? '#FFFFFF' : isNeighbor ? '#E4E4E7' : '#A1A1AA'}
                      fontSize={isSelected ? '11' : '10'}
                      fontWeight={isSelected ? '600' : 'normal'}
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="pointer-events-none select-none drop-shadow"
                    >
                      {node.label.length > 22 ? `${node.label.substring(0, 20)}...` : node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Selected Entity Inspector Panel (4 cols) */}
        <div className="lg:col-span-4 bg-[#131316] border border-[#29292F] rounded-lg flex flex-col overflow-hidden">
          <div className="p-2 border-b border-[#222227] flex items-center justify-between bg-[#111114]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveRightTab('details')}
                className={`px-2.5 py-1 text-xs font-mono rounded flex items-center gap-1.5 transition-colors ${
                  activeRightTab === 'details'
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 font-semibold'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A22]'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                Entity Attributes
              </button>
              <button
                onClick={() => setActiveRightTab('expansion')}
                className={`px-2.5 py-1 text-xs font-mono rounded flex items-center gap-1.5 transition-colors ${
                  activeRightTab === 'expansion'
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A22]'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Context Expansion
                {highlightedNodeIds.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>
            {selectedNode && activeRightTab === 'details' && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded uppercase"
                style={{
                  backgroundColor: `${getNodeColor(selectedNode.type)}20`,
                  color: getNodeColor(selectedNode.type),
                  border: `1px solid ${getNodeColor(selectedNode.type)}40`,
                }}
              >
                {selectedNode.type}
              </span>
            )}
          </div>

          {activeRightTab === 'expansion' ? (
            <div className="flex-1 overflow-y-auto p-3">
              <ContextExpansionSimulator
                seedNodeId={selectedNode ? selectedNode.id : 'sec-scaled'}
                seedLabel={selectedNode ? selectedNode.label : 'Scaled Dot-Product Attention'}
                documentId={selectedDocumentId}
                versionId={selectedDocument?.active_version_id}
                onNavigateToChunk={(_chunkId) => {
                  setCurrentPage('chunks');
                }}
                onHighlightNodes={(nodeIds) => {
                  setHighlightedNodeIds(nodeIds);
                }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#F4F4F5]">{selectedNode.label}</h3>
                      <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
                        ID: {selectedNode.id}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveRightTab('expansion')}
                      className="text-[11px] font-mono text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/30 flex items-center gap-1 shrink-0"
                    >
                      <Zap className="w-3 h-3 text-emerald-400" />
                      Expand Dependencies
                    </Button>
                  </div>

                  {/* Entity Properties */}
                  <div className="p-3 rounded bg-[#0E0E12] border border-[#222227] space-y-2 text-xs font-mono">
                    <div className="text-[11px] text-[#71717A] uppercase font-semibold">
                      Extracted Attributes
                    </div>
                    {Object.entries(selectedNode.properties).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-start gap-2">
                        <span className="text-[#71717A] shrink-0">{key}:</span>
                        <span className="text-[#F4F4F5] text-right break-all">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Formula or Table Preview if applicable */}
                  {selectedNode.properties.latex && (
                    <div className="p-3 rounded bg-emerald-950/20 border border-emerald-900/40 text-xs font-mono space-y-1">
                      <span className="text-emerald-400 font-semibold block text-[11px]">
                        LaTeX Mathematical Expression
                      </span>
                      <div className="p-2 bg-[#0A0A0C] border border-[#222227] rounded text-emerald-300 overflow-x-auto">
                        <code>{selectedNode.properties.latex}</code>
                      </div>
                    </div>
                  )}

                  {/* Connected Edges & Neighbors */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-[#F4F4F5] flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        Connected Entities ({neighborNodes.length})
                      </span>
                      {selectedNodeId && (
                        <button
                          onClick={() => setSelectedNodeId(null)}
                          className="text-[10px] font-mono text-[#71717A] hover:text-[#A1A1AA]"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {neighborNodes.map(neighbor => {
                        const edge = connectedEdges.find(
                          e =>
                            (e.source === neighbor.id && e.target === selectedNode.id) ||
                            (e.target === neighbor.id && e.source === selectedNode.id)
                        );
                        const isOutgoing = edge?.source === selectedNode.id;

                        return (
                          <div
                            key={neighbor.id}
                            onClick={() => setSelectedNodeId(neighbor.id)}
                            className="p-2.5 bg-[#0E0E12] hover:bg-[#16161B] rounded border border-[#222227] transition-colors cursor-pointer flex items-center justify-between text-xs font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getNodeColor(neighbor.type) }}
                              />
                              <div>
                                <span className="text-[#F4F4F5] font-medium block truncate max-w-[170px]">
                                  {neighbor.label}
                                </span>
                                <span className="text-[10px] text-[#71717A]">
                                  {isOutgoing ? '→ ' : '← '}
                                  {edge?.type || 'RELATES'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-xs text-[#71717A] space-y-2">
                  <Network className="w-8 h-8 text-[#2A2A35] mx-auto" />
                  <p className="font-semibold text-[#A1A1AA]">No Entity Selected</p>
                  <p>Click on any node in the graph canvas to inspect structural dependencies.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
