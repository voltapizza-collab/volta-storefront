import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PartnerOrderPage from './PartnerOrderPage';
import api from '../services/api';
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../utils/seo', () => ({ buildPartnerSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock('../components/Storefront/OrderPortalTransition', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, ReactComponent: () => null }));
jest.mock('react-router-dom', () => {
  const location = { state: null };
  return { useParams: () => ({ partnerSlug: 'test' }), useLocation: () => location, useNavigate: () => jest.fn() };
}, { virtual: true });
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => jest.useRealTimers());
async function show(stores) {
  api.get.mockResolvedValue({ name: 'Test', stores });
  render(<PartnerOrderPage />);
  await act(async () => { jest.advanceTimersByTime(1000); });
}
test('public reception closure does not falsely say no active stores', async () => {
  await show([{ active: true, acceptingOrders: false }]);
  expect(screen.getByText('La recepción de pedidos online está cerrada temporalmente. Vuelve más tarde.')).toBeInTheDocument();
});
test('no enabled store explains preparation', async () => {
  await show([]);
  expect(screen.getByText('En preparación')).toBeInTheDocument();
});
test.each(['paused', 'outside_hours'])('keeps scheduled entry for %s stores', async orderStatus => {
  await show([{ id: 12, slug: 'central', active: true, acceptingOrders: true, orderStatus, pickupEnabled: true, deliveryEnabled: false }]);
  expect(screen.getByRole('button', { name: /Recoger/ })).toBeInTheDocument();
  expect(screen.queryByText('Cerrado')).not.toBeInTheDocument();
});
