import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingCommercial, { CommercialSummary, commercialPreview } from './OnboardingCommercial';
const catalog = { posTotalCents: 25000, installments: { 6: [4167,4167,4167,4167,4167,4165] }, sms: { unitPriceEur: '0.0750', initialCents: 1000, credits: 133 } };
test('six-installment preview displays exact schedule and never claims a final initial total', () => {
  render(<CommercialSummary selection={commercialPreview({ posChoice: 'INSTALLMENTS', posInstallments: 6 }, catalog)} />);
  expect(screen.getByText(/Mes 5 después del primer pago: 41,65/)).toBeInTheDocument();
  expect(screen.getByText(/Primer pago, después de la firma: 41,67/)).toBeInTheDocument();
  expect(screen.getByText(/Hoy no se cobra nada/)).toBeInTheDocument();
});

test('rental preview and summary use the selected term and rounded total', () => {
  const rentalCatalog = { ...catalog, rental: { calculation: 'PRICE_BY_TERM', depositCents: 0,
    termOptions: [{ months: 12, monthlyCents: 2083, totalCents: 24996 }, { months: 36, monthlyCents: 694, totalCents: 24984 }] } };
  const props = { form: { posChoice: 'RENT_QUOTE', posRentalMonths: '' }, catalog: rentalCatalog, updateField: () => jest.fn(), fieldProps: () => ({}), invalidFields: {} };
  const { rerender } = render(<OnboardingCommercial {...props} />);
  expect(screen.getByRole('combobox', { name: 'Plazo del renting' })).toHaveValue('');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  rerender(<OnboardingCommercial {...props} form={{ ...props.form, posRentalMonths: '12' }} />);
  expect(screen.getByRole('status')).toHaveTextContent('12 cuotas de 20,83');
  expect(screen.getByRole('status')).toHaveTextContent('249,96');
  rerender(<CommercialSummary selection={commercialPreview({ posChoice: 'RENT_QUOTE', posRentalMonths: '12' }, rentalCatalog)} />);
  expect(screen.getByText('Solicitud de renting de 12 meses')).toBeInTheDocument();
  expect(screen.getByText('Total de las 12 mensualidades')).toBeInTheDocument();
  expect(screen.queryByText(/36 mensualidades/)).not.toBeInTheDocument();
});
test('rental remains a quote request with no invented monthly price', () => {
  render(<CommercialSummary selection={commercialPreview({ posChoice: 'RENT_QUOTE' }, catalog)} />);
  expect(screen.getByText('Solicitud de renting de 36 meses')).toBeInTheDocument();
  expect(screen.getByText(/pertenece a Volta/)).toBeInTheDocument();
  expect(screen.queryByText(/11,00/)).not.toBeInTheDocument();
});
test('choice is explicit and read-only after submission', () => {
  const update = jest.fn();
  const props = { form: { posChoice: '', commercialAcknowledged: false }, catalog, updateField: () => update, fieldProps: () => ({}), invalidFields: {} };
  const { rerender } = render(<OnboardingCommercial {...props} />);
  expect(screen.getAllByRole('radio').every(input => !input.checked)).toBe(true);
  expect(screen.queryByRole('checkbox', { name: /Quiero notificaciones/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  expect(screen.getByText(/0,075 € por parte de SMS/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /renting/ })); expect(update).toHaveBeenCalledTimes(1);
  rerender(<OnboardingCommercial {...props} disabled />);
  expect(screen.getByRole('radio', { name: /renting/ })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Acepto las condiciones/ })).toBeDisabled();
});

test('financed renting uses frozen payments including the adjusted last instalment and short maximum', () => {
  const plan = { months: 12, monthlyCents: 2199, totalCents: 26390, interestCents: 1390, monthlyInterestPercent: 1,
    payments: [...Array(11).fill(2199), 2201], principalCents: 25000 };
  const financed = { ...catalog, rental: { calculation: 'AMORTIZED_RENTAL', depositCents: 0, termOptions: [plan] } };
  const form = { posChoice: 'RENT_QUOTE', posRentalMonths: 12 };
  const { rerender } = render(<OnboardingCommercial form={form} catalog={financed} updateField={() => jest.fn()} fieldProps={() => ({})} invalidFields={{}} />);
  expect(screen.getByRole('radio', { name: /Renting/ })).toHaveAccessibleName(/hasta 12 meses/);
  expect(screen.getByRole('status')).toHaveTextContent('última de 22,01');
  expect(screen.getByRole('status')).toHaveTextContent('263,90');
  rerender(<CommercialSummary selection={commercialPreview(form, financed)} />);
  expect(screen.getByText(/Mes 11 desde la entrega operativa: 22,01/)).toBeInTheDocument();
  expect(screen.getByText(/Intereses totales: 13,90/)).toBeInTheDocument();
  expect(screen.getByText(/Primera cuota después de firmar, antes de activar: 21,99/)).toBeInTheDocument();
  expect(screen.queryByText(/36 meses/)).not.toBeInTheDocument();
});
