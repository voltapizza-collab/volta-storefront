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
  const raw = [order?.delivery, order?.type]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase())
    .join(" ");

  return raw.includes("DELIVERY") || raw.includes("COURIER");
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
    const items = readOrderItems(order);
    const scheduledFor = formatScheduledFor(getScheduledFor(order));
    const lines = [
      "VOLTA POS VIRTUAL",
      `Pedido: ${order?.code || order?.id || "-"}`,
      `Tienda: ${order?.storeName || "-"}`,
      ...(scheduledFor ? [`PROGRAMADO: ${scheduledFor}`] : []),
      `Cliente: ${order?.customerData?.name || "-"}`,
      `Telefono: ${order?.customerData?.phone || "-"}`,
      ...(isDeliveryOrder(order) && order?.customerData?.address_1
        ? [`Direccion: ${order.customerData.address_1}`]
        : []),
      "------------------------------",
      ...items.map((item) => {
        const size = item?.size || item?.selectedSize || "";
        return `${lineName(item)} ${size} x${lineQty(item)}`.trim();
      }),
      "------------------------------",
      `Total: ${Number(order?.total || 0).toFixed(2)} ${order?.currency || "EUR"}`,
    ];

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
