import { prepareFulfillmentLines, getOrderMinimum, getDeliveryBlocks, getShippingBenefitFee } from './fulfillmentPolicy';
const now = Date.parse('2026-09-30T14:00:00Z');
const deal = { id:8, isClearance:true, remainingQuantity:3, expiresAt:'2026-09-30T16:00:00Z' };
const menu = [{pizzaId:1,category:'Pizzas',directDiscount:deal},{pizzaId:2,category:'Pizzas'},{pizzaId:3,category:'Bebidas'}];
const cart = [{pizzaId:1,qty:1,subtotal:5,directDiscount:deal},{pizzaId:3,qty:1,subtotal:3}];
test('mixed clearance pickup skips the minimum; delivery does not', () => {
  const lines=prepareFulfillmentLines(cart,menu,now);
  expect(getOrderMinimum(lines,'PICKUP',9.99).met).toBe(true);
  expect(getOrderMinimum(lines,'COURIER',9.99).missingAmount).toBe(1.99);
  expect(getOrderMinimum(lines.slice(1),'PICKUP',9.99).missingAmount).toBe(6.99);
});
test.each([{remainingQuantity:0},{isClearance:false},{id:9},{expiresAt:'2026-09-30T13:00:00Z'}])('invalid live deal removes pickup exemption: %s', patch => {
  const lines=prepareFulfillmentLines(cart,[{...menu[0],directDiscount:{...deal,...patch}},menu[2]],now);
  expect(getOrderMinimum(lines,'PICKUP',9.99).pickupExempt).toBe(false);
});
test('unlimited clearance is valid, and disappearance or stock rejection removes exemption', () => {
  expect(prepareFulfillmentLines(cart,[{...menu[0],directDiscount:{...deal,remainingQuantity:null}}],now)[0].directDiscount.isClearance).toBe(true);
  expect(prepareFulfillmentLines(cart,[],now)[0].directDiscount.isClearance).toBe(false);
  expect(prepareFulfillmentLines([{...cart[0],availabilityRejected:true}],menu,now)[0].directDiscount.isClearance).toBe(false);
});
test('promo quantities, rewards and halves occupy physical pizza capacity', () => {
  const lines=prepareFulfillmentLines([
    {type:'PROMO',qty:2,promoItems:[{pizzaId:2,quantity:2},{pizzaId:3,quantity:1}]},
    {type:'INCENTIVE_REWARD',pizzaId:2,qty:1},
    {...cart[0]},
  ],menu,now);
  expect(getDeliveryBlocks(lines,5)).toEqual({totalBlocks:2,coveredBlocks:1,extraBlocks:1});
  expect(getShippingBenefitFee(lines,{deliveryFeeBlockSize:5},5)).toBe(2.5);
  expect(getShippingBenefitFee([lines[2]],{},2.5)).toBe(0);
});
test('minimum ignores shipping discounts and queue fees, but includes product discounts', () => {
  expect(getOrderMinimum([{subtotal:10},{type:'COUPON',subtotal:-1},{type:'QUEUE_BOOST',subtotal:3}],'COURIER',9.99).missingAmount).toBe(.99);
  expect(getOrderMinimum([{subtotal:9.99},{type:'COUPON',subtotal:-2.5}],'COURIER',9.99,2.5).met).toBe(true);
});
