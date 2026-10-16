import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PizzaLab from './PizzaLab';
import { initialPizza, makeLabLine, pizzaReducer, toppingPoints } from './model';
import { catalog, category } from './catalog';
import { buildOrderLines } from '../../pos/printers/mockPrinter';
import { scaleIngredientPriceForSize, getCustomIngredientPrice } from '../../utils/customPizza';

test('shared prices preserve size scaling, double and half multipliers including comma costs', () => {
  expect(scaleIngredientPriceForSize('1,50', 'XL')).toBe(2.67);
  expect(getCustomIngredientPrice({ basePrice: 2.67, placement: 'LEFT', quantity: 'DOUBLE' })).toBe(2.67);
  expect(getCustomIngredientPrice({ basePrice: 2.67, placement: 'FULL', quantity: 'DOUBLE' })).toBe(5.34);
  expect(getCustomIngredientPrice({ basePrice: 2.67 })).toBe(0);
});
test('editing, removal, size changes and undo keep the same canonical line and ticket', () => {
  let state = { present: initialPizza, past: [] };
  state = pizzaReducer(state, { type: 'ingredient', id: 5, placement: 'RIGHT', quantity: 'DOUBLE' });
  state = pizzaReducer(state, { type: 'ingredient', id: 3, placement: 'FULL', quantity: 'SIMPLE' });
  state = pizzaReducer(state, { type: 'ingredient', id: 8, placement: 'LEFT', quantity: 'SIMPLE' });
  const line = makeLabLine(state.present, category, catalog, 123);
  expect(line).toMatchObject({ type: 'CUSTOM_BUILD', cartLineId: 'custom-pizza-lab-123', price: 6.4, size: 'M', qty: 1, allergens: ['LECHE'] });
  expect(line.subtotal).toBeCloseTo(9.6, 2);
  expect(line.customDetails.ingredients).toHaveLength(3);
  expect(line.customMeta).toMatchObject({ categoryId: 1, pricingRule: 'CATEGORY_CONFIGURED' });
  const lines = buildOrderLines({ products: [line] });
  expect(lines.indexOf('  FULL')).toBeLessThan(lines.indexOf('  DERECHA'));
  expect(lines.indexOf('  DERECHA')).toBeLessThan(lines.indexOf('  IZQUIERDA'));
  state = pizzaReducer(state, { type: 'size', value: 'XL' });
  expect(makeLabLine(state.present, category, catalog).subtotal).toBeCloseTo(15.29, 2);
  state = pizzaReducer(state, { type: 'remove', id: 5 });
  expect(makeLabLine(state.present, category, catalog).ingredients).toHaveLength(2);
  state = pizzaReducer(state, { type: 'undo' });
  state = pizzaReducer(state, { type: 'undo' });
  expect(makeLabLine(state.present, category, catalog, 123)).toEqual(line);
  expect(initialPizza.ingredients).toEqual({});
});
test('visual pieces stay inside their selected half and doubles have twice the density', () => {
  for (const placement of ['FULL', 'RIGHT', 'LEFT']) {
    const points = toppingPoints(5, placement, 'SIMPLE');
    expect(toppingPoints(5, placement, 'DOUBLE')).toHaveLength(points.length * 2);
    points.forEach(({ x, y }) => {
      expect(Math.hypot(x - 200, y - 200)).toBeLessThan(151);
      if (placement === 'RIGHT') expect(x).toBeGreaterThan(200);
      if (placement === 'LEFT') expect(x).toBeLessThan(200);
    });
  }
});
test('mobile-friendly controls support add, edit, remove, undo and review into a local demo cart', () => {
  render(<PizzaLab />);
  expect(screen.getByRole('button', { name: /Mi pizza está lista/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Elegir Salsa de tomate' }));
  const editor = screen.getByRole('region', { name: 'Configurar Salsa de tomate' });
  fireEvent.click(within(editor).getByRole('button', { name: 'Derecha' }));
  fireEvent.click(within(editor).getByRole('button', { name: 'Doble' }));
  fireEvent.click(within(editor).getByRole('button', { name: /Poner en mi pizza/ }));
  expect(screen.getByText('Derecha · Doble')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Editar Salsa de tomate' }));
  fireEvent.click(screen.getByRole('button', { name: 'Izquierda' }));
  fireEvent.click(screen.getByRole('button', { name: /Guardar cambio/ }));
  expect(screen.getByText('Izquierda · Doble')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar Salsa de tomate' }));
  fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }));
  fireEvent.click(screen.getByRole('button', { name: /Mi pizza está lista/ }));
  fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Cortar en ocho' } });
  fireEvent.click(screen.getByRole('button', { name: /Añadir a bandeja de prueba/ }));
  const cart = screen.getByRole('region', { name: 'Bandeja de prueba' });
  expect(within(cart).getByText(/Nota: Cortar en ocho/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Pizza añadida');
});
