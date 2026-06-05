import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../setupAxios";
import { mockPrinter } from "./printers/mockPrinter";
import "../styles/PosApp.css";

const POS_SESSION_KEY = "volta_pos_virtual_session";
const POS_ACCEPTED_NOTICE_KEY_PREFIX = "volta_pos_accepted_order_notices";
const POLL_MS = 5000;
const POS_REQUEST_TIMEOUT_MS = 8000;
const STALE_AFTER_MS = 15_000;
const OFFLINE_AFTER_MS = 60_000;
const MAX_ACCEPTED_NOTICE_IDS = 500;

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatChatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getOrderScheduledFor = (order) =>
  order?.scheduledFor ||
  order?.customerData?.scheduledFor ||
  order?.customerData?.delivery?.scheduledFor ||
  null;

const formatScheduledTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getScheduledOrderState = (order, nowMs = Date.now()) => {
  const scheduledFor = getOrderScheduledFor(order);
  const scheduledAtMs = scheduledFor ? new Date(scheduledFor).getTime() : NaN;
  const hasSchedule = Number.isFinite(scheduledAtMs);
  const remainingMs = hasSchedule ? scheduledAtMs - nowMs : 0;

  return {
    hasSchedule,
    locked: hasSchedule && remainingMs > 0,
    scheduledFor,
    label: hasSchedule ? formatScheduledTime(scheduledFor) : "",
    countdown: hasSchedule ? formatCountdown(remainingMs) : "",
    remainingMs,
  };
};

const isSameLocalDay = (left, right) =>
  left instanceof Date &&
  right instanceof Date &&
  !Number.isNaN(left.getTime()) &&
  !Number.isNaN(right.getTime()) &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const formatClockTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatCalendarDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Hoy";

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
};

const parseMaybeJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getAcceptedNoticeStorageKey = (storeId) =>
  `${POS_ACCEPTED_NOTICE_KEY_PREFIX}:${storeId || "global"}`;

const readAcceptedNoticeIds = (storeId) => {
  if (typeof window === "undefined" || !storeId) return new Set();

  try {
    const ids = JSON.parse(localStorage.getItem(getAcceptedNoticeStorageKey(storeId)) || "[]");
    return new Set((Array.isArray(ids) ? ids : []).map((id) => String(id)));
  } catch {
    return new Set();
  }
};

const writeAcceptedNoticeIds = (storeId, ids) => {
  if (typeof window === "undefined" || !storeId) return;

  const nextIds = [...ids].map((id) => String(id)).slice(-MAX_ACCEPTED_NOTICE_IDS);
  try {
    localStorage.setItem(getAcceptedNoticeStorageKey(storeId), JSON.stringify(nextIds));
  } catch {
    // The POS can keep working even if the browser refuses local persistence.
  }
};

const asArray = (value) => {
  const first = parseMaybeJson(value, []);
  const second = parseMaybeJson(first, []);
  return Array.isArray(second) ? second : [];
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

const isCustomBuildLine = (item) =>
  String(item?.type || "").toUpperCase() === "CUSTOM_BUILD" ||
  String(item?.cartLineId || "").startsWith("custom-");

const isIncentiveRewardLine = (item) =>
  String(item?.source || "").toLowerCase() === "incentive_reward" ||
  String(item?.type || "").toUpperCase() === "INCENTIVE_REWARD";

const isCompletedPaidOrder = (order) =>
  String(order?.status || "").toUpperCase() === "PAID" && order?.processed === true;

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

const getIngredientDetails = (item) => {
  const directIngredients = asArray(item?.ingredients);
  const detailIngredients = directIngredients.length
    ? directIngredients
    : asArray(item?.customDetails?.ingredients);

  return detailIngredients
    .map((ingredient) => {
      if (ingredient?.label) return String(ingredient.label).trim();

      const name = String(ingredient?.name || ingredient?.label || ingredient || "").trim();
      if (!name) return "";

      const placement = ingredient?.placementLabel || formatIngredientPlacement(ingredient?.placement);
      const quantity = ingredient?.quantityLabel || formatIngredientQuantity(ingredient?.quantity);
      const detail = [placement, quantity].filter(Boolean).join(" - ");
      return detail ? `${name}: ${detail}` : name;
    })
    .filter(Boolean);
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

  getIngredientDetails(item).forEach((detail) => rows.push(detail));

  if (isCustomBuildLine(item) && !getIngredientDetails(item).length) {
    rows.push("Personalizacion sin ingredientes guardados");
  }

  asArray(item?.extras)
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

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildWindowsPrintTicketHtml = (order) => {
  const items = asArray(order?.products);
  const customer = order?.customerData || {};
  const orderCode = order?.code || order?.id || "-";
  const schedule = getScheduledOrderState(order);
  const priority = getOrderPriority(order);
  const showAddress = isDeliveryOrder(order) && customer.address_1;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Ticket ${escapeHtml(orderCode)}</title>
    <style>
      @page { size: 58mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111;
        background: #fff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.28;
      }
      .ticket { width: 50mm; }
      .center { text-align: center; }
      .brand { font-size: 15px; font-weight: 900; letter-spacing: 0; }
      .code { margin-top: 3px; font-size: 20px; font-weight: 900; }
      .block { border-top: 1px dashed #111; margin-top: 8px; padding-top: 7px; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .item { margin-top: 5px; }
      .item strong { display: block; font-size: 12px; }
      .item ul { margin: 3px 0 0 0; padding-left: 11px; }
      .item li { margin: 1px 0; }
      .sectionTitle { margin-bottom: 5px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
      .muted { color: #444; }
      .total { margin-top: 9px; padding-top: 8px; border-top: 2px solid #111; font-size: 15px; font-weight: 900; }
    </style>
  </head>
  <body>
    <main class="ticket">
      <div class="center brand">VOLTA POS</div>
      <div class="center code">${escapeHtml(orderCode)}</div>
      <section class="block">
        <div>Tienda: ${escapeHtml(order?.storeName || "-")}</div>
        <div>Tipo: ${escapeHtml(getOrderType(order))}</div>
        <div>Prioridad: ${escapeHtml(priority.value)}</div>
        ${priority.detail ? `<div>${escapeHtml(priority.detail)}</div>` : ""}
        <div>Hora: ${escapeHtml(formatTime(order?.date || order?.createdAt))}</div>
        ${
          schedule.hasSchedule
            ? `<div>Programado: ${escapeHtml(schedule.label)}</div>`
            : ""
        }
      </section>
      <section class="block">
        <div>Cliente: ${escapeHtml(customer.name || "-")}</div>
        <div>Telefono: ${escapeHtml(customer.phone || "-")}</div>
        ${showAddress ? `<div>Direccion: ${escapeHtml(customer.address_1)}</div>` : ""}
      </section>
      <section class="block">
        <div class="sectionTitle">Pedido</div>
        ${
          items.length
            ? items
                .map((item) => {
                  const size = item?.size || item?.selectedSize || "";
                  const note = item?.notes || item?.note || item?.comment || "";
                  const detailRows = getLineDetailRows(item);
                  return `<div class="item"><strong>${escapeHtml(lineQty(item))} x ${escapeHtml(
                    lineName(item)
                  )}${size ? ` ${escapeHtml(size)}` : ""}${
                    isIncentiveRewardLine(item) ? " [REGALO]" : ""
                  }</strong>${
                    note ? `<span class="muted">${escapeHtml(note)}</span>` : ""
                  }${
                    detailRows.length
                      ? `<ul>${detailRows.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`
                      : ""
                  }</div>`;
                })
                .join("")
            : `<div class="muted">Sin items</div>`
        }
      </section>
      <section class="total row">
        <span>Total</span>
        <span>${escapeHtml(formatMoney(order?.total, order?.currency || "EUR"))}</span>
      </section>
    </main>
    <script>
      window.onload = () => {
        window.focus();
        window.print();
      };
    </script>
  </body>
</html>`;
};

const printOrderWithWindowsDialog = (order) => {
  if (typeof window === "undefined" || !order) return false;

  const printWindow = window.open("", "_blank", "width=420,height=640");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(buildWindowsPrintTicketHtml(order));
  printWindow.document.close();
  return true;
};

const getOrderType = (order) => {
  const raw = [order?.delivery, order?.type]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase())
    .join(" ");
  if (raw.includes("DELIVERY") || raw.includes("COURIER")) return "Delivery";
  if (raw.includes("PICKUP")) return "Pickup";
  if (raw.includes("LOCAL")) return "Local";
  return String(order?.type || order?.delivery || "-");
};

const isDeliveryOrder = (order) => getOrderType(order) === "Delivery";

const getOrderContext = (order) => {
  const type = getOrderType(order);
  const customer = order?.customerData || {};
  const address = customer.address_1 || order?.address_1 || "";
  const name = customer.name || "";

  if (type === "Delivery" && address) return address;
  if (name) return name;
  return type;
};

const isBoostedOrder = (order) => Boolean(order?.boost?.active);

const getBoostTier = (order) => {
  const target = Number(order?.boost?.targetPosition || order?.queuePosition || 1);
  if (target <= 1) return 1;
  if (target === 2) return 2;
  return 3;
};

const getBoostSealTone = (order) => {
  const tier = getBoostTier(order);
  if (tier === 1) return "gold";
  if (tier === 2) return "silver";
  return "bronze";
};

const getBoostText = (order) => {
  if (!isBoostedOrder(order)) return "";

  const credit = Number(order?.boost?.queueCredit || 0);
  const target = Number(order?.boost?.targetPosition || 0);

  if (target === 1) return "Primero por Boost";
  if (credit > 0 && target > 0) return `Subio ${credit} a posicion ${target}`;
  if (credit > 0) return `Subio ${credit} posicion${credit === 1 ? "" : "es"}`;
  return "Prioridad activa";
};

const CUSTOMER_SEGMENT_META = {
  S1: { label: "Potencial", tone: "s1" },
  S2: { label: "Nuevo", tone: "s2" },
  S3: { label: "Dormido", tone: "s3" },
  S4: { label: "Activo", tone: "s4" },
  S5: { label: "VIP", tone: "s5" },
};

const createTone = (
  ctx,
  { frequency, startAt, duration, volume, type = "sine", attack = 0.018 }
) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
};

const playOrderCommandAlert = (ctx, startAt, boosted = false) => {
  const transpose = boosted ? 1.08 : 1;
  const notes = [
    { frequency: 196, offset: 0, duration: 0.18, volume: 0.07, type: "square", attack: 0.006 },
    { frequency: 392, offset: 0.05, duration: 0.2, volume: 0.06, type: "sawtooth", attack: 0.008 },
    { frequency: 523.25, offset: 0.24, duration: 0.16, volume: 0.052, type: "square", attack: 0.007 },
    { frequency: 659.25, offset: 0.4, duration: 0.18, volume: 0.048, type: "sawtooth", attack: 0.008 },
    { frequency: 783.99, offset: 0.58, duration: 0.26, volume: 0.046, type: "square", attack: 0.01 },
    { frequency: 1046.5, offset: 0.9, duration: 0.2, volume: 0.038, type: "triangle", attack: 0.012 },
    { frequency: 880, offset: 1.12, duration: 0.34, volume: 0.034, type: "sawtooth", attack: 0.014 },
  ];

  notes.forEach((note) => {
    createTone(ctx, {
      frequency: note.frequency * transpose,
      startAt: startAt + note.offset,
      duration: note.duration,
      volume: note.volume,
      type: note.type,
      attack: note.attack,
    });
  });

  createTone(ctx, {
    frequency: 130.81 * transpose,
    startAt,
    duration: 0.9,
    volume: boosted ? 0.038 : 0.032,
    type: "triangle",
    attack: 0.012,
  });
};

const orderHasBoost = (order) => Boolean(order?.boost?.active);

const WEATHER_LABELS = {
  0: "Despejado",
  1: "Mayormente claro",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla",
  51: "Llovizna ligera",
  53: "Llovizna",
  55: "Llovizna intensa",
  61: "Lluvia ligera",
  63: "Lluvia",
  65: "Lluvia intensa",
  71: "Nieve ligera",
  73: "Nieve",
  75: "Nieve intensa",
  80: "Chubascos",
  81: "Chubascos",
  82: "Chubascos fuertes",
  95: "Tormenta",
};

const REGION_BY_CITY = {
  ourense: { label: "Galicia", code: "ES-GA" },
  orense: { label: "Galicia", code: "ES-GA" },
  vigo: { label: "Galicia", code: "ES-GA" },
  pontevedra: { label: "Galicia", code: "ES-GA" },
  coruna: { label: "Galicia", code: "ES-GA" },
  "a coruna": { label: "Galicia", code: "ES-GA" },
  lugo: { label: "Galicia", code: "ES-GA" },
};

const LOCAL_DAY_EVENTS = {
  "05-17": [{ scope: "Regional", label: "Dia das Letras Galegas", regionCode: "ES-GA" }],
  "07-25": [{ scope: "Regional", label: "Dia de Galicia", regionCode: "ES-GA" }],
  "01-06": [{ scope: "Nacional", label: "Reyes" }],
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getRegionForCity = (city) => REGION_BY_CITY[normalizeKey(city)] || null;

const getLocalDateParts = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return {
    year,
    isoDate: `${year}-${month}-${day}`,
    monthDay: `${month}-${day}`,
  };
};

const CUSTOMER_HELP_EMOJIS = ["🙋", "🙋🏻‍♀️", "🙋🏻‍♂️", "🙋🏽‍♂️", "🙋🏿", "🧕"];

const pickCustomerHelpEmoji = (current = "") => {
  const pool = CUSTOMER_HELP_EMOJIS.filter((emoji) => emoji !== current);
  const source = pool.length ? pool : CUSTOMER_HELP_EMOJIS;
  return source[Math.floor(Math.random() * source.length)];
};

const getCustomerName = (order) =>
  String(order?.customerData?.name || "").trim() || "Cliente sin nombre";

const getUnreadCustomerChatMessages = (order) =>
  asArray(order?.customerData?.chatMessages).filter(
    (message) => String(message?.sender || "").toUpperCase() === "CUSTOMER" && !message?.readAt
  );

const getUnreadCustomerChatIds = (orders = []) =>
  orders.flatMap((order) =>
    getUnreadCustomerChatMessages(order).map(
      (message) => `${order.id}:${message.id || message.createdAt || message.text}`
    )
  );

const getCustomerSegment = (order) => {
  const key = String(order?.customerData?.segment || "").trim().toUpperCase();
  return CUSTOMER_SEGMENT_META[key] || { label: key || "Sin segmento", tone: "default" };
};

const isVipOrder = (order) =>
  String(order?.customerData?.segment || "").trim().toUpperCase() === "S5";

const getOrderPriority = (order) => {
  if (isBoostedOrder(order)) {
    return {
      tone: "boost",
      label: "Prioridad",
      value: getBoostText(order),
      detail:
        order?.boost?.amount > 0
          ? `Boost pagado: ${formatMoney(order.boost.amount, order.currency || "EUR")}`
          : "",
    };
  }

  if (isVipOrder(order)) {
    return {
      tone: "vip",
      label: "Prioridad",
      value: "Cliente VIP despues de Boost",
      detail: "",
    };
  }

  return {
    tone: "normal",
    label: "Prioridad",
    value: "Cola normal",
    detail: "",
  };
};

const getCustomerTags = (order) => {
  const customer = order?.customerData || {};
  const count = Number(customer.orderCount || 0);
  const averageTicket = Number(customer.averageTicket || 0);
  const trend = String(customer.trend || "").trim();

  return [
    `${count} pedido${count === 1 ? "" : "s"}`,
    `Ticket ${formatMoney(averageTicket, order?.currency || "EUR")}`,
    trend || "Sin tendencia",
  ];
};

const getCustomerAddress = (order) =>
  isDeliveryOrder(order)
    ? String(order?.customerData?.address_1 || order?.address_1 || "").trim()
    : "";

const formatElapsed = (value) => {
  if (!value) return "nunca";
  const diff = Math.max(Date.now() - new Date(value).getTime(), 0);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  return `hace ${Math.floor(seconds / 60)}m`;
};

function OrderItems({ order }) {
  const products = asArray(order?.products);

  if (!products.length) {
    return <span className="pos-muted">Sin items</span>;
  }

  return (
    <div className="pos-items">
      {products.map((item, index) => {
        const size = item?.size || item?.selectedSize || "";
        const detailRows = getLineDetailRows(item);

        return (
          <div key={`${order.id}-${index}`} className="pos-itemLine">
            <strong>
              {lineName(item)}
              {size ? ` ${size}` : ""} x{lineQty(item)}
              {isIncentiveRewardLine(item) && <span className="pos-lineBadge">REGALO</span>}
            </strong>
            {detailRows.length > 0 && (
              <ul className="pos-itemDetails">
                {detailRows.map((detail, detailIndex) => (
                  <li key={`${order.id}-${index}-${detailIndex}`}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PosLogin({ partners, stores, loading, onStart }) {
  const [partnerId, setPartnerId] = useState("");
  const [storeId, setStoreId] = useState("");
  const filteredStores = stores.filter(
    (store) => !partnerId || String(store.partnerId) === String(partnerId)
  );

  useEffect(() => {
    if (!partnerId && partners[0]?.id) {
      setPartnerId(String(partners[0].id));
    }
  }, [partnerId, partners]);

  useEffect(() => {
    if (!filteredStores.length) {
      setStoreId("");
      return;
    }

    if (!filteredStores.some((store) => String(store.id) === String(storeId))) {
      setStoreId(String(filteredStores[0].id));
    }
  }, [filteredStores, storeId]);

  const selectedPartner = partners.find((partner) => String(partner.id) === String(partnerId));
  const selectedStore = stores.find((store) => String(store.id) === String(storeId));

  return (
    <main className="pos-loginScreen">
      <section className="pos-loginPanel">
        <span className="pos-kicker">Volta POS Virtual</span>
        <h1>Emparejar dispositivo</h1>
        <p>
          Esta pantalla simula el terminal Android. Luego se empaqueta como APK y se conecta a
          SUNMI o Bluetooth.
        </p>

        <label>
          Partner
          <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name || partner.slug || `Partner ${partner.id}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tienda
          <select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            {filteredStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.storeName || store.name || `Store ${store.id}`}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={loading || !selectedPartner || !selectedStore}
          onClick={() =>
            onStart({
              partnerId: selectedPartner.id,
              partnerName: selectedPartner.name || selectedPartner.slug || "Partner",
              storeId: selectedStore.id,
              storeName: selectedStore.storeName || selectedStore.name || "Store",
              deviceName: "Volta POS Virtual",
              pairedAt: new Date().toISOString(),
            })
          }
        >
          Iniciar POS
        </button>
      </section>
    </main>
  );
}

function TicketPreview({ order }) {
  if (!order) {
    return (
      <div className="pos-ticketPreview pos-ticketPreview--empty">
        Selecciona un pedido para ver el ticket.
      </div>
    );
  }

  const schedule = getScheduledOrderState(order);
  const address = getCustomerAddress(order);
  const priority = getOrderPriority(order);

  return (
    <div className="pos-ticketPreview">
      <div className="pos-ticketBrand">VOLTA POS</div>
      <div className="pos-ticketCode">{order.code}</div>
      <div className="pos-ticketMeta">
        <span>{order.storeName || "-"}</span>
        <span>{formatTime(order.date || order.createdAt)}</span>
      </div>
      <div className="pos-ticketBlock">
        <span>Operacion</span>
        <strong>{getOrderType(order)}</strong>
      </div>
      {schedule.hasSchedule && (
        <div className={`pos-ticketBlock pos-ticketBlock--scheduled ${schedule.locked ? "is-locked" : ""}`}>
          <span>Pedido programado</span>
          <strong>{schedule.label}</strong>
        </div>
      )}
      <div className={`pos-ticketBlock pos-ticketBlock--priority pos-ticketBlock--priority-${priority.tone}`}>
        <span>{priority.label}</span>
        <strong>{priority.value}</strong>
        {priority.detail && <small>{priority.detail}</small>}
      </div>
      <div className="pos-ticketBlock">
        <span>Cliente</span>
        <strong>{order.customerData?.name || "-"}</strong>
        <small>{order.customerData?.phone || ""}</small>
      </div>
      {address && (
        <div className="pos-ticketBlock">
          <span>Direccion</span>
          <strong>{address}</strong>
        </div>
      )}
      <div className="pos-ticketItems">
        <span>Pedido</span>
        <OrderItems order={order} />
      </div>
      {order.notes && (
        <div className="pos-ticketBlock">
          <span>Notas</span>
          <strong>{order.notes}</strong>
        </div>
      )}
      <div className="pos-ticketTotal">
        <span>Total</span>
        <strong>{formatMoney(order.total, order.currency || "EUR")}</strong>
      </div>
    </div>
  );
}

function PosInventory({ session }) {
  const [ingredients, setIngredients] = useState([]);
  const [openCategory, setOpenCategory] = useState("");
  const [view, setView] = useState("inventory");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState("");

  const loadIngredients = useCallback(async () => {
    if (!session?.storeId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/stores/${session.storeId}/ingredients`, {
        params: { scope: "menu" },
      });
      const items = Array.isArray(response.data) ? response.data : [];
      setIngredients(items);
      setOpenCategory("");
      setMessage("");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cargar inventario.");
    } finally {
      setLoading(false);
    }
  }, [session?.storeId]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  const categories = useMemo(() => {
    const grouped = new Map();

    ingredients.forEach((ingredient) => {
      const category = String(ingredient.category || "OTROS").toUpperCase().trim();
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(ingredient);
    });

    return [...grouped.entries()]
      .sort((left, right) => left[0].localeCompare(right[0], "es", { sensitivity: "base" }))
      .map(([category, items]) => ({
        category,
        items,
        activeCount: items.filter((item) => item.exists && item.active).length,
      }));
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return ingredients;

    return ingredients.filter((ingredient) =>
      [
        ingredient.name,
        ingredient.category,
        ingredient.status,
        ...(ingredient.affectedProductNames || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [ingredients, search]);

  const toggleIngredient = async (ingredient) => {
    if (!session?.storeId || savingId) return;

    const nextActive = !(ingredient.exists && ingredient.active);

    try {
      setSavingId(ingredient.id);
      await api.patch(`/stores/${session.storeId}/ingredients/${ingredient.id}`, {
        active: nextActive,
        source: "pos",
      });
      setIngredients((current) =>
        current.map((item) =>
          item.id === ingredient.id
            ? {
                ...item,
                exists: true,
                active: nextActive,
              }
            : item
        )
      );
      setMessage("");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cambiar el ingrediente.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="pos-inventoryPane">
      <div className="pos-sectionHead">
        <div>
          <span>Inventory</span>
          <h2>Ingredientes del menu</h2>
          <small>{session.storeName}</small>
        </div>
        <div className="pos-invHeadActions">
          {view === "inventory" && (
            <button
              type="button"
              className="pos-invSearchBtn"
              onClick={() => {
                setView("search");
                setSearch("");
              }}
              aria-label="Buscar ingrediente"
              title="Buscar ingrediente"
            >
              <span aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={loadIngredients} disabled={loading}>
            {loading ? "..." : "Sync"}
          </button>
        </div>
      </div>

      {message && <div className="pos-inlineAlert">{message}</div>}

      {view === "search" && (
        <div className="pos-invSearchView">
          <div className="pos-invSearchBar">
            <button type="button" onClick={() => setView("inventory")}>
              Volver
            </button>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar ingrediente..."
              autoFocus
            />
          </div>

          <div className="pos-invItems pos-invItems--search">
            {filteredIngredients.map((ingredient) => {
              const active = ingredient.exists && ingredient.active;

              return (
                <div
                  key={ingredient.id}
                  className={`pos-invItem ${active ? "is-active" : "is-inactive"}`}
                >
                  <span>
                    {String(ingredient.name || "").toUpperCase()}
                    <small>
                      {ingredient.affectedProducts || 0} producto
                      {(ingredient.affectedProducts || 0) === 1 ? "" : "s"}
                    </small>
                  </span>
                  <button
                    type="button"
                    className={`pos-invToggle ${active ? "on" : "off"}`}
                    onClick={() => toggleIngredient(ingredient)}
                    disabled={savingId === ingredient.id}
                  >
                    {active ? "ACTIVE" : "OFF"}
                  </button>
                </div>
              );
            })}

            {!loading && filteredIngredients.length === 0 && (
              <div className="pos-emptySmall">No encontramos ese ingrediente.</div>
            )}
          </div>
        </div>
      )}

      {view === "inventory" && (
        <div className="pos-inventoryList">
          {categories.map(({ category, items, activeCount }) => {
            const isOpen = openCategory === category;

            return (
              <div key={category} className="pos-invCategory">
                <button
                  type="button"
                  className="pos-invCategoryBtn"
                  onClick={() => setOpenCategory(isOpen ? "" : category)}
                >
                  <span>{category}</span>
                  <strong>{activeCount}/{items.length}</strong>
                </button>

                {isOpen && (
                  <div className="pos-invItems">
                    {items.map((ingredient) => {
                      const active = ingredient.exists && ingredient.active;

                      return (
                        <div
                          key={ingredient.id}
                          className={`pos-invItem ${active ? "is-active" : "is-inactive"}`}
                        >
                          <span>
                            {String(ingredient.name || "").toUpperCase()}
                            <small>
                              {ingredient.affectedProducts || 0} producto
                              {(ingredient.affectedProducts || 0) === 1 ? "" : "s"}
                            </small>
                          </span>
                          <button
                            type="button"
                            className={`pos-invToggle ${active ? "on" : "off"}`}
                            onClick={() => toggleIngredient(ingredient)}
                            disabled={savingId === ingredient.id}
                          >
                            {active ? "ACTIVE" : "OFF"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && categories.length === 0 && (
            <div className="pos-emptySmall">No hay ingredientes configurados.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default function PosApp() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(POS_SESSION_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [partners, setPartners] = useState([]);
  const [stores, setStores] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activePanel, setActivePanel] = useState("orders");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [dayOrders, setDayOrders] = useState([]);
  const [dayOrdersKpis, setDayOrdersKpis] = useState(null);
  const [dayOrdersLoading, setDayOrdersLoading] = useState(false);
  const [dayOrdersError, setDayOrdersError] = useState("");
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [storeActive, setStoreActive] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [newOrderNotice, setNewOrderNotice] = useState(null);
  const [readyConfirmOrder, setReadyConfirmOrder] = useState(null);
  const [readyButtonToast, setReadyButtonToast] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [reservationsOpen, setReservationsOpen] = useState(false);
  const [activeCalendarEventId, setActiveCalendarEventId] = useState(null);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [customerHelpOpen, setCustomerHelpOpen] = useState(false);
  const [customerHelpOrderId, setCustomerHelpOrderId] = useState("");
  const [customerHelpText, setCustomerHelpText] = useState("");
  const [customerHelpSending, setCustomerHelpSending] = useState(false);
  const [customerHelpEmoji, setCustomerHelpEmoji] = useState(() => pickCustomerHelpEmoji());
  const [, setAudioReady] = useState(false);
  const [storeMeta, setStoreMeta] = useState(null);
  const [dayInfo, setDayInfo] = useState({
    loading: false,
    items: [],
  });
  const [presence, setPresence] = useState({
    activeVisitors: 0,
    cartVisitors: 0,
    checkoutVisitors: 0,
    browsingVisitors: 0,
  });
  const [syncHealth, setSyncHealth] = useState({
    lastAttemptAt: null,
    lastOkAt: null,
    serverTime: null,
    error: "",
    consecutiveFailures: 0,
  });
  const [clockTick, setClockTick] = useState(Date.now());
  const seenIdsRef = useRef(new Set());
  const ordersRef = useRef([]);
  const acceptedNoticeIdsRef = useRef(new Set());
  const boostStateRef = useRef(new Map());
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const audioPrimedRef = useRef(false);
  const audioPendingOrderAlertRef = useRef(false);
  const alertSoundRef = useRef(null);
  const newOrderSoundRef = useRef(null);
  const chatUnreadIdsRef = useRef(new Set());
  const chatUnreadInitializedRef = useRef(false);
  const loadOrdersRequestRef = useRef(0);
  const loadingOrdersRef = useRef(false);

  const selectedOrder = useMemo(
    () =>
      orders.find((order) => order.id === selectedOrderId) ||
      dayOrders.find((order) => order.id === selectedOrderId) ||
      null,
    [dayOrders, orders, selectedOrderId]
  );
  const selectedOrderSchedule = selectedOrder
    ? getScheduledOrderState(selectedOrder, clockTick)
    : null;
  const customerHelpOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(customerHelpOrderId)) || null,
    [customerHelpOrderId, orders]
  );
  const unreadCustomerMessageCount = useMemo(
    () => orders.reduce((sum, order) => sum + getUnreadCustomerChatMessages(order).length, 0),
    [orders]
  );

  const printerStatus = mockPrinter.getStatus();
  const printerTone = printerStatus.realConnected
    ? "ok"
    : printerStatus.virtualReady
    ? "virtual"
    : "fail";
  const printerLabel = printerStatus.realConnected
    ? "Print OK"
    : printerStatus.virtualReady
    ? "Print Windows"
    : "Print fail";
  const lastOkAgeMs = syncHealth.lastOkAt
    ? clockTick - new Date(syncHealth.lastOkAt).getTime()
    : Infinity;
  const trustState = !syncHealth.lastOkAt
    ? "checking"
    : lastOkAgeMs > OFFLINE_AFTER_MS || syncHealth.consecutiveFailures > 0
    ? "offline"
    : lastOkAgeMs > STALE_AFTER_MS
    ? "stale"
    : "online";
  const hasVisitors = Number(presence.activeVisitors || 0) > 0;
  const showVisitorAlert = orders.length === 0 && trustState === "online" && hasVisitors;
  const showModeTabs = activePanel !== "orders" || Boolean(selectedOrder) || orders.length > 0;
  const showOrderUtilityFabs =
    activePanel === "orders" &&
    !selectedOrder &&
    !showVisitorAlert &&
    !reservationsOpen &&
    !customerHelpOpen;
  const shellClassName = [
    "pos-shell",
    `pos-shell--${trustState}`,
    showVisitorAlert ? "pos-shell--visitors" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const trustLabel =
    trustState === "online"
      ? "Online"
      : trustState === "stale"
      ? "Tardando"
      : trustState === "checking"
      ? "Conectando"
      : "Sin conexion";
  const idleClockTime = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(clockTick)),
    [clockTick]
  );
  const idleClockDate = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date(clockTick)),
    [clockTick]
  );
  const cityRegion = useMemo(
    () => getRegionForCity(storeMeta?.city || session?.storeCity || ""),
    [session?.storeCity, storeMeta?.city]
  );
  const calendarEvents = useMemo(() => {
    const today = new Date(clockTick);
    const reservationEvents = reservations
      .map((reservation) => {
        const reservationDate = reservation.reservationDateTime
          ? new Date(reservation.reservationDateTime)
          : new Date(`${reservation.reservationDate || ""}T${reservation.reservationTime || "00:00"}`);
        const fallbackTime = reservation.reservationTime || formatClockTime(reservationDate);

        return {
          id: `reservation-${reservation.id}`,
          type: "reservation",
          tone: "reservation",
          time: fallbackTime,
          sortAt: Number.isNaN(reservationDate.getTime()) ? 0 : reservationDate.getTime(),
          title: reservation.customerName || "Reserva",
          subtitle: `${reservation.partySize || "-"} pers. - ${reservation.customerPhone || "Sin telefono"}`,
          meta: reservation.notes || "Reserva de mesa",
          reservation,
        };
      });

    const scheduledOrderEvents = orders
      .map((order) => {
        const schedule = getScheduledOrderState(order, clockTick);
        if (!schedule.hasSchedule) return null;

        const scheduledDate = new Date(schedule.scheduledFor);
        if (!isSameLocalDay(scheduledDate, today)) return null;

        const items = asArray(order.products);

        return {
          id: `scheduled-${order.id}`,
          type: "scheduled",
          tone: "scheduled",
          time: formatClockTime(scheduledDate),
          sortAt: scheduledDate.getTime(),
          title: getCustomerName(order),
          subtitle: `${order.code || `Pedido ${order.id}`} - ${formatMoney(order.total, order.currency || "EUR")}`,
          meta: items.length ? `${lineQty(items[0])} x ${lineName(items[0])}` : "Pedido programado",
          schedule,
          order,
        };
      })
      .filter(Boolean);

    return [...reservationEvents, ...scheduledOrderEvents].sort((left, right) => {
      if (left.sortAt !== right.sortAt) return left.sortAt - right.sortAt;
      return left.title.localeCompare(right.title);
    });
  }, [clockTick, orders, reservations]);
  const activeCalendarEvent =
    calendarEvents.find((event) => event.id === activeCalendarEventId) || null;
  const activeReservation =
    activeCalendarEvent?.type === "reservation" ? activeCalendarEvent.reservation : null;
  const hasReservationCalendarEvents = calendarEvents.some(
    (event) => event.type === "reservation"
  );
  const hasScheduledCalendarEvents = calendarEvents.some((event) => event.type === "scheduled");
  const reservationsFabClass = [
    "pos-reservationsFab",
    calendarEvents.length > 0 ? "active" : "",
    hasReservationCalendarEvents ? "has-reservations" : "",
    hasScheduledCalendarEvents ? "has-scheduled" : "",
    hasReservationCalendarEvents && hasScheduledCalendarEvents ? "has-both" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCustomerHelpEmoji((current) => pickCustomerHelpEmoji(current));
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  const playOrderMelodyOnContext = useCallback((ctx, boosted = false) => {
    if (!ctx) return;

    const now = ctx.currentTime + 0.01;
    playOrderCommandAlert(ctx, now, boosted);

    if (boosted) {
      createTone(ctx, {
        frequency: 1174.66,
        startAt: now + 1.44,
        duration: 0.26,
        volume: 0.032,
        type: "square",
        attack: 0.012,
      });
    }
  }, []);

  const unlockAudioContext = useCallback(async () => {
    if (typeof window === "undefined") return null;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    if (audioCtxRef.current.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {
        return null;
      }
    }

    if (audioCtxRef.current.state !== "running") return null;

    audioUnlockedRef.current = true;
    setAudioReady(true);
    if (!audioPrimedRef.current) {
      const now = audioCtxRef.current.currentTime + 0.01;
      createTone(audioCtxRef.current, {
        frequency: 440,
        startAt: now,
        duration: 0.04,
        volume: 0.0008,
        type: "sine",
        attack: 0.005,
      });
      audioPrimedRef.current = true;
    }
    return audioCtxRef.current;
  }, []);

  const getUnlockedAudioContext = useCallback(() => {
    if (!audioUnlockedRef.current || !audioCtxRef.current) return null;
    if (audioCtxRef.current.state !== "running") return null;
    return audioCtxRef.current;
  }, []);

  const playNewOrderSound = useCallback(() => {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return false;
    playOrderMelodyOnContext(ctx, false);
    audioPendingOrderAlertRef.current = false;
    return true;
  }, [getUnlockedAudioContext, playOrderMelodyOnContext]);

  const playBoostSound = useCallback(() => {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return false;
    playOrderMelodyOnContext(ctx, true);
    audioPendingOrderAlertRef.current = false;
    return true;
  }, [getUnlockedAudioContext, playOrderMelodyOnContext]);

  const playCustomerMessageSound = useCallback(() => {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return false;

    const now = ctx.currentTime + 0.01;
    createTone(ctx, { frequency: 659.25, startAt: now, duration: 0.12, volume: 0.032, type: "sine" });
    createTone(ctx, { frequency: 880, startAt: now + 0.14, duration: 0.14, volume: 0.027, type: "triangle" });
    createTone(ctx, { frequency: 1174.66, startAt: now + 0.31, duration: 0.18, volume: 0.022, type: "sine" });
    return true;
  }, [getUnlockedAudioContext]);

  const stopNewOrderSoundLoop = useCallback(() => {
    if (newOrderSoundRef.current) {
      window.clearInterval(newOrderSoundRef.current);
      newOrderSoundRef.current = null;
    }
    audioPendingOrderAlertRef.current = false;
  }, []);

  const startNewOrderSoundLoop = useCallback((boosted = false) => {
    stopNewOrderSoundLoop();

    const playOnce = boosted ? playBoostSound : playNewOrderSound;
    if (!playOnce()) {
      audioPendingOrderAlertRef.current = true;
    }
    newOrderSoundRef.current = window.setInterval(playOnce, 5200);
  }, [playBoostSound, playNewOrderSound, stopNewOrderSoundLoop]);

  useEffect(() => {
    const unlockAudio = () => {
      unlockAudioContext().then(() => {
        if (audioPendingOrderAlertRef.current && orders.length > 0) {
          startNewOrderSoundLoop(orders.some(orderHasBoost));
        }
      });
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true, capture: true });
    window.addEventListener("keydown", unlockAudio, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio, { capture: true });
      window.removeEventListener("keydown", unlockAudio, { capture: true });
    };
  }, [orders, startNewOrderSoundLoop, unlockAudioContext]);

  const playAlertPulse = useCallback(() => {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.01;
    createTone(ctx, { frequency: 493.88, startAt: now, duration: 0.2, volume: 0.017, type: "triangle" });
    createTone(ctx, { frequency: 587.33, startAt: now + 0.22, duration: 0.24, volume: 0.014, type: "triangle" });
  }, [getUnlockedAudioContext]);

  useEffect(() => {
    const loadSetup = async () => {
      try {
        setLoadingSetup(true);
        const [partnersResponse, storesResponse] = await Promise.all([
          api.get("/partners"),
          api.get("/api/stores"),
        ]);
        setPartners(Array.isArray(partnersResponse.data) ? partnersResponse.data : []);
        setStores(Array.isArray(storesResponse.data) ? storesResponse.data : []);
      } catch (error) {
        console.error(error);
        setMessage("No se pudo cargar la configuracion del POS.");
      } finally {
        setLoadingSetup(false);
      }
    };

    loadSetup();
  }, []);

  const loadOrders = useCallback(async ({ force = false } = {}) => {
    if (!session?.partnerId || !session?.storeId) return;
    if (loadingOrdersRef.current && !force) return;

    const requestId = loadOrdersRequestRef.current + 1;
    loadOrdersRequestRef.current = requestId;

    try {
      await unlockAudioContext();
      loadingOrdersRef.current = true;
      setLoadingOrders(true);
      const lastAttemptAt = new Date().toISOString();
      setSyncHealth((current) => ({
        ...current,
        lastAttemptAt,
      }));

      const [ordersResponse, presenceResponse] = await Promise.all([
        api.get("/api/myorders/pending", {
          params: {
            partnerId: session.partnerId,
            storeId: session.storeId,
            _ts: Date.now(),
          },
          timeout: POS_REQUEST_TIMEOUT_MS,
        }),
        api.get(`/api/presence/stores/${session.storeId}/status`, {
          params: {
            partnerId: session.partnerId,
            _ts: Date.now(),
          },
          timeout: POS_REQUEST_TIMEOUT_MS,
        }).catch(() => null),
      ]);
      if (requestId !== loadOrdersRequestRef.current) return;

      const items = Array.isArray(ordersResponse.data?.items) ? ordersResponse.data.items : [];
      const previousSeen = seenIdsRef.current;
      const previousBoostState = boostStateRef.current;
      const acceptedNoticeIds = acceptedNoticeIdsRef.current;
      const incoming = items.filter(
        (item) => !previousSeen.has(item.id) && !acceptedNoticeIds.has(String(item.id))
      );
      const incomingBoosted = incoming.filter(orderHasBoost);
      const newlyBoosted = items.filter(
        (item) =>
          previousSeen.has(item.id) &&
          !acceptedNoticeIds.has(String(item.id)) &&
          orderHasBoost(item) &&
          !previousBoostState.get(item.id)
      );

      if (incoming.length > 0) {
        const primaryIncoming = incomingBoosted[0] || incoming[0];
        setMessage(`${incoming.length} pedido(s) nuevo(s) en ${session.storeName}.`);
        setNewOrderNotice({
          id: `${primaryIncoming.id}-${Date.now()}`,
          order: primaryIncoming,
          orderIds: incoming.map((item) => item.id),
          count: incoming.length,
          boosted: incomingBoosted.length > 0,
        });
      }

      if (incomingBoosted.length > 0 || (previousSeen.size > 0 && newlyBoosted.length > 0)) {
        startNewOrderSoundLoop(true);
      } else if (incoming.length > 0) {
        startNewOrderSoundLoop(false);
      }

      if (presenceResponse?.data?.presence) {
        setPresence(presenceResponse.data.presence);
      }

      const previousUnreadIds = chatUnreadIdsRef.current;
      const nextUnreadIds = new Set(getUnreadCustomerChatIds(items));
      const newUnreadIds = [...nextUnreadIds].filter((id) => !previousUnreadIds.has(id));
      if (chatUnreadInitializedRef.current && newUnreadIds.length > 0) {
        playCustomerMessageSound();
        setMessage(
          newUnreadIds.length === 1
            ? "Nueva respuesta de cliente en el chat."
            : `${newUnreadIds.length} respuestas nuevas de clientes.`
        );
      }
      chatUnreadIdsRef.current = nextUnreadIds;
      chatUnreadInitializedRef.current = true;

      const lastOkAt = new Date().toISOString();
      setSyncHealth({
        lastAttemptAt,
        lastOkAt,
        serverTime: ordersResponse.data?.updatedAt || lastOkAt,
        error: "",
        consecutiveFailures: 0,
      });
      seenIdsRef.current = new Set(items.map((item) => item.id));
      boostStateRef.current = new Map(items.map((item) => [item.id, orderHasBoost(item)]));
      setOrders(items);
      setSelectedOrderId((current) =>
        current && items.some((item) => item.id === current) ? current : null
      );
    } catch (error) {
      if (requestId !== loadOrdersRequestRef.current) return;
      console.error(error);
      setSyncHealth((current) => ({
        ...current,
        error: error.response?.data?.error || "No se pudo leer el servidor.",
        consecutiveFailures: current.consecutiveFailures + 1,
      }));
      setMessage(error.response?.data?.error || "No se pudo leer la cola del POS.");
    } finally {
      if (requestId === loadOrdersRequestRef.current) {
        loadingOrdersRef.current = false;
        setLoadingOrders(false);
      }
    }
  }, [playCustomerMessageSound, session, startNewOrderSoundLoop, unlockAudioContext]);

  const loadDayOrders = useCallback(async () => {
    if (!session?.partnerId || !session?.storeId) return;

    try {
      setDayOrdersLoading(true);
      setDayOrdersError("");
      const response = await api.get("/api/myorders/summary", {
        params: {
          partnerId: session.partnerId,
          storeId: session.storeId,
          period: "today",
        },
      });
      const data = response.data || {};
      const completedOrders = Array.isArray(data?.orders)
        ? data.orders.filter(isCompletedPaidOrder)
        : [];
      setDayOrders(completedOrders);
      setDayOrdersKpis(data?.kpis || null);
    } catch (error) {
      console.error(error);
      setDayOrdersError("No se pudieron cargar las ordenes del dia.");
    } finally {
      setDayOrdersLoading(false);
    }
  }, [session?.partnerId, session?.storeId]);

  useEffect(() => {
    if (!session) return undefined;

    seenIdsRef.current = new Set();
    acceptedNoticeIdsRef.current = readAcceptedNoticeIds(session.storeId);
    boostStateRef.current = new Map();
    chatUnreadIdsRef.current = new Set();
    chatUnreadInitializedRef.current = false;
    loadOrders();
    const timer = window.setInterval(loadOrders, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadOrders, session]);

  useEffect(() => {
    if (!session) return undefined;

    const forceRead = () => {
      loadOrders();
    };

    const watchdog = window.setInterval(() => {
      const lastOkMs = syncHealth.lastOkAt ? new Date(syncHealth.lastOkAt).getTime() : 0;
      if (!lastOkMs || Date.now() - lastOkMs > STALE_AFTER_MS) {
        loadOrders();
      }
    }, Math.max(3000, Math.floor(POLL_MS / 2)));

    window.addEventListener("focus", forceRead);
    window.addEventListener("online", forceRead);
    document.addEventListener("visibilitychange", forceRead);

    return () => {
      window.clearInterval(watchdog);
      window.removeEventListener("focus", forceRead);
      window.removeEventListener("online", forceRead);
      document.removeEventListener("visibilitychange", forceRead);
    };
  }, [loadOrders, session, syncHealth.lastOkAt]);

  useEffect(() => {
    if (!showVisitorAlert) {
      if (alertSoundRef.current) {
        window.clearInterval(alertSoundRef.current);
        alertSoundRef.current = null;
      }
      return undefined;
    }

    playAlertPulse();
    alertSoundRef.current = window.setInterval(playAlertPulse, 2200);

    return () => {
      if (alertSoundRef.current) {
        window.clearInterval(alertSoundRef.current);
        alertSoundRef.current = null;
      }
    };
  }, [playAlertPulse, showVisitorAlert]);

  useEffect(() => {
    if (!session?.storeId) return;

    api
      .get(`/api/stores/${session.storeId}`)
      .then((response) => {
        const store = response?.data || response;
        setStoreMeta(store || null);
        setStoreActive(store?.active !== false);
      })
      .catch((error) => {
        console.error(error);
        setMessage("No se pudo leer si la tienda esta abierta.");
      });
  }, [session?.storeId]);

  useEffect(() => {
    if (!session?.storeId) return undefined;

    let cancelled = false;

    const resolveCoordinates = async (store) => {
      const lat = Number(store?.latitude);
      const lon = Number(store?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };

      const city = String(store?.city || session?.storeName || "").trim();
      if (!city) return null;

      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json&countryCode=ES`
      );
      if (!response.ok) return null;

      const data = await response.json();
      const place = Array.isArray(data?.results) ? data.results[0] : null;
      const placeLat = Number(place?.latitude);
      const placeLon = Number(place?.longitude);
      return Number.isFinite(placeLat) && Number.isFinite(placeLon)
        ? { lat: placeLat, lon: placeLon }
        : null;
    };

    const loadDayInfo = async () => {
      const store = storeMeta || {};
      const city = String(store.city || session.storeName || "").trim();
      const region = getRegionForCity(city);
      const { year, isoDate, monthDay } = getLocalDateParts();
      const nextItems = [];

      setDayInfo((current) => ({ ...current, loading: true }));

      try {
        const coords = await resolveCoordinates(store);
        if (coords && !cancelled) {
          const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code&timezone=auto`
          );
          if (weatherResponse.ok) {
            const weather = await weatherResponse.json();
            const temp = Number(weather?.current?.temperature_2m);
            const code = Number(weather?.current?.weather_code);
            if (Number.isFinite(temp)) {
              nextItems.push({
                key: "weather",
                label: "Clima",
                value: `${Math.round(temp)}°C · ${WEATHER_LABELS[code] || "Ahora"}`,
              });
            }
          }
        }
      } catch (error) {
        console.warn("[pos.dayInfo.weather]", error?.message || error);
      }

      try {
        const holidaysResponse = await fetch(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/ES`
        );
        if (holidaysResponse.ok) {
          const holidays = await holidaysResponse.json();
          const todaysHolidays = Array.isArray(holidays)
            ? holidays.filter((holiday) => {
                if (holiday?.date !== isoDate) return false;
                if (!Array.isArray(holiday.counties) || holiday.counties.length === 0) {
                  return true;
                }
                return region?.code ? holiday.counties.includes(region.code) : false;
              })
            : [];

          if (todaysHolidays.length) {
            nextItems.push({
              key: "holiday",
              label: region?.label ? `Festivo ${region.label}` : "Festivo",
              value: todaysHolidays.map((holiday) => holiday.localName || holiday.name).join(" · "),
            });
          }
        }
      } catch (error) {
        console.warn("[pos.dayInfo.holidays]", error?.message || error);
      }

      const localEvents = (LOCAL_DAY_EVENTS[monthDay] || []).filter(
        (event) => !event.regionCode || event.regionCode === region?.code
      );
      localEvents.forEach((event, index) => {
        nextItems.push({
          key: `event-${index}`,
          label: event.scope,
          value: event.label,
        });
      });

      if (!nextItems.some((item) => item.key === "holiday" || item.key.startsWith("event-"))) {
        nextItems.push({
          key: "no-event",
          label: city || region?.label ? "Local" : "Info",
          value: city
            ? `${city}${region?.label ? ` · ${region.label}` : ""} · sin festivo cargado hoy`
            : "Sin evento cargado hoy",
        });
      }

      if (!cancelled) {
        setDayInfo({
          loading: false,
          items: nextItems.slice(0, 4),
        });
      }
    };

    loadDayInfo();
    const timer = window.setInterval(loadDayInfo, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.storeId, session?.storeName, storeMeta]);

  const loadReservations = useCallback(async () => {
    if (!session?.storeId) return;

    try {
      setLoadingReservations(true);
      const response = await api.get(`/api/reservations/today/${session.storeId}`);
      const items = Array.isArray(response.data) ? response.data : [];
      setReservations(items);
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar las reservas de hoy.");
    } finally {
      setLoadingReservations(false);
    }
  }, [session?.storeId]);

  useEffect(() => {
    if (!session?.storeId) return undefined;

    loadReservations();
    const timer = window.setInterval(loadReservations, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadReservations, session?.storeId]);

  useEffect(() => {
    if (!reservationsOpen) return;

    setActiveCalendarEventId((current) =>
      current && calendarEvents.some((event) => event.id === current)
        ? current
        : calendarEvents[0]?.id || null
    );
  }, [calendarEvents, reservationsOpen]);

  useEffect(() => {
    if (!customerHelpOpen) return;

    const fallbackOrder = selectedOrder || orders[0] || null;
    if (fallbackOrder && !orders.some((order) => String(order.id) === String(customerHelpOrderId))) {
      setCustomerHelpOrderId(String(fallbackOrder.id));
    }
  }, [customerHelpOpen, customerHelpOrderId, orders, selectedOrder]);

  useEffect(() => {
    if (!customerHelpOpen || !customerHelpOrder?.id) return;
    if (!getUnreadCustomerChatMessages(customerHelpOrder).length) return;

    let cancelled = false;
    api
      .patch(`/api/myorders/${customerHelpOrder.id}/messages/read`)
      .then((response) => {
        if (cancelled) return;
        const messages = response.data?.messages || [];
        setOrders((current) =>
          current.map((order) =>
            order.id === customerHelpOrder.id
              ? {
                  ...order,
                  customerData: {
                    ...order.customerData,
                    chatMessages: messages,
                  },
                }
              : order
          )
        );
        chatUnreadIdsRef.current = new Set(
          [...chatUnreadIdsRef.current].filter((id) => !id.startsWith(`${customerHelpOrder.id}:`))
        );
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [customerHelpOpen, customerHelpOrder]);

  const startSession = (nextSession) => {
    unlockAudioContext();
    localStorage.setItem(POS_SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setMessage("POS virtual emparejado.");
  };

  const logoutSession = () => {
    localStorage.removeItem(POS_SESSION_KEY);
    setSession(null);
    setOrders([]);
    setSelectedOrderId(null);
    setSyncHealth({
      lastAttemptAt: null,
      lastOkAt: null,
      serverTime: null,
      error: "",
      consecutiveFailures: 0,
    });
    setMessage("");
  };

  const toggleStore = async () => {
    if (!session?.storeId || savingStore) return;

    const nextActive = !storeActive;

    try {
      setSavingStore(true);
      await api.patch(`/api/stores/${session.storeId}/active`, {
        active: nextActive,
      });
      setStoreActive(nextActive);
      setMessage(nextActive ? "Tienda abierta para pedidos." : "Tienda cerrada manualmente.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cambiar el estado de la tienda.");
    } finally {
      setSavingStore(false);
    }
  };

  const printOrder = async (order) => {
    if (!order) return;

    const openedWindowsPrint = printOrderWithWindowsDialog(order);

    try {
      const job = await mockPrinter.printOrder(order);
      setMessage(
        openedWindowsPrint
          ? `Ticket ${job.code || job.orderId} abierto para imprimir en Windows.`
          : `Ticket ${job.code || job.orderId} guardado en impresora virtual. El navegador bloqueo la ventana de impresion.`
      );
    } catch (error) {
      console.error(error);
      setMessage(
        openedWindowsPrint
          ? "Ticket abierto para imprimir en Windows, pero no se pudo guardar en la impresora virtual."
          : "No se pudo imprimir el ticket virtual."
      );
    }
  };

  const showReadyBlockedToast = () => {
    const toast = {
      id: Date.now(),
      text: "Espera el momento 🧘‍♂️",
    };
    setReadyButtonToast(toast);
    window.setTimeout(() => {
      setReadyButtonToast((current) => (current?.id === toast.id ? null : current));
    }, 1800);
  };

  const markReady = async (order) => {
    if (!order) return;

    const schedule = getScheduledOrderState(order, clockTick);
    if (schedule.locked) {
      showReadyBlockedToast();
      return;
    }

    try {
      const response = await api.patch(`/api/myorders/${order.id}/ready`);
      const notification = response.data?.notification;
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSelectedOrderId(null);
      setReadyConfirmOrder(null);
      setMessage(
        notification?.ok
          ? `Pedido ${order.code || order.id} marcado como listo. Cliente notificado.`
          : `Pedido ${order.code || order.id} marcado como listo. Revisa la notificacion al cliente.`
      );
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo marcar como listo.");
    }
  };

  const requestMarkReady = (order) => {
    if (!order) return;

    const schedule = getScheduledOrderState(order, clockTick);
    if (schedule.locked) {
      showReadyBlockedToast();
      return;
    }

    setReadyConfirmOrder(order);
  };

  const completeReservation = async () => {
    if (!activeReservation) return;

    const confirmed = window.confirm("Estas seguro de completar esta reserva?");
    if (!confirmed) return;

    try {
      await api.patch(`/api/reservations/${activeReservation.id}/complete`);
      setReservations((current) => current.filter((item) => item.id !== activeReservation.id));
      setActiveCalendarEventId(null);
      setReservationsOpen(false);
      setMessage("Reserva completada.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo completar la reserva.");
    }
  };

  const sendCustomerHelpQuestion = async () => {
    if (!customerHelpOrder) {
      setMessage("Selecciona un pedido para consultar al cliente.");
      return;
    }

    if (!customerHelpOrder.customerData?.phone) {
      setMessage("Ese pedido no tiene telefono para consultar al cliente.");
      return;
    }

    const question = customerHelpText.trim();
    if (!question) {
      setMessage("Escribe la duda antes de contactar al cliente.");
      return;
    }

    try {
      setCustomerHelpSending(true);
      const response = await api.post(`/api/myorders/${customerHelpOrder.id}/messages`, {
        text: question,
      });
      const messages = response.data?.messages || [];
      setOrders((current) =>
        current.map((order) =>
          order.id === customerHelpOrder.id
            ? {
                ...order,
                customerData: {
                  ...order.customerData,
                  chatMessages: messages,
                },
              }
            : order
        )
      );
      setCustomerHelpText("");
      setMessage(
        response.data?.notification?.ok
          ? `Mensaje enviado al cliente de ${customerHelpOrder.code || customerHelpOrder.id}.`
          : `Mensaje guardado, pero revisa el envio SMS.`
      );
    } catch (error) {
      console.error(error);
      const code = error.response?.data?.error;
      const messages = {
        bad_message: "Escribe un mensaje para el cliente.",
        order_not_found: "No encontramos ese pedido.",
        valid_order_id_required: "Selecciona un pedido valido.",
      };
      setMessage(messages[code] || "No se pudo enviar el mensaje al cliente.");
    } finally {
      setCustomerHelpSending(false);
    }
  };

  const acceptNewOrderNotice = () => {
    const acceptedIds = newOrderNotice?.orderIds?.length
      ? newOrderNotice.orderIds
      : newOrderNotice?.order?.id
      ? [newOrderNotice.order.id]
      : [];

    if (acceptedIds.length > 0 && session?.storeId) {
      const nextAccepted = new Set(acceptedNoticeIdsRef.current);
      acceptedIds.forEach((id) => nextAccepted.add(String(id)));
      acceptedNoticeIdsRef.current = nextAccepted;
      writeAcceptedNoticeIds(session.storeId, nextAccepted);
    }

    stopNewOrderSoundLoop();
    setNewOrderNotice(null);
    setActivePanel("orders");
    setSelectedOrderId(null);
    if (newOrderNotice?.order) {
      setMessage(`Pedido ${newOrderNotice.order.code || newOrderNotice.order.id} aceptado en POS.`);
    }
  };

  const openDayOrders = () => {
    setMenuOpen(false);
    setSelectedOrderId(null);
    setActivePanel("dayOrders");
    loadDayOrders();
  };

  const activateOrderAudio = async () => {
    const ctx = await unlockAudioContext();

    if (!ctx) {
      setMessage("El navegador no permitio activar el sonido todavia.");
      return;
    }

    playOrderMelodyOnContext(ctx, false);
    setMessage("Sonido de pedidos activado.");
  };

  if (!session) {
    return (
      <PosLogin
        partners={partners}
        stores={stores}
        loading={loadingSetup}
        onStart={startSession}
      />
    );
  }

  return (
    <main className={shellClassName}>
      <header className="pos-topbar">
        <div className="pos-storeIdentity">
          <span className="pos-kicker">Volta POS Virtual</span>
          <h1>{session.storeName}</h1>
          <small>{session.partnerName}</small>
        </div>

        <div className="app-toggle pos-storeToggle">
          <span className="app-toggle-label">
            {storeActive ? "Store open" : "Store closed"}
          </span>
          <button
            type="button"
            onClick={toggleStore}
            aria-pressed={storeActive}
            disabled={savingStore}
            className={`app-toggle-btn ${storeActive ? "on" : "off"}`}
          >
            <span className="app-toggle-knob" />
          </button>
        </div>

        <div className="pos-topMetrics">
          <div className="pos-topActions">
            <button
              type="button"
              className="pos-menuBtn"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Menu POS"
              title="Menu"
            >
              Menu
            </button>

            <button
              type="button"
              className="pos-logoutPill"
              onClick={logoutSession}
            >
              Logout
            </button>
          </div>

          <div className="pos-topChip pos-topChip--queue" title="Pedidos pendientes">
            <span className="pos-chipIcon pos-chipIcon--queue" aria-hidden="true">
              <span />
              <span />
            </span>
            <strong>{orders.length}</strong>
          </div>

          <div
            className={`pos-topChip pos-topChip--visitors ${hasVisitors ? "is-active" : ""}`}
            title="Visitantes activos en la tienda"
          >
            <span className="pos-chipIcon pos-chipIcon--visitor" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <strong>{presence.activeVisitors || 0}</strong>
          </div>

          <button
            type="button"
      className={`pos-topChip pos-syncChip pos-syncChip--${trustState} ${loadingOrders ? "is-syncing" : ""}`}
            onClick={() => loadOrders({ force: true })}
            aria-busy={loadingOrders}
            title={`Estado: ${trustLabel}. Ultima revision OK: ${formatElapsed(syncHealth.lastOkAt)}`}
          >
            <span className="pos-signalDot" />
            <span className="pos-chipText">Sync</span>
          </button>

        </div>

        {menuOpen && (
          <div className="pos-menuPanel">
            <button type="button" onClick={openDayOrders}>
              Ordenes del dia
            </button>
            <button
              type="button"
              onClick={async () => {
                await activateOrderAudio();
                setMenuOpen(false);
              }}
            >
              Probar sonido pedido
            </button>
          </div>
        )}
      </header>

      {message && (
        <button type="button" className="pos-message" onClick={() => setMessage("")}>
          {message}
        </button>
      )}

      {showModeTabs && (
        <nav className="pos-modeTabs" aria-label="POS section">
          <button
            type="button"
            className={activePanel === "orders" ? "active" : ""}
            onClick={() => {
              setSelectedOrderId(null);
              setActivePanel("orders");
            }}
          >
            Orders
          </button>
          <button
            type="button"
            className={activePanel === "inventory" ? "active" : ""}
            onClick={() => setActivePanel("inventory")}
          >
            Inventory
          </button>
        </nav>
      )}

      {trustState !== "online" && (
        <section className={`pos-trustAlert pos-trustAlert--${trustState}`}>
          <strong>Necesita push manual</strong>
          <span>
            Pulsa SYNC para forzar lectura del servidor. Ultima revision correcta:{" "}
            {syncHealth.lastOkAt ? formatTime(syncHealth.lastOkAt) : "nunca"}.
          </span>
          <button
            type="button"
            onClick={() => loadOrders({ force: true })}
            disabled={loadingOrders}
          >
            {loadingOrders ? "Sincronizando" : "Push manual"}
          </button>
        </section>
      )}

      {activePanel === "orders" && (
      <div
        className={`pos-workspace ${
          selectedOrder
            ? "pos-workspace--ticket"
            : showVisitorAlert
            ? "pos-workspace--visitorAlert"
            : "pos-workspace--queue"
        }`}
      >
        <section className={`pos-ordersPane ${showVisitorAlert ? "pos-ordersPane--visitorAlert" : ""}`}>
          {selectedOrder ? (
            <div className="pos-ticketFocus">
              <div className="pos-sectionHead">
                <div>
                  <span>Ticket</span>
                  <h2>{selectedOrder.code || "Pedido"}</h2>
                </div>
                <button type="button" onClick={() => setSelectedOrderId(null)}>
                  Cola
                </button>
              </div>

              <TicketPreview order={selectedOrder} />

              <div className="pos-actionGrid pos-actionGrid--ticket">
                <button type="button" onClick={() => printOrder(selectedOrder)}>
                  Imprimir
                </button>
                <div className="pos-readyButtonWrap">
                  <button
                    type="button"
                    className={selectedOrderSchedule?.locked ? "is-scheduledLocked" : ""}
                    aria-disabled={selectedOrderSchedule?.locked || undefined}
                    onClick={() => requestMarkReady(selectedOrder)}
                  >
                    {selectedOrderSchedule?.locked
                      ? `Ready ${selectedOrderSchedule.countdown}`
                      : "Ready"}
                  </button>
                  {readyButtonToast && selectedOrderSchedule?.locked && (
                    <span key={readyButtonToast.id} className="pos-readyButtonToast">
                      {readyButtonToast.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <>
              {!showVisitorAlert && (
                <div className="pos-sectionHead">
                  <div>
                    <span>Pedidos pendientes</span>
                    <h2>Operacion de cocina</h2>
                  </div>
                </div>
              )}
            <div className={`pos-empty ${showVisitorAlert ? "pos-empty--visitors" : ""}`}>
              {showVisitorAlert ? (
                <div className="pos-visitorSignal" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div className="pos-chill">
                  <span>🐒</span>
                  <strong>Chill For Now ;)</strong>
                </div>
              )}
              {!showVisitorAlert && (
                <>
                  <strong>Sin pedidos pendientes</strong>
                  <span>
                    {trustState === "online"
                      ? "Cola confirmada con el servidor."
                      : "Esperando una lectura confiable del servidor."}
                  </span>
                  <small>Ultima revision OK: {formatElapsed(syncHealth.lastOkAt)}</small>
                </>
              )}
            </div>
            {!showVisitorAlert && (
              <section className="pos-idleClockCard" aria-label="Reloj digital">
                <strong>{idleClockTime}</strong>
                <small>{idleClockDate}</small>
                <div className="pos-dayInfoGrid" aria-label="Informacion relevante del dia">
                  {dayInfo.loading && dayInfo.items.length === 0 ? (
                    <span className="pos-dayInfoChip">
                      <em>Info</em>
                      <b>Cargando datos del dia</b>
                    </span>
                  ) : (
                    dayInfo.items.map((item) => (
                      <span key={item.key} className="pos-dayInfoChip">
                        <em>{item.label}</em>
                        <b>{item.value}</b>
                      </span>
                    ))
                  )}
                  {!dayInfo.loading && dayInfo.items.length === 0 && (
                    <span className="pos-dayInfoChip">
                      <em>{cityRegion?.label || "Info"}</em>
                      <b>Sin datos externos ahora</b>
                    </span>
                  )}
                </div>
              </section>
            )}
            </>
          ) : (
            <div className="pos-queueStage">
              <div className="pos-sectionHead">
                <div>
                  <span>Pedidos pendientes</span>
                  <h2>Operacion de cocina</h2>
                </div>
                <strong className="pos-queueCount">{orders.length}</strong>
              </div>

              <div className="pos-orderList" aria-label="Cola de pedidos">
                {orders.map((order) => {
                  const segment = getCustomerSegment(order);
                  const tags = getCustomerTags(order);
                  const address = getCustomerAddress(order);
                  const boosted = isBoostedOrder(order);
                  const vip = isVipOrder(order);
                  const schedule = getScheduledOrderState(order, clockTick);

                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`pos-orderCard ${boosted ? "is-boosted" : ""} ${
                        vip ? "is-vip" : ""
                      } ${schedule.locked ? "is-scheduledLocked" : ""} ${
                        schedule.hasSchedule && !schedule.locked ? "is-scheduledReady" : ""
                      }`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      {boosted && (
                        <div className={`pos-boostSeal pos-boostSeal--${getBoostSealTone(order)}`}>
                          <span>BOOTS</span>
                        </div>
                      )}

                      <div className="pos-orderIdRow">
                        <div>
                          <span>Pedido</span>
                          <strong>{order.code}</strong>
                        </div>
                        <em>#{order.queuePosition || "-"}</em>
                      </div>

                      <div className="pos-orderCustomerCard">
                        <div className="pos-orderCustomerTop">
                          <div>
                            <span>Cliente</span>
                            <strong>{getCustomerName(order)}</strong>
                          </div>
                          <b className={`pos-segmentBadge pos-segmentBadge--${segment.tone}`}>
                            {segment.label}
                          </b>
                        </div>

                        {tags.length > 0 && (
                          <div className="pos-orderTags">
                            {tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        )}

                        <div className="pos-orderContact">
                          <span>{order.customerData?.phone || "Sin telefono"}</span>
                          {order.customerData?.code && <span>{order.customerData.code}</span>}
                        </div>

                        <div className="pos-orderAddress">
                          {address || getOrderContext(order) || "Sin direccion"}
                        </div>
                      </div>

                      <div className="pos-orderSummary">
                        <span>{getOrderType(order)}</span>
                        <span>{formatTime(order.date || order.createdAt)}</span>
                        <b>{formatMoney(order.total, order.currency || "EUR")}</b>
                      </div>

                      {schedule.hasSchedule && (
                        <div className={`pos-orderSchedule ${schedule.locked ? "is-locked" : ""}`}>
                          <span>Programado</span>
                          <strong>{schedule.label}</strong>
                        </div>
                      )}

                      {!boosted && vip && (
                        <div className="pos-vipPriorityBadge">VIP prioridad despues de Boost</div>
                      )}

                      {boosted && (
                        <div className="pos-orderBoost">{getBoostText(order)}</div>
                      )}

                      <div className="pos-orderItemsTitle">Pidio</div>
                      <OrderItems order={order} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
      )}

      {activePanel === "inventory" && (
        <main className="store-pos-panel pos-storePanel">
          <PosInventory session={session} />
        </main>
      )}

      {activePanel === "dayOrders" && (
        <div className="pos-workspace pos-workspace--dayOrders">
          <section className="pos-ordersPane pos-dayOrdersPane">
            <div className="pos-sectionHead">
              <div>
                <span>Operaciones del dia</span>
                <h2>Tickets de hoy</h2>
                <small>
                  {dayOrdersKpis
                    ? `${dayOrdersKpis.ordersCount || 0} pedidos · ${formatMoney(dayOrdersKpis.revenue, dayOrders[0]?.currency || "EUR")}`
                    : "Resumen de pedidos y ventas"}
                </small>
              </div>
              <button type="button" onClick={loadDayOrders} disabled={dayOrdersLoading}>
                Sync
              </button>
            </div>

            {dayOrdersError && <div className="pos-emptySmall">{dayOrdersError}</div>}

            {dayOrdersLoading && dayOrders.length === 0 ? (
              <div className="pos-emptySmall">Cargando tickets del dia...</div>
            ) : dayOrders.length === 0 ? (
              <div className="pos-emptySmall">Todavia no hay pedidos completados hoy.</div>
            ) : (
              <div className="pos-dayOrdersList" aria-label="Tickets del dia">
                {dayOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="pos-dayOrderTicket"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setActivePanel("orders");
                    }}
                  >
                    <span>{formatTime(order.date || order.createdAt)}</span>
                    <strong>{order.code || `Pedido ${order.id}`}</strong>
                    <small>
                      {getCustomerName(order)} · {lineName(asArray(order.products)[0] || {})}
                    </small>
                    <b>{formatMoney(order.total, order.currency || "EUR")}</b>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {reservationsOpen && (
        <div className="pos-modalBack" onClick={() => setReservationsOpen(false)}>
          <section className="pos-reservationModal" onClick={(event) => event.stopPropagation()}>
            <div className="pos-sectionHead">
              <div>
                <span>Calendario</span>
                <h2>Hoy en cocina</h2>
                <small>{formatCalendarDate(clockTick)}</small>
              </div>
              <button type="button" onClick={() => setReservationsOpen(false)}>
                Cerrar
              </button>
            </div>

            {loadingReservations && (
              <div className="pos-emptySmall">Cargando calendario...</div>
            )}

            {!loadingReservations && calendarEvents.length === 0 && (
              <div className="pos-emptySmall">No hay reservas ni pedidos programados para hoy.</div>
            )}

            {!loadingReservations && calendarEvents.length > 0 && (
              <>
                <div className="pos-calendarLegend" aria-label="Leyenda del calendario">
                  <span className="is-reservation">Reserva</span>
                  <span className="is-scheduled">Pedido programado</span>
                </div>

                <div className="pos-reservationList">
                  {calendarEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`pos-reservationRow pos-reservationRow--${event.tone} ${
                        activeCalendarEventId === event.id ? "active" : ""
                      }`}
                      onClick={() => setActiveCalendarEventId(event.id)}
                    >
                      <strong>{event.time}</strong>
                      <span>{event.title}</span>
                      <small>{event.subtitle}</small>
                    </button>
                  ))}
                </div>

                {activeCalendarEvent && (
                  <div className={`pos-calendarDetail pos-calendarDetail--${activeCalendarEvent.tone}`}>
                    <span>
                      {activeCalendarEvent.type === "reservation"
                        ? "Reserva de mesa"
                        : "Pedido programado"}
                    </span>
                    <strong>{activeCalendarEvent.title}</strong>
                    <small>{activeCalendarEvent.subtitle}</small>
                    <p>{activeCalendarEvent.meta}</p>
                    {activeCalendarEvent.type === "scheduled" && activeCalendarEvent.order && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(activeCalendarEvent.order.id);
                          setReservationsOpen(false);
                          setActivePanel("orders");
                        }}
                      >
                        Abrir ticket
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="pos-actionGrid">
              <button type="button" onClick={loadReservations} disabled={loadingReservations}>
                Sync
              </button>
              <button
                type="button"
                onClick={completeReservation}
                disabled={!activeReservation}
              >
                Completar reserva
              </button>
            </div>
          </section>
        </div>
      )}

      {customerHelpOpen && (
        <div className="pos-modalBack" onClick={() => setCustomerHelpOpen(false)}>
          <section
            className="pos-reservationModal pos-customerHelpModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pos-sectionHead">
              <div>
                <span>Consulta al cliente</span>
                <h2>Duda de cocina</h2>
              </div>
              <button type="button" onClick={() => setCustomerHelpOpen(false)}>
                Cerrar
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="pos-emptySmall">
                No hay pedidos pendientes para consultar.
              </div>
            ) : (
              <div className="pos-customerHelpForm">
                <label>
                  <span>Pedido</span>
                  <select
                    value={customerHelpOrderId}
                    onChange={(event) => setCustomerHelpOrderId(event.target.value)}
                  >
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.code || `Pedido ${order.id}`} - {getCustomerName(order)}
                      </option>
                    ))}
                  </select>
                </label>

                {customerHelpOrder && (
                  <div className="pos-customerHelpTarget">
                    <strong>{getCustomerName(customerHelpOrder)}</strong>
                    <span>{customerHelpOrder.customerData?.phone || "Sin telefono"}</span>
                    {customerHelpOrder.notes && <small>{customerHelpOrder.notes}</small>}
                  </div>
                )}

                <div className="pos-customerHelpThread" aria-label="Chat del pedido">
                  {Array.isArray(customerHelpOrder?.customerData?.chatMessages) &&
                  customerHelpOrder.customerData.chatMessages.length > 0 ? (
                    customerHelpOrder.customerData.chatMessages.map((chatMessage) => (
                      <div
                        key={chatMessage.id}
                        className={`pos-customerHelpBubble ${
                          chatMessage.sender === "CUSTOMER" ? "is-customer" : "is-operator"
                        }`}
                      >
                        <span>
                          {chatMessage.sender === "CUSTOMER" ? "Cliente" : "POS"}
                          {chatMessage.createdAt ? ` · ${formatChatTime(chatMessage.createdAt)}` : ""}
                        </span>
                        <strong>{chatMessage.text}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="pos-customerHelpEmpty">
                      Todavia no hay mensajes en este pedido.
                    </div>
                  )}
                </div>

                <label>
                  <span>Mensaje</span>
                  <textarea
                    value={customerHelpText}
                    onChange={(event) => setCustomerHelpText(event.target.value)}
                    rows={5}
                    maxLength={600}
                    placeholder="Escribe aqui el mensaje exacto para el cliente..."
                  />
                  <small>{customerHelpText.trim().length}/600</small>
                </label>
              </div>
            )}

            <div className="pos-actionGrid">
              <button type="button" onClick={() => setCustomerHelpOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendCustomerHelpQuestion}
                disabled={!customerHelpOrder || !customerHelpText.trim() || customerHelpSending}
              >
                {customerHelpSending ? "Enviando..." : "Enviar SMS"}
              </button>
            </div>
          </section>
        </div>
      )}

      {readyConfirmOrder && (
        <div className="pos-modalBack" onClick={() => setReadyConfirmOrder(null)}>
          <section
            className="pos-reservationModal pos-readyConfirmModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pos-sectionHead">
              <div>
                <span>Confirmar Ready</span>
                <h2>Estas seguro de marcar como listo?</h2>
                <small>{readyConfirmOrder.code || `Pedido ${readyConfirmOrder.id}`}</small>
              </div>
            </div>

            <div className="pos-readyConfirmCopy">
              Se enviara la notificacion respectiva al cliente.
            </div>

            <div className="pos-actionGrid">
              <button type="button" onClick={() => markReady(readyConfirmOrder)}>
                Si, marcar listo
              </button>
              <button type="button" onClick={() => setReadyConfirmOrder(null)}>
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      {newOrderNotice && (
        <div className="pos-newOrderNoticeBack" role="presentation">
          <section
            className="pos-newOrderNotice"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pos-new-order-title"
            aria-describedby="pos-new-order-copy"
          >
            <div className="pos-newOrderNoticeSignal" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="pos-newOrderNoticeCopy">
              <span>{newOrderNotice.boosted ? "Prioridad Volta" : "Cola de cocina"}</span>
              <h2 id="pos-new-order-title">Pedido nuevo</h2>
              <p id="pos-new-order-copy">
                {newOrderNotice.count > 1
                  ? `${newOrderNotice.count} pedidos entraron ahora.`
                  : `${getCustomerName(newOrderNotice.order)} acaba de pedir.`}
              </p>
            </div>

            <div className="pos-newOrderNoticeTicket">
              <span>{newOrderNotice.order.code || `Pedido ${newOrderNotice.order.id}`}</span>
              <strong>{formatMoney(newOrderNotice.order.total, newOrderNotice.order.currency || "EUR")}</strong>
              <small>
                {getOrderType(newOrderNotice.order)} ·{" "}
                {formatTime(newOrderNotice.order.date || newOrderNotice.order.createdAt)}
              </small>
            </div>

            <button type="button" className="pos-newOrderAcceptBtn" onClick={acceptNewOrderNotice}>
              <span>Aceptar</span>
              <small>pedido</small>
            </button>
          </section>
        </div>
      )}

      <footer className="pos-footer">
        <span>© {new Date().getFullYear()} voltaPizza · POS v01</span>
        <div className={`pos-printInline ${printerTone}`}>
          <span />
          {printerLabel}
          <small>{printerStatus.realConnected ? printerStatus.label : "modo prueba"}</small>
        </div>
      </footer>
      {showOrderUtilityFabs && (
        <>
      <button
        type="button"
        className={`pos-customerHelpFab ${selectedOrder ? "active" : ""} ${
          unreadCustomerMessageCount > 0 ? "has-unread" : ""
        }`}
        onClick={() => setCustomerHelpOpen(true)}
        title={
          unreadCustomerMessageCount > 0
            ? `${unreadCustomerMessageCount} mensaje(s) de cliente sin leer`
            : "Consultar al cliente por una duda del pedido"
        }
      >
        <span aria-hidden="true">{customerHelpEmoji}</span>
        <strong>{unreadCustomerMessageCount > 0 ? unreadCustomerMessageCount : "?"}</strong>
      </button>
      <button
        type="button"
        className={reservationsFabClass}
        onClick={() => {
          setReservationsOpen(true);
          loadReservations();
        }}
        title="Calendario de hoy"
      >
        <span aria-hidden="true">📅</span>
        {calendarEvents.length > 0 && <strong>{calendarEvents.length}</strong>}
      </button>
        </>
      )}
    </main>
  );
}
