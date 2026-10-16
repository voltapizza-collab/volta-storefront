import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrderItems, buildWindowsPrintTicketHtml } from './PosApp';
import { buildOrderLines } from './printers/mockPrinter';
import { getLineDetailRows } from './orderLineDetails';
jest.mock('../setupAxios', () => ({ __esModule: true, default: {} }));
jest.mock('../components/Backoffice/EngineBackground', () => () => null);
jest.mock('../assets/logo/pizza.svg', () => ({ __esModule: true, default: 'pizza.svg', ReactComponent: () => null }));
const ing = (name, placement, quantity = 'SIMPLE') => ({ name, placement, quantity });
const custom = ingredients => ({ type: 'CUSTOM_BUILD', name: 'Personalizada', size: 'M', ingredients });

test('FULL only prints one heading and preserves simple quantities', () => {
  expect(getLineDetailRows(custom([ing('Mozzarella', 'FULL'), ing('Tomate', 'FULL')]))).toEqual(['FULL', 'Mozzarella: Simple', 'Tomate: Simple']);
});
test('selection order does not dictate zones; quantities, removals, extras and all notes survive without mutating the order', () => {
  const item = { ...custom([ing('Bacon', 'RIGHT', 'DOUBLE'), ing('Jamón', 'LEFT'), ing('Tomate', 'FULL'), ing('Champiñones', 'RIGHT'), ing('Piña', 'LEFT')]),
    extras: [{ name: 'Orégano', placement: 'FULL', quantity: 'DOUBLE' }], removedIngredients: [{ ingredientId: 9, name: 'Ajo', placement: 'LEFT' }], notes: 'Muy hecha', comment: 'Cortar en ocho' };
  const original = JSON.stringify(item);
  const expected = ['FULL', 'Tomate: Simple', 'Extra: Orégano: Doble', 'DERECHA', 'Bacon: Doble', 'Champiñones: Simple', 'IZQUIERDA', 'Jamón: Simple', 'Piña: Simple', 'SIN AJO', 'Nota: Muy hecha', 'Nota: Cortar en ocho'];
  expect(getLineDetailRows(item)).toEqual(expected);
  const order = { id: 42, products: [item], notes: 'No llamar', total: 19.5 };
  render(<OrderItems order={order} />);
  expected.forEach(row => expect(screen.getByText(row)).toBeInTheDocument());
  const html = buildWindowsPrintTicketHtml(order);
  let previous = -1;
  expected.forEach(row => { const index = html.indexOf(row); expect(index).toBeGreaterThan(previous); previous = index; });
  const text = buildOrderLines(order).join('\n');
  expect(text).toContain('  FULL\n  - Tomate: Simple');
  expect(text).toContain('OBSERVACIONES: No llamar');
  expect(text).toContain('Total: 19.50 EUR');
  expect(JSON.stringify(item)).toBe(original);
});
test('half recipes retain A/B semantics with their own extras and no invented right/left titles', () => {
  expect(getLineDetailRows({ type: 'HALF_HALF', leftName: 'Barbacoa', rightName: 'Hawaiana', extras: [
    { name: 'Piña', side: 'B' }, { name: 'Bacon', side: 'A', quantity: 'DOUBLE' },
  ] })).toEqual(['LADO 1: Barbacoa', 'Extra: Bacon: Doble', 'LADO 2: Hawaiana', 'Extra: Piña']);
});
test('JSON fallback, generated labels, unfamiliar labels/positions and missing data remain readable', () => {
  const item = { ...custom([]), customDetails: { ingredients: JSON.stringify([
    { ...ing('Queso', 'LEFT', 'DOUBLE'), label: 'Queso: Mitad izquierda - Doble' },
    { ...ing('Salsa', 'RIGHT'), label: 'Salsa especial sin picante' },
    ing('Olivas', 'CENTER'), 'Albahaca fresca',
  ]) } };
  expect(getLineDetailRows(item)).toEqual(['DERECHA', 'Salsa especial sin picante - Simple', 'IZQUIERDA', 'Queso: Doble', 'SIN UBICACIÓN', 'Olivas: CENTER - Simple', 'Albahaca fresca']);
  expect(getLineDetailRows(custom([]))).toEqual(['Personalizacion sin ingredientes guardados']);
  expect(buildWindowsPrintTicketHtml({ products: [item] })).toContain('<li class="changesHeading">SIN UBICACIÓN</li>');
});
test('malicious names are escaped in Windows and long text is never truncated before native wrapping', () => {
  const name = '<img src=x onerror=alert(1)> Queso de nombre muy largo';
  const order = { products: [custom([ing(name, 'FULL', 'DOUBLE')])] };
  expect(buildWindowsPrintTicketHtml(order)).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(buildWindowsPrintTicketHtml(order)).not.toContain('<img src=x');
  expect(buildOrderLines(order)).toContain(`  - ${name}: Doble`);
});
