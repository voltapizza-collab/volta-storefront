import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../../setupAxios';
import SettingsBrandingModule from './SettingsBrandingModule';
jest.mock('../../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: { name: 'Restaurante', storefrontMode: 'commercial-light', brandPrimary: '#123456', storefrontButtonConfig: { customPizza: false } } });
  api.patch.mockImplementation(async (path, body) => ({ data: body }));
});

test('offers three modes and saves only the selected mode, without resetting buttons or branding', async () => {
  const { unmount } = render(<SettingsBrandingModule partner={{ partnerId: 7 }} />);
  expect(await screen.findByRole('radio', { name: 'Claro' })).toBeChecked();
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect(screen.queryByText(/galeria de botones/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Aplicar modo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar modo' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Modo oscuro aplicado');
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(api.patch).toHaveBeenCalledWith('/partners/by-id/7/storefront-mode', { storefrontMode: 'commercial-dark' });
  unmount();
  api.get.mockResolvedValue({ data: { storefrontMode: 'commercial-dark' } });
  render(<SettingsBrandingModule partner={{ partnerId: 7 }} />);
  expect(await screen.findByRole('radio', { name: 'Oscuro' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar modo' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Modo claro aplicado');
});

test('failed saves retain the applied mode and allow retry; controls are locked during saving', async () => {
  render(<SettingsBrandingModule partner={{ partnerId: 7 }} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Oscuro' }));
  let reject;
  api.patch.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }));
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar modo' }));
  expect(screen.getByRole('radio', { name: 'Claro' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Aplicando…' })).toBeDisabled();
  await act(async () => reject(new Error('offline')));
  expect(await screen.findByRole('alert')).toHaveTextContent('conserva el anterior');
  expect(screen.getByText('En uso').closest('label')).toHaveTextContent('Claro');
  expect(screen.getByRole('button', { name: 'Aplicar modo' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar modo' }));
  await waitFor(() => expect(screen.getByText('En uso').closest('label')).toHaveTextContent('Oscuro'));
});

test('a failed load cannot overwrite the restaurant with fallback settings', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  render(<SettingsBrandingModule partner={{ partnerId: 7 }} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
  expect(screen.queryByRole('button', { name: 'Aplicar modo' })).not.toBeInTheDocument();
});

test('sepia is saved and restored as a selectable mode', async () => {
  const { unmount } = render(<SettingsBrandingModule partner={{ partnerId: 7 }} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Sepia' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar modo' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Modo sepia aplicado');
  expect(api.patch).toHaveBeenCalledWith('/partners/by-id/7/storefront-mode', { storefrontMode: 'sepia' });
  unmount();
  api.get.mockResolvedValue({ data: { storefrontMode: 'sepia' } });
  render(<SettingsBrandingModule partner={{ partnerId: 7 }} />);
  expect(await screen.findByRole('radio', { name: 'Sepia' })).toBeChecked();
});

test('legacy Volta stays applied until the owner explicitly applies a new mode', async () => {
  api.get.mockResolvedValue({ data: { storefrontMode: 'volta' } });
  render(<SettingsBrandingModule partner={{ partnerId: 7 }} />);
  expect(await screen.findByRole('radio', { name: 'Claro' })).toBeChecked();
  expect(screen.getByText(/Tu tienda conserva el modo Volta/)).toBeVisible();
  expect(screen.queryByText('En uso')).not.toBeInTheDocument();
  expect(api.patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar modo' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Modo claro aplicado');
  expect(api.patch).toHaveBeenCalledWith('/partners/by-id/7/storefront-mode', { storefrontMode: 'commercial-light' });
  expect(screen.getByText('En uso').closest('label')).toHaveTextContent('Claro');
});
