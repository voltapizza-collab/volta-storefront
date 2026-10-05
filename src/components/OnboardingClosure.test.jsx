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

test('admin sends explicit variable price and supply details; editing revokes approval', async () => {
  const row = { id: 1, commercialCatalog: { posTotalCents: 25000 }, formalData: { commercialSelection: { pos: { mode: 'PURCHASE', totalCents: 25000 } } } };
  render(<OnboardingOffer request={row} onUpdate={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText('Cargando condiciones…')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Precio del POS, IVA incluido (€)'), { target: { value: '280,01' } });
  fireEvent.change(screen.getByLabelText('Disponibilidad del POS'), { target: { value: 'WAITING' } });
  const approved = screen.getByRole('checkbox', { name: /He revisado y aprobado/ }); fireEvent.click(approved);
  expect(screen.getByRole('button', { name: 'Preparar oferta completa' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Disponibilidad del POS'), { target: { value: 'IN_STOCK' } });
  expect(approved).not.toBeChecked(); fireEvent.click(approved);
  fireEvent.submit(screen.getByRole('button', { name: 'Preparar oferta completa' }).closest('form'));
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/requests/1/offer', expect.objectContaining({ posTotalCents: 28001, stockStatus: 'IN_STOCK', approved: true }));
});

test('admin rental shows 36-month total and automatically loads common cancellation terms', async () => {
  render(<OnboardingOffer request={{ id: 1, formalData: { commercialSelection: { pos: { mode: 'RENT_QUOTE' } } } }} onUpdate={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('Renting mensual, IVA incluido (€)')).toHaveValue('10.42'));
  fireEvent.change(screen.getByLabelText('Renting mensual, IVA incluido (€)'), { target: { value: '11' } });
  expect(screen.getByText(/36 mensualidades · Total/)).toHaveTextContent('396,00');
  expect(screen.getByLabelText('Condiciones aprobadas de cancelación anticipada del renting')).toBeRequired();
  expect(screen.queryByLabelText('Precio del POS, IVA incluido (€)')).not.toBeInTheDocument();
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

test('a standard offer only needs delivery and approval; packages and terms are loaded once', async () => {
  render(<OnboardingOffer request={{ id: 2, formalData: { commercialSelection: { pos: { mode: 'INSTALLMENTS', totalCents: 25000, installmentCount: 6 } } } }} onUpdate={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText('Cargando condiciones…')).not.toBeInTheDocument());
  expect(screen.getByText(/Sin intereses:/)).toHaveTextContent('5 cuotas de 41,67');
  expect(screen.getByText(/Sin intereses:/)).toHaveTextContent('41,65');
  fireEvent.change(screen.getByLabelText('Disponibilidad del POS'), { target: { value: 'IN_STOCK' } });
  fireEvent.change(screen.getByLabelText('Entrega prevista'), { target: { value: '2099-01-10' } });
  expect(screen.getByLabelText('Fecha límite de entrega')).toHaveValue('2099-01-10');
  fireEvent.click(screen.getByRole('checkbox', { name: /He revisado/ }));
  const button = screen.getByRole('button', { name: 'Preparar oferta completa' });
  expect(button).toBeEnabled(); fireEvent.submit(button.closest('form'));
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/requests/2/offer', expect.objectContaining({ smsCents: 1000, smsCredits: 133, signatureDays: 7, refundDays: 14, supplyTerms: defaults.supplyTerms }));
});

test('an offer without SMS requires no package and sends zero even when shared settings include a recharge', async () => {
  render(<OnboardingOffer request={{ id: 4, formalData: { commercialSelection: {
    pos: { mode: 'PURCHASE', totalCents: 25000 }, sms: { initialRecharge: 'SEPARATE', unitPriceEur: '0.0750' },
  } } }} onUpdate={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText('Cargando condiciones…')).not.toBeInTheDocument());
  expect(screen.getByText(/Herramienta disponible/)).toBeInTheDocument();
  expect(screen.getByText(/0,075 € por parte/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Paquete inicial de SMS')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Disponibilidad del POS'), { target: { value: 'IN_STOCK' } });
  fireEvent.change(screen.getByLabelText('Entrega prevista'), { target: { value: '2099-01-10' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /He revisado/ }));
  const button = screen.getByRole('button', { name: 'Preparar oferta completa' });
  expect(button).toBeEnabled(); fireEvent.submit(button.closest('form'));
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/requests/4/offer', expect.objectContaining({ smsCents: 0, smsCredits: 0 }));
});

test('incomplete shared settings keep preparation disabled and link to the one-time configuration', async () => {
  api.get.mockResolvedValue({ data: { generalTerms: 'Base '.repeat(50), defaults: {} } });
  render(<OnboardingOffer request={{ id: 3, formalData: { commercialSelection: { pos: { mode: 'PURCHASE' } } } }} onUpdate={jest.fn()} />);
  expect(await screen.findByRole('button', { name: 'Configurar condiciones generales' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Preparar oferta completa' })).toBeDisabled();
});
