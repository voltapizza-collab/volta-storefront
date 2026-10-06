import React, { useEffect, useRef, useState } from 'react';
import api from '../setupAxios';
import { euro } from './OnboardingCommercial';
const paymentLabel = status => ({ CREATING: 'Preparando pago', PENDING: 'Pendiente de confirmación', PAID: 'Confirmado', EXPIRED: 'Enlace vencido', REFUND_PENDING: 'Devolución en trámite', REFUNDED: 'Devuelto', REVERSED: 'Requiere revisión por Volta' })[status] || status;

export const closureErrorText = code => ({
  review_confirmation_required: 'Confirma la revisión de los datos, los documentos, el contrato y el suministro del POS.',
  review_changed: 'El contrato ha cambiado. Revisa la versión actualizada antes de enviarla.',
  review_load_failed: 'No se pudo cargar el contrato. Vuelve a intentarlo.',
  rent_price_required: 'Falta definir la cuota de renting en las tarifas vigentes. Se configura una vez en Global Manager.',
  invalid_rental_months: 'Revisa el plazo del renting: debe ser un número entero de meses, con un máximo de 36.',
  rental_selection_changed: 'Los importes del renting deben coincidir con el plazo y la cuota elegidos por el comercio.',
  submitted_selection_required: 'El comercio debe enviar primero sus datos y su elección de pago.',
  contract_signature_required: 'Firma el contrato antes de continuar al pago.',
  welcome_delivery_failed: 'El pago está conservado. Se reintentará completar el alta y enviar el correo de acceso.',
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
    {offer.pos.mode === 'RENT_QUOTE' && <p>{Number.isInteger(offer.pos.durationMonths) && offer.pos.durationMonths >= 1 && offer.pos.durationMonths <= 36 ? <>Renting: {offer.pos.durationMonths} mensualidades de {euro(offer.pos.firstCents)} · Total {euro(offer.pos.totalCents)}. El plazo empieza con la entrega operativa. El POS pertenece a Volta hasta finalizar los {offer.pos.durationMonths} meses y completar los pagos; entonces pasa a ser tuyo sin pago adicional.</> : <>Alquiler: {euro(offer.pos.firstCents)} al mes. Consulta las condiciones de esta versión.</>}</p>}
    {offer.pos.delivery && <p>Entrega prevista: {offer.pos.delivery.expected} · Fecha límite: {offer.pos.delivery.latest}. Suministro sujeto a stock; pagar o firmar no garantiza entrega inmediata.</p>}
    {compact ? <details className="onb-managerAdvanced"><summary>Leer contrato completo</summary><pre className="onb-closureDocument" tabIndex="0" aria-label="Contrato completo">{offer.documentText}</pre></details>
      : <pre className="onb-closureDocument" tabIndex="0" aria-label="Contrato completo">{offer.documentText}</pre>}
    <button type="button" onClick={download}>{payment?.paidAt ? 'Descargar contrato y justificante' : 'Descargar contrato'}</button>
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
  const first = c.offer.workflow === 'SIGN_PAY_ACTIVATE';
  const activated = c.activated || request.status === 'ACTIVATED' || c.status === 'SIGNED';
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
    <h1>{request.businessName} · Contrato y pago</h1>
    <ClosureDocument closure={c} />
    {!activated && <section className="onb-commercial">
      {!first && !c.consented && !cancelled && <>
        <label className="onb-choice"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
          <span>He revisado el contrato completo y acepto las condiciones del pago previo, su importe, el plazo de firma y la devolución si no completo el alta.</span></label>
        <button type="button" disabled={!accepted || busy} onClick={() => action('/closure/consent', { accepted: true })}>Aceptar condiciones y continuar</button>
      </>}
      {c.consented && (!first || c.signed) && !cancelled && !c.overdue && !c.canSign && c.payment?.status !== 'PAID' && <>
        {first && <p>Contrato firmado. Completa el pago para recibir tu acceso y el QR.</p>}
        <button type="button" disabled={busy} onClick={() => action('/closure/checkout')}>Pagar {euro(c.offer.totalCents)} y continuar</button>
        {c.offer.pos.mode === 'PURCHASE' && <p>Si pagas en efectivo, Volta debe registrar el recibo y confirmar que recibió el importe completo. No necesitas pagar otra vez online.</p>}
      </>}
      {c.canSign && !cancelled && <>
        <p>{first ? 'Firma el contrato y después completa el pago inicial.' : 'Pago recibido. Ya puedes firmar.'}</p>
        <label className="onb-choice"><input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />
          <span>Acepto y firmo electrónicamente este contrato completo, y declaro que puedo representar al negocio.</span></label>
        <button type="button" disabled={!signed || busy} onClick={() => action('/sign-contract', { acceptedContract: true })}>{first ? 'Firmar contrato y continuar al pago' : 'Firmar contrato y preparar mi tienda'}</button>
      </>}
      {c.overdue && <p role="alert">Ha vencido el plazo de firma. El alta está bloqueada; Volta debe resolver la devolución del pago.</p>}
      {cancelled && <p role="status">Cancelación o devolución en seguimiento. La firma está bloqueada.</p>}
      {first && c.payment?.status === 'PAID' && !cancelled && <p role="status">Pago confirmado. Estamos preparando tu acceso y el correo de bienvenida con el QR. No necesitas volver a pagar.</p>}
      <button type="button" disabled={busy} onClick={() => action('/closure/refresh')}>Actualizar estado</button>
      {!cancelled && <button type="button" disabled={busy} onClick={() => action('/closure/cancel')}>Solicitar cancelación antes del alta</button>}
    </section>}
    {activated && <p>Contrato firmado y pago confirmado. {['FAILED', 'NOT_CONFIGURED'].includes(request.formalData?.credentialsNotification?.emailStatus)
      ? 'El correo de acceso no se ha entregado; Volta debe reenviarlo desde tu expediente. El contrato y el pago están conservados.'
      : 'Revisa tu correo para configurar el acceso.'} La tienda debe prepararse antes de abrir pedidos.</p>}
    {message && <p role="alert">{message}</p>}
  </div></main>;
}
