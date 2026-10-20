const { publishedResources, resourceSeo } = require('../src/resources/catalog');
function resourceResponse(pathname, catalog) {
  if (!/^\/recursos(?:\/|$)/i.test(pathname)) return null;
  if (/^\/recursos\/?$/i.test(pathname)) return { ...resourceSeo(), statusCode: 200 };
  const match = pathname.match(/^\/recursos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  const resource = match && publishedResources(catalog).find(r => r.slug === match[1]);
  if (resource) return { ...resourceSeo(resource), statusCode: 200 };
  return { ...resourceSeo(), title: 'Recurso no disponible | Volta Pizza',
    description: 'Consulta los materiales publicados en la biblioteca de Volta Pizza.',
    statusCode: 404, robots: 'noindex, nofollow' };
}
module.exports = { resourceResponse };
