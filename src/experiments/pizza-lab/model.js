import { buildCustomPizzaLine, getCustomIngredientPrice, scaleIngredientPriceForSize } from '../../utils/customPizza';

export const initialPizza = { size: 'M', qty: 1, ingredients: {}, notes: '' };
export function pizzaReducer(state, action) {
  if (action.type === 'undo') return state.past.length ? { present: state.past[state.past.length - 1], past: state.past.slice(0, -1) } : state;
  const next = { ...state.present };
  if (action.type === 'ingredient') {
    if (!['FULL', 'RIGHT', 'LEFT'].includes(action.placement) || !['SIMPLE', 'DOUBLE'].includes(action.quantity)) return state;
    next.ingredients = { ...next.ingredients, [action.id]: { placement: action.placement, quantity: action.quantity } };
  } else if (action.type === 'remove') {
    next.ingredients = { ...next.ingredients }; delete next.ingredients[action.id];
  } else if (action.type === 'size') next.size = action.value;
  else if (action.type === 'qty') next.qty = Math.max(1, Math.min(20, Number(action.value) || 1));
  else if (action.type === 'notes') next.notes = action.value;
  else return state;
  return { present: next, past: [...state.past, state.present].slice(-50) };
}

export function makeLabLine(state, category, catalog, now) {
  if (!category.selectSize.includes(state.size)) throw new Error('Tamaño no disponible');
  const selected = Object.entries(state.ingredients).map(([id, selection]) => {
    const ingredient = catalog.find(row => row.id === Number(id));
    if (!ingredient || ingredient.active === false || ingredient.status === 'INACTIVE') throw new Error('Ingrediente no disponible');
    return { ...ingredient, ...selection, ingredientId: ingredient.id, basePrice: scaleIngredientPriceForSize(ingredient.costPrice, state.size) };
  });
  const base = category.priceBySize[state.size];
  const ingredientsTotal = selected.reduce((sum, row) => sum + getCustomIngredientPrice(row), 0);
  const allergens = [...new Set(selected.flatMap(row => row.allergens || []))].sort();
  return { ...buildCustomPizzaLine({ selectedCustomCategory: category, customSize: state.size,
    customQty: state.qty, customBasePrice: base, customIngredients: Object.fromEntries(selected.map(row => [row.id, row])),
    scopedCustomIngredientsCatalog: catalog, customSelectedAllergens: allergens,
    customGrandTotal: (base + ingredientsTotal) * state.qty, now,
  }), notes: state.notes };
}

// Deterministic placement keeps pieces still when unrelated selections change.
export function toppingPoints(id, placement, quantity) {
  const count = (placement === 'FULL' ? 16 : 8) * (quantity === 'DOUBLE' ? 2 : 1);
  return Array.from({ length: count }, (_, i) => {
    const radius = 24 + Math.sqrt((i + 0.5) / count) * 112;
    const turn = ((i * 0.61803398875 + id * 0.137) % 1);
    const angle = placement === 'FULL' ? turn * Math.PI * 2 : (turn - 0.5) * Math.PI;
    const x = Math.cos(angle) * radius;
    return { x: 200 + (placement === 'LEFT' ? -Math.max(14, x) : placement === 'RIGHT' ? Math.max(14, x) : x), y: 200 + Math.sin(angle) * radius, rotation: (i * 73 + id * 29) % 360 };
  });
}
