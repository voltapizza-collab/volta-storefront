import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PartnerOrderPage from './PartnerOrderPage';
import StoreGate from '../components/StoreGate';
import api from '../services/api';
const mockNavigate = jest.fn();
const mockLocation = { state: null };
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => mockLocation, useParams: () => ({ partnerSlug: 'test' }) }), { virtual: true });
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../utils/seo', () => ({ buildPartnerSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock('../components/Storefront/OrderPortalTransition', () => () => <p>Cargando</p>);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, ReactComponent: () => null }));
const ourense = { id: 1, slug: 'ary', storeName: 'Plaza de Ary', city: 'Ourense', address: 'Plaza de Ary 1', active: true, acceptingOrders: true };
const vigo = { ...ourense, id: 2, slug: 'vigo', city: 'Vigo', storeName: 'Vigo demo', address: 'Calle Vigo 2' };
const second = { ...ourense, id: 3, slug: 'centro', storeName: 'Centro', address: 'Calle Centro 3' };
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mockLocation.state = null; });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
async function show(stores, state = null) {
  mockLocation.state = state;
  api.get.mockResolvedValue({ slug: 'test', name: 'Test', stores });
  render(<PartnerOrderPage />);
  await act(async () => { jest.advanceTimersByTime(1000); });
}
const pickup = () => fireEvent.click(screen.getByRole('button', { name: /Recoger En tienda/ }));

test.each([ourense, vigo])('city $city with one store enters immediately without a store list', async store => {
  localStorage.setItem('volta-pickup-stores:test', '["ary"]');
  await show([ourense, vigo]); pickup();
  expect(screen.queryByText('Plaza de Ary')).not.toBeInTheDocument();
  expect(screen.queryByText('Vigo demo')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(store.city) }));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith(`/test/${store.slug}`, expect.objectContaining({ state: expect.objectContaining({ serviceMode: 'pickup', storeName: store.storeName }) }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('multiple stores show names and addresses only after selecting their city; closing does not reopen', async () => {
  await show([ourense, second, vigo]); pickup();
  fireEvent.click(screen.getByRole('button', { name: /Ourense/ }));
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByText('Plaza de Ary 1')).toBeInTheDocument();
  expect(screen.getByText('Calle Centro 3')).toBeInTheDocument();
  expect(screen.queryByText('Vigo demo')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  pickup();
  expect(screen.queryByText('Plaza de Ary')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Ourense/ }));
  fireEvent.click(screen.getByRole('button', { name: /Disponible Centro/ }));
  expect(mockNavigate.mock.calls[0][0]).toBe('/test/centro');
});
test('a single city skips city selection and missing-city stores remain reachable', async () => {
  await show([ourense, { ...second, city: ' OURENSE ' }]); pickup();
  expect(screen.queryByText('Ciudades disponibles')).not.toBeInTheDocument();
  expect(screen.getByText('Plaza de Ary')).toBeInTheDocument();
  expect(screen.getByText('Centro')).toBeInTheDocument();
});
test('stores without a city have their own reachable choice', async () => {
  await show([ourense, { ...vigo, city: '' }]); pickup();
  fireEvent.click(screen.getByRole('button', { name: /Otras tiendas/ }));
  expect(mockNavigate.mock.calls[0][0]).toBe('/test/vigo');
});
test('return from delivery with one pickup store skips the modal and clears delivery context', async () => {
  sessionStorage.setItem('volta_storefront_delivery_selection', '{}');
  await show([ourense], { startServiceMode: 'pickup' });
  expect(mockNavigate.mock.calls[0][0]).toBe('/test/ary');
  expect(mockNavigate.mock.calls[0][1].replace).toBe(true);
  expect(sessionStorage.getItem('volta_storefront_delivery_selection')).toBeNull();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test.each(['paused', 'outside_hours'])('single-store gate keeps %s available and ignores disabled stores', orderStatus => {
  render(<StoreGate partner={{ slug: 'test', name: 'Test', stores: [{ ...ourense, orderStatus }, { ...vigo, active: false }] }} />);
  fireEvent.click(screen.getByRole('button', { name: /Pedir en línea/ }));
  expect(mockNavigate.mock.calls[0][0]).toBe('/test/ary');
});
test('single delivery-only store still asks for coverage and never forces pickup', () => {
  render(<StoreGate partner={{ slug: 'test', name: 'Test', stores: [{ ...ourense, pickupEnabled: false }] }} />);
  fireEvent.click(screen.getByRole('button', { name: /Pedir en línea/ }));
  expect(mockNavigate).toHaveBeenCalledWith('/test/order', expect.objectContaining({ state: expect.objectContaining({ startServiceMode: 'delivery' }) }));
});
test('no eligible stores and errors do not navigate; loading gate is disabled', async () => {
  await show([{ ...ourense, acceptingOrders: false }]);
  expect(screen.getByText('Cerrado')).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
  render(<StoreGate loading partner={{ slug: 'test', stores: [ourense] }} />);
  expect(screen.getByRole('button', { name: /Pedir en línea/ })).toBeDisabled();
});
test('failed or unfinished partner loading cannot open selection', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  api.get.mockRejectedValue(new Error('offline'));
  render(<PartnerOrderPage />);
  expect(screen.queryByRole('button', { name: /Recoger/ })).not.toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(screen.getByText('Partner not found')).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('delivery still requires an address and successful coverage before navigation', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await show([ourense, vigo]);
  fireEvent.click(screen.getByRole('button', { name: /Enviar a casa/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar direccion' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText('Busca tu direccion'), { target: { value: 'Calle 1' } });
  fireEvent.change(screen.getByPlaceholderText('1B, bajo, casa azul...'), { target: { value: '2A' } });
  api.post.mockResolvedValue({ withinRange: false });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar direccion' })); });
  expect(mockNavigate).not.toHaveBeenCalled();
  api.post.mockResolvedValue({ withinRange: true, nearestStore: vigo, deliveryFee: 3 });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar direccion' })); });
  expect(mockNavigate).toHaveBeenCalledWith('/test/vigo', expect.objectContaining({ state: expect.objectContaining({ serviceMode: 'delivery', deliveryAddress: 'Calle 1', deliveryAddressLine2: '2A' }) }));
});
