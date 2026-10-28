import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../setupAxios';
import PosApp from './PosApp';

jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
jest.mock('../components/Backoffice/EngineBackground', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, default: 'pizza.svg', ReactComponent: () => null }));
const originalFetch = global.fetch;
let items;
let products;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); localStorage.clear();
  window.history.replaceState(null, '', '/pos/test/central');
  sessionStorage.clear();
  sessionStorage.setItem('volta_web_session:pos:test:central', JSON.stringify({ role: 'pos', partnerId: 1, partnerSlug: 'test', storeSlug: 'central', storeId: 2, storeName: 'Test', sessionToken: 'a'.repeat(64) }));
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  items = [
    { id: 10, name: 'Pan de pita', canonicalKey: 'pan_de_pita', category: 'OTROS', exists: true, active: true, affectedProducts: 2 },
    { id: 11, name: 'Pavo', canonicalKey: 'turkey', category: 'EMBUTIDOS', exists: true, active: true, affectedProducts: 1 },
    { id: 12, name: 'Pan local', canonicalKey: 'pollo_frito', category: 'PANES_MASAS_HARINAS', isSystem: false, exists: true, active: false, affectedProducts: 1 },
  ];
  products = [
    { pizzaId: 10, active: true, pizza: { name: 'Coca-Cola', category: 'Bebidas', ingredients: [] } },
    { pizzaId: 20, active: false, pizza: { name: 'Nuggets de pollo', category: 'Entrantes', ingredients: [{ id: 12, name: 'Pan local', globalStatus: 'ACTIVE', active: false }] } },
    { pizzaId: 21, active: true, pizza: { name: 'Dónuts', category: 'Postres', ingredients: [] } },
  ];
  api.get.mockImplementation(async url => {
    if (url === '/api/auth/session') return { data: { role: 'pos', partnerId: 1, partnerSlug: 'test', storeSlug: 'central', storeId: 2, storeName: 'Test' } };
    if (url === '/api/stores/2') return { data: { active: true, operationsPaused: false } };
    if (url === '/api/myorders/pending') return { data: { items: [] } };
    if (url === '/api/presence/stores/2/status') return { data: { presence: {} } };
    if (url === '/api/stock/2') return { data: products.map(item => ({ ...item })) };
    if (url === '/api/stores/2/ingredients') return { data: items.map(item => ({ ...item })) };
    if (url === '/api/reservations/today/2') return { data: [] };
    throw new Error(`Unexpected request: ${url}`);
  });
  api.patch.mockImplementation(async (url, body) => {
    if (url.startsWith('/api/stock/')) {
      const id = Number(url.split('/')[4]);
      products = products.map(item => item.pizzaId === id ? { ...item, active: body.active } : item);
      return { data: { active: body.active } };
    }
    const id = Number(url.split('/').pop());
    items = items.map(item => item.id === id ? { ...item, active: body.active } : item);
    return { data: { active: body.active } };
  });
});
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; });
async function openInventory() {
  render(<PosApp />);
  const button = await screen.findByRole('button', { name: /Inventario:/ });
  await act(async () => { fireEvent.click(button); });
  await screen.findByRole('heading', { name: 'Ingredientes y productos' });
  await screen.findByRole('button', { name: /Panes, masas y harinas/ });
  await waitFor(() => expect(within(screen.getByRole('heading', { name: 'Ingredientes y productos' }).closest('section')).getByRole('button', { name: 'Sync' })).toBeEnabled());
}
const rowFor = text => screen.getByText(text, { exact: true }).closest('.pos-invItem');

test('shared search switches a complete product without touching an ingredient with the same ID', async () => {
  await openInventory();
  fireEvent.click(screen.getByRole('button', { name: 'Buscar ingredientes o productos' }));
  const input = screen.getByRole('textbox', { name: 'Buscar ingredientes o productos' });
  fireEvent.change(input, { target: { value: 'coca' } });
  const toggle = screen.getByRole('switch', { name: 'Producto: Coca-Cola' });
  expect(within(rowFor('COCA-COLA')).getByText('Producto · Bebidas')).toBeVisible();
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  expect(api.patch).toHaveBeenCalledWith('/api/stock/2/10/active', { active: false });
  expect(items.find(item => item.id === 10).active).toBe(true);
  expect(products.find(item => item.pizzaId === 21).active).toBe(true);
  fireEvent.click(within(screen.getByRole('heading', { name: 'Ingredientes y productos' }).closest('section')).getByRole('button', { name: 'Sync' }));
  await waitFor(() => expect(within(screen.getByRole('heading', { name: 'Ingredientes y productos' }).closest('section')).getByRole('button', { name: 'Sync' })).toBeEnabled());
  expect(screen.getByRole('switch', { name: 'Producto: Coca-Cola' })).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(screen.getByRole('switch', { name: 'Producto: Coca-Cola' }));
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Producto: Coca-Cola' })).toHaveAttribute('aria-checked', 'true'));
  fireEvent.change(input, { target: { value: 'donuts' } });
  expect(screen.getByRole('switch', { name: 'Producto: Dónuts' })).toBeVisible();
});

test('reactivating a dish retains its missing-ingredient warning until that ingredient is restored', async () => {
  await openInventory();
  fireEvent.click(screen.getByRole('button', { name: 'Buscar ingredientes o productos' }));
  const toggle = screen.getByRole('switch', { name: 'Producto: Nuggets de pollo' });
  fireEvent.click(toggle);
  expect(await screen.findByText('No disponible: Pan local')).toBeVisible();
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(items.find(item => item.id === 12).active).toBe(false);
  fireEvent.click(screen.getByRole('switch', { name: 'Ingrediente: Pan local' }));
  await waitFor(() => expect(screen.queryByText('No disponible: Pan local')).not.toBeInTheDocument());
});

test('product errors and concurrent writes preserve the last confirmed state', async () => {
  await openInventory();
  fireEvent.click(screen.getByRole('button', { name: 'Productos 2/3' }));
  let reject;
  api.patch.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }));
  const toggle = screen.getByRole('switch', { name: 'Producto: Coca-Cola' });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(toggle).toBeDisabled();
  expect(within(screen.getByRole('heading', { name: 'Ingredientes y productos' }).closest('section')).getByRole('button', { name: 'Sync' })).toBeDisabled();
  expect(screen.getByRole('switch', { name: 'Producto: Dónuts' })).toBeEnabled();
  fireEvent.click(screen.getByRole('switch', { name: 'Producto: Dónuts' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
  await act(async () => reject(Object.assign(new Error('rejected'), { response: { status: 400 } })));
  expect(await screen.findByText('No se pudo cambiar el producto.')).toBeVisible();
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(toggle).toBeEnabled();
});

test('new families retain ingredient/store identity, active counts and state after reload', async () => {
  await openInventory();
  const category = screen.getByRole('button', { name: /Panes, masas y harinas/ });
  expect(category).toHaveTextContent('1/2');
  fireEvent.click(category);
  expect(within(rowFor('PAN DE PITA')).getByText('Ingrediente · 2 productos')).toBeVisible();
  fireEvent.click(within(rowFor('PAN DE PITA')).getByRole('switch', { checked: true }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/stores/2/ingredients/10', { active: false, source: 'pos' }));
  await waitFor(() => expect(category).toHaveTextContent('0/2'));
  expect(screen.getByRole('button', { name: 'Inventario: 3 elementos desactivados' })).toBeVisible();
  fireEvent.click(within(rowFor('PAN DE PITA')).getByRole('switch', { checked: false }));
  await waitFor(() => expect(category).toHaveTextContent('1/2'));
  expect(items.find(item => item.id === 11).active).toBe(true);
  expect(items.find(item => item.id === 12).active).toBe(false);
  const pane = screen.getByRole('heading', { name: 'Ingredientes y productos' }).closest('section');
  fireEvent.click(within(pane).getByRole('button', { name: 'Sync' }));
  await waitFor(() => expect(screen.queryByText('PAN DE PITA')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Panes, masas y harinas/ }));
  expect(within(rowFor('PAN DE PITA')).getByRole('switch', { checked: true })).toBeVisible();
});

test('new category search toggles only the matching ID and protects local identities', async () => {
  await openInventory();
  fireEvent.click(screen.getByRole('button', { name: 'Buscar ingredientes o productos' }));
  fireEvent.change(screen.getByPlaceholderText('Buscar ingrediente o producto...'), { target: { value: 'Panes' } });
  expect(screen.getByText('PAN DE PITA')).toBeVisible();
  expect(screen.getByText('PAN LOCAL')).toBeVisible();
  expect(screen.queryByText('PAVO')).not.toBeInTheDocument();
  fireEvent.click(within(rowFor('PAN LOCAL')).getByRole('switch', { checked: false }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/stores/2/ingredients/12', { active: true, source: 'pos' }));
});

test('failed and in-flight writes cannot falsely change availability or submit twice', async () => {
  await openInventory();
  const category = screen.getByRole('button', { name: /Panes, masas y harinas/ });
  fireEvent.click(category);
  let reject;
  api.patch.mockImplementationOnce(() => new Promise((resolve, rejectWrite) => { reject = rejectWrite; }));
  const toggle = within(rowFor('PAN DE PITA')).getByRole('switch', { checked: true });
  fireEvent.click(toggle); fireEvent.click(toggle);
  expect(toggle).toBeDisabled();
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(category).toHaveTextContent('1/2');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => reject(new Error('offline')));
  expect(await screen.findByText('No hay confirmación del cambio. Pulsa Sync para comprobar el estado antes de repetir.')).toBeVisible();
  expect(toggle).toBeDisabled();
  expect(toggle).toHaveTextContent('ACTIVO');
  expect(category).toHaveTextContent('1/2');
  const inventory = within(screen.getByRole('heading', { name: 'Ingredientes y productos' }).closest('section'));
  fireEvent.click(inventory.getByRole('button', { name: 'Sync' }));
  await waitFor(() => expect(inventory.getByRole('button', { name: 'Sync' })).toBeEnabled());
  fireEvent.click(category);
  expect(within(rowFor('PAN DE PITA')).getByRole('switch')).toBeEnabled();
  consoleError.mockRestore();
});

