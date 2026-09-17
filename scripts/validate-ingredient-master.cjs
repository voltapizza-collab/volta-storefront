// Validate authored data before it reaches the ingredient picker or translator.
// Unicode accents and non-Latin names are supported; identifiers are independent of display names.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const decodeJson = relativePath => JSON.parse(new TextDecoder('utf-8', { fatal: true })
  .decode(fs.readFileSync(path.join(root, relativePath))));
const master = decodeJson('src/data/ingredientMasterSource.json');
const pending = decodeJson('src/data/ingredientMasterPendingReview.json');
const review = decodeJson('docs/ingredient-master-review.json');
const errors = [];
const fail = (context, message) => errors.push(`${context}: ${message}`);
const searchKey = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const categoryKeys = {
  ACEITES_GRASAS_VINAGRES: 'oils_fats_vinegars', AROMAS_Y_EXTRACTOS: 'extras',
  CARNES: 'meats', CREMAS_DULCES: 'sweet_creams', EMBUTIDOS: 'cured_meats',
  ENDULZANTES: 'sweeteners', FRUTAS: 'fruits',
  HIERBAS_ESPECIAS: 'herbs_spices', OTROS: 'other', PESCADOS_Y_MARISCOS: 'seafood',
  QUESOS: 'cheeses', SALSAS: 'sauces', SETAS: 'mushrooms', VERDURAS: 'vegetables',
};
function checkText(value, context, max) {
  if (typeof value !== 'string' || !value.trim()) { fail(context, 'missing text'); return false; }
  if (value.length > max) fail(context, `exceeds ${max} characters`);
  if (/[\uFFFD\p{Cc}\p{Cf}]/u.test(value)) fail(context, 'damaged, control or invisible character');
  if (/(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â[€™œž“”])/u.test(value)) fail(context, 'possible mojibake');
  if (value !== value.normalize('NFC')) fail(context, 'not normalized to NFC');
  if (value !== value.trim().replace(/\s+/gu, ' ')) fail(context, 'nonstandard whitespace');
  return true;
}
if (!Array.isArray(master) || !master.length || !Array.isArray(pending)) throw new Error('Invalid ingredient master or review inventory');
if (new Set(master.map(row => row.category)).size !== 14) fail('categories', 'the master must retain exactly the existing 14 categories');
const identifiers = new Set();
const activeKeys = new Set(master.map(row => row.canonicalKey));
const protectedKeys = decodeJson('docs/ingredient-master-protected-keys.json');
for (const key of protectedKeys.keys) {
  if (!activeKeys.has(key)) fail('protected master', `protected identity cannot be removed or renamed: ${key}`);
}
const serverCataloguePath = path.resolve(root, '../volta-backend/data/ingredientMasterCatalogue.json');
if (fs.existsSync(serverCataloguePath)) {
  const serverCatalogue = JSON.parse(fs.readFileSync(serverCataloguePath, 'utf8'));
  const expected = master.map(({ canonicalKey, defaultName, category, aliases, legacyCanonicalKeys }) =>
    ({ canonicalKey, defaultName, category, aliases, ...(legacyCanonicalKeys ? { legacyCanonicalKeys } : {}) }));
  if (JSON.stringify(serverCatalogue) !== JSON.stringify(expected)) fail('protected master', 'server catalogue must match the reviewed master');
}
const pendingKeys = new Set(pending.map(row => row.canonicalKey));
const redirects = new Map();
const names = new Map();
for (const row of [...master, ...pending]) {
  const id = row.canonicalKey;
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(id)) fail(String(id), 'invalid canonical key');
  if (identifiers.has(id)) fail(id, 'duplicate canonical key');
  identifiers.add(id);
  if (pendingKeys.has(id)) checkText(row.reviewReason, `${id}.reviewReason`, 500);
  if (!(row.category in categoryKeys)) fail(id, 'unknown category');
  else if (categoryKeys[row.category] !== row.semanticCategoryKey) fail(id, 'inconsistent semantic category');
  if (checkText(row.defaultName, `${id}.defaultName`, 120)) {
    const name = searchKey(row.defaultName);
    if (activeKeys.has(id)) names.set(name, [...(names.get(name) || []), id]);
  }
  if (!row.translations || typeof row.translations !== 'object' || Array.isArray(row.translations)) fail(id, 'missing translations');
  else {
    if (row.translations.es !== row.defaultName) fail(id, 'Spanish translation differs from default name');
    for (const [locale, name] of Object.entries(row.translations)) checkText(name, `${id}.translations.${locale}`, 160);
  }
  if (!Array.isArray(row.aliases) || !row.aliases.length || row.aliases.length > 30) fail(id, 'invalid aliases');
  else {
    if (!row.aliases.includes(row.defaultName)) fail(id, 'primary name missing from aliases');
    const aliases = new Set();
    row.aliases.forEach((alias, index) => {
      if (!checkText(alias, `${id}.aliases[${index}]`, 160)) return;
      const key = alias.toLocaleLowerCase('es');
      if (aliases.has(key)) fail(id, 'duplicate alias');
      aliases.add(key);
    });
  }
  const legacyKeys = row.legacyCanonicalKeys || [];
  if (!Array.isArray(legacyKeys) || legacyKeys.length > 30) fail(id, 'invalid legacy keys');
  else for (const key of legacyKeys) {
    if (typeof key !== 'string' || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key) || key.length > 120) fail(id, 'invalid legacy key');
    if (activeKeys.has(key) || pendingKeys.has(key) || redirects.has(key)) fail(id, `ambiguous legacy key ${key}`);
    if (!activeKeys.has(id)) fail(id, 'pending records cannot be redirect targets');
    redirects.set(key, id);
  }
}
for (const [name, ids] of names) {
  if (ids.length > 1) fail(name, `duplicate: ${ids.join(', ')}`);
}
// An exact alias shared by separate selectable identities needs editorial review.
const aliasOwners = new Map();
for (const row of master) for (const alias of row.aliases) {
  const key = searchKey(alias);
  const owner = aliasOwners.get(key);
  if (owner && owner !== row.canonicalKey) fail(alias, `alias belongs to both ${owner} and ${row.canonicalKey}`);
  aliasOwners.set(key, row.canonicalKey);
}
for (const decision of review.decisions) {
  for (const key of decision.originalKeys) {
    if (!identifiers.has(key) && !redirects.has(key)) fail('review', `lost historical identity ${key}`);
  }
  for (const key of decision.activeKeys) {
    if (!activeKeys.has(key)) fail('review', `inactive target ${key}`);
  }
  for (const key of decision.pendingKeys) {
    if (!pendingKeys.has(key)) fail('review', `missing pending record ${key}`);
  }
}
const researchRows = master.filter(row => row.source === 'RESEARCH_EXPANSION');
if (researchRows.length) {
  const batches = new Map();
  for (const file of fs.readdirSync(path.join(root, 'docs')).filter(file => /^ingredient-master-expansion-batch-\d+\.json$/.test(file))) {
    const batch = decodeJson(`docs/${file}`);
    if (batches.has(batch.batchId)) fail('research', `duplicate batch ID ${batch.batchId}`);
    batches.set(batch.batchId, batch);
  }
  const evidence = new Map();
  const sourceIdentities = new Set();
  for (const batchId of new Set(researchRows.map(row => row.researchBatch))) {
    const batch = batches.get(batchId);
    if (!batch) { fail('research', `missing batch ${batchId}`); continue; }
    for (const record of batch.records) {
      if (evidence.has(record.canonicalKey)) fail(record.canonicalKey, 'identity repeated across research batches');
      evidence.set(record.canonicalKey, {record, batch});
      const identity = `${record.evidence?.sourceId}:${record.evidence?.recordId}`;
      if (sourceIdentities.has(identity)) fail(record.canonicalKey, 'source identity counted twice');
      sourceIdentities.add(identity);
    }
  }
  const matched = new Set();
  for (const row of researchRows) {
    const entry = evidence.get(row.canonicalKey);
    if (!entry || row.researchBatch !== entry.batch.batchId) { fail(row.canonicalKey, 'missing research provenance'); continue; }
    const {record, batch} = entry;
    matched.add(row.canonicalKey);
    if (!batch.sources[record.evidence?.sourceId] || !record.evidence?.recordId || !/^https:\/\//.test(record.evidence?.url || '')) fail(row.canonicalKey, 'incomplete evidence');
    for (const field of ['defaultName', 'category', 'aliases', 'allergens', 'scientificName']) {
      if (JSON.stringify(row[field]) !== JSON.stringify(record[field])) fail(row.canonicalKey, `${field} differs from the reviewed research batch`);
    }
  }
  if (matched.size !== evidence.size) fail('research', 'an applied batch is incomplete');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Ingredient master OK: ${master.length} records, ${new Set(master.map(row => row.category)).size} categories; valid UTF-8/NFC, names, aliases and identifiers.`);
  console.log(`${redirects.size} consolidated keys preserved; ${pending.length} ambiguous records held separately. No duplicate names or shared exact aliases in the selectable source.`);
}
