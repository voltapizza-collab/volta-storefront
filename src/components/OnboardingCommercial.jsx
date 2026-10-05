import React from 'react';

export const euro = cents => Number.isInteger(cents)
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100) : 'Pendiente de oferta';

export function commercialPreview(form, catalog) {
  const payments = form.posChoice === 'PURCHASE' ? [catalog?.posTotalCents]
    : form.posChoice === 'INSTALLMENTS' ? catalog?.installments?.[form.posInstallments] : null;
  return { pos: { mode: form.posChoice, totalCents: payments ? catalog?.posTotalCents : null,
    installmentCents: payments, firstPaymentCents: payments?.[0] ?? null } };
}

export function CommercialSummary({ selection }) {
  if (!selection) return null;
  const pos = selection.pos || {};
  const labels = { PURCHASE: 'Compra al contado', INSTALLMENTS: 'Compra a plazos sin intereses', RENT_QUOTE: 'Solicitud de renting de 36 meses' };
  return <section className="onb-commercialSummary" aria-label="Resumen de equipo y notificaciones">
    <h3>Tu elección, pendiente de revisión</h3>
    <dl>
      <div><dt>POS</dt><dd>{labels[pos.mode] || 'Elige una modalidad'}</dd></div>
      <div><dt>{pos.mode === 'RENT_QUOTE' ? 'Renting y fianza' : 'Precio propuesto del POS, IVA incluido'}</dt><dd>{euro(pos.totalCents)}</dd></div>
      {pos.installmentCents?.length > 1 && <div><dt>Calendario de cuotas</dt><dd><ol>{pos.installmentCents.map((amount, index) => <li key={index}>
        {index === 0 ? 'Primer pago, antes de la firma' : `Mes ${index} después del primer pago`}: {euro(amount)}
      </li>)}</ol></dd></div>}
      <div><dt>Primer pago del POS previsto</dt><dd>{euro(pos.firstPaymentCents)}</dd></div>
      <div><dt>Recarga inicial de SMS</dt><dd>Pendiente de oferta: importe y número de mensajes por confirmar.</dd></div>
      <div><dt>Total inicial a pagar</dt><dd>Pendiente de completar la oferta. Hoy no se cobra nada.</dd></div>
    </dl>
    {pos.mode === 'RENT_QUOTE' && <p>Renting de 36 meses desde la entrega operativa. El POS pertenece a Volta durante el plazo y pasa a ser tuyo al finalizarlo y completar las 36 mensualidades, sin pago residual. La oferta concretará cuota, posible fianza, cancelación anticipada y responsabilidad por daños o extravío. Solicitarla no supone aceptarla.</p>}
    <p>Suministro sujeto al stock de Volta. El contado pagado tiene prioridad entre asignaciones pendientes, respetando entregas comprometidas. Volta confirmará disponibilidad y plazo antes de pedir el pago.</p>
    <p>Los pagos del POS y de SMS se realizan por separado de las ventas. No se descuentan del 90 % del comercio.</p>
    <p>Liquidaciones: 90 % del ticket para el comercio; 9 % para Volta y 1 % para el embajador. El calendario se acordará antes del cierre, sobre fondos cobrados y disponibles, sin anticipos de Volta.</p>
    <p>Volta revisará esta elección y te presentará las condiciones completas antes del pago y la firma.</p>
  </section>;
}

export default function OnboardingCommercial({ form, catalog, updateField, disabled, fieldProps, invalidFields }) {
  return <div className="onb-commercial">
    <h2>Tu equipo y notificaciones</h2>
    <p>Elige cómo prefieres incorporar el POS. Los importes indicados incluyen IVA.</p>
    {!catalog && <p role="alert">No se pudieron cargar las condiciones. Vuelve a abrir el formulario antes de enviar.</p>}
    <fieldset disabled={disabled || !catalog} aria-invalid={Boolean(invalidFields.posChoice)}>
      <legend>¿Cómo quieres incorporar el POS?</legend>
      {[
        ['PURCHASE', `Comprar al contado · ${euro(catalog?.posTotalCents)}`],
        ['INSTALLMENTS', `Comprar en cuotas · ${euro(catalog?.posTotalCents)} en total, sin intereses`],
        ['RENT_QUOTE', 'Solicitar renting de 36 meses · cuota pendiente'],
      ].map(([value, label], index) => <label key={value} className="onb-choice">
        <input type="radio" name="posChoice" value={value} checked={form.posChoice === value} onChange={updateField('posChoice')}
          {...(index === 0 ? fieldProps('posChoice') : {})} /><span>{label}</span>
      </label>)}
      {form.posChoice === 'INSTALLMENTS' && <label><span>Número de cuotas mensuales</span>
        <select value={form.posInstallments} onChange={updateField('posInstallments')} {...fieldProps('posInstallments')}>
          {[2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} cuotas</option>)}
        </select>
      </label>}
    </fieldset>
    <h3>Notificaciones de texto</h3>
    <p>La recarga inicial de SMS se incluirá en la oferta con su precio y número de mensajes. No activaremos un cobro ni una recarga al enviar este formulario.</p>
    <label className="onb-choice">
      <input type="checkbox" checked={Boolean(form.commercialAcknowledged)} onChange={updateField('commercialAcknowledged')} disabled={disabled}
        {...fieldProps('commercialAcknowledged')} />
      <span>Entiendo que estoy enviando una elección para revisión y que el POS y los SMS se pagan aparte de las ventas. Revisaré los importes y condiciones definitivos antes de pagar y firmar.</span>
    </label>
  </div>;
}
