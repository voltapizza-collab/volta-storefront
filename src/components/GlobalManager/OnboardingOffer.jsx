import React, { useEffect, useRef, useState } from 'react';
import api from '../../setupAxios';
import { ClosureDocument, closureErrorText } from '../OnboardingClosure';
import { euro, smsTariff } from '../OnboardingCommercial';
import { termFields, asCents, amountInput } from './onboardingOfferFields';
import '../../styles/OnboardingManager.css';
export default function OnboardingOffer({ request, onUpdate }) {
  const [form, setForm] = useState({ generalTerms: '', equipmentTerms: '', settlementTerms: '', rent: '', deposit: '', sms: '', smsCredits: '', signatureDays: '', refundDays: '', approved: false,
    price: String((request.closure?.offer.pos.totalCents ?? request.formalData?.commercialSelection?.pos?.totalCents ?? request.commercialCatalog?.posTotalCents ?? 25000) / 100),
    stockStatus: '', deliveryExpected: '', deliveryLatest: '', supplyReference: '', supplyTerms: '', cancellationTerms: '' });
  const [receipt, setReceipt] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [sessionId, setSessionId] = useState(''), [refundId, setRefundId] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false), [reload, setReload] = useState(0), [packs, setPacks] = useState([]);
  const [smsPricing, setSmsPricing] = useState(null);
  const touched = useRef(new Set());
  const c = request.closure, rental = request.formalData?.commercialSelection?.pos?.mode === 'RENT_QUOTE';
  const smsSelection = request.formalData?.commercialSelection?.sms;
  const smsRequested = smsSelection?.initialRecharge !== 'SEPARATE' && smsSelection?.requested !== false;
  const base = `/api/onboarding/requests/${request.id}`;
  const change = key => e => {
    touched.current.add(key);
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(current => ({ ...current, approved: false, [key]: value,
      ...(key === 'deliveryExpected' && !touched.current.has('deliveryLatest') ? { deliveryLatest: value } : {}),
      ...(key === 'sms' ? { smsCredits: String(packs.find(pack => pack.cents === asCents(value))?.credits ?? '') } : {}),
    }));
  };
  useEffect(() => {
    const refresh = () => setReload(value => value + 1);
    window.addEventListener('volta:onboarding-defaults', refresh);
    return () => window.removeEventListener('volta:onboarding-defaults', refresh);
  }, []);
  useEffect(() => {
    if (!request.formalData?.commercialSelection || c?.signed) return;
    let live = true; setLoaded(false);
    api.get(`${base}/offer-draft`).then(({ data }) => {
      if (!live) return;
      const d = data.defaults || {}, values = { generalTerms: data.generalTerms || '',
        ...Object.fromEntries(termFields.map(([key]) => [key, d[key] || ''])),
        rent: amountInput(d.rentCents), deposit: amountInput(d.depositCents), sms: amountInput(d.smsCents),
        smsCredits: d.smsCredits == null ? '' : String(d.smsCredits),
        signatureDays: d.signatureDays == null ? '' : String(d.signatureDays), refundDays: d.refundDays == null ? '' : String(d.refundDays),
        supplyReference: d.supplyReference || `POS · expediente ${request.id}` };
      setForm(current => ({ ...current, ...Object.fromEntries(Object.entries(values).filter(([key]) => !touched.current.has(key))), approved: false }));
      setPacks(data.smsPackages || []); setLoaded(true);
      setSmsPricing(data.smsPricing || null);
    }).catch(() => { if (live) setMessage('No se pudieron cargar las condiciones generales. Vuelve a intentarlo.'); });
    return () => { live = false; };
  }, [base, reload, request.id, request.formalData?.commercialSelection, c]);
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
  const publish = e => {
    e.preventDefault();
    run('/offer', { ...form, replacesOfferHash: c?.offer.hash, posTotalCents: asCents(form.price), rentCents: asCents(form.rent), depositCents: asCents(form.deposit), smsCents: smsRequested ? asCents(form.sms) : 0,
      smsCredits: smsRequested ? Number(form.smsCredits) : 0, signatureDays: Number(form.signatureDays), refundDays: Number(form.refundDays) });
  };
  if (!request.formalData?.commercialSelection) return null;
  const canReplace = !c || !c.payment || ['EXPIRED','REFUNDED'].includes(c.payment.status);
  const count = rental ? 36 : request.formalData.commercialSelection.pos?.installmentCount || 1;
  const total = rental ? (asCents(form.rent) == null ? null : asCents(form.rent) * 36) : asCents(form.price);
  const first = rental ? asCents(form.rent) : total == null ? null : Math.round(total / count);
  const smsCents = smsRequested ? asCents(form.sms) : 0;
  const missing = [
    form.generalTerms.length < 200 && 'contrato base', form.equipmentTerms.length < 30 && 'condiciones del equipo',
    form.settlementTerms.length < 30 && 'liquidaciones', form.supplyTerms.length < 30 && 'condiciones de entrega',
    rental && !(asCents(form.rent) > 0) && 'cuota de renting', rental && asCents(form.deposit) == null && 'fianza',
    rental && form.cancellationTerms.length < 30 && 'cancelación del renting',
    smsRequested && !(asCents(form.sms) > 0 && Number(form.smsCredits) > 0) && 'paquete SMS',
    !Number(form.signatureDays) && 'plazo de firma', !Number(form.refundDays) && 'plazo de devolución',
  ].filter(Boolean);
  return <section className="onb-commercial" aria-label="Oferta y pago inicial">
    <h3>Oferta y cierre</h3>
    {c && <>
      <ClosureDocument closure={c} compact />
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
    {canReplace && !c?.signed && <form onSubmit={publish} className="onb-managerForm">
      <p>Revisa el resumen y confirma la entrega. Preparar la oferta no envía correo ni realiza cobros.</p>
      <div className="onb-offerOverview">
        <div><span>{rental ? 'Renting · 36 meses' : count > 1 ? `Compra · ${count} cuotas` : 'Compra al contado'}</span><strong>{euro(first)}{count > 1 ? '/mes' : ''}</strong><span>Total POS: {euro(total)} · IVA incluido</span></div>
        <div><span>Notificaciones SMS opcionales</span><strong>{euro(smsCents)}</strong><span>{!smsRequested ? 'Herramienta disponible · Recarga por separado' : form.smsCredits ? `${form.smsCredits} partes de SMS` : 'Paquete pendiente'}</span><span>{smsTariff(smsSelection?.unitPriceEur ? smsSelection : smsPricing)}</span></div>
        <div><span>Primer pago total</span><strong>{euro(first != null && smsCents != null && (!rental || asCents(form.deposit) != null) ? first + smsCents + (rental ? asCents(form.deposit) : 0) : null)}</strong><span>POS{smsRequested ? ' + SMS' : ''}{rental && Number(form.deposit) > 0 ? ' + fianza' : ''}</span></div>
      </div>
      {!rental && count > 1 && total != null && <p>Sin intereses: {count - 1} cuotas de {euro(first)} y una última de {euro(total - first * (count - 1))}.</p>}
      {rental && <p>36 mensualidades · Total: {euro(total)}. Desde la entrega operativa; propiedad de Volta hasta finalizar el plazo y completar los pagos, sin importe residual.</p>}
      {!loaded && !c && <p role="status">Cargando condiciones…</p>}
      {loaded && missing.length > 0 && <div className="onb-managerNotice" role="status">Completa una vez la configuración general: {missing.join(', ')}.
        <button type="button" onClick={() => { window.dispatchEvent(new Event('volta:configure-onboarding')); document.getElementById('onboarding-defaults')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Configurar condiciones generales</button>
      </div>}
      <div className="onb-managerGrid">
      <label>Disponibilidad del POS<select required value={form.stockStatus} onChange={change('stockStatus')}>
        <option value="">Seleccionar disponibilidad</option><option value="WAITING">Sin stock ni fecha confirmada: en espera</option>
        <option value="IN_STOCK">Stock confirmado</option><option value="REPLENISHMENT">Reposición con fecha comprometida</option>
      </select></label>
      {['IN_STOCK','REPLENISHMENT'].includes(form.stockStatus) && <label>Entrega prevista<input required type="date" value={form.deliveryExpected} onChange={change('deliveryExpected')} /></label>}
      </div>
      {form.stockStatus === 'WAITING' && <p role="status">El expediente debe esperar. No se puede preparar una oferta para pago hasta confirmar el suministro.</p>}
      <p>Las tres modalidades están sujetas a stock. El contado pagado tiene prioridad entre asignaciones pendientes, respetando las entregas ya comprometidas.</p>
      <details className="onb-managerAdvanced"><summary>Ajustar importes o entrega de este expediente</summary><div className="onb-managerGrid">
        {!rental && <label>Precio del POS, IVA incluido (€)<input required inputMode="decimal" value={form.price} onChange={change('price')} /></label>}
        {rental && <><label>Renting mensual, IVA incluido (€)<input required inputMode="decimal" value={form.rent} onChange={change('rent')} /></label>
          <label>Fianza reembolsable (€; 0 si no se exige)<input required inputMode="decimal" value={form.deposit} onChange={change('deposit')} /></label></>}
        {smsRequested && <label>Paquete inicial de SMS<select value={form.sms} onChange={change('sms')}><option value="">Seleccionar paquete</option>
          {form.sms && !packs.some(pack => String(pack.cents / 100) === form.sms) && <option value={form.sms}>{euro(asCents(form.sms))} · {form.smsCredits} partes de SMS</option>}
          {packs.map(pack => <option key={pack.cents} value={String(pack.cents / 100)}>{euro(pack.cents)} · {pack.credits} partes de SMS</option>)}</select></label>}
        <label>Fecha límite de entrega<input required type="date" min={form.deliveryExpected} value={form.deliveryLatest} onChange={change('deliveryLatest')} /></label>
        <label>Referencia de asignación o suministro<input required minLength="3" maxLength="200" value={form.supplyReference} onChange={change('supplyReference')} /></label>
      </div></details>
      <details className="onb-managerAdvanced"><summary>Revisar contrato y condiciones cargadas</summary>
        <label>Contrato general completo<textarea required rows="6" minLength="200" value={form.generalTerms} onChange={change('generalTerms')} /></label>
        {termFields.filter(([key]) => rental || key !== 'cancellationTerms').map(([key, label]) => <label key={key}>{label}<textarea required rows="3" minLength="30" value={form[key]} onChange={change(key)} /></label>)}
        <div className="onb-managerGrid"><label>Días para firmar después del pago<input type="number" required min="1" max="60" value={form.signatureDays} onChange={change('signatureDays')} /></label>
          <label>Máximo de días para tramitar la devolución antes del alta<input type="number" required min="1" max="30" value={form.refundDays} onChange={change('refundDays')} /></label></div>
      </details>
      <label className="onb-choice"><input type="checkbox" required checked={form.approved} onChange={change('approved')} />He revisado y aprobado los importes, el contrato, los plazos y las condiciones de esta oferta.</label>
      <button type="submit" disabled={busy || !loaded || missing.length > 0 || !form.approved || !['IN_STOCK', 'REPLENISHMENT'].includes(form.stockStatus)}>Preparar oferta completa</button>
    </form>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
