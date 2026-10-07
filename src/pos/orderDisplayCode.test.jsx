import { getPosOrderCode } from './orderDisplayCode';
import { buildOrderLines } from './printers/mockPrinter';
import { buildWindowsPrintTicketHtml, TicketPreview } from './PosApp';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('../setupAxios', () => ({ __esModule: true, default: {} }));
jest.mock('../components/Backoffice/EngineBackground', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, default: 'pizza.svg', ReactComponent: () => null }));

test('web references display a stable unique short number in the POS and both printers without changing tracking', () => {
  const order = Object.freeze({ id: 775, code: `WEB-${'A'.repeat(32)}`, products: [], total: 4.94 });
  expect(getPosOrderCode(order)).toBe('WEB-775');
  expect(getPosOrderCode({ ...order, id: 776 })).toBe('WEB-776');
  expect(buildOrderLines(order)).toContain('Pedido: WEB-775');
  const html = buildWindowsPrintTicketHtml(order);
  expect(html).toContain('WEB-775');
  expect(html).not.toContain(order.code);
  render(<TicketPreview order={order} />);
  expect(screen.getByText('WEB-775')).toBeInTheDocument();
  expect(screen.queryByText(order.code)).not.toBeInTheDocument();
  expect(order.code).toBe(`WEB-${'A'.repeat(32)}`);
});

test('existing short codes and test tickets remain recognizable; no ID means keep the full reference', () => {
  expect(getPosOrderCode({ id: 8, code: 'WEB-12345' })).toBe('WEB-12345');
  expect(getPosOrderCode({ code: 'PRUEBA-58MM' })).toBe('PRUEBA-58MM');
  expect(getPosOrderCode({ code: `WEB-${'A'.repeat(32)}` })).toBe(`WEB-${'A'.repeat(32)}`);
  expect(getPosOrderCode({ id: 8 })).toBe('8');
});
