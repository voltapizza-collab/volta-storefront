import { videoSource } from '../resources/catalog';

export function ResourceBody({ blocks = [] }) {
  return <div className="vp-resourceBody">{blocks.map((block, index) => {
    if (block.type === 'heading') return <h2 id={`seccion-${index}`} key={index}>{block.text}</h2>;
    if (block.type === 'subheading') return <h3 id={`seccion-${index}`} key={index}>{block.text}</h3>;
    if (block.type === 'list') return <ul key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
    if (block.type === 'paragraph') return <p key={index}>{block.content.map((part, i) => typeof part === 'string'
      ? part : <a key={i} href={part.href} {...(part.href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{part.text}</a>)}</p>;
    return null;
  })}</div>;
}

export function ResourceVideo({ url, title, poster }) {
  const source = videoSource(url);
  if (!source) return null;
  return <section className="vp-resourceMedia" aria-label="Vídeo de la clase">
    {source.kind === 'file'
      ? <video controls playsInline preload="metadata" src={source.url} poster={poster} aria-label={title}>
        Tu navegador no admite este vídeo. <a href={source.url}>Abrir vídeo</a>.
      </video>
      : <iframe src={source.url} title={`Vídeo: ${title}`} loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen />}
  </section>;
}

export function ResourcePdf({ url, title }) {
  return <section className="vp-resourcePdf" aria-label="Documento de investigación">
    <div className="vp-resourceActions">
      <a className="vp-secondaryLink" href={url} target="_blank" rel="noopener noreferrer">Abrir PDF</a>
      <a className="vp-primaryLink" href={`${url}?download=1`} download>Descargar PDF</a>
    </div>
    <p className="vp-resourceHint">Si tu navegador no muestra el documento, puedes abrirlo en otra pestaña o descargarlo.</p>
    <iframe title={`PDF: ${title}`} src={url} loading="lazy" />
  </section>;
}
