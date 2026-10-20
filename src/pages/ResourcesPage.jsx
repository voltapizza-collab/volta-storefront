import { useState } from 'react';
import PublicNavigation from '../components/PublicNavigation';
import { usePublicSeo } from '../utils/seo';
import { CATEGORIES, LIBRARY_TITLE, LIBRARY_DESCRIPTION, publishedResources, resourceSeo } from '../resources/catalog';
import catalog from '../resources/published.json';
import '../styles/LandingPage.css';
import '../styles/Resources.css';

const librarySeo = resourceSeo();
export function PublicationDate({ value }) {
  return <time dateTime={value}>{new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))}</time>;
}
export default function ResourcesPage({ resources = catalog }) {
  const [category, setCategory] = useState('todos');
  usePublicSeo(librarySeo);
  const published = publishedResources(resources);
  const visible = published.filter(r => category === 'todos' || r.category === category);
  return <div className="vp-site vp-resources">
    <PublicNavigation current="recursos" />
    <main id="contenido" className="vp-resourcesMain">
      <header className="vp-resourcesIntro">
        <p className="vp-resourceEyebrow">BIBLIOTECA VOLTA PIZZA</p>
        <h1>{LIBRARY_TITLE}</h1>
        <p>{LIBRARY_DESCRIPTION}.</p>
      </header>
      <div className="vp-resourceFilters" role="group" aria-label="Categorías de recursos">
        {Object.entries({ todos: 'Todos', ...CATEGORIES }).map(([key, label]) =>
          <button type="button" key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>)}
      </div>
      <div aria-live="polite" aria-atomic="true" className="vp-resourceCount">
        {visible.length > 0 ? `${visible.length} ${visible.length === 1 ? 'recurso disponible' : 'recursos disponibles'}` : 'Todavía no hay publicaciones en esta categoría.'}
      </div>
      {visible.length ? <div className="vp-resourceGrid">
        {visible.map(resource => <article className="vp-resourceCard" key={resource.slug}>
          <a href={`/recursos/${resource.slug}`}>
            <img src={resource.cover.url} alt={resource.cover.alt} loading="lazy" width="960" height="540" />
            <div className="vp-resourceCardCopy">
              <div className="vp-resourceMeta"><span>{CATEGORIES[resource.category]}</span><PublicationDate value={resource.publishedAt} /></div>
              <h2>{resource.title}</h2>
              <p>{resource.description}</p>
              <span className="vp-resourceRead">{resource.category === 'clases' ? 'Ver clase gratuita' : resource.category === 'investigaciones' ? 'Ver investigación' : 'Leer artículo'} <span aria-hidden="true">→</span></span>
            </div>
          </a>
        </article>)}
      </div> : <section className="vp-resourceEmpty" aria-labelledby="resources-empty-title">
        <h2 id="resources-empty-title">Estamos preparando los primeros recursos</h2>
        <p>Aquí encontrarás investigaciones, artículos y clases sobre cómo desarrollar el canal de venta directa de tu pizzería.</p>
        <p>Publicaremos cada material cuando esté completo y disponible.</p>
      </section>}
    </main>
    <footer className="vp-resourcesFooter"><a href="/">Volta Pizza</a><span>Migración de clientes · Tecnología de venta · Inteligencia comercial</span></footer>
  </div>;
}
