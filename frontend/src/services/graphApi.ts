import { apiRequest, getDemoModePreference } from './apiClient';
import {
  KnowledgeGraphData,
  ContextExpansionConfig,
  ExpandedContextResult,
  ContextExpansionPath,
  GraphEdgeType,
  Chunk,
} from '../types';
import { DEMO_KNOWLEDGE_GRAPH, DEMO_CHUNKS } from '../demo/demoData';

export async function fetchKnowledgeGraph(
  documentId?: string,
  versionId?: string
): Promise<KnowledgeGraphData> {
  if (getDemoModePreference()) {
    let result = { ...DEMO_KNOWLEDGE_GRAPH };
    if (versionId && versionId !== 'all') {
      const nodes = result.nodes.filter(n => !n.version_id || n.version_id === versionId);
      const nodeIds = new Set(nodes.map(n => n.id));
      const edges = result.edges.filter(
        e => nodeIds.has(e.source) && nodeIds.has(e.target) && (!e.version_id || e.version_id === versionId)
      );
      result = {
        ...result,
        nodes,
        edges,
        metadata: {
          ...result.metadata,
          version_id: versionId,
          node_count: nodes.length,
          edge_count: edges.length,
        },
      };
    }
    return Promise.resolve(result);
  }

  const queryParams = new URLSearchParams();
  if (documentId) queryParams.set('document_id', documentId);
  if (versionId) queryParams.set('version_id', versionId);

  const endpoint = `/api/v1/graph${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<KnowledgeGraphData>(endpoint);
}

export async function queryGraphNodes(term: string): Promise<any[]> {
  if (getDemoModePreference()) {
    const q = term.toLowerCase();
    const hits = DEMO_KNOWLEDGE_GRAPH.nodes.filter(
      n => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    );
    return Promise.resolve(hits);
  }
  return apiRequest<any[]>(`/api/v1/graph/search?q=${encodeURIComponent(term)}`);
}

// Map graph node ID to actual Chunk ID in DEMO_CHUNKS
function mapNodeToChunk(nodeId: string): Chunk | undefined {
  if (nodeId === 'chk-5' || nodeId === 'chk-vaswani-005') {
    return DEMO_CHUNKS.find(c => c.id === 'chk-vaswani-005');
  }
  if (nodeId === 'chk-6' || nodeId === 'chk-vaswani-006') {
    return DEMO_CHUNKS.find(c => c.id === 'chk-vaswani-006');
  }
  if (nodeId === 'chk-8' || nodeId === 'chk-vaswani-008') {
    return DEMO_CHUNKS.find(c => c.id === 'chk-vaswani-008');
  }
  if (nodeId === 'chk-resnet-004') {
    return DEMO_CHUNKS.find(c => c.id === 'chk-resnet-004');
  }
  if (nodeId === 'chk-vaswani-001') {
    return DEMO_CHUNKS.find(c => c.id === 'chk-vaswani-001');
  }
  // Fallback to finding by id
  return DEMO_CHUNKS.find(c => c.id === nodeId);
}

// Priority rank for edge types (semantic dependency first, then structural, then lexical)
const EDGE_PRIORITY: Record<GraphEdgeType, number> = {
  DEPENDS_ON: 1.0,
  DEFINES: 0.95,
  REFERENCES: 0.85,
  PARENT_CHILD: 0.8,
  CONTAINS: 0.75,
  CALCULATES: 0.7,
  PREVIOUS_NEXT: 0.65,
  FOLLOWS: 0.6,
  CITES: 0.55,
  SEMANTIC_SIMILAR: 0.4,
};

/**
 * FEATURE 2: Bounded Context Dependency Expansion
 * Expands retrieved seed chunks along structural and semantic dependency edges
 * with cycle avoidance, candidate ranking, and strict token budget enforcement.
 */
export async function expandContextWithDependencies(
  seedChunkIds: string[],
  config: ContextExpansionConfig
): Promise<ExpandedContextResult> {
  if (getDemoModePreference()) {
    const maxTokens = config.max_expansion_tokens || 512;
    const maxDepth = config.max_hop_depth || 2;
    const minWeight = config.min_edge_weight || 0.5;
    const allowedTypes = config.allowed_edge_types;
    const avoidCycles = config.avoid_cycles !== false;
    const versionFilter = config.version_id;

    // Resolve seed chunks
    const seedChunks: Chunk[] = [];
    const seedNodeIds = new Set<string>();

    for (const id of seedChunkIds) {
      const chk = mapNodeToChunk(id);
      if (chk) {
        seedChunks.push(chk);
        seedNodeIds.add(chk.id);
        if (chk.id === 'chk-vaswani-005') seedNodeIds.add('chk-5');
        if (chk.id === 'chk-vaswani-006') seedNodeIds.add('chk-6');
        if (chk.id === 'chk-vaswani-008') seedNodeIds.add('chk-8');
      } else {
        seedNodeIds.add(id);
      }
    }

    const initialTokens = seedChunks.reduce((acc, c) => acc + c.token_count, 0);

    let expandedTokens = 0;
    let cyclesDetected = 0;
    let prunedCandidatesCount = 0;

    const expandedChunks: Chunk[] = [];
    const expandedChunkIds = new Set<string>(seedChunks.map(c => c.id));
    const traversalPaths: ContextExpansionPath[] = [];

    // BFS Queue: [nodeId, depth, pathSoFar]
    const queue: Array<{ nodeId: string; depth: number; path: string[] }> = [];
    for (const s of seedNodeIds) {
      queue.push({ nodeId: s, depth: 0, path: [s] });
    }

    const visitedNodes = new Set<string>(seedNodeIds);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      // Find relevant edges connected to current node
      const candidateEdges = DEMO_KNOWLEDGE_GRAPH.edges
        .filter(e => e.source === current.nodeId || e.target === current.nodeId)
        .filter(e => !allowedTypes || allowedTypes.includes(e.type))
        .filter(e => (e.weight ?? 1.0) >= minWeight)
        // Sort by relationship priority and weight
        .sort((a, b) => {
          const pA = (EDGE_PRIORITY[a.type] || 0.5) * (a.weight || 1.0);
          const pB = (EDGE_PRIORITY[b.type] || 0.5) * (b.weight || 1.0);
          return pB - pA;
        });

      for (const edge of candidateEdges) {
        const neighborId = edge.source === current.nodeId ? edge.target : edge.source;

        // 1. Cycle detection
        if (avoidCycles && current.path.includes(neighborId)) {
          cyclesDetected++;
          continue;
        }

        if (visitedNodes.has(neighborId)) {
          continue;
        }

        // 2. Cross-version isolation check
        if (versionFilter && edge.version_id && edge.version_id !== versionFilter) {
          continue; // Prevent cross-version contamination
        }

        // 3. Resolve neighbor chunk if applicable
        const neighborChunk = mapNodeToChunk(neighborId);

        if (neighborChunk && !expandedChunkIds.has(neighborChunk.id)) {
          // Version isolation on chunk
          if (versionFilter && neighborChunk.version_id && neighborChunk.version_id !== versionFilter) {
            continue;
          }

          // 4. Token budget check
          if (expandedTokens + neighborChunk.token_count > maxTokens) {
            prunedCandidatesCount++;
            continue; // Exceeds budget
          }

          // Add chunk to expansion
          expandedChunks.push(neighborChunk);
          expandedChunkIds.add(neighborChunk.id);
          expandedTokens += neighborChunk.token_count;

          // Record justified traversal path
          const justification =
            edge.evidence ||
            `${edge.type} relationship: ${edge.label || 'Structural dependency connection'}`;

          traversalPaths.push({
            source_id: current.nodeId,
            target_id: neighborId,
            edge_type: edge.type,
            hop_depth: current.depth + 1,
            justification,
            weight: edge.weight || 1.0,
          });
        }

        visitedNodes.add(neighborId);
        queue.push({
          nodeId: neighborId,
          depth: current.depth + 1,
          path: [...current.path, neighborId],
        });
      }
    }

    const result: ExpandedContextResult = {
      seed_chunk_ids: seedChunkIds,
      expanded_chunks: expandedChunks,
      traversal_paths: traversalPaths,
      initial_tokens: initialTokens,
      expanded_tokens: expandedTokens,
      total_tokens: initialTokens + expandedTokens,
      token_budget: maxTokens,
      cycles_detected: cyclesDetected,
      pruned_candidates_count: prunedCandidatesCount,
    };

    return Promise.resolve(result);
  }

  return apiRequest<ExpandedContextResult>('/api/v1/graph/expand-context', {
    method: 'POST',
    body: JSON.stringify({
      seed_chunk_ids: seedChunkIds,
      config,
    }),
  });
}


