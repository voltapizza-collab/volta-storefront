import React from 'react';

export const euro = cents => Number.isInteger(cents)
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100) : 'Pendiente de oferta';
export const smsTariff = sms => sms?.unitPriceEur
  ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 }).format(Number(sms.unitPriceEur))} € por parte de SMS` : 'Tarifa por parte pendiente de confirmar';

export function commercialPreview(form, catalog) {
  const flexibleRental = catalog?.rental?.calculation === 'PRICE_BY_TERM';
  const rentalPlan = flexibleRental ? catalog.rental.termOptions.find(plan => plan.months === Number(form.posRentalMonths)) : null;
  const monthlyRent = flexibleRental ? rentalPlan?.monthlyCents : catalog?.rental?.monthlyCents;
  const payments = form.posChoice === 'PURCHASE' ? [catalog?.posTotalCents]
    : form.posChoice === 'INSTALLMENTS' ? catalog?.installments?.[form.posInstallments] : null;
  return { pos: { mode: form.posChoice, totalCents: payments ? catalog?.posTotalCents : null,
    installmentCents: payments, firstPaymentCents: payments?.[0] ?? (form.posChoice === 'RENT_QUOTE' ? monthlyRent : null),
    monthlyRentCents: form.posChoice === 'RENT_QUOTE' ? monthlyRent : null,
    durationMonths: form.posChoice === 'RENT_QUOTE' ? (flexibleRental ? rentalPlan?.months : catalog?.rental?.durationMonths ?? 36) : null,
    depositCents: form.posChoice === 'RENT_QUOTE' ? catalog?.rental?.depositCents : null }, sms: catalog?.sms };
}

export function CommercialSummary({ selection }) {
  if (!selection) return null;
  const pos = selection.pos || {};
  const rentalMonths = pos.durationMonths;
  const labels = { PURCHASE: 'Compra al contado', INSTALLMENTS: 'Compra a plazos sin intereses', RENT_QUOTE: Number.isInteger(rentalMonths) ? `Solicitud de renting de ${rentalMonths} meses` : 'Renting: elige el plazo' };
  return <section className="onb-commercialSummary" aria-label="Resumen de equipo y notificaciones">
    <h3>Tu elección, pendiente de revisión</h3>
    <dl>
      <div><dt>POS</dt><dd>{labels[pos.mode] || 'Elige una modalidad'}</dd></div>
      <div><dt>{pos.mode === 'RENT_QUOTE' ? 'Cuota de renting, IVA incluido' : 'Precio propuesto del POS, IVA incluido'}</dt><dd>{euro(pos.mode === 'RENT_QUOTE' ? pos.monthlyRentCents : pos.totalCents)}{pos.mode === 'RENT_QUOTE' && Number.isInteger(pos.monthlyRentCents) ? '/mes' : ''}</dd></div>
      {pos.mode === 'RENT_QUOTE' && Number.isInteger(pos.monthlyRentCents) && Number.isInteger(rentalMonths) && <div><dt>Total de las {rentalMonths} mensualidades</dt><dd>{euro(pos.monthlyRentCents * rentalMonths)} · Fianza: {euro(pos.depositCents)}</dd></div>}
      {pos.installmentCents?.length > 1 && <div><dt>Calendario de cuotas</dt><dd><ol>{pos.installmentCents.map((amount, index) => <li key={index}>
        {index === 0 ? 'Primer pago, después de la firma' : `Mes ${index} después del primer pago`}: {euro(amount)}
      </li>)}</ol></dd></div>}
      <div><dt>Primer pago del POS previsto</dt><dd>{euro(pos.firstPaymentCents)}</dd></div>
      <div><dt>Notificaciones SMS opcionales</dt><dd>Uso opcional de la herramienta de Volta. Recargas por paquetes desde el backoffice. {smsTariff(selection.sms)} (tarifa vigente, puede variar). No se añade una recarga al alta.</dd></div>
      <div><dt>Total inicial a pagar</dt><dd>Pendiente de completar la oferta. Hoy no se cobra nada.</dd></div>
    </dl>
    {pos.mode === 'RENT_QUOTE' && <p>Renting {Number.isInteger(rentalMonths) ? `de ${rentalMonths} meses` : 'con el plazo que elijas, hasta 36 meses'} desde la entrega operativa. El POS pertenece a Volta durante el plazo y pasa a ser tuyo al finalizarlo y completar todas las mensualidades, sin pago residual. Revisa en el contrato la cuota, posible fianza, cancelación anticipada y responsabilidad por daños o extravío.</p>}
    <p>Suministro sujeto al stock de Volta. El contado pagado tiene prioridad entre asignaciones pendientes, respetando entregas comprometidas. Volta confirmará disponibilidad y plazo antes de pedir el pago.</p>
    <p>Los pagos del POS y de SMS, si los solicitas, se realizan por separado de las ventas. No se descuentan del 90 % del comercio.</p>
    <p>Liquidaciones: 90 % del ticket para el comercio; 9 % para Volta y 1 % para el embajador. El calendario se acordará antes del cierre, sobre fondos cobrados y disponibles, sin anticipos de Volta.</p>
    <p>Volta revisará esta elección y te presentará las condiciones completas para firmar y después pagar.</p>
  </section>;
}

export default function OnboardingCommercial({ form, catalog, updateField, disabled, fieldProps, invalidFields }) {
  const flexibleRental = catalog?.rental?.calculation === 'PRICE_BY_TERM';
  const rentalPlan = flexibleRental ? catalog.rental.termOptions.find(plan => plan.months === Number(form.posRentalMonths)) : null;
  return <div className="onb-commercial">
    <h2>Tu equipo y notificaciones</h2>
    <p>Elige cómo prefieres incorporar el POS. Los importes indicados incluyen IVA.</p>
    {!catalog && <p role="alert">No se pudieron cargar las condiciones. Vuelve a abrir el formulario antes de enviar.</p>}
    <fieldset disabled={disabled || !catalog} aria-invalid={Boolean(invalidFields.posChoice)}>
      <legend>¿Cómo quieres incorporar el POS?</legend>
      {[
        ['PURCHASE', `Comprar al contado · ${euro(catalog?.posTotalCents)}`],
        ['INSTALLMENTS', `Comprar en cuotas · ${euro(catalog?.posTotalCents)} en total, sin intereses`],
        ['RENT_QUOTE', flexibleRental ? 'Renting · elige el plazo, hasta 36 meses' : `Solicitar renting de 36 meses · ${Number.isInteger(catalog?.rental?.monthlyCents) ? `${euro(catalog.rental.monthlyCents)}/mes` : 'cuota pendiente'}`],
      ].map(([value, label], index) => <label key={value} className="onb-choice">
        <input type="radio" name="posChoice" value={value} checked={form.posChoice === value} onChange={updateField('posChoice')}
          {...(index === 0 ? fieldProps('posChoice') : {})} /><span>{label}</span>
      </label>)}
      {form.posChoice === 'INSTALLMENTS' && <label><span>Número de cuotas mensuales</span>
        <select value={form.posInstallments} onChange={updateField('posInstallments')} {...fieldProps('posInstallments')}>
          {[2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} cuotas</option>)}
        </select>
      </label>}
      {form.posChoice === 'RENT_QUOTE' && flexibleRental && <>
        <label className="onb-termChoice"><span>Plazo del renting</span>
          <select value={form.posRentalMonths ?? ''} onChange={updateField('posRentalMonths')} {...fieldProps('posRentalMonths')}>
            <option value="">Elige el número de meses</option>
            {catalog.rental.termOptions.map(plan => <option key={plan.months} value={plan.months}>{plan.months} {plan.months === 1 ? 'mes' : 'meses'} · {euro(plan.monthlyCents)}/mes</option>)}
          </select>
        </label>
        <p>La cuota es el precio del POS dividido entre el plazo elegido, redondeada a céntimos.</p>
        {rentalPlan && <p role="status"><strong>{rentalPlan.months} × {euro(rentalPlan.monthlyCents)}</strong> · Total: <strong>{euro(rentalPlan.totalCents)}</strong>, IVA incluido. Fianza: {euro(catalog.rental.depositCents)}. El primer pago se realiza después de firmar; el plazo comienza con la entrega operativa del POS.</p>}
      </>}
    </fieldset>
    <h3>Notificaciones y comunicación por SMS</h3>
    <p>Volta incluye una herramienta de notificaciones SMS. Puedes utilizarla cuando la necesites recargando saldo; su uso es opcional y no requiere contratarla durante el alta.</p>
    <p><strong>Tarifa vigente: {smsTariff(catalog?.sms)}</strong>. Un mensaje puede consumir varias partes según su longitud y caracteres.</p>
    {catalog?.sms?.packages?.length > 0 && <p>Por ejemplo, el paquete de {euro(Math.round(catalog.sms.packages[0].amount * 100))} incluye actualmente {catalog.sms.packages[0].credits} partes de SMS.</p>}
    <p>La tarifa puede cambiar. Antes de cada recarga verás su precio y las partes incluidas. El alta no incluye una recarga automática; podrás recargar desde el backoffice.</p>
    <label className="onb-choice">
      <input type="checkbox" checked={Boolean(form.commercialAcknowledged)} onChange={updateField('commercialAcknowledged')} disabled={disabled}
        {...fieldProps('commercialAcknowledged')} />
      <span>Acepto las condiciones de pago y entiendo que el uso de notificaciones SMS es opcional, mediante recargas por paquetes a la tarifa vigente mostrada antes de cada compra. El POS y las recargas se pagan aparte de las ventas. Revisaré los importes definitivos antes de firmar y pagar.</span>
    </label>
  </div>;
}
