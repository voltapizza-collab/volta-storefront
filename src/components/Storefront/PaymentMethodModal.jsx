import { useEffect, useId, useRef } from "react";
import "../../styles/PaymentMethods.css";

export default function PaymentMethodModal({ methods, total, busy, onClose, onSelect }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => {
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
        else document.querySelector("[data-payment-picker]")?.focus();
      });
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !busy) {
      event.stopPropagation();
      onClose();
    }
    if (event.key !== "Tab") return;
    const buttons = [...dialogRef.current.querySelectorAll("button:not(:disabled)")];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  };

  return (
    <div className="sf-modalOverlay sf-paymentMethodOverlay" onClick={() => !busy && onClose()}>
      <div ref={dialogRef} className="sf-modalCard sf-paymentMethodModal" role="dialog" aria-modal="true"
        aria-labelledby={titleId} onKeyDown={handleKeyDown} onClick={(event) => event.stopPropagation()}>
        <div className="sf-cartModalHead">
          <div><span>Método de pago</span><h3 id={titleId}>¿Cómo quieres pagar?</h3></div>
          <button type="button" className="sf-modalCloseBtn" onClick={onClose} disabled={busy} aria-label="Cerrar">×</button>
        </div>
        <div className="sf-paymentMethodGrid">
          {methods.map((method) => (
            <button key={method.id} type="button"
              className={`sf-paymentMethodCard sf-paymentMethodCard--${method.id} ${method.ready ? "is-ready" : "is-disabled"}`}
              onClick={() => onSelect(method)} disabled={busy || !method.ready}>
              <span className="sf-paymentMethodMark" aria-hidden="true">{method.icon}</span>
              <span className="sf-paymentMethodCopy"><strong>{method.title}</strong><small>{method.description}</small></span>
              {!method.ready && <em>Próximamente</em>}
            </button>
          ))}
        </div>
        <div className="sf-paymentMethodTotal"><span>Total</span><strong>{total}</strong></div>
      </div>
    </div>
  );
}
