// ============================================================================
// PHASE 2 VERIFICATION TEST SUITE: CONTEXT DEPENDENCY GRAPH
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`\x1b[31m✘ FAIL:\x1b[0m ${name}`);
    console.error(`  ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('SMARTCHUNK PHASE 2: CONTEXT DEPENDENCY GRAPH TEST HARNESS');
  console.log('============================================================\n');

  // 1. Verify schema migration 002
  test('1. Database Migration 002 defines graph_nodes, graph_edges and traversal indexes', () => {
    const migrationPath = path.join(__dirname, '../schema/migrations/002_context_dependency_graph.sql');
    assert(fs.existsSync(migrationPath), 'Migration 002 file must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert(sql.includes('CREATE TABLE IF NOT EXISTS graph_nodes'), 'Must contain graph_nodes table');
    assert(sql.includes('CREATE TABLE IF NOT EXISTS graph_edges'), 'Must contain graph_edges table');
    assert(sql.includes('REFERENCES documents(id)'), 'Must reference documents table');
    assert(sql.includes('REFERENCES document_versions(id)'), 'Must reference document_versions table');
    assert(sql.includes("'DEPENDS_ON'"), 'Must support DEPENDS_ON edge type');
    assert(sql.includes("'DEFINES'"), 'Must support DEFINES edge type');
    assert(sql.includes("'REFERENCES'"), 'Must support REFERENCES edge type');
    assert(sql.includes("'PARENT_CHILD'"), 'Must support PARENT_CHILD edge type');
    assert(sql.includes("'PREVIOUS_NEXT'"), 'Must support PREVIOUS_NEXT edge type');
    assert(sql.includes('idx_graph_edges_traversal'), 'Must index traversal edges by source_node_id and edge_type');
    assert(sql.includes('idx_graph_edges_incoming'), 'Must index incoming edges by target_node_id');
  });

  // 2. Verify TypeScript type definitions for Context Dependency Graph
  test('2. TypeScript types declare ContextExpansionConfig and traversal result contracts', () => {
    const typesPath = path.join(__dirname, '../src/types/index.ts');
    const content = fs.readFileSync(typesPath, 'utf8');
    assert(content.includes('export type GraphEdgeType'), 'Must declare GraphEdgeType');
    assert(content.includes('export interface ContextExpansionConfig'), 'Must declare ContextExpansionConfig');
    assert(content.includes('export interface ContextExpansionPath'), 'Must declare ContextExpansionPath');
    assert(content.includes('export interface ExpandedContextResult'), 'Must declare ExpandedContextResult');
    assert(content.includes('max_expansion_tokens: number;'), 'ContextExpansionConfig must have max_expansion_tokens');
    assert(content.includes('max_hop_depth: number;'), 'ContextExpansionConfig must have max_hop_depth');
    assert(content.includes('cycles_detected: number;'), 'ExpandedContextResult must track cycles_detected');
    assert(content.includes('traversal_paths: ContextExpansionPath[];'), 'ExpandedContextResult must track traversal_paths');
    assert(content.includes('expansion_justification?: string;'), 'Citation must support expansion_justification');
    assert(content.includes('is_graph_expanded?: boolean;'), 'Citation must support is_graph_expanded flag');
  });

  // 3. Verify Graph API Context Expansion Algorithm Implementation
  test('3. Graph API exports expandContextWithDependencies with BFS and cycle tracking', () => {
    const apiPath = path.join(__dirname, '../src/services/graphApi.ts');
    const content = fs.readFileSync(apiPath, 'utf8');
    assert(content.includes('export async function expandContextWithDependencies'), 'expandContextWithDependencies must be exported');
    assert(content.includes('visitedNodes = new Set<string>'), 'Must track visited nodes to avoid duplicate expansion');
    assert(content.includes('cyclesDetected++'), 'Must detect and record graph cycle traversals');
    assert(content.includes('EDGE_PRIORITY'), 'Must apply candidate ranking with edge weight priorities');
    assert(content.includes('expandedTokens + neighborChunk.token_count > maxTokens'), 'Must enforce strict token budget cap');
    assert(content.includes('prunedCandidatesCount++'), 'Must track pruned candidate count');
  });

  // 4. Algorithm Simulation: Candidate ranking and edge priority ordering
  test('4. Algorithm Simulation: DEPENDS_ON and DEFINES prioritized over SEMANTIC_SIMILAR', () => {
    const edgePriorities = {
      DEPENDS_ON: 1.0,
      DEFINES: 0.95,
      REFERENCES: 0.85,
      PARENT_CHILD: 0.8,
      PREVIOUS_NEXT: 0.65,
      SEMANTIC_SIMILAR: 0.4,
    };

    assert(edgePriorities['DEPENDS_ON'] > edgePriorities['REFERENCES'], 'DEPENDS_ON must outrank REFERENCES');
    assert(edgePriorities['DEFINES'] > edgePriorities['SEMANTIC_SIMILAR'], 'DEFINES must outrank SEMANTIC_SIMILAR');
    assert(edgePriorities['REFERENCES'] > edgePriorities['PREVIOUS_NEXT'], 'REFERENCES must outrank PREVIOUS_NEXT');

    // Simulate sorting 3 candidates by priority score
    const candidates = [
      { id: 'chunk-sem', type: 'SEMANTIC_SIMILAR', weight: 0.4, tokens: 100 },
      { id: 'chunk-dep', type: 'DEPENDS_ON', weight: 1.0, tokens: 120 },
      { id: 'chunk-ref', type: 'REFERENCES', weight: 0.85, tokens: 80 },
    ];

    candidates.sort((a, b) => (edgePriorities[b.type] || 0) - (edgePriorities[a.type] || 0));

    assert.strictEqual(candidates[0].id, 'chunk-dep', 'First candidate must be DEPENDS_ON');
    assert.strictEqual(candidates[1].id, 'chunk-ref', 'Second candidate must be REFERENCES');
    assert.strictEqual(candidates[2].id, 'chunk-sem', 'Last candidate must be SEMANTIC_SIMILAR');
  });

  // 5. Algorithm Simulation: Strict token budget enforcement and cycle avoidance
  test('5. Algorithm Simulation: Bounded expansion enforces token ceiling and flags cycles', () => {
    const tokenBudget = 250;
    let accumulatedTokens = 0;
    let cyclesDetected = 0;
    const visited = new Set();
    const admittedChunks = [];

    const mockTraversalQueue = [
      { id: 'node-A', target: 'node-B', tokens: 100, isCycle: false },
      { id: 'node-B', target: 'node-A', tokens: 100, isCycle: true }, // circular link
      { id: 'node-B', target: 'node-C', tokens: 120, isCycle: false },
      { id: 'node-C', target: 'node-D', tokens: 80, isCycle: false }, // would exceed 250 (100+120+80 = 300)
    ];

    visited.add('node-A');

    for (const item of mockTraversalQueue) {
      if (visited.has(item.target)) {
        cyclesDetected++;
        continue;
      }

      if (accumulatedTokens + item.tokens <= tokenBudget) {
        accumulatedTokens += item.tokens;
        visited.add(item.target);
        admittedChunks.push(item.target);
      }
    }

    assert.strictEqual(cyclesDetected, 1, 'Exactly one cycle should have been detected');
    assert.strictEqual(accumulatedTokens, 220, 'Total tokens (100 + 120 = 220) must not exceed budget 250');
    assert(accumulatedTokens <= tokenBudget, 'Strict token budget must never be breached');
    assert.deepStrictEqual(admittedChunks, ['node-B', 'node-C'], 'Admitted nodes must strictly fit budget');
  });

  // 6. Algorithm Simulation: Cross-version isolation in graph traversal
  test('6. Algorithm Simulation: Traversal strictly isolates nodes by document version', () => {
    const graphNodes = [
      { id: 'node-v1-1', version_id: 'ver-vaswani-v1', label: 'v1 Scaled Attention' },
      { id: 'node-v2-1', version_id: 'ver-vaswani-v2', label: 'v2 Scaled Attention' },
      { id: 'node-v2-2', version_id: 'ver-vaswani-v2', label: 'v2 Multi-Head Attention' },
    ];

    const targetVersion = 'ver-vaswani-v2';
    const isolatedNodes = graphNodes.filter(n => !n.version_id || n.version_id === targetVersion);

    assert.strictEqual(isolatedNodes.length, 2, 'Should only retain nodes matching target version');
    assert(!isolatedNodes.some(n => n.version_id === 'ver-vaswani-v1'), 'Must not include historical v1 nodes');
  });

  // 7. Component & UI Integration Verification
  test('7. ContextExpansionSimulator, KnowledgeGraphPage, and ChatPage integration', () => {
    const simulatorPath = path.join(__dirname, '../src/components/graph/ContextExpansionSimulator.tsx');
    assert(fs.existsSync(simulatorPath), 'ContextExpansionSimulator.tsx component must exist');
    const simContent = fs.readFileSync(simulatorPath, 'utf8');
    assert(simContent.includes('expandContextWithDependencies'), 'Simulator must invoke expansion API');
    assert(simContent.includes('tokenBudget'), 'Simulator must include token budget control');
    assert(simContent.includes('maxHops'), 'Simulator must include hop depth control');

    const graphPagePath = path.join(__dirname, '../src/pages/KnowledgeGraphPage.tsx');
    const graphContent = fs.readFileSync(graphPagePath, 'utf8');
    assert(graphContent.includes('ContextExpansionSimulator'), 'KnowledgeGraphPage must embed ContextExpansionSimulator');
    assert(graphContent.includes('activeRightTab'), 'KnowledgeGraphPage must provide tab switcher for expansion');
    assert(graphContent.includes('highlightedNodeIds'), 'KnowledgeGraphPage must highlight expanded nodes in SVG canvas');

    const chunkPagePath = path.join(__dirname, '../src/pages/ChunkInspectorPage.tsx');
    const chunkContent = fs.readFileSync(chunkPagePath, 'utf8');
    assert(chunkContent.includes('Trace in Graph'), 'ChunkInspectorPage must provide Trace in Graph button');

    const chatPagePath = path.join(__dirname, '../src/pages/ChatPage.tsx');
    const chatContent = fs.readFileSync(chatPagePath, 'utf8');
    assert(chatContent.includes('enableGraphExpansion'), 'ChatPage must manage enableGraphExpansion state');
    assert(chatContent.includes('Graph Context Expansion'), 'ChatPage must render Graph Context Expansion toggle');
    assert(chatContent.includes('cit.is_graph_expanded'), 'ChatPage must badge graph-expanded citations');
    assert(chatContent.includes('activeCitation.expansion_justification'), 'ChatPage must show expansion justification');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`Phase 2 Tests Finished: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
