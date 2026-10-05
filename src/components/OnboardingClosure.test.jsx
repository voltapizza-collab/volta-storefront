import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingClosure from './OnboardingClosure';
import OnboardingOffer from './GlobalManager/OnboardingOffer';
import OnboardingPricing from './GlobalManager/OnboardingPricing';
import api from '../setupAxios';
jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const offer = { id: 'test', hash: 'test-hash', revision: 1, documentText: 'Contrato completo de prueba', totalCents: 29000,
  pos: { mode: 'PURCHASE', payments: [28000], totalCents: 28000, firstCents: 28000, priceChanged: true, previousPriceCents: 25000,
    delivery: { expected: '2099-01-01', latest: '2099-01-10' } }, lines: [{ code: 'POS', label: 'POS', amountCents: 28000 }, { code: 'SMS', label: 'SMS', amountCents: 1000 }] };
const request = closure => ({ token: 'token', id: 1, businessName: 'Test', closure: { offer, status: 'OFFERED', ...closure } });
test('review shows generated contract and sends payment email with one approval, without financial input fields', async () => {
  api.get.mockResolvedValue({ data: { offer: { ...offer, workflow: 'SIGN_PAY_ACTIVATE' }, fingerprint: 'review-1' } });
  render(<OnboardingOffer request={{ id: 1, submittedAt: '2026-10-05', formalData: { commercialSelection: { pos: { mode: 'PURCHASE' } } } }} onUpdate={jest.fn()} />);
  await screen.findByText('Total inicial:', { exact: false });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  const button = screen.getByRole('button', { name: 'Enviar correo de pago' });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /He revisado los datos/ }));
  expect(button).toBeEnabled(); fireEvent.click(button);
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/requests/1/contract/send', { reviewApproved: true, stockConfirmed: true, reviewFingerprint: 'review-1' });
  expect(api.post).not.toHaveBeenCalledWith('/api/onboarding/requests/1/offer', expect.anything());
});

test('signature first leaves checkout available until payment and never shows access before activation', () => {
  const current = patch => request({ offer: { ...offer, workflow: 'SIGN_PAY_ACTIVATE' }, ...patch });
  const onUpdate = jest.fn();
  const { rerender } = render(<OnboardingClosure request={current({ canSign: true })} onUpdate={onUpdate} />);
  expect(screen.queryByRole('button', { name: /^Pagar/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Aceptar condiciones y continuar' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Firmar contrato y continuar al pago' }));
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/form/token/sign-contract', { acceptedContract: true, offerHash: offer.hash });
  rerender(<OnboardingClosure request={current({ signed: true, consented: true, status: 'AWAITING_PAYMENT' })} onUpdate={onUpdate} />);
  expect(screen.getByRole('button', { name: /^Pagar/ })).toBeInTheDocument();
  expect(screen.queryByText(/Revisa tu correo para configurar el acceso/)).not.toBeInTheDocument();
  rerender(<OnboardingClosure request={current({ signed: true, consented: true, status: 'PAID', payment: { status: 'PAID', amountCents: 29000 } })} onUpdate={onUpdate} />);
  expect(screen.queryByRole('button', { name: /^Pagar|^Firmar/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Estamos preparando tu acceso/)).toBeInTheDocument();
  rerender(<OnboardingClosure request={current({ signed: true, activated: true, status: 'SIGNED' })} onUpdate={onUpdate} />);
  expect(screen.getByText(/Revisa tu correo para configurar el acceso/)).toBeInTheDocument();
});

test('missing rental tariff shows a specific configuration action instead of unexplained disabled controls', async () => {
  api.get.mockRejectedValue({ response: { data: { error: 'rent_price_required' } } });
  render(<OnboardingOffer request={{ id: 1, submittedAt: '2026-10-05', formalData: { commercialSelection: { pos: { mode: 'RENT_QUOTE' } } } }} onUpdate={jest.fn()} />);
  expect(await screen.findByText(/Falta definir la cuota de renting/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Configurar tarifa de renting' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Enviar correo de pago' })).toBeDisabled();
});
const defaults = { equipmentTerms: 'Condiciones del equipo aprobadas para esta prueba.', settlementTerms: 'Liquidación semanal de fondos disponibles para esta prueba.',
  supplyTerms: 'Si hay retraso se acuerda nueva fecha o devolución.', cancellationTerms: 'Condiciones de cancelación aprobadas para esta prueba.',
  rentCents: 1042, depositCents: 0, smsCents: 1000, smsCredits: 133, signatureDays: 7, refundDays: 14, supplyReference: 'POS prueba' };
beforeEach(() => { jest.clearAllMocks(); api.post.mockImplementation(() => new Promise(() => {}));
  api.get.mockResolvedValue({ data: { generalTerms: 'Contrato general para una prueba controlada. '.repeat(8), defaults, smsPackages: [{ cents: 1000, credits: 133 }] } }); });

test('full contract and changed price appear before consent; payment and signature stay gated', async () => {
  const onUpdate = jest.fn();
  const { rerender } = render(<OnboardingClosure request={request()} onUpdate={onUpdate} />);
  expect(screen.getByLabelText('Contrato completo')).toHaveTextContent(offer.documentText);
  expect(screen.getByRole('alert')).toHaveTextContent('de 250,00');
  expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Firmar contrato/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox'));
  api.post.mockResolvedValueOnce({ data: { request: request({ consented: true }) } });
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar condiciones y continuar' }));
  await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/form/token/closure/consent', { offerHash: 'test-hash', accepted: true });
  rerender(<OnboardingClosure request={request({ consented: true, status: 'PAYMENT_PENDING' })} onUpdate={onUpdate} />);
  expect(screen.getByRole('button', { name: /Pagar/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Firmar contrato/ })).not.toBeInTheDocument();
  rerender(<OnboardingClosure request={request({ consented: true, canSign: true, status: 'PAID' })} onUpdate={onUpdate} />);
  expect(screen.getByRole('button', { name: /Firmar contrato/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: /Firmar contrato/ })).toBeEnabled();
});

test('overdue or cancelled closure cannot show signing or checkout controls', () => {
  render(<OnboardingClosure request={request({ consented: true, overdue: true, status: 'CANCEL_REQUESTED', cancelRequested: true })} onUpdate={jest.fn()} />);
  expect(screen.queryByRole('button', { name: /Pagar|Firmar contrato/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Ha vencido el plazo/)).toBeInTheDocument();
});

test('failed welcome delivery preserves signed confirmation and does not offer another payment', () => {
  const row = { ...request({ signed: true, status: 'SIGNED' }), formalData: { credentialsNotification: { emailStatus: 'FAILED' } } };
  render(<OnboardingClosure request={row} onUpdate={jest.fn()} />);
  expect(screen.getByText(/El contrato y el pago están conservados/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Pagar|Firmar contrato/ })).not.toBeInTheDocument();
});





test('default pricing is saved as cents with revision and reports scope of the change', async () => {
  api.get.mockResolvedValue({ data: { pricing: { posTotalCents: 25000, revision: 2 }, smsPricing: { unitPriceEur: '0.0750' } } });
  api.post.mockResolvedValue({ data: { pricing: { posTotalCents: 29999, revision: 3 } } });
  render(<OnboardingPricing />);
  const field = screen.getByLabelText('Precio predeterminado del POS, IVA incluido (€)');
  await waitFor(() => expect(field).toHaveValue('250'));
  fireEvent.change(field, { target: { value: '299,99' } });
  const smsField = screen.getByLabelText(/Tarifa vigente del SMS/);
  expect(smsField).toHaveValue('0,075');
  fireEvent.change(smsField, { target: { value: '0,08' } });
  fireEvent.submit(screen.getByRole('button', { name: /Guardar configuración general/, hidden: true }).closest('form'));
  await screen.findByText(/Configuración guardada/);
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/pricing', { posTotalCents: 29999, revision: 2, defaults: { smsUnitPriceEur: '0.08' } });
});
