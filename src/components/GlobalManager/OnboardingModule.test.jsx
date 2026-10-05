import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingModule from './OnboardingModule';
import api from '../../setupAxios';
jest.mock('../../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

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
