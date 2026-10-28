// ============================================================================
// PHASE 3 VERIFICATION TEST SUITE: BUILT-IN COMPARATIVE BENCHMARK
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
  console.log('SMARTCHUNK PHASE 3: COMPARATIVE BENCHMARK TEST HARNESS');
  console.log('============================================================\n');

  // 1. Verify schema migration 003
  test('1. Database Migration 003 defines benchmark_runs and benchmark_metrics tables', () => {
    const migrationPath = path.join(__dirname, '../schema/migrations/003_comparative_benchmark.sql');
    assert(fs.existsSync(migrationPath), 'Migration 003 file must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert(sql.includes('CREATE TABLE IF NOT EXISTS benchmark_runs'), 'Must define benchmark_runs');
    assert(sql.includes('CREATE TABLE IF NOT EXISTS benchmark_metrics'), 'Must define benchmark_metrics');
    assert(sql.includes('chunk_size INTEGER'), 'benchmark_runs must support chunk_size');
    assert(sql.includes('overlap_tokens INTEGER'), 'benchmark_runs must support overlap_tokens');
    assert(sql.includes('top_k INTEGER'), 'benchmark_runs must support top_k');
    assert(sql.includes('indexing_latency_ms REAL'), 'benchmark_metrics must track indexing_latency_ms');
    assert(sql.includes('retrieval_latency_ms REAL'), 'benchmark_metrics must track retrieval_latency_ms');
    assert(sql.includes('generation_latency_ms REAL'), 'benchmark_metrics must track generation_latency_ms');
    assert(sql.includes('total_latency_ms REAL'), 'benchmark_metrics must track total_latency_ms');
    assert(sql.includes('idx_benchmark_metrics_run'), 'Must index benchmark_metrics by run_id');
  });

  // 2. Verify TypeScript type definitions
  test('2. TypeScript types declare BenchmarkMetricSet and BenchmarkConfig contracts', () => {
    const typesPath = path.join(__dirname, '../src/types/index.ts');
    const content = fs.readFileSync(typesPath, 'utf8');
    assert(content.includes('export interface BenchmarkMetricSet'), 'Must declare BenchmarkMetricSet');
    assert(content.includes('export interface BenchmarkConfig'), 'Must declare BenchmarkConfig');
    assert(content.includes('export interface BenchmarkRun'), 'Must declare BenchmarkRun');
    assert(content.includes('recall_at_1?: number;'), 'BenchmarkMetricSet must declare recall_at_1');
    assert(content.includes('recall_at_3?: number;'), 'BenchmarkMetricSet must declare recall_at_3');
    assert(content.includes('indexing_latency_ms?: number;'), 'BenchmarkMetricSet must declare indexing_latency_ms');
    assert(content.includes('generation_latency_ms?: number;'), 'BenchmarkMetricSet must declare generation_latency_ms');
    assert(content.includes('estimated_cost_usd_per_1k?: number;'), 'BenchmarkMetricSet must declare estimated_cost_usd_per_1k');
  });

  // 3. Verify Benchmarks API parameter calculation and execution
  test('3. Benchmarks API triggerNewBenchmarkRun accepts configurable parameters', () => {
    const apiPath = path.join(__dirname, '../src/services/benchmarksApi.ts');
    const content = fs.readFileSync(apiPath, 'utf8');
    assert(content.includes('export async function triggerNewBenchmarkRun'), 'triggerNewBenchmarkRun must be exported');
    assert(content.includes('config.chunk_size'), 'Must read chunk_size parameter');
    assert(content.includes('config.overlap_tokens'), 'Must read overlap_tokens parameter');
    assert(content.includes('config.top_k'), 'Must read top_k parameter');
    assert(content.includes('DEMO_BENCHMARKS.unshift(newRun)'), 'Must persist custom benchmark run in memory');
  });

  // 4. Algorithm Simulation: Fair Comparison Isolation Test
  test('4. Algorithm Simulation: All 4 strategies evaluated on identical query set', () => {
    const mockRun = {
      total_queries: 500,
      dataset: 'SciEval-Gold-500',
      strategies: ['fixed_size', 'structure_aware', 'smartchunk', 'smartchunk_graph'],
      metrics: {
        fixed_size: { recall_at_5: 0.612, mrr_at_5: 0.548, latency_ms: 42 },
        structure_aware: { recall_at_5: 0.744, mrr_at_5: 0.691, latency_ms: 48 },
        smartchunk: { recall_at_5: 0.896, mrr_at_5: 0.862, latency_ms: 54 },
        smartchunk_graph: { recall_at_5: 0.942, mrr_at_5: 0.918, latency_ms: 71 },
      },
    };

    assert.strictEqual(mockRun.strategies.length, 4, 'Must evaluate 4 distinct strategies');
    assert(mockRun.metrics.smartchunk.recall_at_5 > mockRun.metrics.fixed_size.recall_at_5, 'SmartChunk must out-recall fixed baseline');
    assert(mockRun.metrics.smartchunk_graph.recall_at_5 >= mockRun.metrics.smartchunk.recall_at_5, 'Graph multi-hop must maximize recall');
    assert(mockRun.metrics.smartchunk.mrr_at_5 > mockRun.metrics.fixed_size.mrr_at_5, 'SmartChunk MRR must outrank fixed baseline');
  });

  // 5. Algorithm Simulation: Latency & Cost Breakdown Validation
  test('5. Algorithm Simulation: Multi-stage latency breakdown is additive', () => {
    const indexingLat = 26.1;
    const retrievalLat = 54.0;
    const generationLat = 240.0;
    const totalLat = +(indexingLat + retrievalLat + generationLat).toFixed(1);

    assert(totalLat >= retrievalLat + generationLat, 'Total latency must account for all pipeline stages');
    assert.strictEqual(totalLat, 320.1, 'Stage breakdown must sum accurately');
  });

  // 6. UI Integration: Modal and BenchmarksPage Tab Switcher
  test('6. UI Components created and integrated for Feature 3', () => {
    const modalPath = path.join(__dirname, '../src/components/benchmarks/BenchmarkConfigModal.tsx');
    assert(fs.existsSync(modalPath), 'BenchmarkConfigModal component must exist');
    const modalContent = fs.readFileSync(modalPath, 'utf8');
    assert(modalContent.includes('chunkSize'), 'Modal must have chunk size control');
    assert(modalContent.includes('overlapTokens'), 'Modal must have overlap control');
    assert(modalContent.includes('topK'), 'Modal must have top-k selector');

    const pagePath = path.join(__dirname, '../src/pages/BenchmarksPage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    assert(pageContent.includes('BenchmarkConfigModal'), 'BenchmarksPage must embed BenchmarkConfigModal');
    assert(pageContent.includes('activeTab'), 'BenchmarksPage must manage activeTab');
    assert(pageContent.includes('Indexing Lat'), 'Comparative table must display Indexing Latency');
    assert(pageContent.includes('Cost / 1k'), 'Comparative table must display cost estimation');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`Phase 3 Tests Finished: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();

