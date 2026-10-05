const key = (partnerSlug, storeSlug) => `volta_repeat_receipts:${partnerSlug}:${storeSlug}`;
export function readRepeatReceipts(partnerSlug, storeSlug) {
  try {
    const values = JSON.parse(localStorage.getItem(key(partnerSlug, storeSlug)) || '[]');
    return Array.isArray(values) ? values.filter(value => typeof value === 'string').slice(0, 3) : [];
  } catch { return []; }
}
export function rememberRepeatReceipt(partnerSlug, storeSlug, receipt) {
  try {
    localStorage.setItem(key(partnerSlug, storeSlug), JSON.stringify([receipt, ...readRepeatReceipts(partnerSlug, storeSlug).filter(value => value !== receipt)].slice(0, 3)));
  } catch { /* Checkout remains available without browser storage. */ }
}
