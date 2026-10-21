import '../styles/PublicNavigation.css';

export default function PublicNavigation({ current = 'inicio' }) {
  return <header className="vp-publicHeader">
    <div className="vp-nav vp-publicNav">
      {current !== 'inicio' && <a className="vp-publicBrand" href="/" aria-label="Volta Pizza, inicio">VOLTA PIZZA</a>}
      <nav aria-label="Navegación principal">
        <a href="/" aria-current={current === 'inicio' ? 'page' : undefined}>Inicio</a>
        <a href="/recursos" aria-current={current === 'recursos' ? 'page' : undefined}>Recursos</a>
      </nav>
    </div>
  </header>;
}
