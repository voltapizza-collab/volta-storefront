const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = (base, file) => JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const write = (base, file, value) => fs.writeFileSync(path.join(base,file),JSON.stringify(value,null,2)+'\n');
const masterPath = 'src/data/ingredientMasterSource.json';
const batchPath = 'docs/ingredient-master-expansion-batch-02.json';
// Importer fixtures represent historical catalogues. Give them the matching
// projection rather than validating a 2026 catalogue hash against a 1,358-row fixture.
function refreshFixtureTaxonomy(dir) {
 const master = read(dir,masterPath), taxonomy = read(root,'src/data/ingredientTaxonomy.json');
 taxonomy.sourceSha256 = crypto.createHash('sha256').update(JSON.stringify(master)).digest('hex');
 taxonomy.assignments = Object.fromEntries(master.map(row=>[row.canonicalKey, row.restaurantCategoryKey
   ? {categoryKey:row.restaurantCategoryKey,reviewRequired:false} : taxonomy.assignments[row.canonicalKey]]));
 write(dir,'src/data/ingredientTaxonomy.json',taxonomy);
}
function fixture(t) {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'volta-ingredient-batches-'));
 t.after(()=>{
   assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
   assert(path.basename(dir).startsWith('volta-ingredient-batches-'));
   fs.rmSync(dir,{recursive:true,force:true});
 });
 for(const folder of ['scripts','docs','src/data']) fs.mkdirSync(path.join(dir,folder),{recursive:true});
 for(const file of ['scripts/expand-ingredient-master.cjs','scripts/validate-ingredient-master.cjs',
  'docs/ingredient-master-expansion-batch-01.json',batchPath,'docs/ingredient-master-expansion-audit.json',
  'docs/ingredient-master-review.json','src/data/ingredientMasterPendingReview.json'])
   fs.copyFileSync(path.join(root,file),path.join(dir,file));
 const first = read(root,'docs/ingredient-master-expansion-audit.json');
 const before = new Set([...first.baselineKeys,...first.addedKeys]);
 const baseline = read(root,masterPath).filter(row=>before.has(row.canonicalKey));
 write(dir,masterPath,baseline);
 refreshFixtureTaxonomy(dir);
 // Protect the identities present at this historical stage, before later batches.
 write(dir,'docs/ingredient-master-protected-keys.json',{version:1,keys:baseline.map(row=>row.canonicalKey)});
 return dir;
}
function run(dir, script, ...args) {
 const result = spawnSync(process.execPath,[path.join(dir,'scripts',script),...args],{encoding:'utf8'});
 assert.ifError(result.error);
 return result;
}
const expand=(dir,...args)=>{
 const result=run(dir,'expand-ingredient-master.cjs','--batch=02',...args);
 if(result.status===0 && args.includes('--apply')) refreshFixtureTaxonomy(dir);
 return result;
};
test('second batch appends without modifying earlier identities; both batches stay idempotent',t=>{
 const dir=fixture(t), before=read(dir,masterPath), oldAudit=fs.readFileSync(path.join(dir,'docs/ingredient-master-expansion-audit.json'),'utf8');
 const dry=expand(dir);assert.equal(dry.status,0,dry.stderr);assert.deepEqual(read(dir,masterPath),before);
 const applied=expand(dir,'--apply');assert.equal(applied.status,0,applied.stderr);
 const after=read(dir,masterPath);assert.deepEqual(after.slice(0,before.length),before);
 assert.equal(after.length,before.length+read(dir,batchPath).records.length);
 const bytes=fs.readFileSync(path.join(dir,masterPath),'utf8');
 for(const number of ['01','02']) {const result=run(dir,'expand-ingredient-master.cjs',`--batch=${number}`,'--apply');assert.equal(result.status,0,result.stderr);}
 assert.equal(fs.readFileSync(path.join(dir,masterPath),'utf8'),bytes);
 assert.equal(fs.readFileSync(path.join(dir,'docs/ingredient-master-expansion-audit.json'),'utf8'),oldAudit);
 const validated=run(dir,'validate-ingredient-master.cjs');assert.equal(validated.status,0,validated.stderr);
});
test('renaming an earlier source identity cannot count it again',t=>{
 const dir=fixture(t), batch=read(dir,batchPath), before=read(dir,masterPath);
 batch.records[0].evidence=read(dir,'docs/ingredient-master-expansion-batch-01.json').records[0].evidence;
 write(dir,batchPath,batch);const result=expand(dir,'--apply');assert.notEqual(result.status,0);
 assert.match(result.stderr,/Same source identity counted twice/);assert.deepEqual(read(dir,masterPath),before);
});

test('an editorial-only batch is idempotent without rewriting master data and protects its decisions',t=>{
 const dir=fixture(t),batch=read(dir,batchPath);
 batch.records=[];batch.kind='EDITORIAL_REVIEW_ONLY';batch.decisions=[{term:'Existing ingredient',decision:'KEEP_EXISTING'}];write(dir,batchPath,batch);
 const before=fs.readFileSync(path.join(dir,masterPath),'utf8');
 assert.equal(expand(dir).status,0);
 assert(!fs.existsSync(path.join(dir,'docs/ingredient-master-expansion-audit-batch-02.json')));
 const first=expand(dir,'--apply');assert.equal(first.status,0,first.stderr);assert.equal(JSON.parse(first.stdout).added,0);
 const audit=fs.readFileSync(path.join(dir,'docs/ingredient-master-expansion-audit-batch-02.json'),'utf8');
 const again=expand(dir,'--apply');assert.equal(again.status,0,again.stderr);assert(JSON.parse(again.stdout).alreadyApplied);
 assert.equal(fs.readFileSync(path.join(dir,masterPath),'utf8'),before);
 assert.equal(fs.readFileSync(path.join(dir,'docs/ingredient-master-expansion-audit-batch-02.json'),'utf8'),audit);
 batch.decisions[0].decision='CHANGED';write(dir,batchPath,batch);
 assert.match(expand(dir,'--apply').stderr,/Applied editorial decisions changed/);
 assert.equal(fs.readFileSync(path.join(dir,masterPath),'utf8'),before);
});

test('an editorial-only batch rejects additions and still detects changes to the historical master',t=>{
 const dir=fixture(t),batch=read(dir,batchPath);batch.kind='EDITORIAL_REVIEW_ONLY';batch.decisions=[{term:'Existing ingredient',decision:'KEEP_EXISTING'}];write(dir,batchPath,batch);
 assert.match(expand(dir,'--apply').stderr,/Review-only batches cannot add identities/);
 batch.records=[];write(dir,batchPath,batch);assert.equal(expand(dir,'--apply').status,0);
 const master=read(dir,masterPath);master[0].imageStatus='CHANGED';write(dir,masterPath,master);
 assert.match(expand(dir,'--apply').stderr,/Historical baseline changed/);
});
test('aliases cannot shadow earlier names after accent normalization',t=>{
 const dir=fixture(t),batch=read(dir,batchPath);
 batch.records[0].aliases.push('Limon');write(dir,batchPath,batch);
 const result=expand(dir);assert.notEqual(result.status,0);assert.match(result.stderr,/already belongs to/);
});
test('a fifteenth category is rejected',t=>{
 const dir=fixture(t),batch=read(dir,batchPath);batch.records[0].category='CEREALES';write(dir,batchPath,batch);
 const result=expand(dir);assert.notEqual(result.status,0);assert.match(result.stderr,/New category not allowed/);
});

test('unknown restaurant families fail before the master can be written',t=>{
 const dir=fixture(t),batch=read(dir,batchPath),before=read(dir,masterPath);
 batch.records[0].restaurantCategoryKey='UNREVIEWED_FAMILY';write(dir,batchPath,batch);
 const result=expand(dir,'--apply');assert.notEqual(result.status,0);
 assert.match(result.stderr,/Unknown restaurant family/);assert.deepEqual(read(dir,masterPath),before);
});

test('reviewed restaurant families persist without approving semantics or changing historical category',t=>{
 const dir=fixture(t),batch=read(dir,batchPath),record=batch.records[0];
 record.restaurantCategoryKey='PANES_MASAS_HARINAS';write(dir,batchPath,batch);
 const result=expand(dir,'--apply');assert.equal(result.status,0,result.stderr);
 const added=read(dir,masterPath).find(row=>row.canonicalKey===record.canonicalKey);
 assert.equal(added.restaurantCategoryKey,record.restaurantCategoryKey);
 assert.equal(added.category,record.category);assert.equal(added.semanticStatus,'NEEDS_REVIEW');
 assert.equal(run(dir,'validate-ingredient-master.cjs').status,0);
 const changed=read(dir,masterPath);changed.find(row=>row.canonicalKey===record.canonicalKey).restaurantCategoryKey='LACTEOS_HUEVOS';write(dir,masterPath,changed);
 assert.match(run(dir,'validate-ingredient-master.cjs').stderr,/restaurantCategoryKey differs from the reviewed research batch/);
});
test('partially applied batches fail both validation and reapplication',t=>{
 const dir=fixture(t);assert.equal(expand(dir,'--apply').status,0);
 const master=read(dir,masterPath);master.pop();write(dir,masterPath,master);
 assert.match(run(dir,'validate-ingredient-master.cjs').stderr,/applied batch is incomplete/);
 assert.match(expand(dir,'--apply').stderr,/Previously applied batch differs/);
});
test('reapplying a batch detects changes to its historical baseline',t=>{
 const dir=fixture(t);assert.equal(expand(dir,'--apply').status,0);
 const master=read(dir,masterPath);master[0].imageStatus='CHANGED';write(dir,masterPath,master);
 const result=expand(dir,'--apply');assert.notEqual(result.status,0);assert.match(result.stderr,/Historical baseline changed/);
});
test('validation rejects missing provenance and duplicate cross-batch evidence',t=>{
 const dir=fixture(t);assert.equal(expand(dir,'--apply').status,0);
 const batch=read(dir,batchPath), saved=batch.records[0].evidence;
 batch.records[0].evidence={...saved,sourceId:'MISSING'};write(dir,batchPath,batch);
 assert.match(run(dir,'validate-ingredient-master.cjs').stderr,/incomplete evidence/);
 batch.records[0].evidence=read(dir,'docs/ingredient-master-expansion-batch-01.json').records[0].evidence;write(dir,batchPath,batch);
 assert.match(run(dir,'validate-ingredient-master.cjs').stderr,/source identity counted twice/);
});
