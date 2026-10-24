import { usesPizzaBuilder, foodButtonVisible } from './foodCapabilities';
import { normalizeStorefrontButtonConfig } from '../constants/storefrontButtons';

const sizes = item => item.selectSize;
test('burger extras do not enable a pizza builder, including stale customizable flags', () => {
  expect(usesPizzaBuilder({ categoryCustomizable: false, categoryBuilderType: 'NONE', extras: [1] })).toBe(false);
  expect(usesPizzaBuilder({ categoryCustomizable: true, categoryBuilderType: 'NONE' })).toBe(false);
  expect(usesPizzaBuilder({ categoryCustomizable: true, categoryBuilderType: 'PIZZA', category: 'Artesanas' })).toBe(true);
  expect(usesPizzaBuilder({ categoryCustomizable: true })).toBe(true);
});
test('buttons require available configuration and respect explicit business settings', () => {
  const config=normalizeStorefrontButtonConfig({customPizza:false,coupons:false});
  expect(config.coupons).toBe(false);expect(config.call).toBe(true);
  expect(foodButtonVisible('customPizza',config,[{}],[],sizes)).toBe(false);
  expect(foodButtonVisible('customPizza',{},[],[],sizes)).toBe(false);
  expect(foodButtonVisible('customPizza',{},[{}],[],sizes)).toBe(true);
  expect(foodButtonVisible('halfAndHalf',{},[],[{selectSize:['M']},{selectSize:['L']}],sizes)).toBe(false);
  expect(foodButtonVisible('halfAndHalf',{},[],[{selectSize:['M']},{selectSize:['M','L']}],sizes)).toBe(true);
  expect(foodButtonVisible('halfAndHalf',{},[],[{selectSize:['M']}],sizes)).toBe(false);
});
