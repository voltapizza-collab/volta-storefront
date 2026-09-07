import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../setupAxios';
import { PosLogin, DayOrderCard } from './PosApp';
import PosLogoutDialog from './PosLogoutDialog';

jest.mock('../setupAxios', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../components/Backoffice/EngineBackground', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, default: 'pizza.svg', ReactComponent: () => null }));
const key = 'volta_pos_remembered_login';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

test('remembers successful credentials only when selected and restores them masked', async () => {
  api.post.mockResolvedValue({ data: { partnerId: 1, storeId: 2 } });
  const onStart = jest.fn();
  const view = render(<PosLogin onStart={onStart} />);
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'partner' } });
  fireEvent.change(screen.getByLabelText('PIN de tienda'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Entrar al POS' }));
  await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
  view.unmount();
  render(<PosLogin onStart={onStart} />);
  expect(screen.getByLabelText('Usuario')).toHaveValue('partner');
  expect(screen.getByLabelText('PIN de tienda')).toHaveValue('123456');
  expect(screen.getByLabelText('PIN de tienda')).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.getByLabelText('PIN de tienda')).toHaveValue('');
});

test('does not persist the PIN without selecting remember', async () => {
  api.post.mockResolvedValue({ data: { partnerId: 1, storeId: 2 } });
  const onStart = jest.fn();
  render(<PosLogin onStart={onStart} />);
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'partner' } });
  fireEvent.change(screen.getByLabelText('PIN de tienda'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar al POS' }));
  await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
  expect(localStorage.getItem(key)).toBeNull();
});

test('ignores malformed remembered credentials', () => {
  localStorage.setItem(key, '{broken');
  render(<PosLogin onStart={jest.fn()} />);
  expect(screen.getByLabelText('PIN de tienda')).toHaveValue('');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

test.each([
  ['cash', 'DELIVERY', 'Efectivo', 'Delivery'],
  ['card', 'PICKUP', 'Tarjeta', 'Pickup'],
])('completed operation shows customer, movement and %s payment with %s service', (paymentMode, delivery, paymentLabel, serviceLabel) => {
  const onOpen = jest.fn();
  render(<DayOrderCard order={{ id: 42, code: 'VOL-42', paymentMode, delivery,
    date: '2026-09-07T10:30:00Z', total: 25.5, currency: 'EUR',
    customerData: { name: 'Ana Pérez' }, products: [{ name: 'Margherita', quantity: 2 }] }} onOpen={onOpen} />);
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  expect(screen.getByText('2× Margherita')).toBeInTheDocument();
  expect(screen.getByText(paymentLabel)).toBeInTheDocument();
  expect(screen.getByText(serviceLabel)).toBeInTheDocument();
  expect(screen.getByText('Finalizada')).toBeInTheDocument();
  expect(screen.getByText(/25,50/)).toBeInTheDocument();
  expect(screen.getByText(/0?7\/0?9, \d{1,2}:30/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('opening and cancelling logout never closes the session; confirmation runs once', async () => {
  const onCancel = jest.fn();
  let finish;
  const onConfirm = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  render(<PosLogoutDialog onCancel={onCancel} onConfirm={onConfirm} />);
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(screen.getByRole('button', { name: 'Cerrando sesión…' })).toBeDisabled();
  expect(onConfirm).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled());
});
