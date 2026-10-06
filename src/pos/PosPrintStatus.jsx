import { useRef, useState } from 'react';
import { nativeCall } from './nativeBridge';

export function usePosPrinting() {
  const pending = useRef(false);
  const [status, setStatus] = useState(null);
  const print = async (operation, payload, confirmation) => {
    if (pending.current) return;
    pending.current = true;
    const orderId = payload.orderId ?? null;
    setStatus({ orderId, phase: 'printing', text: 'Imprimiendo ticket…' });
    try {
      await nativeCall(operation, payload);
      setStatus({ orderId, phase: 'success', text: confirmation });
    } catch (_) {
      setStatus({ orderId, phase: 'error', text: 'Impresión sin confirmar. Comprueba papel y ticket antes de repetir.' });
    } finally {
      pending.current = false;
    }
  };
  return [status, print];
}

export default function PosPrintStatus({ status }) {
  return <p className={`pos-printStatus pos-printStatus--${status?.phase || 'idle'}`}
    role="status" aria-live="polite" aria-atomic="true">{status?.text || ''}</p>;
}
