// Apply one explicitly curated batch. External datasets are never bulk-imported here.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const batchNumber = (process.argv.find(arg => arg.startsWith('--batch=')) || '--batch=01').slice(8);
assert.match(batchNumber, /^\d{2,}$/, 'Use --batch=02 to select an explicitly curated batch');
const batchPath = `docs/ingredient-master-expansion-batch-${batchNumber}.json`;
const batch = read(batchPath);
const auditPath = path.join(root, batchNumber === '01' ? 'docs/ingredient-master-expansion-audit.json' : `docs/ingredient-master-expansion-audit-batch-${batchNumber}.json`);
const priorAudit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const masterPath = 'src/data/ingredientMasterSource.json';
const master = read(masterPath);
const pending = read('src/data/ingredientMasterPendingReview.json');
const additionsInMaster = master.filter(row => row.researchBatch === batch.batchId);
const baseline = master.filter(row => row.researchBatch !== batch.batchId);
const categories = new Map(baseline.map(row => [row.category, row.semanticCategoryKey]));
assert.equal(categories.size, 14, 'Expansion must retain the existing 14 categories');
assert.equal(batch.status, 'EDITORIAL_REVIEW');
const normalize = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const clean = value => typeof value === 'string' && value.length > 0 && value === value.normalize('NFC').trim().replace(/\s+/gu,' ') && !/[\uFFFD\p{Cc}\p{Cf}]/u.test(value);
const usedKeys = new Set([...baseline, ...pending].flatMap(row => [row.canonicalKey, ...(row.legacyCanonicalKeys || [])]));
const owners = new Map();
for (const row of [...baseline,...pending]) for (const alias of row.aliases) owners.set(normalize(alias), row.canonicalKey);
const evidenceIds = new Set();
// A different name must not allow the same source identity to enter in a later batch.
const previousBatches = new Map();
for (const file of fs.readdirSync(path.join(root, 'docs')).filter(file => /^ingredient-master-expansion-batch-\d+\.json$/.test(file))) {
  const previous = read(`docs/${file}`);
  assert(!previousBatches.has(previous.batchId), `Duplicate research batch ID: ${previous.batchId}`);
  previousBatches.set(previous.batchId, previous);
}
for (const row of baseline.filter(row => row.source === 'RESEARCH_EXPANSION')) {
  const record = previousBatches.get(row.researchBatch)?.records.find(record => record.canonicalKey === row.canonicalKey);
  assert(record?.evidence, `Missing earlier evidence: ${row.canonicalKey}`);
  evidenceIds.add(`${record.evidence.sourceId}:${record.evidence.recordId}`);
}
const knownAllergens = new Set(baseline.flatMap(row => row.allergens));
const additions = [];
for (const record of batch.records) {
  const key = record.canonicalKey;
  assert.match(key,/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
  assert(!usedKeys.has(key), `Canonical key already used or retired: ${key}`);
  usedKeys.add(key);
  assert(categories.has(record.category), `New category not allowed: ${record.category}`);
  assert(clean(record.defaultName) && record.defaultName.length <= 120, `Invalid name: ${key}`);
  assert(Array.isArray(record.aliases) && record.aliases.includes(record.defaultName) && record.aliases.length <= 30);
  const localAliases = new Set();
  for (const alias of record.aliases) {
    assert(clean(alias) && alias.length <= 160, `Invalid alias: ${key}`);
    const match = normalize(alias);
    assert(!owners.has(match) || owners.get(match) === key, `${alias}: already belongs to ${owners.get(match)}`);
    assert(!localAliases.has(alias.toLowerCase()), `Repeated alias: ${key}`);
    localAliases.add(alias.toLowerCase());
    owners.set(match, key);
  }
  assert(Array.isArray(record.allergens) && record.allergens.every(item => knownAllergens.has(item)), `Unrecognised allergen vocabulary: ${key}`);
  assert(batch.sources[record.evidence.sourceId], `Missing source: ${key}`);
  assert(record.evidence.recordId && record.evidence.sourceName && /^https:\/\//.test(record.evidence.url));
  const evidenceId = `${record.evidence.sourceId}:${record.evidence.recordId}`;
  assert(!evidenceIds.has(evidenceId), `Same source identity counted twice: ${evidenceId}`);
  evidenceIds.add(evidenceId);
  assert(clean(record.identityReason), `Missing identity decision: ${key}`);
  additions.push({canonicalKey:key,sourceCategory:record.category,category:record.category,
    semanticCategoryKey:categories.get(record.category),defaultName:record.defaultName,allergens:record.allergens,
    translations:{es:record.defaultName},aliases:record.aliases,semanticStatus:'NEEDS_REVIEW',imageStatus:'MISSING',
    source:'RESEARCH_EXPANSION',researchBatch:batch.batchId,
    ...(record.scientificName?{scientificName:record.scientificName}:{})});
}
if (additionsInMaster.length) {
  assert.deepEqual(additionsInMaster,additions,'Previously applied batch differs; review the change explicitly');
  assert(priorAudit && priorAudit.batchId === batch.batchId, 'Applied batch is missing its historical audit');
  const historicalKeys = new Set(priorAudit.baselineKeys);
  const historicalBaseline = master.filter(row => historicalKeys.has(row.canonicalKey));
  assert.equal(historicalBaseline.length, priorAudit.baselineKeys.length, 'An earlier ingredient was lost');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(historicalBaseline)).digest('hex'), priorAudit.baselineSha256, 'Historical baseline changed');
  console.log(JSON.stringify({alreadyApplied:true,...priorAudit.summary,currentTotal:master.length},null,2));
  // Do not reorder the master or rewrite historical counts after later batches.
  process.exit(0);
}
assert(!priorAudit, 'An audit exists but the batch is absent; investigate before applying');
const updated = [...baseline,...additions];
assert.equal(new Set(updated.map(row=>row.category)).size,14);
const summary = {
  baseline:baseline.length,added:additions.length,total:updated.length,categories:14,
  aliasesAdded:additions.reduce((sum,row)=>sum+row.aliases.length-1,0),pendingPreserved:pending.length,
  remainingTo3000:Math.max(0,3000-updated.length),
  byCategory:Object.fromEntries([...categories.keys()].map(category=>[category,{
    before:baseline.filter(row=>row.category===category).length,
    added:additions.filter(row=>row.category===category).length,
    after:updated.filter(row=>row.category===category).length,
  }])),
};
if(process.argv.includes('--apply')){
 const audit={schemaVersion:1,date:batch.date,batchId:batch.batchId,batchPath,
   baselineSha256:crypto.createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),
   summary,baselineKeys:baseline.map(row=>row.canonicalKey),addedKeys:additions.map(row=>row.canonicalKey),
   databaseWrites:0,generatedTranslations:0,publication:'LOCAL_ONLY'};
 fs.writeFileSync(path.join(root,masterPath),JSON.stringify(updated,null,2)+'\n');
 fs.writeFileSync(auditPath,JSON.stringify(audit,null,2)+'\n');
}
console.log(JSON.stringify(summary,null,2));
