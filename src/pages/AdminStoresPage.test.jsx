import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../setupAxios';
import AdminStoresPage from './AdminStoresPage';
jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
const store = { id: 12, storeName: 'Central', city: 'Vigo', address: 'Calle 1', active: true, acceptingOrders: true, latitude: 42, longitude: -8 };
beforeEach(() => {
  jest.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  api.get.mockImplementation(async path => {
    if (path === '/partners') throw new Error('Global partner list is forbidden');
    if (path === '/partners/by-id/7') return { data: { id: 7, name: 'Partner' } };
    if (path === '/api/stores?partnerId=7') return { data: [store] };
    if (path.endsWith('/order-reception')) return { data: { ...store, status: 'outside_hours', scheduledOrdersAvailable: true, canOpen: true } };
    return { data: [] };
  });
});

test('partner list uses its own business, loads without global access and shows one order status', async () => {
  render(<AdminStoresPage initialPartnerId="7" lockPartner />);
  expect(await screen.findByText('Central')).toBeInTheDocument();
  expect(await screen.findByText('Fuera de horario')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/partners/by-id/7');
  expect(api.get).not.toHaveBeenCalledWith('/partners');
  expect(screen.queryByText('No pudimos cargar el modulo de tiendas.')).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
  const list = screen.getByRole('table');
  expect(within(list).getAllByRole('columnheader')).toHaveLength(4);
  expect(within(list).getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Cerrar pedidos' })).toBeNull();
});

test('management keeps reception controls and editing available outside the list', async () => {
  render(<AdminStoresPage initialPartnerId="7" lockPartner />);
  fireEvent.click(await screen.findByRole('button', { name: 'Gestionar Central' }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByRole('button', { name: 'Cerrar pedidos' })).toBeEnabled();
  expect(within(dialog).getByText('Puedes recibir pedidos programados.')).toBeInTheDocument();
  for (const name of ['Menu', 'Horarios', 'Acceso POS', 'Reporte', 'Reservas']) expect(within(dialog).getByRole('button', { name })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Editar' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(await screen.findByDisplayValue('Central')).toBeInTheDocument();
  expect(api.patch).not.toHaveBeenCalled();
});

test('a genuine loading failure can recover by retrying', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  api.get.mockRejectedValueOnce(new Error('offline'));
  render(<AdminStoresPage initialPartnerId="7" lockPartner />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Central')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('No pudimos cargar el modulo de tiendas.')).toBeNull());
  errorLog.mockRestore();
});
