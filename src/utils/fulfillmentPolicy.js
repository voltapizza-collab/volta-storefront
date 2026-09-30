// These rules operate on server-priced lines. Keep the storefront preview in sync.
const money = value => Math.round(Number(value || 0) * 100) / 100;
const kind = (line, value) => String(line.type || '').toUpperCase() === value || String(line.source || '').toUpperCase() === value;
export const isClearanceLine = line => line?.directDiscount?.isClearance === true;
const product = line => !kind(line, 'COUPON') && !kind(line, 'QUEUE_BOOST');
export const isPizzaCategory = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('pizza');

export function getDeliveryBlocks(lines, blockSize = 5) {
  const size = Math.max(1, Math.trunc(Number(blockSize) || 5));
  const products = lines.filter(product);
  const units = rows => rows.reduce((sum, line) => sum + Number(line.deliveryUnits || 0) * Number(line.qty || 1), 0);
  const regular = products.filter(line => !isClearanceLine(line));
  const totalBlocks = products.length ? Math.max(1, Math.ceil(units(products) / size)) : 0;
  const coveredBlocks = regular.length ? Math.max(1, Math.ceil(units(regular) / size)) : 0;
  return { totalBlocks, coveredBlocks, extraBlocks: Math.max(0, totalBlocks - coveredBlocks) };
}

export function getShippingBenefitFee(lines, partner, deliveryFee) {
  if (!lines.some(line => product(line) && !isClearanceLine(line))) return 0;
  // Only fixed tariffs have a configured pizza capacity. Distance tariffs stay unchanged.
  if (partner.deliveryPricingMode === 'VARIABLE') return money(deliveryFee);
  const { totalBlocks, coveredBlocks } = getDeliveryBlocks(lines, partner.deliveryFeeBlockSize);
  return totalBlocks ? money(deliveryFee * coveredBlocks / totalBlocks) : 0;
}

export function getOrderMinimum(lines, method, minimumAmount, shippingDiscount = 0) {
  const minimum = Math.max(0, money(minimumAmount));
  const productSubtotal = money(Math.max(0, lines.reduce((sum, line) => {
    if (kind(line, 'QUEUE_BOOST') || kind(line, 'INCENTIVE_REWARD')) return sum;
    return sum + Number(line.subtotal || 0);
  }, 0) + Number(shippingDiscount || 0)));
  const pickupExempt = method === 'PICKUP' && lines.some(isClearanceLine);
  const missingAmount = pickupExempt ? 0 : money(Math.max(0, minimum - productSubtotal));
  return { minimumPaymentAmount: minimum, productSubtotal, missingAmount, pickupExempt, met: missingAmount === 0 };
}

// Preview only. Checkout rebuilds these fields from the live server catalog.
export function prepareFulfillmentLines(cart, menu, now = Date.now()) {
  const products = new Map(menu.map(item => [Number(item.pizzaId ?? item.id), item]));
  return cart.map(line => {
    const current = products.get(Number(line.pizzaId));
    const discount = current?.directDiscount;
    const validClearance = discount?.isClearance === true &&
      Number(discount.id) === Number(line.directDiscount?.id) &&
      (discount.remainingQuantity == null || Number(discount.remainingQuantity) > 0) &&
      (!discount.expiresAt || new Date(discount.expiresAt).getTime() > now) && !line.availabilityRejected;
    const pizzaUnits = item => isPizzaCategory(products.get(Number(item.pizzaId))?.category || item.category) ? Number(item.quantity ?? item.qty ?? 1) : 0;
    const deliveryUnits = kind(line, 'COUPON') || kind(line, 'QUEUE_BOOST') ? 0 :
      Array.isArray(line.promoItems) && line.promoItems.length ? line.promoItems.reduce((sum, item) => sum + pizzaUnits(item), 0) :
      line.leftPizzaId || line.rightPizzaId || isPizzaCategory(current?.category || line.category) ? 1 : 0;
    return { ...line, deliveryUnits, directDiscount: line.directDiscount ? { ...line.directDiscount, isClearance: validClearance } : null };
  });
}
