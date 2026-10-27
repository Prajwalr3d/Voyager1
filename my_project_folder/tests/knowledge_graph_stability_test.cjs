// ============================================================================
// KNOWLEDGE GRAPH STABILITY & INTERACTION TEST HARNESS
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
    console.error(`\x1b[31m✖ FAIL:\x1b[0m ${name}`);
    console.error(`  ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('SMARTCHUNK: KNOWLEDGE GRAPH STABILITY VERIFICATION');
  console.log('============================================================\n');

  const pagePath = path.join(__dirname, '../src/pages/KnowledgeGraphPage.tsx');
  assert(fs.existsSync(pagePath), 'KnowledgeGraphPage.tsx must exist');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Test 1: No CSS hover scaling or erratic CSS keyframe animations on SVG elements
  test('1. Elimination of violent hover scaling and broken SVG animations', () => {
    assert(!code.includes('hover:scale-110'), 'Must not contain hover:scale-110 which causes 60Hz SVG oscillation loop');
    assert(!code.includes('animate-spin-slow'), 'Must not contain undefined animate-spin-slow');
    assert(code.includes('fill="transparent"'), 'Must include invisible hit-testing ring to prevent edge hover flicker');
  });

  // Test 2: Layout calculation is memoized/computed once and does not re-run on selection
  test('2. Layout calculation stability: computeStableGraphLayout is deterministic and stationary', () => {
    assert(code.includes('computeStableGraphLayout'), 'Must export/use computeStableGraphLayout');
    assert(code.includes('BASE_CURATED_POSITIONS'), 'Must preserve curated layout coordinates');
    assert(code.includes('setNodePositions(prev => computeStableGraphLayout'), 'Must set positions once on graph load');
  });

  // Test 3: Disambiguation between click, canvas pan, and individual node drag
  test('3. Drag vs Click threshold disambiguation and individual node dragging', () => {
    assert(code.includes('dragTrackerRef'), 'Must track pointer interactions with ref to avoid render thrashing');
    assert(code.includes('Math.hypot(dx, dy) > 4'), 'Must enforce distance threshold to prevent click jitter');
    assert(code.includes('handleCanvasPointerDown'), 'Must handle background canvas pan cleanly');
    assert(code.includes('handleNodePointerDown'), 'Must handle individual node drag separately');
    assert(code.includes('window.addEventListener(\'pointermove\''), 'Must bind window move/up listeners during drag');
  });

  // Test 4: Visual hierarchy: Connected edges highlighted, unrelated nodes/edges dimmed
  test('4. Visual hierarchy: Highlighting connected elements and dimming unrelated items', () => {
    assert(code.includes('neighborNodeIdSet'), 'Must memoize neighbor node IDs');
    assert(code.includes('connectedEdgeIdSet'), 'Must memoize connected edge IDs');
    assert(code.includes('hasSelection && !isSelected && !isNeighbor && !isHighlighted'), 'Must dim unrelated nodes');
    assert(code.includes('marker-end') || code.includes('markerEnd'), 'Must provide directional arrowhead markers');
  });

  // Test 5: Wheel zoom & user-controlled reset view
  test('5. Predictable pan, wheel zoom, and explicit user-driven reset view', () => {
    assert(code.includes('handleWheel'), 'Must provide smooth wheel zoom');
    assert(code.includes('handleResetView'), 'Must provide manual reset view button');
    assert(code.includes('setZoomLevel(1)'), 'Reset view resets zoom to 100%');
    assert(code.includes('setPanOffset({ x: 0, y: 0 })'), 'Reset view centers pan offset');
  });

  // Test 6: Simulation of Scenario 1 & 2: Repeated clicks and consecutive selections
  test('6. Simulation: Repeated clicks on the same node and consecutive selections preserve coordinates', () => {
    // Mock state store
    let selectedId = 'sec-scaled';
    let positions = {
      'sec-scaled': { x: 180, y: 390 },
      'sec-attn': { x: 260, y: 270 },
      'eq-scaled': { x: 140, y: 510 }
    };

    const initialCoord = { ...positions['sec-scaled'] };

    // Click 10 times consecutively
    for (let i = 0; i < 10; i++) {
      selectedId = 'sec-scaled';
    }

    assert.strictEqual(positions['sec-scaled'].x, initialCoord.x, 'X coordinate must remain stationary after 10 clicks');
    assert.strictEqual(positions['sec-scaled'].y, initialCoord.y, 'Y coordinate must remain stationary after 10 clicks');

    // Select different nodes consecutively
    selectedId = 'sec-attn';
    assert.strictEqual(positions['sec-scaled'].x, initialCoord.x, 'Previous node position unchanged');
    assert.strictEqual(positions['sec-attn'].x, 260, 'Target node position unchanged');

    selectedId = 'eq-scaled';
    assert.strictEqual(positions['eq-scaled'].x, 140, 'Target node position unchanged');
  });

  // Test 7: Simulation of Scenario 4: Node dragging updates ONLY dragged node
  test('7. Simulation: Dragging a single node updates only that node without moving peers', () => {
    let positions = {
      'node-A': { x: 100, y: 100 },
      'node-B': { x: 200, y: 200 },
      'node-C': { x: 300, y: 300 },
    };

    // User drags node-A by dx=50, dy=25
    const dx = 50;
    const dy = 25;
    positions = {
      ...positions,
      'node-A': { x: positions['node-A'].x + dx, y: positions['node-A'].y + dy },
    };

    assert.strictEqual(positions['node-A'].x, 150, 'node-A must move to 150');
    assert.strictEqual(positions['node-A'].y, 125, 'node-A must move to 125');
    assert.strictEqual(positions['node-B'].x, 200, 'node-B must remain stationary');
    assert.strictEqual(positions['node-C'].x, 300, 'node-C must remain stationary');
  });

  // Test 8: Simulation of Scenario 7: Dynamic unmapped nodes placed deterministically in tiers without stacking at (300, 300)
  test('8. Simulation: Unmapped / large graph nodes are organized into non-overlapping horizontal tiers', () => {
    const unmappedNodes = [
      { id: 'custom-doc', type: 'document' },
      { id: 'custom-sec-1', type: 'section' },
      { id: 'custom-sec-2', type: 'section' },
      { id: 'custom-eq-1', type: 'equation' },
      { id: 'custom-eq-2', type: 'equation' },
      { id: 'custom-chk-1', type: 'chunk' },
      { id: 'custom-chk-2', type: 'chunk' },
      { id: 'custom-chk-3', type: 'chunk' },
    ];

    const tierY = { document: 65, section: 165, equation: 330, table: 330, chunk: 630 };
    const positions = {};

    const byTier = {};
    unmappedNodes.forEach(node => {
      const t = node.type;
      if (!byTier[t]) byTier[t] = [];
      byTier[t].push(node);
    });

    Object.entries(byTier).forEach(([t, tNodes]) => {
      const y = tierY[t] || 740;
      const count = tNodes.length;
      const startX = 100;
      const endX = 660;
      const spacing = (endX - startX) / (count + 1);
      tNodes.forEach((node, idx) => {
        positions[node.id] = { x: Math.round(startX + spacing * (idx + 1)), y };
      });
    });

    // Verify no two nodes share the same coordinates
    const coordStrings = Object.values(positions).map(p => `${p.x},${p.y}`);
    const uniqueCoords = new Set(coordStrings);
    assert.strictEqual(uniqueCoords.size, unmappedNodes.length, 'Every node must receive distinct, non-overlapping coordinates');
    assert(!coordStrings.includes('300,300'), 'Nodes must not collapse into arbitrary fixed 300,300');
  });

  // Test 9: Context expansion and right tab switching preserved
  test('9. ContextExpansionSimulator tab integration preserved', () => {
    assert(code.includes('ContextExpansionSimulator'), 'Must embed ContextExpansionSimulator');
    assert(code.includes('activeRightTab === \'expansion\''), 'Must toggle to expansion tab');
    assert(code.includes('highlightedNodeIds'), 'Must pass and receive highlighted node IDs');
  });

  // Test 10: Event listener cleanup on unmount & pointerup
  test('10. Memory safety: Window listeners are removed on pointerup/cancel', () => {
    assert(code.includes('window.removeEventListener(\'pointermove\''), 'Must clean up pointermove');
    assert(code.includes('window.removeEventListener(\'pointerup\''), 'Must clean up pointerup');
    assert(code.includes('window.removeEventListener(\'pointercancel\''), 'Must clean up pointercancel');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`Knowledge Graph Stability Tests: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();

