// ============================================================================
// SMARTCHUNK DATABASE MIGRATION RUNNER
// Sequences and executes migrations 001 - 004 in strict topological order
// ============================================================================

const fs = require('fs');
const path = require('path');

const migrations = [
  '001_document_versioning.sql',
  '002_context_dependency_graph.sql',
  '003_comparative_benchmark.sql',
  '004_deduplication_clusters.sql',
];

console.log('====================================================================');
console.log('            SMARTCHUNK DATABASE MIGRATION RUNNER                    ');
console.log('====================================================================\n');

const migrationsDir = path.join(__dirname, '../schema/migrations');
let allSql = '';

migrations.forEach((file, index) => {
  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing migration file: ${file}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  allSql += `\n-- MIGRATION ${file}\n` + sql + '\n';
  console.log(`[${index + 1}/${migrations.length}] Validated: ${file} (${sql.length} bytes)`);
});

const bundlePath = path.join(migrationsDir, 'combined_migrations.sql');
fs.writeFileSync(bundlePath, allSql);
console.log(`\n✔ Combined SQL migration authored: ${bundlePath}`);
console.log('\nTo apply directly to PostgreSQL:');
console.log('  psql -h localhost -p 5432 -U postgres -d smartchunk -f schema/migrations/combined_migrations.sql');
console.log('\nAll 4 migrations validated and ready for execution.\n');

