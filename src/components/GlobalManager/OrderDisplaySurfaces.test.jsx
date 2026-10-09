import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrdersMovementsModule } from './MyOrdersModule';
import { FinanceBillingModule } from '../Backoffice/BillingModule';
import api from '../../setupAxios';

jest.mock('../../setupAxios', () => ({ __esModule: true, default: { get: jest.fn() } }));

const code = `WEB-${'A'.repeat(32)}`;
const sale = Object.freeze({ id: 775, code, status: 'PAID', total: 4.94, date: '2026-10-08T12:00:00Z', customerName: 'Cliente prueba', storeName: 'Centro', products: [] });
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: { recentSales: [sale, { ...sale, id: 776, code: 'WEB-HISTORICO-123' }] } });
});

test('movements display short codes, search both references and open the matching ticket', async () => {
  render(<OrdersMovementsModule partner={{ id: 1 }} />);
  await screen.findByText('WEB-775');
  expect(screen.queryByText(code)).not.toBeInTheDocument();
  expect(screen.getByText('WEB-HISTORICO-123')).toBeInTheDocument();
  const search = screen.getByPlaceholderText('Nombre, telefono o codigo');
  for (const query of ['web-775', '775', code]) {
    fireEvent.change(search, { target: { value: query } });
    expect(screen.getByText('WEB-775')).toBeInTheDocument();
    expect(screen.queryByText('WEB-HISTORICO-123')).not.toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Ver ticket' }));
  expect(screen.getByRole('heading', { name: 'WEB-775' })).toBeInTheDocument();
  expect(screen.queryByText(code)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  fireEvent.change(search, { target: { value: 'WEB-999' } });
  expect(screen.getByText('Sin movimientos para los filtros seleccionados.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
  expect(screen.getByText('WEB-HISTORICO-123')).toBeInTheDocument();
  expect(sale.code).toBe(code);
});

test('finance displays and exports the same short reference in individual and bulk CSV', async () => {
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => 'blob:test');
  URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    render(<FinanceBillingModule partner={{ id: 1 }} />);
    const reference = await screen.findByText('WEB-775');
    fireEvent.click(within(reference.closest('tr')).getByRole('button', { name: 'Exportar' }));
    expect(click.mock.instances[0].download).toBe('WEB-775.csv');
    fireEvent.click(screen.getByRole('button', { name: 'Recibidos' }));
    fireEvent.click(screen.getByRole('button', { name: 'CSV en lote' }));
    for (const [blob] of URL.createObjectURL.mock.calls) {
      const csv = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
      expect(csv).toContain('"WEB-775"');
      expect(csv).not.toContain(code);
    }
    expect(screen.getByText('WEB-HISTORICO-123')).toBeInTheDocument();
    expect(sale.code).toBe(code);
  } finally {
    click.mockRestore();
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
  }
});
