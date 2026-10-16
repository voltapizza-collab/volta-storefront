import { getIngredientTaxonomyKey } from './ingredientTaxonomy';

// Illustrative appearance only: never used for identity, pricing or allergens.
const appearance = (art, color, accent) => ({ art, color, ...(accent ? { accent } : {}) });
const rules = [
  [/\bcheddar\b/, appearance('cheddar', '#efa52c')],
  [/queso azul|roquefort|gorgonzola/, appearance('blue-cheese', '#eee9cd', '#527d76')],
  [/mozz?arella.*rallad/, appearance('shreds', '#fff4cf')],
  [/mozz?arella.*ahumad|scamorza/, appearance('mozzarella', '#f1d9aa', '#bd945c')],
  [/mozz?arella|burrata/, appearance('mozzarella', '#fffbed', '#d8ceb7')],
  [/ricotta|requeson/, appearance('crumbles', '#faf5e8')],
  [/queso.*cabra|rulo.*cabra/, appearance('goat', '#fff7e7')],
  [/parmesano|grana padano/, appearance('flakes', '#e4cf88')],
  [/arzua|tetilla/, appearance('cheese', '#efdfa9')],
  [/pulpo/, appearance('tentacle', '#9b526d', '#f4d8ca')],
  [/calamar|sepia/, appearance('ring', '#f7ebd6', '#c9ae92')],
  [/gamba|langostino|camaron/, appearance('shrimp', '#e68d6d', '#fff0d6')],
  [/salmon/, appearance('ham', '#ed946f')],
  [/atun|bonito/, appearance('piece', '#bc9885')],
  [/anchoa|sardina/, appearance('strip', '#817769')],
  [/bacon|panceta/, appearance('bacon', '#b64c46')],
  [/jamon|prosciutto/, appearance('ham', '#de8a91')],
  [/pepperoni|peperoni/, appearance('pepperoni', '#af3428', '#edb17c')],
  [/chorizo/, appearance('chorizo', '#c65a2d', '#f1ce94')],
  [/salami|salchichon/, appearance('salami', '#a75e68', '#f3d8c1')],
  [/pollo|pavo/, appearance('piece', '#dfc49b')],
  [/carne|ternera|vacuno|cerdo/, appearance('piece', '#84604b')],
  [/champinon|seta|portobello/, appearance('mushroom', '#967859')],
  [/aceituna.*negra|oliva.*negra/, appearance('olive', '#34342e')],
  [/aceituna|oliva/, appearance('olive', '#71834a')],
  [/cebolla.*(morada|roja)/, appearance('ring', '#a665a2', '#eacde5')],
  [/cebolla/, appearance('ring', '#e4d9b9', '#b3a686')],
  [/tomate/, appearance('tomato', '#d64a35', '#f4bc66')],
  [/pimiento.*rojo/, appearance('strip', '#d64c37')],
  [/pimiento.*amarillo/, appearance('strip', '#efbd3b')],
  [/pimiento|jalapeno/, appearance('ring', '#4e8743', '#b9cc76')],
  [/albahaca|rucula|espinaca/, appearance('basil', '#44824d')],
  [/brocoli/, appearance('piece', '#4d8043')],
  [/maiz/, appearance('kernel', '#f2c53d')],
  [/pina/, appearance('piece', '#f4cf59')],
  [/pimenton|paprika/, appearance('crumbles', '#ad4931')],
  [/miel/, appearance('sauce', '#dba32f')],
  [/chocolate|nutella|cacao/, appearance('sauce', '#633e2b')],
];

export function ingredientArtwork(ingredient = {}) {
  const name = String(ingredient.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Sauce recipes take precedence over the ingredient in their name.
  if (/salsa|pesto|barbacoa|\bbbq\b|alioli|mayonesa|tomate triturado|aceite|ranch|cesar|bechamel/.test(name)) {
    if (/aceite/.test(name)) return appearance('sauce', '#c7ac4c');
    if (/barbacoa|\bbbq\b/.test(name)) return appearance('sauce', '#713e2c');
    if (/pesto|verde/.test(name)) return appearance('sauce', '#538348');
    if (/cheddar/.test(name)) return appearance('sauce', '#efa52c');
    if (/blanca|queso|nata|carbonara|alioli|mayonesa|ranch|cesar|bechamel/.test(name)) return appearance('sauce', '#f5e8c9');
    if (/picante|brava|sriracha/.test(name)) return appearance('sauce', '#da6830');
    return appearance('sauce', '#c6472c');
  }
  const match = rules.find(([pattern]) => pattern.test(name));
  if (match) return { ...match[1] };
  const family = getIngredientTaxonomyKey(ingredient);
  const fallback = {
    QUESOS: appearance('cheese', '#efdfa9'),
    CARNES_AVES: appearance('piece', '#a37c5e'),
    EMBUTIDOS_CHARCUTERIA: appearance('slice', '#ad6658', '#e4b798'),
    VERDURAS_SETAS_ALGAS: appearance('piece', '#719253'),
    PESCADOS_Y_MARISCOS: appearance('piece', '#c5ac9b'),
  };
  return fallback[family] || appearance('piece', '#ad9880');
}
