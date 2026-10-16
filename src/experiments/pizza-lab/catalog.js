
// Deliberately synthetic: never a live store catalog or a promise of availability.
export const category = {
  key: 'pizza-lab', categoryId: 1, name: 'Pizza al horno', baseName: 'Pizza al horno',
  samplePizzaId: 1, selectSize: ['M', 'L', 'XL'],
  priceBySize: { M: 6.4, L: 8, XL: 9.6 },
};
export const catalog = [
  { id: 1, name: 'Salsa de tomate', category: 'SALSAS_CONDIMENTOS_BASES', costPrice: 0.6, art: 'sauce', color: '#c6472c', allergens: [] },
  { id: 2, name: 'Salsa barbacoa', category: 'SALSAS_CONDIMENTOS_BASES', costPrice: 0.8, art: 'sauce', color: '#713e2c', allergens: ['MOSTAZA'] },
  { id: 3, name: 'Mozzarella', category: 'QUESOS', costPrice: 1.2, art: 'cheese', color: '#fff0bd', allergens: ['LECHE'] },
  { id: 4, name: 'Queso de cabra', category: 'QUESOS', costPrice: 1.6, art: 'goat', color: '#fff6dc', allergens: ['LECHE'] },
  { id: 5, name: 'Bacon', category: 'CARNES', costPrice: 1.5, art: 'bacon', color: '#b64c36', allergens: [] },
  { id: 6, name: 'Jamón', category: 'CARNES', costPrice: 1.4, art: 'ham', color: '#de8a80', allergens: [] },
  { id: 7, name: 'Champiñones', category: 'VERDURAS', costPrice: 1.1, art: 'mushroom', color: '#9b795b', allergens: [] },
  { id: 8, name: 'Piña', category: 'FRUTAS', costPrice: 1, art: 'pineapple', color: '#f0be47', allergens: [] },
  { id: 9, name: 'Aceitunas negras', category: 'VERDURAS', costPrice: 0.9, art: 'olive', color: '#354338', allergens: [] },
  { id: 10, name: 'Albahaca', category: 'VERDURAS', costPrice: 0.4, art: 'basil', color: '#44824d', allergens: [] },
];
