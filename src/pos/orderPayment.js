const normalize = (value) => String(value || "").trim().toLowerCase();
const paymentMode = (value) => {
  const mode = normalize(value);
  if (["cash", "efectivo"].includes(mode)) return "cash";
  if (["card", "tarjeta", "stripe", "stripe_checkout"].includes(mode)) return "card";
  return "";
};

export const getOrderPayment = (order) => {
  const customer = order?.customerData || {};
  let status = normalize(order?.paymentStatus || customer.paymentStatus);
  // Prefer the explicit method to stale status fields from an earlier checkout.
  let mode = [order?.paymentMode, order?.paymentMethod, customer.paymentMode,
    customer.paymentMethod, customer.payment_type].map(paymentMode).find(Boolean) || "";
  if (!mode) {
    if (status.startsWith("cash_")) mode = "cash";
    else if (["card_paid", "awaiting_card_payment"].includes(status) ||
      order?.stripeCheckoutSessionId || order?.stripePaymentIntentId) mode = "card";
  }

  // PAID also admits cash orders into the kitchen; it never proves cash collection.
  if (mode === "card" && normalize(order?.status) === "paid" &&
    ["", "pending", "awaiting_card_payment", "cash_pending", "paid", "card_paid"].includes(status)) {
    status = "card_paid";
  }
  if (!status && mode === "card" && normalize(order?.status) === "awaiting_payment") status = "awaiting_card_payment";
  return { mode, status };
};

export const isCashPaymentOrder = (order) => getOrderPayment(order).mode === "cash";
export const isCashPaymentPending = (order) => {
  const { mode, status } = getOrderPayment(order);
  return mode === "cash" && !["paid", "cash_paid"].includes(status);
};

export const getPaymentLabel = (order) => {
  const { mode, status } = getOrderPayment(order);
  if (mode === "cash") return ["paid", "cash_paid"].includes(status) ? "Efectivo cobrado" : "Efectivo pendiente";
  if (mode === "card") {
    if (["paid", "card_paid"].includes(status)) return "Tarjeta pagada";
    if (["pending", "awaiting_card_payment", "cash_pending"].includes(status)) return "Tarjeta pendiente";
    return "Tarjeta";
  }
  return "Por confirmar";
};
