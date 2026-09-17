import { buildWindowsPrintTicketHtml } from './PosApp';
import { buildOrderLines } from './printers/mockPrinter';
import { isCashPaymentPending } from './orderPayment';

jest.mock('../setupAxios', () => ({ __esModule: true, default: {} }));
jest.mock('../components/Backoffice/EngineBackground', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, default: 'pizza.svg', ReactComponent: () => null }));

test.each([
  ['confirmed card with stale pending status', { status: 'PAID', paymentMode: 'card', paymentStatus: 'awaiting_card_payment' }, 'Tarjeta pagada', false],
  ['normalized card overrides old cash metadata', { status: 'PAID', paymentMode: 'card', paymentStatus: 'card_paid', customerData: { paymentMode: 'cash', paymentStatus: 'cash_pending' } }, 'Tarjeta pagada', false],
  ['explicit card with a stale cash status', { status: 'PAID', customerData: { paymentMode: 'card', paymentStatus: 'cash_pending' } }, 'Tarjeta pagada', false],
  ['unpaid card', { status: 'AWAITING_PAYMENT', paymentMode: 'card', paymentStatus: 'awaiting_card_payment' }, 'Tarjeta pendiente', false],
  ['Stripe session alone does not prove payment', { status: 'AWAITING_PAYMENT', stripeCheckoutSessionId: 'cs_test' }, 'Tarjeta pendiente', false],
  ['cash accepted into kitchen remains uncollected', { status: 'PAID', customerData: { paymentMode: 'cash', paymentStatus: 'cash_pending' } }, 'Efectivo pendiente', true],
  ['collected cash', { status: 'PAID', paymentMode: 'cash', paymentStatus: 'cash_paid' }, 'Efectivo cobrado', false],
  ['legacy collected cash', { status: 'PAID', customerData: { paymentMode: ' EFECTIVO ', paymentStatus: ' PAID ' } }, 'Efectivo cobrado', false],
  ['unknown payment is not assumed paid', { status: 'PAID' }, 'Por confirmar', false],
  ['canceled card is not assumed paid', { status: 'CANCELED', paymentMode: 'card' }, 'Tarjeta', false],
])('%s agrees on Windows and Sunmi receipts', (_name, payment, label, cashPending) => {
  const order = { id: 1, code: 'PAYMENT-TEST', total: 11.18, products: [], ...payment };
  expect(buildOrderLines(order)).toContain(`Pago: ${label}`);
  const html = buildWindowsPrintTicketHtml(order);
  expect(html).toContain(`Pago: ${label}`);
  expect(html.includes('PENDIENTE DE PAGO EN EFECTIVO</div>')).toBe(cashPending);
  expect(isCashPaymentPending(order)).toBe(cashPending);
});
