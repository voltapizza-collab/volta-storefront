import { useReducer } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import StorePage from './StorePage';
import PartnerOrderPage from './PartnerOrderPage';
import api from '../services/api';

const mockNavigate = jest.fn();
let mockLocation;
jest.mock('react-router-dom', () => ({
  useParams: () => ({ partnerSlug: 'test', storeSlug: mockLocation.pathname.split('/')[2] }),
  useLocation: () => mockLocation, useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}), { virtual: true });
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../utils/seo', () => ({ buildStorefrontSeo: () => ({}), buildPartnerSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, ReactComponent: () => null }));

const product = { cartLineId: 'saved', pizzaId: 1, name: 'Margherita', size: 'M', qty: 2, price: 10, subtotal: 20 };
const selection = mode => ({ partnerSlug: 'test', storeSlug: 'centro', serviceMode: mode,
  deliveryAddress: mode === 'delivery' ? 'Calle Mayor 12' : '', deliveryAddressLine2: mode === 'delivery' ? '2B' : '',
  deliveryResolution: mode === 'delivery' ? { deliveryFee: 3 } : null });
let store, partner, couponPending, availabilityPending;
const sessions = () => api.post.mock.calls.filter(([path]) => path === '/api/checkout/session');
function App() {
  const [, update] = useReducer(n => n + 1, 0);
  mockNavigate.mockImplementation((pathname, options) => {
    mockLocation = { pathname, search: '', state: options?.state || null };
    update();
  });
  return mockLocation.pathname.endsWith('/order') ? <PartnerOrderPage /> : <StorePage />;
}
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  window.scrollTo = jest.fn(); Element.prototype.scrollTo = jest.fn();
  mockLocation = { pathname: '/test/centro', search: '', state: selection('delivery') };
  store = { id: 1, partnerId: 1, slug: 'centro', storeName: 'Centro', address: 'Plaza del Sol 5', city: 'Madrid', pickupEnabled: true, deliveryEnabled: true };
  partner = { id: 1, slug: 'test', name: 'Test', currency: 'EUR', deliveryPricingMode: 'FIXED', deliveryFeeFixed: 3, paymentPolicySettings: { cash: true } };
  couponPending = null; availabilityPending = null;
  localStorage.setItem('volta-repeat-cart-draft:test:centro', JSON.stringify({ items: [product] }));
  localStorage.setItem('volta-checkout-customer:test', JSON.stringify({ name: 'Test', phone: '612345678' }));
  api.get.mockImplementation(async path => {
    if (path === '/partners/test') return { ...partner, stores: [store] };
    if (path.endsWith('/menu')) return { store, menu: [] };
    if (path.includes('/availability/')) return availabilityPending || { acceptingOrders: true, serviceOpen: true, days: [], paymentMethods: ['card'] };
    return {};
  });
  api.post.mockImplementation(async (path, body) => {
    if (path.endsWith('/delivery/resolve')) return { withinRange: true, nearestStore: store, deliveryFee: 3 };
    if (path === '/api/coupons/validate') return couponPending || { valid: body.deliveryFee > 0, discount: body.deliveryFee,
      coupon: { id: 1, code: 'VOL-DFTEST', type: 'DELIVERY_FREE' }, message: body.deliveryFee > 0 ? 'Envío gratis aplicado.' : 'Este cupón requiere entrega a domicilio.' };
    return {};
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
async function openCart(mode = 'delivery') {
  mockLocation.state = { ...mockLocation.state, ...selection(mode) };
  render(<App />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Abrir carrito' }))[0]);
  return screen.findByRole('region', { name: 'Modalidad del pedido' });
}
const total = () => document.querySelector('.sf-cartFootLine--total strong').textContent;
async function changeTo(mode) {
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar modalidad' }));
  fireEvent.click(await screen.findByRole('button', { name: mode === 'pickup' ? /Recoger En tienda/ : /Enviar a casa/ }));
  if (mode === 'delivery') {
    fireEvent.change(screen.getByPlaceholderText('Busca tu direccion'), { target: { value: 'Calle Nueva 8' } });
    fireEvent.change(screen.getByPlaceholderText('1B, bajo, casa azul...'), { target: { value: '3A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar direccion' }));
  }
  return screen.findByRole('region', { name: 'Modalidad del pedido' });
}

test.each(['delivery', 'pickup'])('%s shows its full destination immediately before payment choices', async mode => {
  const block = await openCart(mode);
  expect(block).toHaveTextContent(mode === 'delivery' ? 'ENTREGA A DOMICILIO' : 'RECOGIDA EN TIENDA');
  expect(block).toHaveTextContent(mode === 'delivery' ? 'Tu pedido será entregado en:Calle Mayor 122B' : 'Tendrás que recoger tu pedido en:CentroPlaza del Sol 5, Madrid');
  expect(block.nextElementSibling).toHaveClass('sf-cartPaymentPanel');
  expect(total()).toBe(mode === 'delivery' ? 'EUR 23.00' : 'EUR 20.00');
  fireEvent.click(screen.getByRole('radio', { name: /Tarjeta/ }));
  const picker = screen.getByRole('dialog', { name: '¿Cómo quieres pagar?' });
  expect(within(picker).getByRole('region').nextElementSibling).toHaveClass('sf-paymentMethodGrid');
});

test.each(['delivery', 'pickup'])('%s switches through the existing editor, preserving products and chosen payment', async from => {
  await openCart(from);
  fireEvent.click(screen.getByRole('radio', { name: /Efectivo/ }));
  const to = from === 'delivery' ? 'pickup' : 'delivery';
  const block = await changeTo(to);
  expect(block).toHaveTextContent(to === 'delivery' ? 'Calle Nueva 8' : 'Plaza del Sol 5');
  expect(total()).toBe(to === 'delivery' ? 'EUR 23.00' : 'EUR 20.00');
  expect(screen.getByRole('radio', { name: /Efectivo/ })).toHaveAttribute('aria-checked', 'true');
  expect(JSON.parse(localStorage.getItem('volta-repeat-cart-draft:test:centro')).items).toEqual([expect.objectContaining({ pizzaId: 1, qty: 2 })]);
  expect(mockLocation.state.checkoutResume).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido en efectivo' }));
  await waitFor(() => expect(sessions()).toHaveLength(1));
  expect(sessions()[0][1]).toEqual(expect.objectContaining({ total: to === 'delivery' ? 23 : 20, paymentMode: 'cash',
    delivery: expect.objectContaining({ method: to === 'delivery' ? 'COURIER' : 'PICKUP', address: to === 'delivery' ? 'Calle Nueva 8' : '', deliveryFee: to === 'delivery' ? 3 : 0 }) }));
});

test('Pay now also shows the confirmation and returns from editing to checkout', async () => {
  render(<App />);
  fireEvent.click((await screen.findAllByRole('button', { name: /Pay now/ }))[0]);
  expect(screen.getByRole('region', { name: 'Modalidad del pedido' })).toHaveTextContent('Calle Mayor 12');
  await changeTo('pickup');
  expect(screen.getByRole('radiogroup', { name: 'Método de pago' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pagar ahora' }));
  await waitFor(() => expect(sessions()).toHaveLength(1));
  expect(sessions()[0][1]).toEqual(expect.objectContaining({ paymentMethod: 'card', total: 20 }));
});

test('a shipping coupon is revalidated, blocks checkout while pending, and explains incompatibility', async () => {
  mockLocation.state.checkoutResume = { items: [product], couponCode: 'VOL-DFTEST' };
  await openCart();
  await waitFor(() => expect(total()).toBe('EUR 20.00'));
  let finish;
  couponPending = new Promise(resolve => { finish = resolve; });
  await changeTo('pickup');
  expect(screen.getByRole('button', { name: 'Comprobando descuento...' })).toBeDisabled();
  expect(sessions()).toHaveLength(0);
  await act(async () => finish({ valid: false, discount: 0, message: 'Este cupón requiere entrega a domicilio.' }));
  expect(await screen.findByText('Este cupón requiere entrega a domicilio.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pagar ahora' })).toBeDisabled();
  expect(total()).toBe('EUR 20.00');
  fireEvent.click(screen.getByRole('button', { name: 'Quitar cupón' }));
  expect(screen.getByRole('button', { name: 'Pagar ahora' })).toBeEnabled();
});

test.each(['delivery', 'pickup'])('unavailable %s remains visible and cannot be silently replaced or paid', async mode => {
  store[mode + 'Enabled'] = false;
  const block = await openCart(mode);
  expect(block).toHaveTextContent('Esta modalidad no está disponible');
  expect(block).toHaveTextContent(mode === 'delivery' ? 'ENTREGA A DOMICILIO' : 'RECOGIDA EN TIENDA');
  expect(screen.getByRole('button', { name: 'Pagar ahora' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar modalidad' }));
  await screen.findByText('Metodo disponible');
  expect(screen.queryByRole('button', { name: mode === 'delivery' ? /Enviar a casa/ : /Recoger En tienda/ })).not.toBeInTheDocument();
  expect(sessions()).toHaveLength(0);
});

test('cancel returns to the original checkout with the cart intact', async () => {
  await openCart();
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar modalidad' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
  expect(await screen.findByRole('region', { name: 'Modalidad del pedido' })).toHaveTextContent('Calle Mayor 12');
  expect(total()).toBe('EUR 23.00');
});

test('changing stores preserves the source cart and checks the new store minimum', async () => {
  await openCart();
  store = { ...store, id: 2, slug: 'norte', storeName: 'Norte', address: 'Calle Norte 9' };
  partner.minimumPaymentAmount = 25;
  const block = await changeTo('pickup');
  expect(block).toHaveTextContent('NorteCalle Norte 9');
  expect(screen.getByText(/Has cambiado de tienda/)).toBeInTheDocument();
  expect(screen.getByText(/Faltan 5,00/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pagar ahora' })).toBeDisabled();
  for (const slug of ['centro', 'norte']) {
    expect(JSON.parse(localStorage.getItem(`volta-repeat-cart-draft:test:${slug}`)).items).toEqual([expect.objectContaining({ pizzaId: 1, qty: 2 })]);
  }
  expect(sessions()).toHaveLength(0);
});

test('a zero delivery fee still revalidates a product coupon when changing mode', async () => {
  partner.deliveryFeeFixed = 0;
  mockLocation.state.checkoutResume = { items: [product], couponCode: 'SAVE' };
  api.post.mockImplementation(async path => path === '/api/coupons/validate'
    ? { valid: true, discount: 2, coupon: { id: 2, code: 'SAVE', kind: 'AMOUNT', amount: 2 } } : {});
  await openCart();
  await waitFor(() => expect(total()).toBe('EUR 18.00'));
  const before = api.post.mock.calls.filter(([path]) => path === '/api/coupons/validate').length;
  await changeTo('pickup');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar ahora' })).toBeEnabled());
  expect(api.post.mock.calls.filter(([path]) => path === '/api/coupons/validate').length).toBeGreaterThan(before);
  expect(total()).toBe('EUR 18.00');
});

test('a cart change while availability is pending cannot submit an outdated checkout', async () => {
  await openCart();
  let finish;
  availabilityPending = new Promise(resolve => { finish = resolve; });
  fireEvent.click(screen.getByRole('button', { name: 'Pagar ahora' }));
  expect(screen.getByRole('button', { name: 'Cambiar modalidad' })).toBeDisabled();
  fireEvent.click(document.querySelector('.sf-cartRemoveBtn'));
  await act(async () => finish({ acceptingOrders: true, days: [] }));
  expect(sessions()).toHaveLength(0);
  expect(await screen.findByText(/El pedido ha cambiado/)).toBeInTheDocument();
});
