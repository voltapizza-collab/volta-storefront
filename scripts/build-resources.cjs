const fs = require('node:fs');
const path = require('node:path');
const { publicationErrors, publishedResources, safeUrl } = require('../src/resources/catalog');
const root = path.resolve(__dirname, '..');

function validateCatalog(catalog, publicRoot) {
  if (!Array.isArray(catalog)) throw Error('Resources catalog must be an array');
  const slugs = new Set();
  for (const resource of catalog) {
    if (!resource?.slug || slugs.has(resource.slug)) throw Error('Missing or duplicate resource slug');
    slugs.add(resource.slug);
    if (typeof resource.active !== 'boolean') throw Error(`Resource ${resource.slug}: active must be boolean`);
    if (!resource.active) continue;
    const errors = publicationErrors(resource);
    if (errors.length) throw Error(`Resource ${resource.slug} is incomplete: ${errors.join(', ')}`);
    const assets = [resource.cover.url, resource.seo.image, resource.pdfUrl, resource.videoUrl].filter(Boolean);
    for (const url of assets) {
      if (!safeUrl(url)) throw Error(`Unsafe resource URL: ${resource.slug}`);
      if (!url.startsWith('/')) continue;
      const relative = decodeURIComponent(new URL(url, 'https://voltapizza.com').pathname).slice(1);
      const file = path.resolve(publicRoot, relative);
      if (!file.startsWith(path.resolve(publicRoot) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
        throw Error(`Resource ${resource.slug}: missing local asset ${url}`);
      if (url === resource.pdfUrl) {
        const fd = fs.openSync(file, 'r');
        try {
          const header = Buffer.alloc(5); fs.readSync(fd, header, 0, 5, 0);
          if (header.toString() !== '%PDF-') throw Error(`Resource ${resource.slug}: invalid PDF`);
        } finally { fs.closeSync(fd); }
      }
    }
  }
  const published = publishedResources(catalog);
  for (const r of published) for (const block of r.body) for (const part of block.content || []) {
    if (typeof part === 'object' && part.href.startsWith('/recursos/')) {
      const slug = part.href.split(/[?#]/)[0].slice('/recursos/'.length);
      if (!published.some(item => item.slug === slug)) throw Error(`Resource ${r.slug}: link to unpublished resource ${slug}`);
    }
  }
  return published;
}
if (require.main === module) {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'content/resources.json'), 'utf8'));
  const published = validateCatalog(catalog, path.join(root, 'public'));
  const json = JSON.stringify(published, null, 2) + '\n';
  fs.writeFileSync(path.join(root, 'src/resources/published.json'), json);
  fs.writeFileSync(path.join(root, 'public/resources-manifest.json'), json);
  console.log(`Resources: ${published.length} published; drafts and future publications excluded.`);
}
module.exports = { validateCatalog };
