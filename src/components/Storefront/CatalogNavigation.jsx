import { useEffect, useRef } from "react";

export default function CatalogNavigation({ offers, categories, activeId, onSelect }) {
  const scroller = useRef(null);
  useEffect(() => {
    const rail = scroller.current;
    const button = Array.from(rail?.children || []).find(child => child.dataset.categoryId === String(activeId));
    if (!button) return;
    const railRect = rail.getBoundingClientRect(), buttonRect = button.getBoundingClientRect();
    if (buttonRect.left < railRect.left || buttonRect.right > railRect.right) {
      rail.scrollTo?.({ left: rail.scrollLeft + buttonRect.left - railRect.left, behavior: "auto" });
    }
  }, [activeId]);
  const selectedOffer = offers.some(offer => offer.id === activeId) ? activeId : "";
  return (
    <nav className="sf-catalogNav" aria-label="Categorías y ofertas">
      {offers.length > 0 && <div className="sf-catalogOffers">
        <label className="sf-catalogOfferSelect">
          <span className="sf-catalogSrOnly">Ofertas</span>
          <select aria-label="Ofertas" value={selectedOffer} onChange={event => onSelect(event.target.value)}>
            <option value="" disabled>Ofertas</option>
            {offers.map(offer => <option key={offer.id} value={offer.id}>{offer.label}</option>)}
          </select>
        </label>
        <div className="sf-catalogOfferButtons">
          {offers.map(offer => <button type="button" key={offer.id} aria-pressed={offer.id === activeId}
            onClick={() => onSelect(offer.id)}>{offer.label}</button>)}
        </div>
      </div>}
      <div className="sf-catalogCategories" ref={scroller}>
        {categories.map(category => <button type="button" key={category.id} data-category-id={category.id}
          aria-pressed={category.id === activeId} onClick={() => onSelect(category.id)}>{category.label}</button>)}
      </div>
    </nav>
  );
}

export function CatalogSearch({ value, onChange, onClose, autoFocus = false }) {
  const inputRef = useRef(null);
  useEffect(() => { if (autoFocus && inputRef.current?.getClientRects().length) inputRef.current.focus({ preventScroll: true }); }, [autoFocus]);
  return <form className="sf-catalogSearch" role="search" onSubmit={event => {
    event.preventDefault(); event.currentTarget.querySelector("input")?.blur();
  }}>
    <input ref={inputRef} type="search" aria-label="Buscar pizza o ingrediente" placeholder="Buscar pizza o ingrediente…"
      value={value} onChange={event => onChange(event.target.value)} />
    <button type="button" onClick={() => { onChange(""); onClose(); }}>Cerrar búsqueda</button>
  </form>;
}

export function CatalogTools({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const outside = event => { if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false; };
    const escape = event => {
      if (event.key === "Escape" && ref.current?.open) {
        event.stopPropagation(); ref.current.open = false; ref.current.querySelector("summary").focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  return <details className="sf-catalogTools" ref={ref}>
    <summary>Más</summary>
    <div onClick={event => { if (event.target.closest("button, a")) ref.current.open = false; }}>{children}</div>
  </details>;
}
