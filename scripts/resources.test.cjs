const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { validateCatalog } = require('./build-resources.cjs');
const { resourceResponse } = require('./resources-http.cjs');
const { serveResourceMedia } = require('./resource-media.cjs');
const draft = require('../content/resources.json')[0];
const fixture = () => ({ slug: 'prueba', category: 'investigaciones', active: true, order: 1,
  title: 'Prueba', description: 'Resumen', introduction: 'Introducción', publishedAt: '2026-01-01',
  cover: { url: '/resources/cover.svg', alt: 'Portada' },
  seo: { title: 'Prueba SEO', description: 'Descripción SEO', image: '/resources/cover.svg' },
  body: [{ type: 'paragraph', content: ['Contenido exclusivo de una prueba automatizada.'] }],
  pdfUrl: '/resources/prueba.pdf' });

test('publication gate keeps drafts private and rejects incomplete activation and duplicate slugs', () => {
  assert.deepEqual(validateCatalog([draft], '.'), []);
  assert.throws(() => validateCatalog([{ ...draft, active: true }], '.'), /incomplete/);
  assert.throws(() => validateCatalog([draft, draft], '.'), /duplicate/);
});
test('publication checks real local asset existence, PDF signature and internal published links', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'volta-resource-test-'));
  try {
    fs.mkdirSync(path.join(directory, 'resources'));
    fs.writeFileSync(path.join(directory, 'resources/cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    assert.throws(() => validateCatalog([fixture()], directory), /missing local asset/);
    fs.writeFileSync(path.join(directory, 'resources/prueba.pdf'), 'not pdf');
    assert.throws(() => validateCatalog([fixture()], directory), /invalid PDF/);
    fs.writeFileSync(path.join(directory, 'resources/prueba.pdf'), '%PDF-1.4\n% temporary test fixture');
    assert.equal(validateCatalog([fixture()], directory).length, 1);
    const item = fixture(); item.body[0].content = [{ text: 'Link', href: '/recursos/not-published' }];
    assert.throws(() => validateCatalog([item], directory), /unpublished resource/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('HTTP SEO resolves resource URLs before store slugs and returns 404/noindex for drafts', () => {
  assert.equal(resourceResponse('/recursos', []).statusCode, 200);
  assert.equal(resourceResponse('/recursos/prueba', [fixture()]).canonicalUrl, 'https://voltapizza.com/recursos/prueba');
  assert.equal(resourceResponse('/recursos/prueba', [fixture()]).image, 'https://voltapizza.com/resources/cover.svg');
  assert.equal(resourceResponse(`/recursos/${draft.slug}`, [draft]).statusCode, 404);
  assert.equal(resourceResponse('/recursos/prueba/extra', [fixture()]).robots, 'noindex, nofollow');
  assert.equal(resourceResponse('/mycrushpizza', []), null);
});
test('PDF and video serving supports inline content, download, HEAD and byte seeking', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'volta-media-test-'));
  const file = path.join(directory, 'fixture.pdf');
  const bytes = Buffer.from('%PDF-1.4\n0123456789'); fs.writeFileSync(file, bytes);
  const server = http.createServer((req, res) => serveResourceMedia(req, res, file,
    req.url.startsWith('/video') ? 'video/mp4' : 'application/pdf'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const full = await fetch(origin);
    assert.equal(full.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    const download = await fetch(origin + '/?download=1', { method: 'HEAD' });
    assert.match(download.headers.get('content-disposition'), /attachment/);
    assert.equal(await download.text(), '');
    const partial = await fetch(origin + '/video', { headers: { Range: 'bytes=0-4' } });
    assert.equal(partial.status, 206); assert.equal(partial.headers.get('content-type'), 'video/mp4');
    assert.equal(await partial.text(), '%PDF-');
    const suffix = await fetch(origin, { headers: { Range: 'bytes=-3' } });
    assert.equal(await suffix.text(), '789');
    const invalid = await fetch(origin, { headers: { Range: 'bytes=999-1000' } });
    assert.equal(invalid.status, 416);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
