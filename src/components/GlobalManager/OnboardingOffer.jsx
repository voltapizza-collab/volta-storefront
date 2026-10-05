import React, { useState } from 'react';
import api from '../../setupAxios';
import { ClosureDocument, closureErrorText } from '../OnboardingClosure';
import { euro } from '../OnboardingCommercial';
const asCents = input => /^\d+(?:[.,]\d{1,2})?$/.test(input) ? Math.round(Number(input.replace(',', '.')) * 100) : null;
export default function OnboardingOffer({ request, onUpdate }) {
  const [form, setForm] = useState({ generalTerms: '', equipmentTerms: '', settlementTerms: '', rent: '', deposit: '', sms: '', smsCredits: '', signatureDays: '', refundDays: '', approved: false,
    price: String((request.closure?.offer.pos.totalCents ?? request.formalData?.commercialSelection?.pos?.totalCents ?? request.commercialCatalog?.posTotalCents ?? 25000) / 100),
    stockStatus: '', deliveryExpected: '', deliveryLatest: '', supplyReference: '', supplyTerms: '', cancellationTerms: '' });
  const [receipt, setReceipt] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [sessionId, setSessionId] = useState(''), [refundId, setRefundId] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const c = request.closure, rental = request.formalData?.commercialSelection?.pos?.mode === 'RENT_QUOTE';
  const base = `/api/onboarding/requests/${request.id}`;
  const change = key => e => setForm(current => ({ ...current, approved: false, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const run = async (path, body) => {
    if (busy) return; setBusy(true); setMessage('');
    try { const { data } = await api.post(`${base}${path}`, body); if (data.request) onUpdate(data.request);
      if (path.endsWith('/send')) {
        const notice = path === '/credentials/send' ? data.request?.formalData?.credentialsNotification : data.request?.formalData?.contractNotification;
        setMessage(notice?.emailStatus === 'SENT' ? 'Correo enviado.' : 'El correo no se ha enviado. Revisa su estado y la configuración antes de reintentar.');
      }
    }
    catch (e) { setMessage(closureErrorText(e.response?.data?.error)); }
    finally { setBusy(false); }
  };
  const draft = async () => {
    setBusy(true);
    try { const { data } = await api.get(`${base}/offer-draft`); setForm(current => ({ ...current, generalTerms: data.generalTerms, approved: false })); }
    catch { setMessage('No se pudo cargar el borrador.'); } finally { setBusy(false); }
  };
  const publish = e => {
    e.preventDefault();
    run('/offer', { ...form, replacesOfferHash: c?.offer.hash, posTotalCents: asCents(form.price), rentCents: asCents(form.rent), depositCents: asCents(form.deposit), smsCents: asCents(form.sms),
      smsCredits: Number(form.smsCredits), signatureDays: Number(form.signatureDays), refundDays: Number(form.refundDays) });
  };
  if (!request.formalData?.commercialSelection) return null;
  const canReplace = !c || !c.payment || ['EXPIRED','REFUNDED'].includes(c.payment.status);
  return <section className="onb-commercial" aria-label="Oferta y pago inicial">
    <h3>Oferta y cierre</h3>
    {c && <>
      <ClosureDocument closure={c} />
      {c.overdue && !c.signed && <p role="alert">Pagado sin firma: plazo vencido. Tramita la devolución antes de {new Date(c.refundDueAt).toLocaleDateString('es-ES')}.</p>}
      {c.status === 'OFFERED' && <button type="button" disabled={busy} onClick={() => run('/contract/send', {})}>Enviar correo de cierre</button>}
      {c.signed && <><p>Correo de bienvenida: {request.formalData?.credentialsNotification?.emailStatus || 'Pendiente'}.</p>
        <p>Reenviar genera una nueva invitación para crear contraseña; no vuelve a cobrar ni recarga SMS. El PIN existente se gestiona desde el backoffice.</p>
        <button type="button" disabled={busy} onClick={() => run('/credentials/send', {})}>Reenviar bienvenida y acceso</button></>}
      {(c.consented || c.cancelRequested || c.overdue) && !c.signed && <>
        <label>Referencia del recibo de efectivo<input value={receipt} onChange={e => setReceipt(e.target.value)} /></label>
        <label className="onb-choice"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
          {c.cancelRequested || c.overdue ? `Confirmo tramitar la devolución de ${euro(c.offer.totalCents)}; si fue en efectivo, ya he devuelto el dinero y registrado el recibo.` : `Confirmo haber recibido ${euro(c.offer.totalCents)} en efectivo y registrado su recibo.`}</label>
        {!c.payment && c.offer.pos.mode === 'PURCHASE' && <button type="button" disabled={busy || !confirmed || receipt.length < 3}
          onClick={() => run('/cash-payment', { offerHash: c.offer.hash, receipt, confirmReceived: true })}>Confirmar efectivo recibido</button>}
      </>}
      {!c.signed && (c.cancelRequested || c.overdue) && <button type="button" disabled={busy || !confirmed || (c.payment?.method === 'CASH' && receipt.length < 3)}
        onClick={() => run('/resolve-cancellation', { offerHash: c.offer.hash, cashReceipt: receipt, confirmRefund: true })}>Resolver cancelación y devolver pago</button>}
      {c.payment?.method === 'STRIPE' && <details><summary>Comprobar o recuperar una operación de Stripe</summary>
        <label>Sesión Stripe (si no quedó registrada)<input value={sessionId} onChange={e => setSessionId(e.target.value)} /></label>
        <label>Devolución Stripe (si no quedó registrada)<input value={refundId} onChange={e => setRefundId(e.target.value)} /></label>
        <button type="button" disabled={busy} onClick={() => run('/reconcile-payment', { sessionId: sessionId || undefined, refundId: refundId || undefined })}>Comprobar con Stripe</button>
      </details>}
    </>}
    {canReplace && !c?.signed && <form onSubmit={publish} className="onb-offerForm">
      <p>Rellena solo condiciones aprobadas. No se enviará correo ni se cobrará al preparar la oferta.</p>
      <h4>Condiciones del POS</h4>
      {!rental && <label>Precio del POS, IVA incluido (€)<input required inputMode="decimal" value={form.price} onChange={change('price')} /></label>}
      {!rental && <p>Este precio se guarda solo en la oferta de este comercio. Las cuotas se calculan sobre el total; cualquier cambio se mostrará al cliente antes de pagar.</p>}
      <label>Disponibilidad del POS<select required value={form.stockStatus} onChange={change('stockStatus')}>
        <option value="">Seleccionar disponibilidad</option><option value="WAITING">Sin stock ni fecha confirmada: en espera</option>
        <option value="IN_STOCK">Stock confirmado</option><option value="REPLENISHMENT">Reposición con fecha comprometida</option>
      </select></label>
      {form.stockStatus === 'WAITING' && <p role="status">El expediente debe esperar. No se puede preparar una oferta para pago hasta confirmar el suministro.</p>}
      <label>Referencia de asignación o suministro<input required minLength="3" maxLength="200" value={form.supplyReference} onChange={change('supplyReference')} /></label>
      <label>Entrega prevista<input required type="date" value={form.deliveryExpected} onChange={change('deliveryExpected')} /></label>
      <label>Fecha límite de entrega<input required type="date" min={form.deliveryExpected} value={form.deliveryLatest} onChange={change('deliveryLatest')} /></label>
      <label>Condiciones aprobadas ante retraso: nueva fecha, cancelación y devolución<textarea required minLength="30" rows="3" value={form.supplyTerms} onChange={change('supplyTerms')} /></label>
      <p>Las tres modalidades están sujetas a stock. El contado pagado tiene prioridad entre asignaciones pendientes, respetando las entregas ya comprometidas.</p>
      <button type="button" disabled={busy} onClick={draft}>Cargar contrato base para revisar</button>
      <label>Contrato general completo<textarea required rows="10" minLength="200" value={form.generalTerms} onChange={change('generalTerms')} /></label>
      <label>Condiciones del equipo: propiedad, entrega, cuotas o renta, devolución, daños y extravío<textarea required rows="4" minLength="30" value={form.equipmentTerms} onChange={change('equipmentTerms')} /></label>
      <label>Calendario y condiciones de liquidación del 90 %<textarea required rows="3" minLength="30" value={form.settlementTerms} onChange={change('settlementTerms')} /></label>
      {rental && <><label>Renting mensual, IVA incluido (€)<input required inputMode="decimal" value={form.rent} onChange={change('rent')} /></label>
        <p>36 mensualidades · Total: {euro(asCents(form.rent) === null ? null : asCents(form.rent) * 36)}. Inicio en la entrega operativa. Propiedad de Volta durante los 36 meses y transmisión al concluir el plazo y completar los pagos, sin importe residual.</p>
        <label>Condiciones aprobadas de cancelación anticipada del renting<textarea required minLength="30" rows="3" value={form.cancellationTerms} onChange={change('cancellationTerms')} /></label>
        <p>Introduce la cuota aprobada y revisa el tratamiento fiscal de la transmisión final antes de preparar la oferta.</p>
        <label>Fianza reembolsable (€; 0 si no se exige)<input required inputMode="decimal" value={form.deposit} onChange={change('deposit')} /></label></>}
      <label>Recarga inicial SMS, IVA incluido (€)<input required inputMode="decimal" value={form.sms} onChange={change('sms')} /></label>
      <label>Segmentos SMS incluidos<input type="number" required min="1" max="100000" value={form.smsCredits} onChange={change('smsCredits')} /></label>
      <label>Días para firmar después del pago<input type="number" required min="1" max="60" value={form.signatureDays} onChange={change('signatureDays')} /></label>
      <label>Máximo de días para tramitar la devolución antes del alta<input type="number" required min="1" max="30" value={form.refundDays} onChange={change('refundDays')} /></label>
      <label className="onb-choice"><input type="checkbox" required checked={form.approved} onChange={change('approved')} />He revisado y aprobado los importes, el contrato, los plazos y las condiciones de esta oferta.</label>
      <button type="submit" disabled={busy || !form.approved || !['IN_STOCK', 'REPLENISHMENT'].includes(form.stockStatus)}>Preparar oferta completa</button>
    </form>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
