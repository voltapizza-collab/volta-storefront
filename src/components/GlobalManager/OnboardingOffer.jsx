import React, { useEffect, useRef, useState } from 'react';
import api from '../../setupAxios';
import { ClosureDocument, closureErrorText } from '../OnboardingClosure';
import { euro } from '../OnboardingCommercial';
import '../../styles/OnboardingManager.css';

export default function OnboardingOffer({ request, onUpdate }) {
  const [review, setReview] = useState(null), [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [reload, setReload] = useState(0), [receipt, setReceipt] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const working = useRef(false);
  const c = request.closure, base = `/api/onboarding/requests/${request.id}`;
  const activated = request.status === 'ACTIVATED' || c?.status === 'SIGNED';
  useEffect(() => {
    const refresh = () => { setApproved(false); setReload(n => n + 1); };
    window.addEventListener('volta:onboarding-defaults', refresh);
    return () => window.removeEventListener('volta:onboarding-defaults', refresh);
  }, []);
  useEffect(() => {
    if (c || !request.submittedAt || !request.formalData?.commercialSelection) return;
    let live = true; setReview(null); setApproved(false); setError('');
    api.get(`${base}/review-contract`).then(({ data }) => { if (live) setReview(data); })
      .catch(e => { if (live) setError(e.response?.data?.error || 'review_load_failed'); });
    return () => { live = false; };
  }, [base, c, reload, request.submittedAt, request.formalData?.commercialSelection]);
  const run = async (path, body = {}) => {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage('');
    try {
      const { data } = await api.post(`${base}${path}`, body);
      if (data.request) onUpdate(data.request);
      if (path.endsWith('/send')) {
        const notice = path === '/credentials/send' ? data.request?.formalData?.credentialsNotification : data.request?.formalData?.contractNotification;
        setMessage(notice?.emailStatus === 'SENT' ? 'Correo enviado.' : 'El correo no se ha enviado. Puedes reintentarlo desde este expediente.');
      }
    } catch (e) {
      setMessage(closureErrorText(e.response?.data?.error));
      if (e.response?.data?.error === 'review_changed') { setApproved(false); setReload(n => n + 1); }
    } finally { working.current = false; setBusy(false); }
  };
  if (!c && !request.submittedAt) return null;
  const cancelled = c?.cancelRequested || ['CANCELLED','REFUNDED','REFUND_PENDING','REVERSED'].includes(c?.status);
  return <section className="onb-commercial" aria-label="Revisión y pago">
    <h3>Revisión y pago</h3>
    {!c && <>
      <p>Revisa los datos, los documentos y el contrato. La modalidad y los importes corresponden a la elección del comercio.</p>
      {review && <ClosureDocument closure={{ offer: review.offer }} compact />}
      {!review && !error && <p role="status">Cargando contrato…</p>}
      {error && <p role="alert">{closureErrorText(error)} <button type="button" onClick={() => setReload(n => n + 1)}>Volver a cargar</button></p>}
      {error === 'rent_price_required' && <button type="button" onClick={() => { window.dispatchEvent(new Event('volta:configure-onboarding')); document.getElementById('onboarding-defaults')?.scrollIntoView({ behavior: 'smooth' }); }}>Configurar tarifa de renting</button>}
      <label className="onb-choice"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />He revisado los datos, los documentos y el contrato, y confirmo que Volta puede suministrar el POS.</label>
      <button type="button" disabled={busy || !review || !approved} onClick={() => run('/contract/send', { reviewApproved: true, stockConfirmed: true, reviewFingerprint: review.fingerprint })}>Enviar correo de pago</button>
      <p>El comercio firmará y pagará desde el enlace. Al confirmarse el cobro se preparará el alta y se enviarán automáticamente los accesos, el QR y las instrucciones.</p>
    </>}
    {c && <>
      <ClosureDocument closure={c} compact />
      {!activated && !cancelled && <p role="status">{c.payment?.status === 'PAID' ? 'Pago confirmado. Preparando el alta y el correo de bienvenida.' : c.signed ? 'Contrato firmado. Pendiente de pago.' : 'Pendiente de firma y pago del comercio.'}</p>}
      {!activated && !cancelled && c.payment?.status !== 'PAID' && <button type="button" disabled={busy} onClick={() => run('/contract/send')}>Reenviar correo de pago</button>}
      {activated && <>
        <p>Correo de bienvenida: {request.formalData?.credentialsNotification?.emailStatus || 'Pendiente'}.</p>
        <button type="button" disabled={busy} onClick={() => run('/credentials/send')}>Reenviar bienvenida y acceso</button>
      </>}
      {!activated && (c.signed || c.consented) && !cancelled && c.offer.pos.mode === 'PURCHASE' && (!c.payment || c.payment.status === 'EXPIRED') && <details>
        <summary>Registrar pago en efectivo</summary>
        <label>Referencia del recibo<input value={receipt} onChange={e => setReceipt(e.target.value)} /></label>
        <label className="onb-choice"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo haber recibido {euro(c.offer.totalCents)} y registrado el recibo.</label>
        <button type="button" disabled={busy || !confirmed || receipt.trim().length < 3} onClick={() => run('/cash-payment', { offerHash: c.offer.hash, receipt, confirmReceived: true })}>Confirmar efectivo recibido</button>
      </details>}
      {c.payment?.method === 'STRIPE' && <button type="button" disabled={busy} onClick={() => run('/reconcile-payment')}>Comprobar pago y completar alta</button>}
      {!activated && (c.cancelRequested || c.overdue) && <details><summary>Resolver cancelación</summary>
        <label>Recibo de devolución en efectivo, si corresponde<input value={receipt} onChange={e => setReceipt(e.target.value)} /></label>
        <label className="onb-choice"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo la devolución de {euro(c.offer.totalCents)}; si fue en efectivo, ya he devuelto el dinero.</label>
        <button type="button" disabled={busy || !confirmed || (c.payment?.method === 'CASH' && receipt.trim().length < 3)} onClick={() => run('/resolve-cancellation', { offerHash: c.offer.hash, cashReceipt: receipt, confirmRefund: true })}>Resolver cancelación y devolver pago</button>
      </details>}
    </>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
