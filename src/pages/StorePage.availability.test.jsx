import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StorePage from './StorePage';
import api from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../utils/seo', () => ({ buildStorefrontSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock('react-router-dom', () => {
  const location = { pathname: '/test/centro/menu', search: '', state: null };
  const navigate = jest.fn();
  return { useParams: () => ({ partnerSlug: 'test', storeSlug: 'centro' }), useLocation: () => location,
    useNavigate: () => navigate, Link: ({ children }) => children };
}, { virtual: true });
const dish = { pizzaId: 1, name: 'Barbacoa', categoryId: 1, category: 'Pizzas', selectSize: ['M'], priceBySize: { M: 10 }, available: true, ingredients: [] };
let available;
let heldMenu;
const menuCalls = () => api.get.mock.calls.filter(([path]) => path.endsWith('/menu'));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  window.scrollTo = jest.fn(); Element.prototype.scrollTo = jest.fn();
  available = true; heldMenu = null;
  api.get.mockImplementation(async path => {
    if (path.includes('/availability/')) return { acceptingOrders: true, serviceOpen: true, days: [], paymentMethods: ['card'] };
    if (path === '/partners/test') return { id: 1, slug: 'test', name: 'Test', currency: 'EUR' };
    if (path.endsWith('/menu')) return heldMenu || { store: { id: 1, partnerId: 1, storeName: 'Centro', pickupEnabled: true }, menu: available ? [dish] : [] };
    return {};
  });
  api.post.mockResolvedValue({});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('open menu removes disabled dishes within 15 seconds and restores reactivated dishes', async () => {
  jest.useFakeTimers();
  render(<StorePage />);
  expect((await screen.findAllByRole('button', { name: 'Comprar Barbacoa' })).length).toBeGreaterThan(0);
  available = false;
  await act(async () => jest.advanceTimersByTime(15000));
  expect(screen.queryByRole('button', { name: 'Comprar Barbacoa' })).not.toBeInTheDocument();
  available = true;
  await act(async () => jest.advanceTimersByTime(15000));
  expect((await screen.findAllByRole('button', { name: 'Comprar Barbacoa' })).length).toBeGreaterThan(0);
});

test.each(['focus', 'online'])('refreshes on %s without overlapping requests or clearing the cart', async event => {
  localStorage.setItem('volta-repeat-cart-draft:test:centro', JSON.stringify({ items: [{ ...dish, cartLineId: 'saved', size: 'M', qty: 1, price: 10, subtotal: 10 }] }));
  render(<StorePage />);
  await screen.findAllByRole('button', { name: 'Comprar Barbacoa' });
  let release;
  heldMenu = new Promise(resolve => { release = resolve; });
  const before = menuCalls().length;
  fireEvent(window, new Event(event)); fireEvent(window, new Event(event));
  expect(menuCalls()).toHaveLength(before + 1);
  await act(async () => release({ store: { id: 1, partnerId: 1 }, menu: [] }));
  expect(screen.queryByRole('button', { name: 'Comprar Barbacoa' })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('volta-repeat-cart-draft:test:centro')).items).toHaveLength(1);
});

test('hidden pages stop polling and refresh when visible; unmount removes listeners', async () => {
  jest.useFakeTimers();
  const visibility = jest.spyOn(document, 'visibilityState', 'get');
  visibility.mockReturnValue('visible');
  const view = render(<StorePage />);
  await screen.findAllByRole('button', { name: 'Comprar Barbacoa' });
  const before = menuCalls().length;
  visibility.mockReturnValue('hidden');
  await act(async () => jest.advanceTimersByTime(30000));
  expect(menuCalls()).toHaveLength(before);
  available = false; visibility.mockReturnValue('visible');
  await act(async () => fireEvent(document, new Event('visibilitychange')));
  expect(screen.queryByRole('button', { name: 'Comprar Barbacoa' })).not.toBeInTheDocument();
  view.unmount();
  const after = menuCalls().length;
  await act(async () => { fireEvent(window, new Event('focus')); jest.advanceTimersByTime(30000); });
  expect(menuCalls()).toHaveLength(after);
});

test.each([
  ['cart_item_unavailable', /Un producto o ingrediente de tu carrito ya no está disponible/],
  ['cart_price_changed', /El precio de un artículo ha cambiado/],
  ['cart_offer_unavailable', /Una oferta del carrito ya no cumple sus condiciones/],
  ['cart_line_invalid', /No podemos confirmar la composición de un artículo/],
])('checkout rejection %s keeps the cart, identifies the stale item and refreshes the menu', async (error, message) => {
  localStorage.setItem('volta-repeat-cart-draft:test:centro', JSON.stringify({ items: [{ ...dish, cartLineId: 'saved', size: 'M', qty: 1, price: 10, subtotal: 10 }] }));
  localStorage.setItem('volta-checkout-customer:test', JSON.stringify({ name: 'Test', phone: '612345678' }));
  api.post.mockImplementation(async path => {
    if (path !== '/api/checkout/session') return {};
    available = false;
    throw { response: { data: { error, cartLineId: 'saved' } } };
  });
  render(<StorePage />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Abrir carrito' }))[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Pagar ahora' }));
  await screen.findByText(message);
  expect(await screen.findByText(/Revisa este artículo/)).toBeInTheDocument();
  await waitFor(() => expect(menuCalls().length).toBeGreaterThan(1));
  expect(JSON.parse(localStorage.getItem('volta-repeat-cart-draft:test:centro')).items).toHaveLength(1);
});
