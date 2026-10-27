// ============================================================================
// MASTER VERIFICATION RUNNER: ALL 5 SMARTCHUNK FEATURES
// ============================================================================

const { execSync } = require('child_process');
const path = require('path');

const testSuites = [
  { name: 'Feature 1: Version-Aware Evidence & Provenance', file: 'versioning_test.cjs' },
  { name: 'Feature 2: Context Dependency Graph & Multi-Hop Traversal', file: 'graph_dependency_test.cjs' },
  { name: 'Feature 3: Built-In Comparative Benchmark', file: 'benchmarks_test.cjs' },
  { name: 'Feature 4: Structure-Aware Document Benchmark', file: 'structure_benchmark_test.cjs' },
  { name: 'Feature 5: Deduplication & Before/After Evaluation', file: 'deduplication_test.cjs' },
];

console.log('==============================================================================');
console.log('       SMARTCHUNK PLATFORM MASTER TEST RUNNER — ALL 5 ADVANCED FEATURES       ');
console.log('==============================================================================\n');

let totalSuitesPassed = 0;
let totalSuitesFailed = 0;

for (const suite of testSuites) {
  const filePath = path.join(__dirname, suite.file);
  console.log(`\n>>> Executing Test Suite: ${suite.name} (${suite.file})`);
  try {
    const output = execSync(`node "${filePath}"`, { stdio: 'inherit' });
    totalSuitesPassed++;
  } catch (err) {
    console.error(`\x1b[31mFAIL in suite: ${suite.name}\x1b[0m`);
    totalSuitesFailed++;
  }
}

console.log('\n==============================================================================');
console.log(`MASTER TEST SUMMARY: ${totalSuitesPassed} Suites Passed, ${totalSuitesFailed} Suites Failed`);
console.log('==============================================================================\n');

if (totalSuitesFailed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✔ ALL 5 ADVANCED SMARTCHUNK FEATURES VERIFIED SUCCESSFULLY (PASS)\x1b[0m\n');
}

