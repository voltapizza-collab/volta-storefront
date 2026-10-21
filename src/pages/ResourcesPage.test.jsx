import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResourcesPage from './ResourcesPage';
import ResourcePage from './ResourcePage';
import { ResourceVideo } from '../components/ResourceContent';
import { publishedResources, publicationErrors, videoSource } from '../resources/catalog';
const drafts = [{ slug: 'clase-borrador', category: 'clases', active: false, title: 'Clase en preparación' }];
let mockSlug = 'articulo-prueba';
jest.mock('react-router-dom', () => ({ useParams: () => ({ slug: mockSlug }) }), { virtual: true });

// Synthetic fixtures are for tests only; they never enter the publication catalog.
const resource = (category = 'articulos', extra = {}) => ({
  slug: 'articulo-prueba', category, active: true, order: 10, title: 'Contenido de prueba',
  description: 'Descripción de prueba', introduction: 'Introducción de prueba',
  publishedAt: '2026-01-01', cover: { url: '/resources/cover.jpg', alt: 'Portada de prueba' },
  seo: { title: 'SEO de prueba | Volta Pizza', description: 'Resumen para compartir', image: '/resources/cover.jpg' },
  body: [{ type: 'heading', text: 'Primera sección' }, { type: 'paragraph', content: ['Texto de prueba y ', { text: 'biblioteca', href: '/recursos' }] }],
  author: 'Autor de prueba', references: [{ title: 'Referencia de prueba', author: 'Autora', year: '2025', url: 'https://example.org/referencia' }],
  ...extra,
});

test('only complete active dated resources appear, ordered explicitly; drafts stay unpublished', () => {
  const earlier = resource('articulos', { slug: 'primero', order: 1 });
  expect(publishedResources([resource(), earlier, ...drafts])).toEqual([earlier, resource()]);
  expect(publishedResources([resource('clases', { videoUrl: '' }), resource('investigaciones', { pdfUrl: '' }),
    resource('articulos', { active: false }), resource('articulos', { publishedAt: '2999-01-01' })])).toEqual([]);
  expect(publicationErrors(resource('articulos', { publishedAt: '2026-02-30' }))).toContain('publishedAt');
});

test('library shows an honest empty state with categories and no empty players or draft links', () => {
  const { container } = render(<ResourcesPage resources={drafts} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recursos para vender más pizzas directamente');
  expect(screen.getByText('Estamos preparando los primeros recursos')).toBeVisible();
  for (const name of ['Investigaciones', 'Artículos', 'Clases']) expect(screen.getByRole('button', { name })).toBeVisible();
  expect(screen.queryByText(drafts[0].title)).not.toBeInTheDocument();
  expect(container.querySelector('iframe, video')).toBeNull();
});

test('category controls filter cards without losing their individual URLs and metadata', () => {
  render(<ResourcesPage resources={[resource(), resource('clases', { slug: 'clase-prueba', title: 'Clase de prueba', videoUrl: 'https://youtu.be/abcdefghijk' })]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Clases' }));
  expect(screen.getByRole('link', { name: /Clase de prueba/ })).toHaveAttribute('href', '/recursos/clase-prueba');
  expect(screen.queryByRole('heading', { name: 'Contenido de prueba' })).not.toBeInTheDocument();
  expect(screen.getByText('1 de enero de 2026')).toHaveAttribute('datetime', '2026-01-01');
  fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
  expect(screen.getByRole('heading', { name: 'Contenido de prueba' })).toBeVisible();
});

test('article renders semantic content, references, meeting link and individual sharing metadata', () => {
  render(<ResourcePage resources={[resource()]} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Contenido de prueba');
  expect(screen.getByRole('heading', { name: 'Primera sección', level: 2 })).toBeVisible();
  expect(screen.getByText('Por Autor de prueba')).toBeVisible();
  expect(screen.getByRole('link', { name: 'biblioteca' })).toHaveAttribute('href', '/recursos');
  expect(screen.getByRole('link', { name: 'Referencia de prueba' })).toHaveAttribute('rel', 'noopener noreferrer');
  const meeting = screen.getByRole('link', { name: 'Agendar una reunión' });
  expect(meeting).toHaveAttribute('href', 'https://calendar.app.google/MPeZBS1K4UsEgmKG8');
  expect(meeting).toHaveAttribute('target', '_blank');
  expect(document.querySelector('meta[property="og:image"]').content).toBe('https://voltapizza.com/resources/cover.jpg');
  expect(document.querySelector('link[rel="canonical"]').href).toBe('https://voltapizza.com/recursos/articulo-prueba');
});

test('PDF offers an inline viewer, a new-tab fallback and same-origin forced download', () => {
  const { container } = render(<ResourcePage resources={[resource('investigaciones', { pdfUrl: '/resources/papers/prueba.pdf' })]} />);
  expect(container.querySelector('iframe')).toHaveAttribute('src', '/resources/papers/prueba.pdf');
  expect(screen.getByRole('link', { name: 'Abrir PDF' })).toHaveAttribute('target', '_blank');
  expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('href', '/resources/papers/prueba.pdf?download=1');
  expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('download');
});

test('video URL is normalized and an empty or untrusted player is never rendered', () => {
  expect(videoSource('https://www.youtube.com/watch?v=abcdefghijk')).toEqual({ kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk' });
  expect(videoSource('https://vimeo.com/12345')?.url).toBe('https://player.vimeo.com/video/12345');
  for (const url of ['', 'javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=abcdefghijk', '//evil.test/video.mp4']) expect(videoSource(url)).toBeNull();
  const { container, rerender } = render(<ResourceVideo url="" title="Prueba" />);
  expect(container.querySelector('iframe, video')).toBeNull();
  rerender(<ResourceVideo url="https://youtu.be/abcdefghijk" title="Prueba" />);
  expect(screen.getByTitle('Vídeo: Prueba')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  rerender(<ResourceVideo url="/resources/videos/prueba.mp4" title="Prueba" />);
  expect(container.querySelector('video')).toHaveAttribute('controls');
});

test('draft detail is unavailable, not indexable and never offers an incomplete class', () => {
  mockSlug = drafts[0].slug;
  const { container } = render(<ResourcePage resources={drafts} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Este recurso no está disponible');
  expect(container.querySelector('iframe, video')).toBeNull();
  expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
  mockSlug = 'articulo-prueba';
});
