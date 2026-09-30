import "../../styles/DeliveryMethodSelector.css";

function DeliveryLine({ children, className = "" }) {
  return (
    <span className={`sf-deliveryChoice__line ${className}`}>
      <span className="sf-deliveryChoice__text">{children}</span>
      <span className="sf-deliveryChoice__change">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5" />
        </svg>
      </span>
    </span>
  );
}

export default function DeliveryMethodSelector({ serviceMode, destination, onChange }) {
  const caption = serviceMode === "delivery" ? "Enviaremos tu pedido a:" : "Pedido a recoger en:";
  const description = `${caption} ${destination}`;

  return (
    <button
      type="button"
      className="sf-deliveryChoice"
      onClick={onChange}
      aria-label={`Cambiar método de entrega. ${description}`}
      title={`${description}. Cambiar método de entrega`}
    >
      <span className="sf-deliveryChoice__window" aria-hidden="true">
        <span className="sf-deliveryChoice__track" key={description}>
          <DeliveryLine>{caption}</DeliveryLine>
          <DeliveryLine>{destination}</DeliveryLine>
          <DeliveryLine className="sf-deliveryChoice__repeat">{caption}</DeliveryLine>
        </span>
      </span>
      <span className="sf-deliveryChoice__static" aria-hidden="true">
        <DeliveryLine>{description}</DeliveryLine>
      </span>
    </button>
  );
}
