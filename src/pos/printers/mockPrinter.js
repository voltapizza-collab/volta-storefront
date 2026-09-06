const PRINT_LOG_KEY = "volta_pos_virtual_print_log";

const parseLog = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRINT_LOG_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLog = (items) => {
  localStorage.setItem(PRINT_LOG_KEY, JSON.stringify(items.slice(0, 30)));
};

const readOrderItems = (order) => {
  if (Array.isArray(order?.products)) return order.products;

  try {
    const parsed = JSON.parse(order?.products || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const lineName = (item) => {
  if (item?.leftName && item?.rightName) {
    return `${item.leftName} / ${item.rightName}`;
  }

  return String(
    item?.name ||
      item?.pizzaName ||
      item?.title ||
      (item?.pizzaId ? `Producto #${item.pizzaId}` : "Producto")
  ).trim();
};

const lineQty = (item) => {
  const qty = Number(item?.quantity ?? item?.qty ?? item?.cantidad ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const getPromoItemDetails = (item) =>
  readArray(item?.promoItems)
    .map((promoItem) => {
      const name = lineName(promoItem);
      const size = promoItem?.size || promoItem?.selectedSize || "";
      return `${lineQty(promoItem)}x ${name}${size ? ` ${size}` : ""}`.trim();
    })
    .filter(Boolean);

const isCustomBuildLine = (item) =>
  String(item?.type || "").toUpperCase() === "CUSTOM_BUILD" ||
  String(item?.cartLineId || "").startsWith("custom-");

const isIncentiveRewardLine = (item) =>
  String(item?.source || "").toLowerCase() === "incentive_reward" ||
  String(item?.type || "").toUpperCase() === "INCENTIVE_REWARD";

const isHalfAndHalfLine = (item) =>
  Boolean(item?.leftName && item?.rightName) ||
  String(item?.cartLineId || "").startsWith("half-");

const formatIngredientPlacement = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "FULL") return "Entera";
  if (raw === "LEFT") return "Mitad izquierda";
  if (raw === "RIGHT") return "Mitad derecha";
  return value ? String(value) : "";
};

const formatIngredientQuantity = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "DOUBLE") return "Doble";
  if (raw === "SIMPLE") return "Simple";
  return value ? String(value) : "";
};

const formatExtraSide = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "A" || raw === "LEFT") return "Mitad A";
  if (raw === "B" || raw === "RIGHT") return "Mitad B";
  if (raw === "FULL" || raw === "ALL") return "Entera";
  return value ? String(value) : "";
};

const readArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getLineDetailRows = (item) => {
  const rows = [];
  const customMeta = item?.customMeta || item?.customDetails || {};

  if (isIncentiveRewardLine(item)) {
    rows.push("Incentivo: premio gratis");
  }

  if (isHalfAndHalfLine(item)) {
    if (item.leftName) rows.push(`Mitad A: ${item.leftName}`);
    if (item.rightName) rows.push(`Mitad B: ${item.rightName}`);
  }

  getPromoItemDetails(item).forEach((detail) => rows.push(detail));

  const ingredientRows = [];
  const sourceIngredients = readArray(item?.ingredients).length
    ? readArray(item?.ingredients)
    : readArray(item?.customDetails?.ingredients);

  sourceIngredients.forEach((ingredient) => {
    if (ingredient?.label) {
      ingredientRows.push(String(ingredient.label).trim());
      return;
    }

    const name = String(ingredient?.name || ingredient?.label || ingredient || "").trim();
    if (!name) return;

    const placement = ingredient?.placementLabel || formatIngredientPlacement(ingredient?.placement);
    const quantity = ingredient?.quantityLabel || formatIngredientQuantity(ingredient?.quantity);
    const detail = [placement, quantity].filter(Boolean).join(" - ");
    ingredientRows.push(detail ? `${name}: ${detail}` : name);
  });
  rows.push(...ingredientRows);

  if (isCustomBuildLine(item) && !ingredientRows.length) {
    rows.push("Personalizacion sin ingredientes guardados");
  }

  readArray(item?.extras)
    .map((extra) => {
      const name = extra?.label || extra?.name || extra?.code || extra;
      if (!name) return "";
      const side = formatExtraSide(extra?.side || extra?.placement);
      return side ? `Extra ${side}: ${name}` : `Extra: ${name}`;
    })
    .filter(Boolean)
    .forEach((extra) => rows.push(extra));

  if (isCustomBuildLine(item)) {
    const baseName =
      customMeta.baseProductName ||
      customMeta.baseName ||
      customMeta.categoryName ||
      "";
    const visibleName = lineName(item);
    if (baseName && !visibleName.toLowerCase().includes(String(baseName).toLowerCase())) {
      rows.push(`Tipo: ${baseName}`);
    }
  }

  return rows;
};

const getScheduledFor = (order) =>
  order?.scheduledFor ||
  order?.customerData?.scheduledFor ||
  order?.customerData?.delivery?.scheduledFor ||
  null;

const formatScheduledFor = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const isDeliveryOrder = (order) => {
  const raw = [order?.delivery, order?.type, order?.customerData?.delivery?.method]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase())
    .join(" ");

  return raw.includes("DELIVERY") || raw.includes("COURIER");
};

const getFulfilmentLabel = (order) => {
  if (isDeliveryOrder(order)) return "ENVIO / DELIVERY";
  const raw = [order?.delivery, order?.type, order?.customerData?.delivery?.method].filter(Boolean).join(" ").toUpperCase();
  if (raw.includes("PICKUP")) return "RECOGIDA / PICKUP";
  if (raw.includes("LOCAL")) return "CONSUMO EN LOCAL";
  return "MODALIDAD: POR CONFIRMAR";
};

const getDeliveryAddress = (order) => {
  const delivery = order?.customerData?.delivery || {};
  const nestedAddress = [delivery.address, delivery.addressLine2]
    .filter(Boolean)
    .join(", ");
  const address = String(order?.customerData?.address_1 || order?.address_1 || nestedAddress || order?.customerData?.address || "").trim();

  return address && !/^\(PICKUP\)/i.test(address) ? address : "";
};

const getPaymentLabel = (order) => {
  const customerData = order?.customerData || {};
  const paymentSignal = [
    order?.paymentMode,
    order?.paymentStatus,
    order?.paymentMethod,
    customerData.paymentMode,
    customerData.paymentStatus,
    customerData.paymentMethod,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())
    .join(" ");

  if (paymentSignal.includes("cash") || paymentSignal.includes("efectivo")) {
    return ["paid", "cash_paid"].includes(String(order?.paymentStatus || customerData.paymentStatus || "").toLowerCase()) ? "Efectivo cobrado" : "Efectivo pendiente";
  }
  const status = String(order?.paymentStatus || customerData.paymentStatus || "").toLowerCase();
  if (status === "card_paid") return "Tarjeta pagada";
  if (status === "awaiting_card_payment") return "Tarjeta pendiente";
  if (/card|tarjeta|stripe/.test(paymentSignal)) return "Tarjeta";
  return "Por confirmar";
};

export const mockPrinter = {
  id: "windows-browser-print",
  label: "Impresion Windows temporal",
  mode: "WINDOWS_TEST",

  getStatus() {
    return {
      online: false,
      realConnected: false,
      virtualReady: true,
      paper: "virtual",
      mode: this.mode,
      label: this.label,
    };
  },

  getLog() {
    return parseLog();
  },

  clearLog() {
    saveLog([]);
  },

  async printOrder(order) {
    const printedAt = new Date().toISOString();
    const lines = buildOrderLines(order);

    const job = {
      id: `mock-${Date.now()}`,
      adapter: this.id,
      orderId: order?.id,
      code: order?.code,
      status: "VIRTUAL_PRINTED",
      printedAt,
      lines,
    };

    saveLog([job, ...parseLog()]);

    return job;
  },
};

export function buildOrderLines(order) {
    const items = readOrderItems(order);
    const scheduledFor = formatScheduledFor(getScheduledFor(order));
    const deliveryAddress = getDeliveryAddress(order);
    const lines = [
      "VOLTA POS",
      `Tienda: ${order?.storeName || "-"}`,
      getFulfilmentLabel(order),
      `Pedido: ${order?.code || order?.id || "-"}`,
      ...(formatScheduledFor(order?.date || order?.createdAt) ? [`Realizado: ${formatScheduledFor(order?.date || order?.createdAt)}`] : []),
      ...(scheduledFor ? [`PROGRAMADO: ${scheduledFor}`] : []),
      `Cliente: ${order?.customerData?.name || "-"}`,
      `Telefono: ${order?.customerData?.phone || "-"}`,
      ...(isDeliveryOrder(order)
        ? [`Direccion: ${deliveryAddress || "FALTA - CONFIRMAR CON CLIENTE"}`]
        : []),
      "------------------------------",
      ...items.flatMap((item) => {
        const size = item?.size || item?.selectedSize || "";
        return [
          `${lineQty(item)} x ${lineName(item)} ${size}${isIncentiveRewardLine(item) ? " [REGALO]" : ""}`.trim(),
          ...getLineDetailRows(item).map((detail) => `  - ${detail}`),
        ];
      }),
      "------------------------------",
      ...(String(order?.notes || "").trim() ? [`OBSERVACIONES: ${String(order.notes).trim()}`, "------------------------------"] : []),
      `Total: ${Number(order?.total || 0).toFixed(2)} ${order?.currency || "EUR"}`,
      `Pago: ${getPaymentLabel(order)}`,
    ];

    return lines;
}
