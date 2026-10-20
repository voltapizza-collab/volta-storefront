import "../../styles/OrderModeConfirmation.css";

export default function OrderModeConfirmation({ serviceMode, address, addressLine2, storeName, onChange, busy, issue }) {
  const delivery = serviceMode === "delivery";
  return (
    <section className={`sf-orderMode sf-orderMode--${delivery ? "delivery" : "pickup"}`} aria-label="Modalidad del pedido">
      <div aria-live="polite" aria-atomic="true">
        <div className="sf-orderMode__summary">
          <svg className="sf-orderMode__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {delivery ? <><path d="M3 5h11v12H3zM14 9h4l3 4v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></> : <><path d="M3 10h18l-2-6H5l-2 6ZM5 10v10h14V10M9 20v-6h6v6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0" /></>}
          </svg>
          <div className="sf-orderMode__heading">
            <span className="sf-orderMode__eyebrow">MODALIDAD DE TU PEDIDO</span>
            <strong className="sf-orderMode__title">{delivery ? "ENTREGA" : "RECOGIDA"}{" "}<span>{delivery ? "A DOMICILIO" : "EN TIENDA"}</span></strong>
          </div>
        </div>
        <div className="sf-orderMode__copy">
          <p>{delivery ? "Tu pedido será entregado en:" : "Tendrás que recoger tu pedido en:"}</p>
          {!delivery && <strong className="sf-orderMode__destination">{storeName}</strong>}
          <span className="sf-orderMode__destination">{address || "Dirección pendiente de confirmar"}</span>
          {delivery && addressLine2 && <span className="sf-orderMode__destination">{addressLine2}</span>}
          {issue && <p className="sf-orderMode__issue" role="alert">{issue}</p>}
        </div>
      </div>
      <button type="button" className="sf-orderMode__change" onClick={onChange} disabled={busy}>Cambiar modalidad</button>
    </section>
  );
}
