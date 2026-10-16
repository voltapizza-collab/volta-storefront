import { getIngredientTaxonomyKey } from './ingredientTaxonomy';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Culinary defaults for building a pizza, not popularity or sales statistics.
const priorities = {
  SALSAS_CONDIMENTOS_BASES: [/tomate|pomodoro|marinara/, /blanca|bechamel|nata|carbonara|ranch|cesar/, /barbacoa|\bbbq\b/, /pesto/, /queso|cheddar/, /picante|brava/, /alioli|mayonesa/],
  QUESOS: [/mozz?arella.*rallad/, /mozz?arella.*fresc|mozz?arella.*bufala/, /mozz?arella/, /burrata|ricotta|requeson/, /cheddar/, /parmesano|grana padano/, /arzua|tetilla|gouda|emmental/, /cabra/, /azul|roquefort|gorgonzola/],
  EMBUTIDOS_CHARCUTERIA: [/pepperoni|peperoni/, /chorizo/, /salami|salchichon/, /jamon|prosciutto/, /bacon|panceta/, /salchicha/],
  CARNES_AVES: [/pollo/, /pavo/, /carne picada|ternera/, /cerdo/],
  VERDURAS_SETAS_ALGAS: [/champinon|seta/, /cebolla/, /pimiento/, /aceituna|oliva/, /tomate/, /rucula|albahaca|espinaca/],
  PESCADOS_Y_MARISCOS: [/atun|bonito/, /anchoa/, /salmon/, /gamba|langostino/, /pulpo/, /calamar|sepia/],
};

export function ingredientPresentationRank(ingredient) {
  const family = getIngredientTaxonomyKey(ingredient);
  const rules = priorities[family] || [];
  const index = rules.findIndex(pattern => pattern.test(normalize(ingredient.name)));
  // The visual meat tray combines cured meats and poultry: keep those groups together.
  return index < 0 ? 100 : index + (family === 'CARNES_AVES' ? 20 : 0);
}

export function sortIngredientsForBuilding(ingredients) {
  // Stable ties retain the catalog order; unknown items are never dropped.
  return [...ingredients].sort((a, b) => ingredientPresentationRank(a) - ingredientPresentationRank(b));
}
