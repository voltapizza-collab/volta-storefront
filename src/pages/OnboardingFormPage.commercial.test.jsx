import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingFormPage from './OnboardingFormPage';
import api from '../setupAxios';
jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('react-router-dom', () => ({ useParams: () => ({ token: 'test-token' }) }), { virtual: true });
const fields = { partnerType: 'AUTONOMO', legalName: 'Titular', taxId: 'TEST', legalRepresentative: 'Titular', representativeRole: 'Propietario',
  commercialName: 'Mi tienda', businessAddress: 'Calle 1', city: 'Madrid', postalCode: '28001', country: 'España',
  businessPhone: '600000000', businessEmail: 'test@example.com', accountHolder: 'Titular', iban: 'ES0012341234123412341234',
  acceptedTerms: true, acceptedCompliance: true, posChoice: 'PURCHASE', posInstallments: null, commercialAcknowledged: true };
let request;
test('email method prefills a new selection without overwriting a saved choice or accepting terms', async () => {
  window.history.replaceState(null, '', '/onboarding/test-token?posChoice=INSTALLMENTS');
  request.formalData.onboardingDraft = { ...fields, posChoice: '', commercialAcknowledged: false };
  const { unmount } = render(<OnboardingFormPage />);
  await screen.findByDisplayValue('Mi tienda');
  fireEvent.click(screen.getByRole('button', { name: '3. Equipo y SMS' }));
  expect(screen.getByRole('radio', { name: /Comprar en cuotas/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /Acepto las condiciones de pago/ })).not.toBeChecked();
  unmount();
  request.formalData.onboardingDraft = fields;
  render(<OnboardingFormPage />);
  await screen.findByDisplayValue('Mi tienda');
  fireEvent.click(screen.getByRole('button', { name: '3. Equipo y SMS' }));
  expect(screen.getByRole('radio', { name: /Comprar al contado/ })).toBeChecked();
});
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, '', '/onboarding/test-token');
  window.requestAnimationFrame = fn => fn();
  request = { token: 'test-token', businessName: 'Mi tienda', status: 'EMAIL_SENT',
    commercialCatalog: { version: 'v1', posTotalCents: 25000, installments: { 6: [4167,4167,4167,4167,4167,4165] } },
    formalData: { supportingDocuments: [{ type: 'IDENTITY', name: 'identity.pdf' }, { type: 'FISCAL', name: 'fiscal.pdf' }], onboardingDraft: fields } };
  api.get.mockImplementation(async () => ({ data: { request } }));
});
test('resumes server draft, defaults installments when switching, submits prices only as server version and locks', async () => {
  api.post.mockImplementation(async (_, data) => ({ data: { request: { ...request, status: 'IN_REVIEW',
    commercialClosurePending: true, formalData: { ...fields, posChoice: 'INSTALLMENTS', posInstallments: 6,
      commercialSelection: { pos: { mode: 'INSTALLMENTS', totalCents: 25000, installmentCents: [4167,4167,4167,4167,4167,4165], firstPaymentCents: 4167 } } } } } }));
  render(<OnboardingFormPage />);
  await screen.findByDisplayValue('Mi tienda');
  fireEvent.click(screen.getByRole('button', { name: '3. Equipo y SMS' }));
  expect(screen.getByRole('radio', { name: /Comprar al contado/ })).toBeChecked();
  expect(screen.queryByRole('checkbox', { name: /Quiero notificaciones/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /Comprar en cuotas/ }));
  expect(screen.getByRole('combobox', { name: /Número de cuotas/ })).toHaveValue('6');
  fireEvent.click(screen.getByRole('button', { name: '4. Resumen' }));
  expect(screen.getByText(/Mes 5 después del primer pago: 41,65/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión' }));
  await screen.findByText('En revision');
  const [url, body] = api.post.mock.calls[0];
  expect(url).toBe('/api/onboarding/form/test-token');
  expect(body.get('commercialVersion')).toBe('v1');
  expect(body.get('posChoice')).toBe('INSTALLMENTS');
  expect(body.get('smsRequested')).toBeNull();
  expect(body.get('commercialSelection')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Enviar a revisión' })).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /Comprar en cuotas/ })).toBeDisabled();
});
test('save progress works with partial data and does not submit files or signed metadata', async () => {
  request.formalData = null;
  api.post.mockResolvedValue({ data: { request } });
  render(<OnboardingFormPage />);
  await screen.findByRole('button', { name: 'Guardar y continuar después' });
  fireEvent.change(screen.getByLabelText('Nombre comercial'), { target: { value: 'Nueva' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar después' }));
  await screen.findByText(/Avance guardado/);
  expect(api.post.mock.calls[0][0]).toBe('/api/onboarding/form/test-token/draft');
  expect(api.post.mock.calls[0][1].commercialName).toBe('Nueva');
  expect(api.post.mock.calls[0][1].smsRequested).toBeUndefined();
  expect(api.post.mock.calls[0][1].supportingDocuments).toBeUndefined();
});

test('renting requires a term, saves it in drafts and submits the selected months without client prices', async () => {
  request.commercialCatalog.rental = { calculation: 'PRICE_BY_TERM', depositCents: 0,
    termOptions: Array.from({ length: 36 }, (_, i) => ({ months: i + 1, monthlyCents: Math.round(25000 / (i + 1)), totalCents: Math.round(25000 / (i + 1)) * (i + 1) })) };
  request.formalData.onboardingDraft = { ...fields, posChoice: 'RENT_QUOTE', posRentalMonths: '' };
  api.post.mockImplementation(async (url, body) => {
    if (url.endsWith('/draft')) return { data: { request: { ...request, formalData: { ...request.formalData, onboardingDraft: body } } } };
    return { data: { request: { ...request, status: 'IN_REVIEW', formalData: { ...fields, posChoice: 'RENT_QUOTE', posRentalMonths: 12,
      commercialSelection: { pos: { mode: 'RENT_QUOTE', durationMonths: 12, monthlyRentCents: 2083, firstPaymentCents: 2083, depositCents: 0 } } } } } };
  });
  const { unmount } = render(<OnboardingFormPage />);
  fireEvent.click(await screen.findByRole('button', { name: '4. Resumen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión' }));
  await screen.findByText(/Revisa el plazo del renting/);
  expect(api.post).not.toHaveBeenCalled();
  const select = screen.getByRole('combobox', { name: 'Plazo del renting' });
  expect(select.querySelectorAll('option')).toHaveLength(37);
  fireEvent.change(select, { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar después' }));
  await screen.findByText(/Avance guardado/);
  expect(api.post.mock.calls[0][1].posRentalMonths).toBe('12');
  request.formalData.onboardingDraft = api.post.mock.calls[0][1];
  unmount(); render(<OnboardingFormPage />);
  fireEvent.click(await screen.findByRole('button', { name: '3. Equipo y SMS' }));
  expect(screen.getByRole('combobox', { name: 'Plazo del renting' })).toHaveValue('12');
  fireEvent.click(screen.getByRole('button', { name: '4. Resumen' }));
  expect(screen.getByText('Solicitud de renting de 12 meses')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión' }));
  await screen.findByText('En revision');
  const body = api.post.mock.calls[1][1];
  expect(body.get('posRentalMonths')).toBe('12');
  expect(body.get('monthlyRentCents')).toBeNull();
});
test('missing choice moves back to equipment and new applications cannot sign the old contract', async () => {
  request.formalData.onboardingDraft = { ...fields, posChoice: '' };
  const { unmount } = render(<OnboardingFormPage />);
  fireEvent.click(await screen.findByRole('button', { name: '4. Resumen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '3. Equipo y SMS' })).toHaveAttribute('aria-current', 'step'));
  expect(api.post).not.toHaveBeenCalled();
  unmount();
  request = { ...request, status: 'CONTRACT_SENT', commercialClosurePending: true };
  render(<OnboardingFormPage />);
  await screen.findByText('Condiciones en preparación');
  expect(screen.queryByRole('button', { name: 'Firmar contrato y activar backoffice' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled();
});
