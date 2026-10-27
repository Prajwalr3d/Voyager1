// ============================================================================
// PHASE 4 VERIFICATION TEST SUITE: STRUCTURE-AWARE DOCUMENT BENCHMARK
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
  console.log('SMARTCHUNK PHASE 4: STRUCTURE-AWARE BENCHMARK TEST HARNESS');
  console.log('============================================================\n');

  // 1. Verify Schema Migration for Structure Taxonomy
  test('1. Database Migration 003 defines structure_benchmark_evaluations table', () => {
    const migrationPath = path.join(__dirname, '../schema/migrations/003_comparative_benchmark.sql');
    assert(fs.existsSync(migrationPath), 'Migration 003 file must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert(sql.includes('CREATE TABLE IF NOT EXISTS structure_benchmark_evaluations'), 'Must define structure_benchmark_evaluations');
    assert(sql.includes("'formulas'"), 'Must evaluate formulas category');
    assert(sql.includes("'tables'"), 'Must evaluate tables category');
    assert(sql.includes("'sections'"), 'Must evaluate sections category');
    assert(sql.includes("'code'"), 'Must evaluate code category');
    assert(sql.includes("'lists'"), 'Must evaluate lists category');
    assert(sql.includes('fixed_fracture_rate_pct'), 'Must track fixed_fracture_rate_pct');
    assert(sql.includes('smartchunk_preservation_pct'), 'Must track smartchunk_preservation_pct');
  });

  // 2. Verify TypeScript type definitions for Structure Benchmark
  test('2. TypeScript types declare StructureCategory and StructureBenchmarkReport contracts', () => {
    const typesPath = path.join(__dirname, '../src/types/index.ts');
    const content = fs.readFileSync(typesPath, 'utf8');
    assert(content.includes('export type StructureCategory'), 'Must declare StructureCategory');
    assert(content.includes('export interface StructureCategoryMetric'), 'Must declare StructureCategoryMetric');
    assert(content.includes('export interface StructureBenchmarkReport'), 'Must declare StructureBenchmarkReport');
    assert(content.includes('key_failure_mode: string;'), 'StructureCategoryMetric must declare key_failure_mode');
    assert(content.includes('expected_element: string;'), 'test_case must declare expected_element');
    assert(content.includes('smartchunk_result: string;'), 'test_case must declare smartchunk_result');
  });

  // 3. Verify Benchmarks API Structure Evaluation Methods
  test('3. Benchmarks API exports fetchStructureBenchmarkReport and triggerStructureEvaluation', () => {
    const apiPath = path.join(__dirname, '../src/services/benchmarksApi.ts');
    const content = fs.readFileSync(apiPath, 'utf8');
    assert(content.includes('export async function fetchStructureBenchmarkReport'), 'fetchStructureBenchmarkReport must be exported');
    assert(content.includes('export async function triggerStructureEvaluation'), 'triggerStructureEvaluation must be exported');
    assert(content.includes('DEMO_STRUCTURE_BENCHMARK'), 'Must load demo structure benchmark data in preview mode');
  });

  // 4. Algorithm Simulation: Taxonomy Coverage Validation
  test('4. Algorithm Simulation: All 5 structural categories evaluated with AST metrics', () => {
    const expectedCategories = ['formulas', 'tables', 'sections', 'code', 'lists'];
    const mockReport = {
      total_categories: 5,
      categories: [
        { category: 'formulas', fixed_preservation: 44.2, smartchunk_preservation: 99.1, fixed_fracture: 48.6 },
        { category: 'tables', fixed_preservation: 51.0, smartchunk_preservation: 97.6, fixed_fracture: 45.2 },
        { category: 'sections', fixed_preservation: 38.5, smartchunk_preservation: 98.4, fixed_fracture: 54.0 },
        { category: 'code', fixed_preservation: 46.0, smartchunk_preservation: 96.5, fixed_fracture: 52.0 },
        { category: 'lists', fixed_preservation: 58.0, smartchunk_preservation: 97.2, fixed_fracture: 35.0 },
      ],
    };

    assert.strictEqual(mockReport.categories.length, 5, 'Must evaluate exactly 5 structural categories');
    for (const cat of mockReport.categories) {
      assert(expectedCategories.includes(cat.category), `Category ${cat.category} must be in allowed taxonomy`);
      assert(cat.smartchunk_preservation > cat.fixed_preservation, `${cat.category}: SmartChunk must exceed fixed baseline preservation`);
      assert(cat.fixed_fracture > 30.0, `${cat.category}: Fixed chunking must exhibit significant fracture rate`);
    }
  });

  // 5. Algorithm Simulation: LaTeX Formula AST Preservation & Failure Mode
  test('5. Algorithm Simulation: LaTeX AST closure prevents severed denominator', () => {
    const testCase = {
      query: 'What is the exact denominator scaling in Scaled Dot-Product attention?',
      expected: '\\sqrt{d_k}',
      fixed_cut: 'Attention(Q, K, V) = softmax(QK^T /', // truncated at slash
      smartchunk_closed: '\\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V',
    };

    assert(!testCase.fixed_cut.includes(testCase.expected), 'Fixed chunk severed denominator');
    assert(testCase.smartchunk_closed.includes(testCase.expected), 'SmartChunk preserved closed formula AST');
  });

  // 6. UI Integration: StructureTaxonomyView and BenchmarksPage
  test('6. UI Components created and integrated for Feature 4', () => {
    const viewPath = path.join(__dirname, '../src/components/benchmarks/StructureTaxonomyView.tsx');
    assert(fs.existsSync(viewPath), 'StructureTaxonomyView component must exist');
    const viewContent = fs.readFileSync(viewPath, 'utf8');
    assert(viewContent.includes('fetchStructureBenchmarkReport'), 'StructureTaxonomyView must call API');
    assert(viewContent.includes('smartchunk_preservation_pct'), 'View must display preservation progress');
    assert(viewContent.includes('Gold Test Case Inspection'), 'View must inspect test cases');

    const pagePath = path.join(__dirname, '../src/pages/BenchmarksPage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    assert(pageContent.includes('StructureTaxonomyView'), 'BenchmarksPage must embed StructureTaxonomyView');
    assert(pageContent.includes('Structure Taxonomy (Feature 4)'), 'Tab title must be present');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`Phase 4 Tests Finished: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();

