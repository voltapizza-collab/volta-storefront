// Keep the public tracking reference intact; the kitchen uses the unique sale ID.
export function getPosOrderCode(order) {
  const code = String(order?.code || '');
  const id = Number(order?.id);
  if (/^WEB-[A-F0-9]{32}$/i.test(code) && Number.isSafeInteger(id) && id > 0) {
    return `WEB-${id}`;
  }
  return code || String(order?.id || '-');
}
