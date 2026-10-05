export const termFields = [
  ['equipmentTerms', 'Condiciones del equipo: propiedad, entrega, cuotas o renta, devolución, daños y extravío'],
  ['settlementTerms', 'Calendario y condiciones de liquidación del 90 %'],
  ['supplyTerms', 'Condiciones aprobadas ante retraso: nueva fecha, cancelación y devolución'],
  ['cancellationTerms', 'Condiciones aprobadas de cancelación anticipada del renting'],
];
export const asCents = input => /^\d+(?:[.,]\d{1,2})?$/.test(String(input)) ? Math.round(Number(String(input).replace(',', '.')) * 100) : null;
export const amountInput = value => Number.isInteger(value) ? String(value / 100) : '';
