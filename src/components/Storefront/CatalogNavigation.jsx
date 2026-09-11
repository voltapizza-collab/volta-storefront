import { memo, useEffect, useRef } from "react";

const CatalogNavigation = memo(function CatalogNavigation({ offers, categories, activeId, onSelect }) {
  const scroller = useRef(null);
  useEffect(() => {
    const rail = scroller.current;
    const button = Array.from(rail?.children || []).find(child => child.dataset.categoryId === String(activeId));
    if (!button || !rail.getClientRects().length) return;
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
});

export default CatalogNavigation;

export function CatalogFocusCategory({ offers, categories, activeId, onSelect, resultCount, searching = false }) {
  const items = [...offers, ...categories];
  const active = items.find(item => item.id === activeId);
  const countLabel = `${resultCount} ${resultCount === 1 ? "producto" : "productos"}`;
  return <div className={`sf-catalogFocusCategory${searching ? "" : " sf-catalogFocusCategory--picker"}`}>
    <div className="sf-catalogFocusCategory__copy" aria-hidden="true">
      <strong>{searching ? "Resultados" : active?.label || "Categorías"}</strong>
      <span>{searching ? countLabel : <>Cambiar<span className="sf-catalogFocusCategory__hintDetail"> categoría</span></>}</span>
    </div>
    {!searching && <>
      <svg className="sf-catalogFocusCategory__chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      <select aria-label="Cambiar categoría" title="Desliza para cambiar de categoría o toca para elegir" value={active ? String(activeId) : ""} onChange={event => {
        const item = items.find(candidate => String(candidate.id) === event.target.value);
        if (item) onSelect(item.id);
      }}>
        {!active && <option value="" disabled>Categorías</option>}
        {offers.length > 0 && <optgroup label="Ofertas">{offers.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>}
        {categories.length > 0 && <optgroup label="Categorías">{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>}
      </select>
    </>}
    <span className="sf-catalogSrOnly" role="status" aria-live="polite" aria-atomic="true">{searching ? "Resultados" : active?.label || "Categorías"}: {countLabel}</span>
  </div>;
}

export function CatalogSearch({ value, onChange, onClose, resultCount = 0, autoFocus = false }) {
  const inputRef = useRef(null);
  useEffect(() => { if (autoFocus && inputRef.current?.getClientRects().length) inputRef.current.focus({ preventScroll: true }); }, [autoFocus]);
  const close = () => { onChange(""); onClose(); };
  return <form className="sf-catalogSearch" role="search" aria-label="Buscar en la tienda" onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }} onSubmit={event => {
    event.preventDefault(); event.currentTarget.querySelector("input")?.blur();
  }}>
    <div className="sf-catalogSearch__heading">
      <strong>¿Qué te apetece?</strong>
      <button className="sf-catalogSearch__close" type="button" onClick={close} aria-label="Cerrar búsqueda">Cerrar <span aria-hidden="true">×</span></button>
    </div>
    <div className="sf-catalogSearch__field">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <input ref={inputRef} type="search" aria-label="Buscar pizza o ingrediente" placeholder="Pizza o ingrediente…" autoComplete="off" enterKeyHint="search"
        value={value} onChange={event => onChange(event.target.value)} />
      {value && <button className="sf-catalogSearch__clear" type="button" aria-label="Borrar búsqueda" onClick={() => { onChange(""); inputRef.current?.focus(); }}>×</button>}
    </div>
    <p className="sf-catalogSearch__hint" role="status" aria-live="polite" aria-atomic="true">{value.trim()
      ? `${resultCount} ${resultCount === 1 ? "producto encontrado" : "productos encontrados"} en la vitrina`
      : "Busca por nombre o ingrediente. Tu próxima pizza está abajo."}</p>
  </form>;
}

export function CatalogTools({ children, showCoupons = false, freeDelivery = false, showCustomPizza = false, showHalfAndHalf = false }) {
  const ref = useRef(null);
  const discover = { theme: "discover", lead: "Descubre", label: "más", icon: "M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" };
  const benefits = [
    ...(showCoupons ? [{ theme: "coupons", lead: "Tus", label: "cupones", icon: "M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4ZM14 5v3m0 3v2m0 3v3" }] : []),
    ...(showCoupons && freeDelivery ? [{ theme: "delivery", lead: "Envío", label: "gratis", icon: "M3 5h11v11H3Zm11 4h4l3 4v3h-7M8 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0Zm12 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z" }] : []),
    ...(showCustomPizza ? [{ theme: "custom", lead: "Arma tu", label: "pizza", icon: "M4 4a21 21 0 0 1 16 16L4 20ZM4 8a16 16 0 0 1 12 12M7 12h.01M8 17h.01M12 16h.01" }] : []),
    ...(showHalfAndHalf ? [{ theme: "halves", lead: "Mitad y", label: "mitad", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0v18M7 9h.01M7 15h.01M16 12h.01" }] : []),
  ];
  // Separate each pair of available benefits with the invitation to open the menu.
  const messages = [discover];
  benefits.forEach((benefit, index) => {
    if (index > 0 && index % 2 === 0) messages.push(discover);
    messages.push(benefit);
  });
  const slides = messages.length > 1 ? [...messages, messages[0]] : messages;
  const description = `Descubre más${benefits.length ? `: ${benefits.map(({ lead, label }) => `${lead} ${label}`).join(", ")}` : ""}`;
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
    <summary aria-label={description} title={description}>
      <span className="sf-catalogTools__window" aria-hidden="true">
        <span key={messages.map(message => message.theme).join("-")} className={`sf-catalogTools__track sf-catalogTools__track--${messages.length}`}>
          {slides.map((message, index) => <span className={`sf-catalogTools__label sf-catalogTools__label--${message.theme}`} key={`${message.theme}-${index}`}>
            <svg className="sf-catalogTools__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={message.icon} /></svg>
            <span className="sf-catalogTools__copy"><span>{message.lead}</span><strong>{message.label}</strong></span>
            <svg className="sf-catalogTools__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 4.5 3 3 3-3" /></svg>
          </span>)}
        </span>
      </span>
    </summary>
    <div onClick={event => { if (event.target.closest("button, a")) ref.current.open = false; }}>{children}</div>
  </details>;
}
