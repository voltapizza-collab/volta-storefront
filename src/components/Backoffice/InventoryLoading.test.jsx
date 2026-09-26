import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryModule from './InventoryModule';
import api from '../../setupAxios';
jest.mock('../../setupAxios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const ingredient = { id: 10, name: 'Pan de pita', canonicalKey: 'pan_de_pita', category: 'OTROS', exists: true, active: true, costPrice: 1, allergens: [] };
let consoleError;
beforeEach(() => { jest.clearAllMocks(); consoleError = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => consoleError.mockRestore());

test('a failed inventory is explained and retry restores the actual categories', async () => {
  let reject;
  api.get.mockImplementationOnce(() => new Promise((resolve, rejectRequest) => { reject = rejectRequest; }));
  api.get.mockResolvedValueOnce({ data: [ingredient] });
  render(<InventoryModule partner={{ storeId: 1 }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando inventario');
  expect(screen.getByRole('button', { name: /Ingredient finder/ })).toBeDisabled();
  await act(async () => reject(new Error('HTTP 500')));
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el inventario');
  expect(screen.queryByText('No hay ingredientes disponibles para esta tienda.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  fireEvent.click(await screen.findByRole('button', { name: /Panes, masas y harinas/ }));
  expect(screen.getByRole('button', { name: /PAN DE PITA/ })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith('/stores/1/ingredients', { params: { locale: 'es' } });
});

test('a genuinely empty response is distinguished from an invalid response', async () => {
  api.get.mockResolvedValueOnce({ data: [] });
  const view = render(<InventoryModule partner={{ storeId: 1 }} />);
  expect(await screen.findByText('No hay ingredientes disponibles para esta tienda.')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  api.get.mockResolvedValueOnce({ data: { error: 'unexpected response' } });
  view.rerender(<InventoryModule partner={{ storeId: 2 }} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
});

test('a late response from a previous store cannot overwrite the current inventory', async () => {
  let resolveOld;
  api.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  api.get.mockResolvedValueOnce({ data: [{ ...ingredient, id: 20, name: 'Queso local', canonicalKey: null, category: 'QUESOS', isSystem: false }] });
  const view = render(<InventoryModule partner={{ storeId: 1 }} />);
  view.rerender(<InventoryModule partner={{ storeId: 2 }} />);
  await screen.findByRole('button', { name: /Quesos/ });
  await act(async () => resolveOld({ data: [ingredient] }));
  expect(screen.queryByRole('button', { name: /Panes, masas y harinas/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Quesos/ }));
  expect(screen.getByRole('button', { name: /QUESO LOCAL/ })).toBeVisible();
});

test('missing store context never requests an undefined inventory', () => {
  render(<InventoryModule partner={{ partnerId: 1 }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido identificar la tienda');
  expect(api.get).not.toHaveBeenCalled();
});

test.each([['en', 'Retry'], ['it', 'Riprova'], ['fr', 'Réessayer'], ['pt', 'Tentar novamente']])('loading errors respect the %s selector', async (language, label) => {
  api.get.mockRejectedValueOnce(new Error('HTTP 500'));
  render(<InventoryModule partner={{ storeId: 1 }} language={language} />);
  expect(await screen.findByRole('button', { name: label })).toBeVisible();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/stores/1/ingredients', { params: { locale: language } }));
});
