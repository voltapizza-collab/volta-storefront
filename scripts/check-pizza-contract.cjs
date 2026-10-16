// Offline contract check against the actual sibling backend pricing service. No HTTP or database.
const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { pathToFileURL } = require('url');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function sourceModule(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = babel.transformFileSync(file, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  new Function('module', 'exports', 'require', code)(module, module.exports, request => {
    if (!request.startsWith('.')) throw new Error('Only local source modules are allowed');
    return sourceModule(path.resolve(path.dirname(file), `${request}.js`));
  });
  cache.set(file, module.exports); return module.exports;
}
(async () => {
  const { makeLabLine, initialPizza } = sourceModule(path.join(root, 'src/experiments/pizza-lab/model.js'));
  const { category, catalog } = sourceModule(path.join(root, 'src/experiments/pizza-lab/catalog.js'));
  const { buildOrderLines } = sourceModule(path.join(root, 'src/pos/printers/mockPrinter.js'));
  const { priceCheckoutLines } = await import(pathToFileURL(path.resolve(root, '../volta-backend/services/checkoutPricing.js')));
  const menu = [{ id: 1, name: 'Referencia de prueba', categoryId: 1, category: category.name, selectSize: category.selectSize,
    priceBySize: { M: 8, L: 10, XL: 12 }, categoryBasePriceBySize: category.priceBySize, categoryRef: { customizable: true, halfAndHalf: true }, ingredients: [] }];
  const uses = catalog.map(ingredient => ({ ingredientId: ingredient.id, categoryId: 1, active: true, ingredient }));
  let count = 0;
  for (const size of category.selectSize) for (const placement of ['FULL', 'RIGHT', 'LEFT']) for (const quantity of ['SIMPLE', 'DOUBLE']) for (const qty of [1, 3]) {
    const line = makeLabLine({ ...initialPizza, size, qty, ingredients: { 5: { placement, quantity }, 3: { placement: 'FULL', quantity: 'SIMPLE' } } }, category, catalog, count);
    const priced = priceCheckoutLines([line], { menu, uses })[0];
    assert.ok(Math.abs(priced.subtotal - line.subtotal) < 0.01);
    assert.equal(priced.ingredients[0].placement, line.ingredients[0].placement);
    count++;
  }
  const ing = (name, placement, quantity = 'SIMPLE') => ({ name, placement, quantity });
  const custom = (name, ingredients, rest = {}) => ({ type: 'CUSTOM_BUILD', name, size: 'M', qty: 1, ingredients, ...rest });
  const cases = [
    custom('01 SOLO FULL', [ing('Mozzarella', 'FULL'), ing('Tomate', 'FULL')]),
    custom('02 TRES ZONAS', [ing('Bacon', 'RIGHT'), ing('Jamón', 'LEFT'), ing('Tomate', 'FULL'), ing('Piña', 'LEFT'), ing('Champiñones', 'RIGHT')]),
    custom('03 DOBLES', [ing('Bacon', 'RIGHT', 'DOUBLE'), ing('Mozzarella', 'FULL', 'DOUBLE')]),
    { pizzaId: 1, name: '04 RETIRADA', size: 'M', qty: 1, removedIngredients: [{ ingredientId: 7, name: 'Cebolla' }] },
    { type: 'HALF_HALF', name: '05 DOS RECETAS', size: 'M', qty: 1, leftName: 'Barbacoa', rightName: 'Hawaiana', extras: [{ name: 'Piña', side: 'B' }, { name: 'Bacon', side: 'A' }] },
    custom('06 OBSERVACIONES', [ing('Tomate', 'FULL')], { notes: 'Cortar en ocho, muy hecha' }),
    custom('07 MULTIPLES CAMBIOS', [ing('Champiñones frescos laminados', 'RIGHT', 'DOUBLE'), ing('Piña', 'LEFT'), ing('Mozzarella', 'FULL')], { removedIngredients: [{ ingredientId: 4, name: 'Ajo', placement: 'LEFT' }], extras: [{ name: 'Albahaca', placement: 'FULL' }], notes: 'No cortar' }),
  ];
  const output = path.resolve(root, '../output/pizza-experiment-2026-10-15');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'ticket-cases.json'), JSON.stringify(cases, null, 2));
  fs.writeFileSync(path.join(output, 'ticket-cases.txt'), cases.map(item => buildOrderLines({ code: 'PRUEBA-ESPACIAL', products: [item], notes: 'MUESTRA SIN VENTA', total: 0 }).join('\n')).join('\n\n'));
  fs.writeFileSync(path.join(output, 'contract-check.txt'), `${count} combinations accepted by checkoutPricing; seven printable fixtures generated.\nNo API, database, order, payment or printer was contacted.\n`);
  console.log(`${count} combinations accepted by actual checkoutPricing; seven ticket fixtures saved in ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
