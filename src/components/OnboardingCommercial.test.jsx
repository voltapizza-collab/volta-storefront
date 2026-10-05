import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingCommercial, { CommercialSummary, commercialPreview } from './OnboardingCommercial';
const catalog = { posTotalCents: 25000, installments: { 6: [4167,4167,4167,4167,4167,4165] }, sms: { unitPriceEur: '0.0750', initialCents: 1000, credits: 133 } };
test('six-installment preview displays exact schedule and never claims a final initial total', () => {
  render(<CommercialSummary selection={commercialPreview({ posChoice: 'INSTALLMENTS', posInstallments: 6 }, catalog)} />);
  expect(screen.getByText(/Mes 5 después del primer pago: 41,65/)).toBeInTheDocument();
  expect(screen.getByText(/Primer pago, antes de la firma: 41,67/)).toBeInTheDocument();
  expect(screen.getByText(/Hoy no se cobra nada/)).toBeInTheDocument();
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
