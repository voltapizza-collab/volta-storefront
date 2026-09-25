// Read-only audit of the expansion frozen at batch 36. No temporary workspace files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const run = (script, ...args) => execFileSync(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
const master = read('src/data/ingredientMasterSource.json');
const taxonomy = read('src/data/ingredientTaxonomy.json');
const coverage = read('docs/ingredient-master-coverage-batch-36.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(master.length, 3728, 'The closed expansion must retain 3,728 identities');
assert.equal(taxonomy.categories.length, 14);
const validation = run('validate-ingredient-master.cjs').trim();
const files = fs.readdirSync(path.join(root, 'docs')).filter(file => /^ingredient-master-expansion-batch-\d+\.json$/.test(file)).sort();
assert.equal(files.length, 36);
let additions = 0, aliases = 0;
for (let n = 1; n <= 36; n++) {
  const number = String(n).padStart(2, '0');
  const batch = read(`docs/ingredient-master-expansion-batch-${number}.json`);
  // The importer checks the historical baseline hash and exact applied rows even in dry-run mode.
  const result = JSON.parse(run('expand-ingredient-master.cjs', `--batch=${number}`));
  assert.equal(result.alreadyApplied, true, `Batch ${number} is not applied`);
  assert.equal(result.currentTotal, master.length);
  additions += batch.records.length;
  aliases += batch.records.reduce((sum, row) => sum + row.aliases.length - 1, 0);
}
assert.equal(additions, 2624);
assert.equal(aliases, 626);
const keys = new Set(master.map(row => row.canonicalKey));
for (const row of master.filter(row => row.source === 'RESEARCH_EXPANSION')) {
  assert.equal(row.semanticStatus, 'NEEDS_REVIEW', row.canonicalKey);
  assert.equal(row.imageStatus, 'MISSING', row.canonicalKey);
  assert.deepEqual(Object.keys(row.translations), ['es'], row.canonicalKey);
}
assert.equal(coverage.checks.length, 248);
assert.equal(coverage.located, 248);
assert.equal(coverage.catalogueTotal, master.length);
for (const check of coverage.checks) {
  assert.equal(check.status, 'LOCALIZADO', check.term);
  assert(check.records.length > 0 && check.records.every(row => keys.has(row.canonicalKey)), check.term);
}
for (const category of coverage.summary) {
  assert.equal(category.catalogueCount, Object.values(taxonomy.assignments).filter(row => row.categoryKey === category.key).length, category.key);
}
assert.equal(coverage.summary.reduce((sum, row) => sum + row.catalogueCount, 0), master.length);
const backend = path.resolve(root, '../volta-backend/data');
const backendAvailable = fs.existsSync(backend);
if (backendAvailable) {
  const projection = master.map(({ canonicalKey, defaultName, category, aliases, legacyCanonicalKeys }) => ({ canonicalKey, defaultName, category, aliases, ...(legacyCanonicalKeys ? { legacyCanonicalKeys } : {}) }));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(backend, 'ingredientMasterCatalogue.json'), 'utf8')), projection);
}
console.log(JSON.stringify({ total: master.length, additions, alternativeAliases: aliases, batchesVerified: 36, historicalBaselinesVerified: 36, categories: 14, basicNeedsWithExistingRecords: 248, sourceSha256: sha256(JSON.stringify(master)), backendMirrors: backendAvailable ? 'verified' : 'not available; skipped', validation, databaseWrites: 0, scope: 'Structural and provenance integrity; not editorial, allergen, visual or database approval.' }, null, 2));
