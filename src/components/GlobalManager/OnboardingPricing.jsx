import React, { useEffect, useState } from 'react';
import api from '../../setupAxios';
import { closureErrorText } from '../OnboardingClosure';
import { euro } from '../OnboardingCommercial';
import { termFields, asCents, amountInput } from './onboardingOfferFields';
import '../../styles/OnboardingManager.css';

export default function OnboardingPricing() {
  const [pricing, setPricing] = useState(null), [price, setPrice] = useState('');
  const [defaults, setDefaults] = useState({}), [packs, setPacks] = useState([]);
  const [smsPriceInput, setSmsPriceInput] = useState('');
  const [rentInput, setRentInput] = useState(''), [depositInput, setDepositInput] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [open, setOpen] = useState(false);
  const load = data => {
    setPricing(data.pricing); setPrice(amountInput(data.pricing.posTotalCents));
    setDefaults(data.pricing.defaults || {}); if (data.smsPackages) setPacks(data.smsPackages);
    if (data.smsPricing) setSmsPriceInput(String(Number(data.smsPricing.unitPriceEur)).replace('.', ','));
    setRentInput(amountInput(data.pricing.defaults?.rentCents)); setDepositInput(amountInput(data.pricing.defaults?.depositCents));
  };
  useEffect(() => {
    let live = true;
    api.get('/api/onboarding/pricing').then(({ data }) => { if (live) load(data); })
      .catch(() => { if (live) setMessage('No se pudo cargar la configuración. Vuelve a abrir Onboarding.'); });
    const show = () => setOpen(true);
    window.addEventListener('volta:configure-onboarding', show);
    return () => { live = false; window.removeEventListener('volta:configure-onboarding', show); };
  }, []);
  const change = key => e => setDefaults(current => ({ ...current, [key]: e.target.type === 'number' || e.target.tagName === 'SELECT' && key !== 'rentMode' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value }));
  const save = async e => {
    e.preventDefault(); if (busy || !pricing) return;
    const cents = asCents(price);
    if (!cents) { setMessage('Introduce un precio válido con hasta dos decimales.'); return; }
    const smsUnitPriceEur = smsPriceInput.trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,4})?$/.test(smsUnitPriceEur) || Number(smsUnitPriceEur) <= 0 || Number(smsUnitPriceEur) > 10) { setMessage('Introduce una tarifa SMS válida, con hasta cuatro decimales.'); return; }
    setBusy(true); setMessage('');
    try {
      const { data } = await api.post('/api/onboarding/pricing', { posTotalCents: cents, revision: pricing.revision, defaults: { ...defaults, smsUnitPriceEur } });
      load(data); window.dispatchEvent(new Event('volta:onboarding-defaults'));
      setMessage('Configuración guardada. La tarifa del POS se aplica a nuevas solicitudes y la tarifa SMS a nuevas recargas. Los pagos iniciados y los contratos existentes conservan sus condiciones.');
    } catch (error) { setMessage(closureErrorText(error.response?.data?.error)); }
    finally { setBusy(false); }
  };
  const rent = defaults.rentMode === 'PRICE_24' ? Math.round(asCents(price) / 24)
    : defaults.rentMode === 'PRICE_36' ? Math.round(asCents(price) / 36) : defaults.rentCents;
  return <details id="onboarding-defaults" className="onb-commercial onb-managerSettings" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Tarifas vigentes del POS y SMS · condiciones generales</summary>
    <p>Estos valores rellenan las ofertas. En cada comercio solo revisas los importes y confirmas la entrega. Completa las condiciones comunes antes de preparar la primera oferta.</p>
    <form onSubmit={save} className="onb-managerForm">
      <div className="onb-managerGrid">
        <label>Precio predeterminado del POS, IVA incluido (€)<input required inputMode="decimal" disabled={!pricing || busy} value={price} onChange={e => setPrice(e.target.value)} /></label>
        <label>Tarifa vigente del SMS (€ por parte)<input required inputMode="decimal" disabled={!pricing || busy} value={smsPriceInput} onChange={e => setSmsPriceInput(e.target.value)} /><span>Se aplica a nuevas recargas de toda Volta. Un mensaje puede consumir varias partes.</span></label>
        <label>Cálculo de la cuota de renting<select value={defaults.rentMode || 'FIXED'} onChange={change('rentMode')}>
          <option value="FIXED">Cuota mensual fija</option><option value="PRICE_24">Precio del POS dividido entre 24</option><option value="PRICE_36">Precio del POS dividido entre 36</option>
        </select></label>
        {(!defaults.rentMode || defaults.rentMode === 'FIXED') && <label>Cuota mensual fija, IVA incluido (€)<input inputMode="decimal" value={rentInput} onChange={e => { setRentInput(e.target.value); setDefaults(d => ({ ...d, rentCents: asCents(e.target.value) })); }} /></label>}
        <label>Fianza del renting (€; 0 si no se exige)<input inputMode="decimal" value={depositInput} onChange={e => { setDepositInput(e.target.value); setDefaults(d => ({ ...d, depositCents: asCents(e.target.value) })); }} /></label>
        <div><strong>Paquetes a la tarifa vigente guardada</strong><p>{packs.map(pack => `${euro(pack.cents)}: ${pack.credits} partes`).join(' · ')}</p></div>
        <label>Días para firmar después del pago<input type="number" min="1" max="60" value={defaults.signatureDays ?? ''} onChange={change('signatureDays')} /></label>
        <label>Máximo de días para tramitar la devolución antes del alta<input type="number" min="1" max="30" value={defaults.refundDays ?? ''} onChange={change('refundDays')} /></label>
      </div>
      <p>Renting: <strong>36 × {euro(rent)}</strong> · Total: <strong>{euro(Number.isInteger(rent) ? rent * 36 : null)}</strong>. Cuota redondeada a céntimos. El POS se transmite al finalizar los 36 meses y completar todos los pagos.</p>
      <details className="onb-managerAdvanced"><summary>Condiciones comunes del contrato</summary>
        <p>Se guardan una vez para reutilizarlas. El contrato general con los datos del comercio se genera automáticamente.</p>
        {termFields.map(([key, label]) => <label key={key}>{label}<textarea rows="3" minLength="30" maxLength={key === 'equipmentTerms' ? 8000 : 4000} value={defaults[key] || ''} onChange={change(key)} /></label>)}
      </details>
      <button type="submit" disabled={!pricing || busy}>Guardar configuración general</button>
    </form>{message && <p role="status">{message}</p>}
  </details>;
}
