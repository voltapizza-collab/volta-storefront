import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../setupAxios';
import PosApp from './PosApp';

jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
jest.mock('../components/Backoffice/EngineBackground', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, default: 'pizza.svg', ReactComponent: () => null }));
const originalFetch = global.fetch;
let items;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); localStorage.clear();
  localStorage.setItem('volta_pos_virtual_session', JSON.stringify({ partnerId: 1, storeId: 2, storeName: 'Auditoría' }));
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  items = [
    { id: 10, name: 'Pan de pita', canonicalKey: 'pan_de_pita', category: 'OTROS', exists: true, active: true, affectedProducts: 2 },
    { id: 11, name: 'Pavo', canonicalKey: 'turkey', category: 'EMBUTIDOS', exists: true, active: true, affectedProducts: 1 },
    { id: 12, name: 'Pan local', canonicalKey: 'pollo_frito', category: 'PANES_MASAS_HARINAS', isSystem: false, exists: true, active: false, affectedProducts: 1 },
  ];
  api.get.mockImplementation(async url => {
    if (url === '/api/stores/2') return { data: { active: true, operationsPaused: false } };
    if (url === '/api/myorders/pending') return { data: { items: [] } };
    if (url === '/api/presence/stores/2/status') return { data: { presence: {} } };
    if (url === '/api/stores/2/ingredients') return { data: items.map(item => ({ ...item })) };
    if (url === '/api/reservations/today/2') return { data: [] };
    throw new Error(`Unexpected request: ${url}`);
  });
  api.patch.mockImplementation(async (url, body) => {
    const id = Number(url.split('/').pop());
    items = items.map(item => item.id === id ? { ...item, active: body.active } : item);
    return { data: { active: body.active } };
  });
});
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; });
async function openInventory() {
  render(<PosApp />);
  fireEvent.click(await screen.findByRole('button', { name: /Inventario:/ }));
  await screen.findByRole('heading', { name: 'Ingredientes del menu' });
  await screen.findByRole('button', { name: /Panes, masas y harinas/ });
}
const rowFor = text => screen.getByText(text, { exact: true }).closest('.pos-invItem');

test('new families retain ingredient/store identity, active counts and state after reload', async () => {
  await openInventory();
  const category = screen.getByRole('button', { name: /Panes, masas y harinas/ });
  expect(category).toHaveTextContent('1/2');
  fireEvent.click(category);
  expect(within(rowFor('PAN DE PITA')).getByText('2 productos')).toBeVisible();
  fireEvent.click(within(rowFor('PAN DE PITA')).getByRole('button', { name: 'ACTIVE' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/stores/2/ingredients/10', { active: false, source: 'pos' }));
  await waitFor(() => expect(category).toHaveTextContent('0/2'));
  expect(screen.getByRole('button', { name: 'Inventario: 2 ingredientes desactivados' })).toBeVisible();
  fireEvent.click(within(rowFor('PAN DE PITA')).getByRole('button', { name: 'OFF' }));
  await waitFor(() => expect(category).toHaveTextContent('1/2'));
  expect(items.find(item => item.id === 11).active).toBe(true);
  expect(items.find(item => item.id === 12).active).toBe(false);
  const pane = screen.getByRole('heading', { name: 'Ingredientes del menu' }).closest('section');
  fireEvent.click(within(pane).getByRole('button', { name: 'Sync' }));
  await waitFor(() => expect(screen.queryByText('PAN DE PITA')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Panes, masas y harinas/ }));
  expect(within(rowFor('PAN DE PITA')).getByRole('button', { name: 'ACTIVE' })).toBeVisible();
});

test('new category search toggles only the matching ID and protects local identities', async () => {
  await openInventory();
  fireEvent.click(screen.getByRole('button', { name: 'Buscar ingrediente' }));
  fireEvent.change(screen.getByPlaceholderText('Buscar ingrediente...'), { target: { value: 'Panes' } });
  expect(screen.getByText('PAN DE PITA')).toBeVisible();
  expect(screen.getByText('PAN LOCAL')).toBeVisible();
  expect(screen.queryByText('PAVO')).not.toBeInTheDocument();
  fireEvent.click(within(rowFor('PAN LOCAL')).getByRole('button', { name: 'OFF' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/stores/2/ingredients/12', { active: true, source: 'pos' }));
});

test('failed and in-flight writes cannot falsely change availability or submit twice', async () => {
  await openInventory();
  const category = screen.getByRole('button', { name: /Panes, masas y harinas/ });
  fireEvent.click(category);
  let reject;
  api.patch.mockImplementationOnce(() => new Promise((resolve, rejectWrite) => { reject = rejectWrite; }));
  const toggle = within(rowFor('PAN DE PITA')).getByRole('button', { name: 'ACTIVE' });
  fireEvent.click(toggle); fireEvent.click(toggle);
  expect(toggle).toBeDisabled();
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(category).toHaveTextContent('1/2');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => reject(new Error('offline')));
  expect(await screen.findByText('No se pudo cambiar el ingrediente.')).toBeVisible();
  expect(toggle).toBeEnabled();
  expect(toggle).toHaveTextContent('ACTIVE');
  expect(category).toHaveTextContent('1/2');
  consoleError.mockRestore();
});

