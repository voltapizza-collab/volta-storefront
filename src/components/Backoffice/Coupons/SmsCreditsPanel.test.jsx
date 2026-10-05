import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SmsCreditsPanel from './SmsCreditsPanel';
import api from '../../../setupAxios';
jest.mock('../../../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

test('a changed tariff refreshes the package for review instead of starting another payment', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  api.get.mockResolvedValueOnce({ data: { balance: { sellPrice: 0.075, smsCredits: 8 }, packages: [{ amount: 10, credits: 133 }] } })
    .mockResolvedValueOnce({ data: { balance: { sellPrice: 0.08, smsCredits: 8 }, packages: [{ amount: 10, credits: 125 }] } });
  api.post.mockRejectedValue({ response: { data: { error: 'sms_price_changed' } } });
  render(<SmsCreditsPanel partnerId={1} />);
  await screen.findByText('133 SMS cortos');
  fireEvent.click(screen.getByRole('button', { name: 'Comprar' }));
  await screen.findByText(/La tarifa SMS ha cambiado/);
  await screen.findByText('125 SMS cortos');
  expect(screen.getByText(/Tarifa vigente: 0,08/)).toBeInTheDocument();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post).toHaveBeenCalledWith('/api/sms-credits/1/checkout-session', expect.objectContaining({ packageAmount: 10, smsUnitPriceEur: 0.075 }));
  jest.restoreAllMocks();
});
