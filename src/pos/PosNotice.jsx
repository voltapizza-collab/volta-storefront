import { useCallback, useEffect, useRef, useState } from 'react';

export function usePosNotice() {
  const [message, update] = useState('');
  const dismissed = useRef('');
  const setMessage = useCallback(value => {
    if (!value) dismissed.current = '';
    if (!value || value !== dismissed.current) update(value);
  }, []);
  const dismiss = useCallback(() => {
    update(current => { dismissed.current = current; return ''; });
  }, []);
  return [message, setMessage, dismiss];
}

export default function PosNotice({ message, onDismiss }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (message && !dialog.current.open) dialog.current.showModal();
    if (!message && dialog.current.open) dialog.current.close();
  }, [message]);
  return <dialog ref={dialog} className="pos-noticeDialog" aria-label="Aviso de Volta"
    onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <header><h2>Aviso de Volta</h2><button type="button" aria-label="Cerrar aviso" onClick={onDismiss}>×</button></header>
    <p>{message}</p>
    <button type="button" className="pos-noticeClose" onClick={onDismiss}>Cerrar</button>
  </dialog>;
}
