// Shared by React, the publication script and the HTTP server.
const ORIGIN = 'https://voltapizza.com';
const CATEGORIES = { investigaciones: 'Investigaciones', articulos: 'Artículos', clases: 'Clases' };
const LIBRARY_TITLE = 'Recursos para vender más pizzas directamente';
const LIBRARY_DESCRIPTION = 'Investigaciones, artículos y clases sobre migración de clientes, venta directa e inteligencia comercial para pizzerías';
const text = value => typeof value === 'string' && value.trim().length > 0;
const safeUrl = value => {
  if (!text(value) || /[\s\\\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch (_) { return false; }
};
const localFile = (value, extension) => typeof value === 'string' &&
  new RegExp(`^/resources/[a-zA-Z0-9_/-]+\\.${extension}$`).test(value) && !value.includes('..');
const absolute = value => value.startsWith('/') ? ORIGIN + value : value;

function videoSource(value) {
  if (!safeUrl(value)) return null;
  if (localFile(value, '(mp4|webm)')) return { kind: 'file', url: value };
  try {
    const url = new URL(value);
    if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: 'file', url: value };
    let id = '';
    if (['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]+)\/?$/)?.[1];
    } else if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` };
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const match = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/);
      if (match) return { kind: 'embed', url: `https://player.vimeo.com/video/${match[1]}` };
    }
  } catch (_) { /* Invalid or unsupported host: never interpolate arbitrary iframe URLs. */ }
  return null;
}

function validBlocks(blocks) {
  return Array.isArray(blocks) && blocks.length > 0 && blocks.every(block => {
    if (!block || typeof block !== 'object') return false;
    if (['heading', 'subheading'].includes(block.type)) return text(block.text);
    if (block.type === 'list') return Array.isArray(block.items) && block.items.length > 0 && block.items.every(text);
    if (block.type === 'paragraph') return Array.isArray(block.content) && block.content.length > 0 &&
      block.content.every(part => text(part) || (part && text(part.text) && safeUrl(part.href)));
    return false;
  });
}

function publicationErrors(resource) {
  const errors = [];
  if (!resource || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.slug || '')) errors.push('slug');
  if (!Object.hasOwn(CATEGORIES, resource?.category)) errors.push('category');
  for (const key of ['title', 'description', 'introduction']) if (!text(resource?.[key])) errors.push(key);
  if (!Number.isFinite(resource?.order)) errors.push('order');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resource?.publishedAt || '') ||
      !Number.isFinite(Date.parse(resource?.publishedAt)) ||
      new Date(resource.publishedAt).toISOString().slice(0, 10) !== resource.publishedAt) errors.push('publishedAt');
  if (!safeUrl(resource?.cover?.url) || !text(resource?.cover?.alt)) errors.push('cover');
  if (!text(resource?.seo?.title) || !text(resource?.seo?.description) || !safeUrl(resource?.seo?.image)) errors.push('seo');
  if (!validBlocks(resource?.body)) errors.push('body');
  if (resource?.category === 'clases' && !videoSource(resource.videoUrl)) errors.push('videoUrl');
  if (resource?.category === 'investigaciones' && !localFile(resource.pdfUrl, 'pdf')) errors.push('pdfUrl');
  if (resource?.category === 'articulos') {
    if (!text(resource.author)) errors.push('author');
    if (!Array.isArray(resource.references) || !resource.references.every(ref =>
      text(ref.title) && text(ref.author) && text(ref.year) && safeUrl(ref.url))) errors.push('references');
  }
  return errors;
}
function publishedResources(catalog, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return catalog.filter(r => r.active === true && !publicationErrors(r).length && r.publishedAt <= today)
    .sort((a, b) => a.order - b.order || b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}
function resourceSeo(resource) {
  if (!resource) return {
    title: `${LIBRARY_TITLE} | Volta Pizza`, description: LIBRARY_DESCRIPTION,
    canonicalUrl: `${ORIGIN}/recursos`, image: `${ORIGIN}/logo512.png`,
  };
  return {
    title: resource.seo.title, description: resource.seo.description,
    canonicalUrl: `${ORIGIN}/recursos/${resource.slug}`, image: absolute(resource.seo.image),
    structuredData: {
      '@context': 'https://schema.org', '@type': resource.category === 'articulos' ? 'Article' : 'CreativeWork',
      headline: resource.title, description: resource.description, datePublished: resource.publishedAt,
      image: absolute(resource.cover.url), url: `${ORIGIN}/recursos/${resource.slug}`,
      isAccessibleForFree: true,
      ...(resource.author ? { author: { '@type': 'Person', name: resource.author } } : {}),
    },
  };
}
module.exports = { CATEGORIES, LIBRARY_TITLE, LIBRARY_DESCRIPTION, safeUrl, localFile, videoSource, publicationErrors, publishedResources, resourceSeo };
