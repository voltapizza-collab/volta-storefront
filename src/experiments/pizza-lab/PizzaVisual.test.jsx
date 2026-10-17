import { render } from '@testing-library/react';
import PizzaVisual from './PizzaVisual';
import { ingredientArtwork } from '../../utils/ingredientArtwork';

const ingredient = (id, name, placement = 'FULL', quantity = 'SIMPLE') =>
  ({ id, name, placement, quantity, ...ingredientArtwork({ name }) });

test('base sauce stays below solid ingredients and finishing sauces stay above them regardless of selection order', () => {
  const rows = [ingredient(50, 'Salsa BBQ'), ingredient(53, 'Salsa Tomate'), ingredient(34, 'Cheddar'), ingredient(6, 'Jamón')];
  const { container } = render(<PizzaVisual ingredients={rows} catalog={rows} />);
  expect([...container.querySelectorAll('[data-ingredient]')].map(el => el.dataset.ingredient)).toEqual(['53', '34', '6', '50']);
  const tomato = container.querySelector('[data-ingredient="53"]');
  expect(tomato.dataset.sauceRole).toBe('BASE');
  expect(tomato.querySelector('circle').getAttribute('r')).toBe('149');
  const bbq = container.querySelector('[data-ingredient="50"]');
  expect(bbq.dataset.sauceRole).toBe('TOPPING');
  expect(bbq.querySelector('circle')).toBeNull();
  expect(bbq.querySelectorAll('path')).toHaveLength(5);
});

test('finishing sauces respect half clipping and double quantity increases visible lines without filling the pizza', () => {
  const rows = [ingredient(50, 'Salsa BBQ', 'RIGHT'), ingredient(65, 'Cheddar fundido', 'LEFT', 'DOUBLE')];
  const { container } = render(<PizzaVisual ingredients={rows} catalog={rows} />);
  for (const [id, side, count] of [[50, 'RIGHT', 5], [65, 'LEFT', 9]]) {
    const group = container.querySelector(`[data-ingredient="${id}"]`);
    const clip = group.getAttribute('clip-path').slice(5, -1);
    expect(clip.endsWith(side)).toBe(true);
    expect(container.querySelector(`[id="${clip}"] path`)).not.toBeNull();
    expect(group.querySelectorAll('path')).toHaveLength(count);
    expect(group.querySelector('circle')).toBeNull();
  }
  expect(container.querySelector('[data-ingredient="50"] [stroke]').getAttribute('stroke')).toBe('#713e2c');
  expect(container.querySelector('[data-ingredient="65"] [stroke]').getAttribute('stroke')).toBe('#efa52c');
});

test('legacy laboratory sauce data also uses the central base allowlist', () => {
  const rows = [{ id: 1, name: 'Salsa de tomate', art: 'sauce', color: 'red', placement: 'FULL' },
    { id: 2, name: 'Salsa especial', art: 'sauce', color: 'orange', placement: 'FULL', sauceRole: 'BASE' }];
  const { container } = render(<PizzaVisual ingredients={rows} catalog={rows} />);
  expect(container.querySelector('[data-ingredient="1"]').dataset.sauceRole).toBe('BASE');
  expect(container.querySelector('[data-ingredient="2"]').dataset.sauceRole).toBe('TOPPING');
});

test('mozzarella covers its selected half below toppings while distinctive cheeses retain their pieces', () => {
  const rows = [ingredient(50, 'Salsa BBQ'), ingredient(3, 'Mozzarella rallada', 'LEFT'), ingredient(4, 'Queso azul'), ingredient(53, 'Salsa Tomate')];
  const { container } = render(<PizzaVisual ingredients={rows} catalog={rows} />);
  expect([...container.querySelectorAll('[data-ingredient]')].map(el => el.dataset.ingredient)).toEqual(['53', '3', '4', '50']);
  const mozzarella = container.querySelector('[data-ingredient="3"]');
  expect(mozzarella.getAttribute('clip-path')).toContain('LEFT');
  expect(mozzarella.querySelector('[data-cheese-coverage]')).not.toBeNull();
  expect(container.querySelector('[data-ingredient="4"] [data-cheese-coverage]')).toBeNull();
});
