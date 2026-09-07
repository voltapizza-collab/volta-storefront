import { checkoutPresenceState, shouldShowCheckoutAlert } from './checkoutPresence';

test('checkout covers both payment methods and survives the redirect to card payment', () => {
  for (const stage of ['loading', 'profileOpen', 'paymentOpen', 'cashOpen', 'redirecting']) {
    expect(checkoutPresenceState({ [stage]: true, cartCount: 2 })).toBe('checkout');
  }
  expect(checkoutPresenceState({ cartCount: 2 })).toBe('cart');
  expect(checkoutPresenceState({ cartCount: 0 })).toBe('browsing');
});

test('an incoming order, disconnection or stale presence suppresses the warning', () => {
  const now = Date.now();
  const presence = { checkoutVisitors: 1, updatedAt: new Date(now).toISOString(), activeWindowMs: 30000 };
  const state = { presence, online: true, now };
  expect(shouldShowCheckoutAlert(state)).toBe(true);
  expect(shouldShowCheckoutAlert({ ...state, incomingOrder: {} })).toBe(false);
  expect(shouldShowCheckoutAlert({ ...state, online: false })).toBe(false);
  expect(shouldShowCheckoutAlert({ ...state, now: now + 30000 })).toBe(false);
  expect(shouldShowCheckoutAlert({ ...state, presence: { checkoutVisitors: 1 } })).toBe(false);
  expect(shouldShowCheckoutAlert({ ...state, presence: { ...presence, checkoutVisitors: 0 } })).toBe(false);
});
