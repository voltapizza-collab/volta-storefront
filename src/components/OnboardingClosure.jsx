import React, { useEffect, useRef, useState } from 'react';
import api from '../setupAxios';
import { euro } from './OnboardingCommercial';
const paymentLabel = status => ({ CREATING: 'Preparando pago', PENDING: 'Pendiente de confirmación', PAID: 'Confirmado', EXPIRED: 'Enlace vencido', REFUND_PENDING: 'Devolución en trámite', REFUNDED: 'Devuelto', REVERSED: 'Requiere revisión por Volta' })[status] || status;

export const closureErrorText = code => ({
  invalid_sms_price: 'Introduce una tarifa SMS mayor que cero, con hasta cuatro decimales.',
  offer_changed: 'La oferta ha cambiado. Actualiza y revisa la nueva versión antes de continuar.',
  initial_payment_required: 'El pago todavía no está confirmado o ha vencido el plazo de firma.',
  prepayment_consent_required: 'Debes aceptar las condiciones del pago previo.',
  onboarding_payments_not_configured: 'El pago online aún no está habilitado. Contacta con Volta.',
  payment_reconciliation_required: 'Volta debe comprobar este pago antes de continuar. No vuelvas a pagarlo.',
  resolve_existing_payment_first: 'Resuelve el pago de la oferta actual antes de cambiarla.',
  closure_cancelled: 'Este cierre está cancelado o pendiente de resolución.',
  offer_approval_required: 'Confirma la revisión de la oferta.',
  invalid_pos_price: 'Introduce un precio del POS entre 1 y 10.000 €, con hasta dos decimales.',
  invalid_offer_amount: 'Revisa los importes de la oferta.',
  stock_confirmation_required: 'Confirma stock o una reposición con fecha comprometida antes de preparar la oferta.',
  delivery_date_required: 'Indica fechas de entrega válidas, desde hoy y con la fecha límite igual o posterior a la prevista.',
  delivery_offer_expired: 'El plazo de entrega de esta oferta ha vencido. Volta debe revisar el suministro antes de cobrar.',
  pricing_changed: 'Otro administrador ha actualizado la tarifa. Vuelve a abrir Onboarding antes de guardarla.',
  invalid_onboarding_defaults: 'Revisa los importes, los plazos y las condiciones generales. Los textos deben tener al menos 30 caracteres.',
  offer_text_required: 'Completa los textos de condiciones de la oferta.',
  email_send_in_progress: 'El correo se está enviando. Actualiza el expediente antes de reintentarlo.',
  offer_integrity_failed: 'La oferta no supera la comprobación de integridad. Volta debe revisar esta versión antes de continuar.',
})[code] || 'No se pudo confirmar la operación. Actualiza el estado antes de repetirla.';

export function ClosureDocument({ closure, compact = false }) {
  const { offer, payment } = closure;
  const download = () => {
    const content = `${offer.documentText}\n\nVersión: ${offer.id}\nSHA-256: ${offer.hash}\nEstado: ${closure.status}\n${closure.signed ? `Firma: ${closure.signerName || '-'} · ${closure.signedAt || '-'}\n` : ''}${payment?.paidAt ? `Pago: ${euro(payment.amountCents)}. ${payment.paidAt}. Justificante: ${payment.receipt || '-'}\n` : ''}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `volta-contrato-${offer.revision}.txt`; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="onb-commercialSummary">
    <h2>{closure.signed ? 'Tu contrato firmado' : 'Revisa tu contrato y el pago inicial'}</h2>
    <p>Versión {offer.revision}. Podrás conservar una copia antes de pagar.</p>
    <ul>{offer.lines.map(line => <li key={line.code}>{line.label}: <strong>{euro(line.amountCents)}</strong></li>)}</ul>
    <p><strong>Total inicial: {euro(offer.totalCents)}</strong></p>
    {offer.pos.priceChanged && <p role="alert">El precio del POS ha cambiado desde tu elección: de {euro(offer.pos.previousPriceCents)} a {euro(offer.pos.totalCents)}. Revisa el nuevo precio antes de aceptar y pagar.</p>}
    {offer.pos.mode !== 'RENT_QUOTE' && offer.pos.payments?.length > 1 && <p>Quedarán {offer.pos.payments.length - 1} cuotas mensuales: {offer.pos.payments.slice(1).map(euro).join(' · ')}.</p>}
    {offer.pos.mode === 'RENT_QUOTE' && <p>{offer.pos.durationMonths === 36 ? <>Renting: 36 mensualidades de {euro(offer.pos.firstCents)} · Total {euro(offer.pos.totalCents)}. El plazo empieza con la entrega operativa. El POS pertenece a Volta hasta finalizar los 36 meses y completar los pagos; entonces pasa a ser tuyo sin pago adicional.</> : <>Alquiler: {euro(offer.pos.firstCents)} al mes. Consulta las condiciones de esta versión.</>}</p>}
    {offer.pos.delivery && <p>Entrega prevista: {offer.pos.delivery.expected} · Fecha límite: {offer.pos.delivery.latest}. Suministro sujeto a stock; pagar o firmar no garantiza entrega inmediata.</p>}
    {compact ? <details className="onb-managerAdvanced"><summary>Leer contrato completo</summary><pre className="onb-closureDocument" tabIndex="0" aria-label="Contrato completo">{offer.documentText}</pre></details>
      : <pre className="onb-closureDocument" tabIndex="0" aria-label="Contrato completo">{offer.documentText}</pre>}
    <button type="button" onClick={download}>Descargar contrato y justificante</button>
    {payment && <p role="status">Estado del pago: {paymentLabel(payment.status)}. {payment.paidAt && <>Recibido: {euro(payment.amountCents)} · Justificante: {payment.receipt}</>}</p>}
    {closure.signatureDeadline && !closure.signed && <p>Plazo de firma: {new Date(closure.signatureDeadline).toLocaleString('es-ES')}.</p>}
    {closure.refundDueAt && !closure.signed && <p>Fecha límite para tramitar la devolución: {new Date(closure.refundDueAt).toLocaleDateString('es-ES')}.</p>}
  </section>;
}

export default function OnboardingClosure({ request, onUpdate }) {
  const [accepted, setAccepted] = useState(false), [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const working = useRef(false);
  const sequence = useRef(0);
  const c = request.closure, prefix = `/api/onboarding/form/${request.token}`;
  useEffect(() => { setAccepted(false); setSigned(false); }, [c.offer.hash]);
  const action = async (path, body = {}) => {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage('');
    sequence.current += 1;
    try {
      const { data } = await api.post(`${prefix}${path}`, { offerHash: c.offer.hash, ...body });
      if (data.request) onUpdate(data.request);
      if (data.url) {
        const target = new URL(data.url);
        if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') throw new Error('invalid_checkout_url');
        window.location.assign(target.href);
      } else if (data.pending) setMessage('Pago en proceso. Espera la confirmación y actualiza el estado.');
      return data;
    } catch (error) { setMessage(closureErrorText(error.response?.data?.error)); }
    finally { working.current = false; setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (working.current) return;
      const current = ++sequence.current;
      try { const { data } = await api.post(`${prefix}/closure/refresh`); if (active && current === sequence.current) onUpdate(data.request); }
      catch { if (active && current === sequence.current) setMessage('No se pudo actualizar el pago. Usa Actualizar estado antes de continuar.'); }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [prefix, onUpdate]);
  const cancelled = c.cancelRequested || ['CANCELLED','REFUNDED','REFUND_PENDING','REVERSED'].includes(c.status);
  return <main className="onb-page"><div className="onb-shell">
    <h1>{request.businessName} · Cierre de incorporación</h1>
    <ClosureDocument closure={c} />
    {!c.signed && <section className="onb-commercial">
      {!c.consented && !cancelled && <>
        <label className="onb-choice"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
          <span>He revisado el contrato completo y acepto las condiciones del pago previo, su importe, el plazo de firma y la devolución si no completo el alta.</span></label>
        <button type="button" disabled={!accepted || busy} onClick={() => action('/closure/consent', { accepted: true })}>Aceptar condiciones y continuar</button>
      </>}
      {c.consented && !cancelled && !c.overdue && !c.canSign && <>
        <button type="button" disabled={busy} onClick={() => action('/closure/checkout')}>Pagar {euro(c.offer.totalCents)} y continuar</button>
        {c.offer.pos.mode === 'PURCHASE' && <p>Si pagas en efectivo, Volta debe registrar el recibo y confirmar que recibió el importe completo. No necesitas pagar otra vez online.</p>}
      </>}
      {c.canSign && <>
        <p>Pago recibido. Ya puedes firmar.</p>
        <label className="onb-choice"><input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />
          <span>Acepto y firmo electrónicamente este contrato completo, y declaro que puedo representar al negocio.</span></label>
        <button type="button" disabled={!signed || busy} onClick={() => action('/sign-contract', { acceptedContract: true })}>Firmar contrato y preparar mi tienda</button>
      </>}
      {c.overdue && <p role="alert">Ha vencido el plazo de firma. El alta está bloqueada; Volta debe resolver la devolución del pago.</p>}
      {cancelled && <p role="status">Cancelación o devolución en seguimiento. La firma está bloqueada.</p>}
      <button type="button" disabled={busy} onClick={() => action('/closure/refresh')}>Actualizar estado</button>
      {!cancelled && <button type="button" disabled={busy} onClick={() => action('/closure/cancel')}>Solicitar cancelación antes del alta</button>}
    </section>}
    {c.signed && <p>Contrato firmado. {['FAILED', 'NOT_CONFIGURED'].includes(request.formalData?.credentialsNotification?.emailStatus)
      ? 'El correo de acceso no se ha entregado; Volta debe reenviarlo desde tu expediente. El contrato y el pago están conservados.'
      : 'Revisa tu correo para configurar el acceso.'} La tienda debe prepararse antes de abrir pedidos.</p>}
    {message && <p role="alert">{message}</p>}
  </div></main>;
}
