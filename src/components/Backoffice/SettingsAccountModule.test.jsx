import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsAccountModule from './SettingsAccountModule';
import { createBackofficeTranslator } from '../../constants/i18n';
import api from '../../setupAxios';
jest.mock('../../setupAxios', () => ({ __esModule: true, default: { post: jest.fn() } }));
const t = createBackofficeTranslator('es');
beforeEach(() => jest.clearAllMocks());
const fill = (confirmation = 'abc') => {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'partner' } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'abc' } });
  fireEvent.change(screen.getByLabelText('Repetir nueva contraseña'), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
};
test('voluntary short password change replaces the session and clears fields', async () => {
  const next = { role: 'backoffice', partnerSlug: 'partner', sessionToken: 'new', rememberDevice: true };
  api.post.mockResolvedValue({ data: next });
  const onSessionChanged = jest.fn();
  render(<SettingsAccountModule partner={{ partnerSlug: 'partner' }} onSessionChanged={onSessionChanged} t={t} />);
  fill();
  expect(await screen.findByRole('status')).toHaveTextContent('Contraseña cambiada');
  expect(api.post).toHaveBeenCalledWith('/partners/backoffice-password/change', { currentPassword: 'partner', password: 'abc' });
  expect(onSessionChanged).toHaveBeenCalledWith(next);
  expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('');
});
test('mismatch stays in the form without changing the account', async () => {
  render(<SettingsAccountModule partner={{ partnerSlug: 'partner' }} onSessionChanged={jest.fn()} t={t} />);
  fill('different');
  expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
  expect(api.post).not.toHaveBeenCalled();
});
test('incorrect current password shows an error without logging out', async () => {
  api.post.mockRejectedValue({ response: { data: { error: 'incorrect_current_password' } } });
  const onSessionChanged = jest.fn();
  render(<SettingsAccountModule partner={{ partnerSlug: 'partner' }} onSessionChanged={onSessionChanged} t={t} />);
  fill();
  expect(await screen.findByRole('alert')).toHaveTextContent('actual no es correcta');
  expect(onSessionChanged).not.toHaveBeenCalled();
});
