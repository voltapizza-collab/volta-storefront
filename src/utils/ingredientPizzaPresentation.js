import presentation from '../data/ingredientPizzaPresentation.json';

// Companion to the ingredient master: display metadata only. Legacy keys remain
// separate from master identities; no price, recipe or taxonomy changes here.
const normalize = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const byKey = new Map();
const byName = new Map();
for (const row of presentation.ingredients) {
  for (const key of row.canonicalKeys) byKey.set(key, row);
  for (const name of row.names) byName.set(normalize(name), row);
}

export function getPizzaSaucePresentation(ingredient = {}) {
  const keys = [ingredient.catalogState?.masterCanonicalKey, ingredient.masterCanonicalKey, ingredient.canonicalKey];
  const reviewed = keys.map(key => byKey.get(key)).find(Boolean) || byName.get(normalize(ingredient.name));
  if (reviewed) return { sauceRole: reviewed.sauceRole, color: reviewed.color };
  return { sauceRole: presentation.defaultSauceRole };
}
