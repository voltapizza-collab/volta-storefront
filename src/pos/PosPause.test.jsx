import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../setupAxios';
import PosApp from './PosApp';

jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
jest.mock('../components/Backoffice/EngineBackground', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, default: 'pizza.svg', ReactComponent: () => null }));

const pendingOrder = {
  id: 42, code: 'VOL-42', total: 15, currency: 'EUR', delivery: 'PICKUP',
  customerData: { name: 'Ana' }, products: [{ name: 'Margherita', quantity: 1 }],
};
const scheduledOrder = { ...pendingOrder, scheduledFor: '2099-09-12T20:00:00Z' };
const originalFetch = global.fetch;
let store;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('volta_pos_virtual_session', JSON.stringify({ partnerId: 1, storeId: 2, storeName: 'Test' }));
  localStorage.setItem('volta_pos_accepted_order_notices:2', JSON.stringify(['42']));
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  store = { active: true, operationsPaused: true };
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});

function mockPos(orders) {
  api.get.mockImplementation(async (url) => {
    if (url === '/api/stores/2') return { data: { ...store } };
    if (url === '/api/myorders/pending') return { data: { items: orders } };
    if (url === '/api/presence/stores/2/status') return { data: { presence: {} } };
    if (url === '/api/stores/2/ingredients' || url === '/api/reservations/today/2') return { data: [] };
    throw new Error(`Unexpected request: ${url}`);
  });
  api.patch.mockImplementation(async (url, { paused }) => {
    store = { ...store, operationsPaused: paused };
    return { data: { ...store } };
  });
}

test.each([
  ['an empty queue', []],
  ['a pending order', [pendingOrder]],
  ['a scheduled order', [scheduledOrder]],
])('pause fills the workspace with %s and restores the queue after confirmation', async (_, orders) => {
  mockPos(orders);
  const { container } = render(<PosApp />);
  const resume = await screen.findByRole('button', { name: 'Reanudar operaciones' });
  await waitFor(() => expect(container.querySelector('.pos-topChip--queue strong')).toHaveTextContent(String(orders.length)));
  expect(screen.getByRole('region', { name: 'Estado de operaciones' })).toHaveClass('pos-pauseBanner--full');
  expect(container.querySelector('.pos-workspace')).not.toBeInTheDocument();
  expect(screen.queryByText('VOL-42')).not.toBeInTheDocument();

  let confirmResume;
  api.patch.mockImplementationOnce(() => new Promise(resolve => { confirmResume = resolve; }));
  fireEvent.click(resume);
  expect(api.patch).toHaveBeenCalledWith('/api/stores/2/operations-pause', { paused: false });
  expect(screen.getByRole('button', { name: 'Reanudando…' })).toBeDisabled();
  expect(container.querySelector('.pos-workspace')).not.toBeInTheDocument();
  await act(async () => confirmResume({ data: { operationsPaused: false } }));
  expect(screen.queryByRole('region', { name: 'Estado de operaciones' })).not.toBeInTheDocument();
  if (orders.length) {
    expect(screen.getByLabelText('Cola de pedidos')).toHaveTextContent('VOL-42');
  } else {
    expect(screen.getByText('Sin pedidos pendientes')).toBeInTheDocument();
  }
});

test('pausing from an open ticket hides it and resuming restores it', async () => {
  store.operationsPaused = false;
  mockPos([scheduledOrder]);
  render(<PosApp />);
  fireEvent.click(await screen.findByRole('button', { name: /VOL-42/ }));
  expect(screen.getByRole('heading', { name: 'VOL-42' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Menu POS' }));
  fireEvent.click(screen.getByRole('button', { name: /Pausar operaciones/ }));
  await screen.findByRole('button', { name: 'Reanudar operaciones' });
  expect(api.patch).toHaveBeenCalledWith('/api/stores/2/operations-pause', { paused: true });
  expect(screen.queryByRole('heading', { name: 'VOL-42' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cola' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reanudar operaciones' }));
  expect(await screen.findByRole('heading', { name: 'VOL-42' })).toBeInTheDocument();
});

test('a failed resume keeps the queue hidden and allows retrying', async () => {
  mockPos([scheduledOrder]);
  api.patch.mockRejectedValueOnce(new Error('Offline'));
  const { container } = render(<PosApp />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reanudar operaciones' }));
  await screen.findByText(/No se pudo confirmar el cambio de pausa/);
  expect(screen.getByRole('region', { name: 'Estado de operaciones' })).toHaveClass('pos-pauseBanner--full');
  expect(container.querySelector('.pos-workspace')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reanudar operaciones' })).toBeEnabled();
});

test('a new scheduled order stays hidden during pause and its notice returns on resume', async () => {
  localStorage.removeItem('volta_pos_accepted_order_notices:2');
  const orders = [];
  mockPos(orders);
  const { container } = render(<PosApp />);
  await screen.findByRole('button', { name: 'Reanudar operaciones' });
  await waitFor(() => expect(container.querySelector('.pos-syncChip')).toHaveAttribute('aria-busy', 'false'));

  orders.push(scheduledOrder);
  fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
  await waitFor(() => expect(container.querySelector('.pos-topChip--queue strong')).toHaveTextContent('1'));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.queryByText('VOL-42')).not.toBeInTheDocument();
  expect(container.querySelector('.pos-workspace')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Reanudar operaciones' }));
  expect(await screen.findByRole('alertdialog', { name: 'Pedido nuevo' })).toHaveTextContent('VOL-42');
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar pedido' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Cola de pedidos')).toHaveTextContent('VOL-42');
});
