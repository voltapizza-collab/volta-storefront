import { useEffect, useRef, useState } from 'react';

export default function PosLogoutDialog({ onCancel, onConfirm }) {
  const dialog = useRef(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="pos-noticeDialog pos-logoutDialog"
      aria-labelledby="pos-logout-title" aria-describedby="pos-logout-description"
      onCancel={event => { event.preventDefault(); if (!submitting.current) onCancel(); }}>
      <h2 id="pos-logout-title">¿Cerrar sesión del POS?</h2>
      <p id="pos-logout-description">
        Dejarás de recibir avisos de pedidos en este terminal hasta que vuelvas a entrar.
        La tienda seguirá con su estado actual. Recuerda tener a mano tu usuario y el PIN de tienda de 6 dígitos.
      </p>
      <div className="pos-logoutActions">
        <button type="button" className="pos-button--secondary" autoFocus disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className="pos-noticeClose" disabled={busy} onClick={confirm}>
          {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </dialog>
  );
}
