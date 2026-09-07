export function checkoutPresenceState({ redirecting, loading, profileOpen, paymentOpen, cashOpen, cartOpen, cartCount }) {
  if (redirecting || loading || profileOpen || paymentOpen || cashOpen) return 'checkout';
  return cartOpen || cartCount > 0 ? 'cart' : 'browsing';
}

export function shouldShowCheckoutAlert({ presence, online, incomingOrder, now = Date.now() }) {
  const age = now - new Date(presence.updatedAt).getTime();
  return Boolean(online && !incomingOrder && presence.checkoutVisitors > 0 &&
    Number.isFinite(age) && age < Number(presence.activeWindowMs || 30000));
}
