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
beforeEach(() => { jest.clearAllMocks(); api.post.mockImplementation(() => new Promise(() => {})); });

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

test('admin sends explicit variable price and supply details; editing revokes approval', async () => {
  const row = { id: 1, commercialCatalog: { posTotalCents: 25000 }, formalData: { commercialSelection: { pos: { mode: 'PURCHASE', totalCents: 25000 } } } };
  render(<OnboardingOffer request={row} onUpdate={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Precio del POS, IVA incluido (€)'), { target: { value: '280,01' } });
  fireEvent.change(screen.getByLabelText('Disponibilidad del POS'), { target: { value: 'WAITING' } });
  const approved = screen.getByRole('checkbox', { name: /He revisado y aprobado/ }); fireEvent.click(approved);
  expect(screen.getByRole('button', { name: 'Preparar oferta completa' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Disponibilidad del POS'), { target: { value: 'IN_STOCK' } });
  expect(approved).not.toBeChecked(); fireEvent.click(approved);
  fireEvent.submit(screen.getByRole('button', { name: 'Preparar oferta completa' }).closest('form'));
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/requests/1/offer', expect.objectContaining({ posTotalCents: 28001, stockStatus: 'IN_STOCK', approved: true }));
});

test('admin rental shows 36-month total and requires separate cancellation terms', () => {
  render(<OnboardingOffer request={{ id: 1, formalData: { commercialSelection: { pos: { mode: 'RENT_QUOTE' } } } }} onUpdate={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Renting mensual, IVA incluido (€)'), { target: { value: '11' } });
  expect(screen.getByText(/36 mensualidades · Total/)).toHaveTextContent('396,00');
  expect(screen.getByLabelText('Condiciones aprobadas de cancelación anticipada del renting')).toBeRequired();
  expect(screen.queryByLabelText('Precio del POS, IVA incluido (€)')).not.toBeInTheDocument();
});

test('default pricing is saved as cents with revision and reports scope of the change', async () => {
  api.get.mockResolvedValue({ data: { pricing: { posTotalCents: 25000, revision: 2 } } });
  api.post.mockResolvedValue({ data: { pricing: { posTotalCents: 29999, revision: 3 } } });
  render(<OnboardingPricing />);
  const field = screen.getByLabelText('Precio predeterminado del POS, IVA incluido (€)');
  await waitFor(() => expect(field).toHaveValue('250'));
  fireEvent.change(field, { target: { value: '299,99' } });
  fireEvent.submit(screen.getByRole('button', { name: /Guardar tarifa/, hidden: true }).closest('form'));
  await screen.findByText(/Tarifa guardada para nuevas solicitudes/);
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/pricing', { posTotalCents: 29999, revision: 2 });
});
