export const PRODUCT_NOTICE_KEYS = ['spicy', 'vegan', 'vegetarian', 'gluten_free', 'kosher', 'halal'];
const labels = {
  es: ['Picante', 'Vegano', 'Vegetariano', 'Sin gluten', 'Kosher', 'Halal'],
  en: ['Spicy', 'Vegan', 'Vegetarian', 'Gluten-free', 'Kosher', 'Halal'],
  it: ['Piccante', 'Vegano', 'Vegetariano', 'Senza glutine', 'Kosher', 'Halal'],
  fr: ['Épicé', 'Végan', 'Végétarien', 'Sans gluten', 'Casher', 'Halal'],
  pt: ['Picante', 'Vegano', 'Vegetariano', 'Sem glúten', 'Kosher', 'Halal'],
};
export const productNoticeLabels = (language = 'es') => Object.fromEntries(PRODUCT_NOTICE_KEYS.map((key, index) =>
  [key, (labels[String(language).slice(0, 2)] || labels.en)[index]]));
export const normalizeProductNotices = values => PRODUCT_NOTICE_KEYS.filter(key => Array.isArray(values) && values.includes(key));
