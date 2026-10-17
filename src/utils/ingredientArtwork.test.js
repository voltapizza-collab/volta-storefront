import { ingredientArtwork } from './ingredientArtwork';

test('recognizable ingredients in the same family have their own appearance', () => {
  const cheese = name => ingredientArtwork({ name, category: 'QUESOS' });
  expect(cheese('Cheddar').color).not.toBe(cheese('Mozzarella fresca').color);
  expect(cheese('Queso azul').art).toBe('blue-cheese');
  expect(ingredientArtwork({ name: 'Pulpo' }).art).toBe('tentacle');
  expect(ingredientArtwork({ name: 'Aceituna negra' }).color).not.toBe(ingredientArtwork({ name: 'Aceituna verde' }).color);
  expect(ingredientArtwork({ name: 'Cebolla morada' }).art).toBe('ring');
});

test('cheese textures and round cured meat slices distinguish ingredients within their family', () => {
  const cheeses = ['Mozzarella rallada', 'Mozzarella fresca', 'Cheddar', 'Parmesano'].map(name => ingredientArtwork({name}));
  expect(new Set(cheeses.map(row => row.art)).size).toBe(4);
  const meats = ['Pepperoni', 'Chorizo', 'Salami'].map(name => ingredientArtwork({name}));
  expect(meats.map(row => row.art)).toEqual(['pepperoni', 'chorizo', 'salami']);
  expect(new Set(meats.map(row => row.color)).size).toBe(3);
});

test('sauce recipes override their ingredients and retain distinct colors', () => {
  const sauces = ['Salsa BBQ', 'Salsa de tomate', 'Salsa pesto', 'Salsa blanca', 'Salsa de cheddar'].map(name => ingredientArtwork({ name }));
  expect(sauces.every(row => row.art === 'sauce')).toBe(true);
  expect(new Set(sauces.map(row => row.color)).size).toBe(5);
  expect(ingredientArtwork({ name: 'Ranch' })).toEqual(ingredientArtwork({ name: 'Salsa blanca' }));
  expect(ingredientArtwork({ name: 'Extracto de pimenton' }).color).not.toBe(ingredientArtwork().color);
});

test('accents and case do not change appearance; unknown ingredients have a stable fallback', () => {
  expect(ingredientArtwork({ name: 'ATÚN' })).toEqual(ingredientArtwork({ name: 'atun' }));
  const unknown = { name: 'Especial de la casa', category: 'QUESOS' };
  expect(ingredientArtwork(unknown)).toEqual(ingredientArtwork({ ...unknown, id: 555 }));
  expect(ingredientArtwork(unknown).art).toBe('cheese');
  expect(ingredientArtwork({ name: 'Especial', category: 'PESCADOS_Y_MARISCOS' }).color).toBe('#c5ac9b');
  expect(ingredientArtwork({ name: 'Aceite de oliva' }).art).toBe('sauce');
  expect(ingredientArtwork({ name: 'Carne de cabra' }).art).toBe('piece');
  expect(ingredientArtwork().color).toMatch(/^#[0-9a-f]{6}$/);
});

test('only reviewed tomato sauces cover the base; other sauces and melted cheddar finish above toppings', () => {
  expect(ingredientArtwork({ name: 'SALSA DE TOMATE' }).sauceRole).toBe('BASE');
  expect(ingredientArtwork({ canonicalKey: 'tomato_sauce', name: 'Tomato sauce' }).sauceRole).toBe('BASE');
  expect(ingredientArtwork({ masterCanonicalKey: 'tomate_triturado', name: 'Tomato' }).sauceRole).toBe('BASE');
  for (const name of ['Salsa BBQ', 'Salsa de cheddar', 'Cheddar fundido', 'Salsa blanca', 'Salsa picante', 'Salsa de tomate y chile', 'Miel']) {
    expect(ingredientArtwork({ name }).sauceRole).toBe('TOPPING');
  }
  expect(ingredientArtwork({ name: 'Tomate', canonicalKey: 'tomate' }).art).toBe('tomato');
  expect(ingredientArtwork({ name: 'Cheddar', canonicalKey: 'cheddar' }).art).toBe('cheddar');
  expect(ingredientArtwork({ canonicalKey: 'bbq_sauce', name: 'Salsa de tomate' }).sauceRole).toBe('TOPPING');
});
