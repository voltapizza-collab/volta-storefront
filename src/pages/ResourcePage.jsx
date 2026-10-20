import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PublicNavigation from '../components/PublicNavigation';
import { ResourceBody, ResourcePdf, ResourceVideo } from '../components/ResourceContent';
import { PublicationDate } from './ResourcesPage';
import { MEETING_BOOKING_URL } from '../config/commercial';
import { CATEGORIES, publishedResources, resourceSeo } from '../resources/catalog';
import { usePublicSeo } from '../utils/seo';
import catalog from '../resources/published.json';
import '../styles/LandingPage.css';
import '../styles/Resources.css';

const missingSeo = { ...resourceSeo(), title: 'Recurso no disponible | Volta Pizza',
  description: 'Consulta las investigaciones, artículos y clases disponibles en la biblioteca de Volta Pizza.' };
export default function ResourcePage({ resources = catalog }) {
  const { slug } = useParams();
  const resource = publishedResources(resources).find(r => r.slug === slug);
  usePublicSeo(resource ? resourceSeo(resource) : missingSeo);
  useEffect(() => {
    if (resource) return undefined;
    const previous = document.head.querySelector('meta[name="robots"]');
    const original = previous?.content;
    const meta = previous || document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    if (!previous) document.head.appendChild(meta);
    return () => { if (previous) meta.content = original; else meta.remove(); };
  }, [resource]);
  return <div className="vp-site vp-resources">
    <PublicNavigation current="recursos" />
    <main className="vp-resourceDetail">
      <a className="vp-resourceBack" href="/recursos">← Todos los recursos</a>
      {!resource ? <section className="vp-resourceEmpty">
        <h1>Este recurso no está disponible</h1>
        <p>Puedes consultar los materiales publicados en nuestra biblioteca.</p>
        <a className="vp-primaryLink" href="/recursos">Explorar recursos</a>
      </section> : <article>
        <header className="vp-resourceArticleHeader">
          <div className="vp-resourceMeta"><span>{CATEGORIES[resource.category]}</span><PublicationDate value={resource.publishedAt} />
            {resource.category === 'clases' && <span>Gratis · Sin registro</span>}</div>
          <h1>{resource.title}</h1>
          {resource.author && <p className="vp-resourceAuthor">Por {resource.author}</p>}
          <p className="vp-resourceLead">{resource.introduction}</p>
          <img className="vp-resourceCover" src={resource.cover.url} alt={resource.cover.alt} width="960" height="540" />
        </header>
        {resource.category === 'clases' && <ResourceVideo url={resource.videoUrl} title={resource.title} poster={resource.cover.url} />}
        <ResourceBody blocks={resource.body} />
        {resource.category === 'investigaciones' && <ResourcePdf url={resource.pdfUrl} title={resource.title} />}
        {resource.references?.length > 0 && <section className="vp-resourceReferences" aria-labelledby="references-title">
          <h2 id="references-title">Referencias bibliográficas</h2>
          <ol>{resource.references.map((ref, index) => <li key={index}>
            {ref.author} ({ref.year}). <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title}</a>.
          </li>)}</ol>
        </section>}
        <aside className="vp-resourceMeeting" aria-label="Habla con Volta Pizza">
          <h2>Hablemos de tu pizzería</h2>
          <p>Conoce cómo abordamos la venta directa y la migración de clientes en Volta Pizza.</p>
          <a className="vp-primaryLink" href={MEETING_BOOKING_URL} target="_blank" rel="noopener noreferrer">Agendar una reunión</a>
        </aside>
      </article>}
    </main>
  </div>;
}
