import { sortIngredientsForBuilding } from './ingredientPresentationOrder';
const rows = (category, names) => names.map((name, id) => ({ id, name, category }));
const names = ingredients => ingredients.map(row => row.name);

test('sauces follow preparation priority instead of alphabetical API order', () => {
  const input = rows('SALSAS_CONDIMENTOS_BASES', ['Salsa BBQ', 'Salsa pesto', 'Salsa blanca', 'Salsa Tomate', 'Salsa picante']);
  expect(names(sortIngredientsForBuilding(input))).toEqual(['Salsa Tomate', 'Salsa blanca', 'Salsa BBQ', 'Salsa pesto', 'Salsa picante']);
  expect(input[0].name).toBe('Salsa BBQ');
  expect(names(sortIngredientsForBuilding(rows('SALSAS_CONDIMENTOS_BASES', ['Salsa BBQ', 'Ranch', 'Salsa Tomate'])))).toEqual(['Salsa Tomate', 'Ranch', 'Salsa BBQ']);
});
test('mozzarella varieties precede complementary cheeses', () => {
  const input = rows('QUESOS', ['Arzua', 'Cheddar', 'Queso azul', 'Mozzarella fresca', 'Parmesano', 'Mozzarella rallada']);
  expect(names(sortIngredientsForBuilding(input))).toEqual(['Mozzarella rallada', 'Mozzarella fresca', 'Cheddar', 'Parmesano', 'Arzua', 'Queso azul']);
});
test('embutidos have a culinary order and unrecognized ingredients retain stable ties', () => {
  const input = rows('EMBUTIDOS_CHARCUTERIA', ['Especial Z', 'Bacon', 'Jamón', 'Salami', 'Chorizo', 'Pepperoni', 'Especial A']);
  const result = sortIngredientsForBuilding(input);
  expect(names(result)).toEqual(['Pepperoni', 'Chorizo', 'Salami', 'Jamón', 'Bacon', 'Especial Z', 'Especial A']);
  expect(result).toHaveLength(input.length);
  expect(new Set(result.map(row => row.id)).size).toBe(input.length);
  const mixed = [...rows('CARNES_AVES', ['Pollo', 'Carne picada']), ...rows('EMBUTIDOS_CHARCUTERIA', ['Bacon', 'Chorizo', 'Pepperoni'])];
  expect(names(sortIngredientsForBuilding(mixed))).toEqual(['Pepperoni', 'Chorizo', 'Bacon', 'Pollo', 'Carne picada']);
});
