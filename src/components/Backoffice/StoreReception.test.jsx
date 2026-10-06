import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../../setupAxios';
import StoreReception from './StoreReception';
jest.mock('../../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
const store = { id: 12, storeName: 'Test', active: true, acceptingOrders: false };
let state;
beforeEach(() => {
  jest.clearAllMocks();
  state = { ...store, status: 'reception_closed', canOpen: true, blockers: [] };
  api.get.mockImplementation(async () => ({ data: { ...state } }));
  api.patch.mockImplementation(async (_, body) => {
    state = { ...state, ...body, operationsPaused: true, status: body.acceptingOrders ? 'paused' : 'reception_closed', scheduledOrdersAvailable: true };
    return { data: { ...state } };
  });
});
test('enabled store explicitly opens reception, keeps pause and can close all orders', async () => {
  render(<StoreReception store={store} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir pedidos' })).toBeEnabled());
  expect(api.patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir pedidos' }));
  await screen.findByText('En pausa');
  expect(screen.getByText('Puedes recibir pedidos programados.')).toBeInTheDocument();
  expect(api.patch).toHaveBeenCalledWith('/api/stores/12/order-reception', { acceptingOrders: true });
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar pedidos' }));
  await screen.findByText('Pedidos cerrados');
});
test('explains missing requirements, refreshes after configuration and handles new server blockers', async () => {
  state.canOpen = false; state.blockers = ['hours', 'menu'];
  const { rerender } = render(<StoreReception store={store} />);
  await screen.findByText('Configura los horarios.');
  expect(screen.getByRole('button', { name: 'Abrir pedidos' })).toBeDisabled();
  state = { ...state, canOpen: true, blockers: [] };
  rerender(<StoreReception store={store} refreshKey="saved" />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir pedidos' })).toBeEnabled());
  state = { ...state, canOpen: false, blockers: ['payment'] };
  api.patch.mockRejectedValueOnce({ response: { data: { error: 'store_not_ready', ...state } } });
  fireEvent.click(screen.getByRole('button', { name: 'Abrir pedidos' }));
  await screen.findByText(/Configura un medio de cobro/);
  expect(screen.getByRole('button', { name: 'Abrir pedidos' })).toBeDisabled();
});
test('unknown status cannot open, can retry, and a double click sends only one mutation', async () => {
  api.get.mockRejectedValueOnce(new Error('offline'));
  render(<StoreReception store={store} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir pedidos' })).toBeEnabled());
  let finish;
  api.patch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Abrir pedidos' }));
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }));
  expect(api.patch).toHaveBeenCalledTimes(1);
  await act(async () => finish({ data: state }));
});

test('compact list shows only a status and never changes reception', async () => {
  state = { ...state, acceptingOrders: true, status: 'outside_hours', scheduledOrdersAvailable: true };
  render(<StoreReception store={store} compact />);
  expect(await screen.findByText('Fuera de horario')).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText('Puedes recibir pedidos programados.')).toBeNull();
  expect(api.patch).not.toHaveBeenCalled();
});

test('compact failed status is unknown instead of claiming the store is closed', async () => {
  api.get.mockRejectedValueOnce(new Error('offline'));
  render(<StoreReception store={store} compact />);
  expect(await screen.findByText('Sin confirmar')).toBeInTheDocument();
  expect(screen.queryByText('Pedidos cerrados')).toBeNull();
});
