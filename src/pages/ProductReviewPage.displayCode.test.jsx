import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductReviewPage from './ProductReviewPage';
import api from '../setupAxios';
jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('react-router-dom', () => ({ useParams: () => ({ token: 'review-token' }), Link: ({ children, to }) => <a href={to}>{children}</a> }), { virtual: true });

test.each([
  { orderCode: `WEB-${'A'.repeat(32)}`, displayCode: 'WEB-775', expected: 'WEB-775' },
  { orderCode: 'WEB-HISTORICO-123', expected: 'WEB-HISTORICO-123' },
])('reviews display $expected while loading through the original review token', async ({ expected, ...review }) => {
  api.get.mockResolvedValue({ data: { ok: true, review: { ...review, items: [] } } });
  render(<ProductReviewPage />);
  expect(await screen.findByText(expected)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/api/product-reviews/review-token');
  if (review.displayCode) expect(screen.queryByText(review.orderCode)).not.toBeInTheDocument();
});
