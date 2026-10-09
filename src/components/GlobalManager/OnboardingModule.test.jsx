import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingModule from './OnboardingModule';
import api from '../../setupAxios';
jest.mock('../../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

test('demo inquiry exposes commercial follow-up and only invites after explicit business interest', async () => {
  const row = { id: 7, requestKind: 'DEMO', name: 'Test', businessName: 'Demo Pizza', email: 'test@example.invalid', status: 'RECEIVED', emailStatus: 'SENT', formalData: { requestKind: 'DEMO' } };
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('/pricing') ? { pricing: { posTotalCents: 25000, revision: 0 } } : { requests: [row] } }));
  api.patch.mockResolvedValue({ data: { request: { ...row, reviewerNote: 'Demo el viernes' } } });
  api.post.mockResolvedValue({ data: { request: { ...row, requestKind: 'ONBOARDING', status: 'EMAIL_SENT', formalUrl: '/onboarding/test', formalData: {} } } });
  render(<OnboardingModule />);
  const invite = await screen.findByRole('button', { name: 'Enviar invitación al alta' });
  expect(invite).toBeDisabled();
  expect(screen.queryByRole('link', { name: 'Abrir fase 2' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar fase' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nota comercial'), { target: { value: 'Demo el viernes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar seguimiento' }));
  await screen.findByText('Seguimiento guardado.');
  expect(api.patch).toHaveBeenCalledWith('/api/onboarding/requests/7/status', { status: 'RECEIVED', reviewerNote: 'Demo el viernes' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'La pizzería ha solicitado continuar con el alta.' }));
  fireEvent.click(invite);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/onboarding/requests/7/invite-onboarding', { requestedByBusiness: true }));
  await screen.findByRole('link', { name: 'Abrir fase 2' });
});

test('signed financial record shows correct email numbering and cannot be deleted or manually moved', async () => {
  const row = { id: 1, name: 'Test', businessName: 'Mi comercio', email: 'test@example.invalid', status: 'ACTIVATED', formalUrl: '/onboarding/test', commercialClosurePending: true,
    formalData: { commercialSelection: { pos: { mode: 'PURCHASE' } }, contractNotification: { emailStatus: 'SENT' }, credentialsNotification: { emailStatus: 'FAILED' } },
    closure: { status: 'SIGNED', signed: true, offer: { revision: 1, hash: 'test', totalCents: 26000, documentText: 'Contrato de prueba',
      pos: { mode: 'PURCHASE', payments: [25000], totalCents: 25000 }, lines: [{ code: 'POS', label: 'POS', amountCents: 25000 }] } } };
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('/pricing') ? { pricing: { posTotalCents: 25000, revision: 0 } } : { requests: [row] } }));
  render(<OnboardingModule />);
  expect(await screen.findByRole('button', { name: 'Eliminar solicitud de Mi comercio' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Guardar fase' })).toBeDisabled();
  expect(screen.getByText('Correo 2: contrato y pago')).toBeInTheDocument();
  expect(screen.getByText('Correo 3: bienvenida y accesos')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reenviar bienvenida y acceso' })).toBeEnabled();
  expect(screen.getByRole('link', { name: 'Abrir contrato y pago' })).toBeInTheDocument();
});
