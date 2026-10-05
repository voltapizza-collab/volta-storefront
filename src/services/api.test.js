import api from './api';
import axiosApi from '../setupAxios';
jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn() } }));
test('the storefront wrapper forwards the signed receipt header', async () => {
  axiosApi.get.mockResolvedValue({ data: { orders: [] } });
  const config = { headers: { 'X-Volta-Receipts': '["receipt"]' } };
  expect(await api.get('/api/myorders/repeat/recent', config)).toEqual({ orders: [] });
  expect(axiosApi.get).toHaveBeenCalledWith('/api/myorders/repeat/recent', config);
});
