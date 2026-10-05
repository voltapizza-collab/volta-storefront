import React, { useEffect, useState } from 'react';
import api from '../../setupAxios';
import { closureErrorText } from '../OnboardingClosure';

export default function OnboardingPricing() {
  const [pricing, setPricing] = useState(null), [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    api.get('/api/onboarding/pricing').then(({ data }) => {
      if (live) { setPricing(data.pricing); setPrice(String(data.pricing.posTotalCents / 100)); }
    }).catch(() => { if (live) setMessage('No se pudo cargar la tarifa. Vuelve a abrir Onboarding.'); });
    return () => { live = false; };
  }, []);
  const save = async e => {
    e.preventDefault(); if (busy || !pricing) return;
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(price)) { setMessage('Introduce un precio válido con hasta dos decimales.'); return; }
    setBusy(true); setMessage('');
    try {
      const { data } = await api.post('/api/onboarding/pricing', { posTotalCents: Math.round(Number(price.replace(',', '.')) * 100), revision: pricing.revision });
      setPricing(data.pricing); setPrice(String(data.pricing.posTotalCents / 100));
      setMessage('Tarifa guardada para nuevas solicitudes. Los expedientes existentes conservan sus importes.');
    } catch (error) { setMessage(closureErrorText(error.response?.data?.error)); }
    finally { setBusy(false); }
  };
  return <details className="onb-commercial"><summary>Tarifa del POS para nuevas altas</summary>
    <form onSubmit={save}>
      <label>Precio predeterminado del POS, IVA incluido (€)<input required inputMode="decimal" disabled={!pricing || busy} value={price} onChange={e => setPrice(e.target.value)} /></label>
      <p>Solo se aplica a nuevas solicitudes. Puedes ajustar la oferta de cada comercio antes del pago; no modifica contratos anteriores ni la cuota de renting.</p>
      <button type="submit" disabled={!pricing || busy}>Guardar tarifa para nuevas altas</button>
    </form>{message && <p role="status">{message}</p>}
  </details>;
}
