// ============================================================================
// PHASE 1 VERIFICATION TEST SUITE: DOCUMENT VERSIONING & EVIDENCE PROVENANCE
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
  console.log('SMARTCHUNK PHASE 1: VERSION-AWARE EVIDENCE TEST HARNESS');
  console.log('============================================================\n');

  // 1. Verify schema migration file
  test('1. Database Migration 001 exists and specifies constraints', () => {
    const migrationPath = path.join(__dirname, '../schema/migrations/001_document_versioning.sql');
    assert(fs.existsSync(migrationPath), 'Migration 001 file must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert(sql.includes('CREATE TABLE IF NOT EXISTS document_versions'), 'Must contain document_versions table');
    assert(sql.includes('content_hash VARCHAR(64) NOT NULL'), 'Must require SHA-256 content_hash');
    assert(sql.includes('version_id VARCHAR(64) NOT NULL REFERENCES document_versions'), 'Chunks must foreign-key to document_versions');
    assert(sql.includes('idx_doc_single_active_version'), 'Must enforce single active version index');
    assert(sql.includes('idx_chunks_doc_version_lookup'), 'Must index chunks by document_id and version_id');
  });

  // 2. Verify TypeScript type contracts
  test('2. TypeScript types export DocumentVersion and provenance models', () => {
    const typesPath = path.join(__dirname, '../src/types/index.ts');
    const content = fs.readFileSync(typesPath, 'utf8');
    assert(content.includes('export interface DocumentVersion'), 'Must define DocumentVersion');
    assert(content.includes('export interface ChunkVersionDiff'), 'Must define ChunkVersionDiff');
    assert(content.includes('export interface DocumentVersionComparison'), 'Must define DocumentVersionComparison');
    assert(content.includes('active_version_id?: string;'), 'Document must have active_version_id');
    assert(content.includes('document_version_id?: string;'), 'Citation must have document_version_id');
  });

  // 3. Verify API services have versioning functions
  test('3. Document API service implements versioning endpoints', () => {
    const apiPath = path.join(__dirname, '../src/services/documentsApi.ts');
    const content = fs.readFileSync(apiPath, 'utf8');
    assert(content.includes('export async function fetchDocumentVersions'), 'fetchDocumentVersions must be exported');
    assert(content.includes('export async function fetchDocumentVersionById'), 'fetchDocumentVersionById must be exported');
    assert(content.includes('export async function createDocumentVersion'), 'createDocumentVersion must be exported');
    assert(content.includes('export async function rollbackDocumentVersion'), 'rollbackDocumentVersion must be exported');
    assert(content.includes('export async function compareDocumentVersions'), 'compareDocumentVersions must be exported');
  });

  // 4. Verify Chunks API supports version isolation
  test('4. Chunks API supports strict version-based retrieval filtering', () => {
    const chunksApiPath = path.join(__dirname, '../src/services/chunksApi.ts');
    const content = fs.readFileSync(chunksApiPath, 'utf8');
    assert(content.includes('versionId?: string'), 'fetchChunks must accept versionId parameter');
    assert(content.includes('c.version_id === params.versionId'), 'fetchChunks must filter by version_id strictly');
  });

  // 5. Verify Chat API supports version isolation policies
  test('5. Chat API implements versionPolicy (active_only vs historical_pinned vs all_versions)', () => {
    const chatApiPath = path.join(__dirname, '../src/services/chatApi.ts');
    const content = fs.readFileSync(chatApiPath, 'utf8');
    assert(content.includes("versionPolicy?: 'active_only' | 'historical_pinned' | 'all_versions'"), 'sendChatMessage must accept versionPolicy');
    assert(content.includes('target_version_policy: versionPolicy'), 'ChatMessage must report target_version_policy used');
    assert(content.includes('document_version_id:'), 'Citation must attach document_version_id');
  });

  // 6. Verify UI components for Phase 1
  test('6. UI Components created and integrated for version management', () => {
    const modalPath = path.join(__dirname, '../src/components/documents/VersionComparisonModal.tsx');
    const drawerPath = path.join(__dirname, '../src/components/documents/VersionHistoryDrawer.tsx');
    assert(fs.existsSync(modalPath), 'VersionComparisonModal must exist');
    assert(fs.existsSync(drawerPath), 'VersionHistoryDrawer must exist');

    const docsPagePath = path.join(__dirname, '../src/pages/DocumentsPage.tsx');
    const docsContent = fs.readFileSync(docsPagePath, 'utf8');
    assert(docsContent.includes('VersionHistoryDrawer'), 'DocumentsPage must embed VersionHistoryDrawer');
    assert(docsContent.includes('VersionComparisonModal'), 'DocumentsPage must embed VersionComparisonModal');

    const inspectorPath = path.join(__dirname, '../src/pages/ChunkInspectorPage.tsx');
    const inspContent = fs.readFileSync(inspectorPath, 'utf8');
    assert(inspContent.includes('fetchDocumentVersions'), 'ChunkInspectorPage must load document versions');
    assert(inspContent.includes('Version Provenance'), 'ChunkInspectorPage must show Version Provenance block');

    const chatPath = path.join(__dirname, '../src/pages/ChatPage.tsx');
    const chatContent = fs.readFileSync(chatPath, 'utf8');
    assert(chatContent.includes('Version Policy:'), 'ChatPage must display Version Policy selector');
    assert(chatContent.includes('cit.version_tag'), 'ChatPage must display citation version tag badge');
  });

  // 7. Verify Content Hash and Cryptographic Provenance Integrity
  test('7. Document version fixtures contain valid 64-char SHA-256 digests', () => {
    const demoDataPath = path.join(__dirname, '../src/demo/demoData.ts');
    const demoContent = fs.readFileSync(demoDataPath, 'utf8');
    const hashMatches = demoContent.match(/content_hash:\s*['"]([0-9a-f]{64})['"]/g);
    assert(hashMatches && hashMatches.length >= 4, 'Must have multiple valid 64-character hex content hashes');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
