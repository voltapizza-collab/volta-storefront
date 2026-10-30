import useWebSession from '../auth/useWebSession';
import { accessDestination } from '../auth/webSession';
import PosInventory, { fetchPosInventory } from './PosInventory';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../setupAxios";
import { receptionText } from '../utils/storeReception';
import {
  customerSegmentMeta,
  normalizeCustomerSegment,
  VIP_CUSTOMER_SEGMENT,
} from "../constants/customerSegments";
import voltaLogo from "../assets/logo/the pizza sale enganine.png";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import pizzaIcon from "../assets/logo/pizza.svg";
import EngineBackground from "../components/Backoffice/EngineBackground";
import { mockPrinter } from "./printers/mockPrinter";
import { buildOrderLines } from './printers/mockPrinter';
import { isNativePos, nativeCall } from './nativeBridge';
import PosNotice, { usePosNotice } from './PosNotice';
import PosPrintStatus, { usePosPrinting } from './PosPrintStatus';
import { getPosOrderCode } from './orderDisplayCode';
import PosLogoutDialog from './PosLogoutDialog';
import PosUpdates, { PosUpdateIndicator } from './PosUpdates';
import PosDayInfo from './PosDayInfo';
import PosClock from './PosClock';
import { shouldShowCheckoutAlert } from '../utils/checkoutPresence';
import "../styles/PosApp.css";
import { ingredientRemovalRows } from "../utils/ingredientRemovals";
import { getLineDetailRows, isSpatialHeading } from './orderLineDetails';
import { getOrderPayment, getPaymentLabel, isCashPaymentOrder, isCashPaymentPending } from './orderPayment';

const POS_REMEMBERED_LOGIN_KEY = "volta_pos_remembered_login";

function readRememberedLogin() {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_REMEMBERED_LOGIN_KEY));
    if (typeof saved?.username === 'string') {
      localStorage.setItem(POS_REMEMBERED_LOGIN_KEY, JSON.stringify({ username: saved.username }));
      return { username: saved.username };
    }
  } catch (_) { /* Login remains available when storage is unavailable. */ }
  return null;
}
const POS_ACCEPTED_NOTICE_KEY_PREFIX = "volta_pos_accepted_order_notices";
const POLL_MS = 5000;
const POS_REQUEST_TIMEOUT_MS = 8000;
const STALE_AFTER_MS = isNativePos ? 45_000 : 15_000;
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

const isIncentiveRewardLine = (item) =>
  String(item?.source || "").toLowerCase() === "incentive_reward" ||
  String(item?.type || "").toUpperCase() === "INCENTIVE_REWARD";

const isCompletedPaidOrder = (order) =>
  String(order?.status || "").toUpperCase() === "PAID" && order?.processed === true;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const buildWindowsPrintTicketHtml = (order) => {
  const items = asArray(order?.products);
  const customer = order?.customerData || {};
  const orderCode = getPosOrderCode(order);
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
      .item li.removal { font-weight: 900; font-size: 13px; border: 1px solid #111; padding: 3px; }
      .item li.changesHeading { list-style: none; font-weight: 900; margin-top: 5px; }
      .item li.recipeOriginal { list-style: none; font-weight: 400; }
      .sectionTitle { margin-bottom: 5px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
      .cashAlert { margin-top: 8px; background: #000; color: #fff; padding: 7px; font-size: 12px; font-weight: 900; text-align: center; }
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
        <div>Pago: ${escapeHtml(getPaymentLabel(order))}</div>
        ${isCashPaymentPending(order) ? `<div class="cashAlert">PENDIENTE DE PAGO EN EFECTIVO</div>` : ""}
        ${showAddress ? `<div>Direccion: ${escapeHtml(customer.address_1)}</div>` : ""}
        ${order?.deliveryReviewRequired ? '<div class="cashAlert">REVISAR REPARTO: tarifa base. Confirmar dirección y cobertura con el cliente.</div>' : ""}
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
                      ? `<ul>${detailRows.map((detail) => `<li${(ingredientRemovalRows(item).includes(detail) || (detail.startsWith("SIN ") && !isSpatialHeading(detail))) ? ' class="removal"' : (detail === 'CAMBIOS:' || isSpatialHeading(detail)) ? ' class="changesHeading"' : detail === 'Receta original' ? ' class="recipeOriginal"' : ''}>${escapeHtml(detail)}</li>`).join("")}</ul>`
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
  const raw = [order?.delivery, order?.type, order?.customerData?.delivery?.method]
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
  const delivery = customer.delivery || {};
  const address = customer.address_1 || order?.address_1 || [delivery.address, delivery.addressLine2].filter(Boolean).join(", ");
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

const createTone = (
  ctx,
  { frequency, startAt, duration, volume, type = "sine", attack = 0.018 }
) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  // The handheld speaker needs a stronger source signal; do not change Android volume.
  const peak = Math.max(0.0001, isNativePos ? Math.min(volume * 4, 0.3) : volume);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + attack);
  if (isNativePos) gain.gain.setValueAtTime(peak, startAt + Math.max(attack, duration * 0.55));
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
  const key = normalizeCustomerSegment(order?.customerData?.segment);
  return key ? customerSegmentMeta(key) : { label: "Sin segmento", tone: "default" };
};

const isVipOrder = (order) =>
  normalizeCustomerSegment(order?.customerData?.segment) === VIP_CUSTOMER_SEGMENT;

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

const getCustomerAddress = (order) => {
  const delivery = order?.customerData?.delivery || {};
  const nestedAddress = [delivery.address, delivery.addressLine2]
    .filter(Boolean)
    .join(", ");
  const address = String(order?.customerData?.address_1 || order?.address_1 || nestedAddress || "").trim();

  if (!address || /^\(PICKUP\)/i.test(address)) return "";
  return isDeliveryOrder(order) || String(delivery.method || "").toUpperCase() === "COURIER" ? address : "";
};

const formatElapsed = (value) => {
  if (!value) return "nunca";
  const diff = Math.max(Date.now() - new Date(value).getTime(), 0);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  return `hace ${Math.floor(seconds / 60)}m`;
};

export function OrderItems({ order }) {
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
                  <li className={(ingredientRemovalRows(item).includes(detail) || (detail.startsWith("SIN ") && !isSpatialHeading(detail))) ? "pos-ingredientRemoval" : (detail === 'CAMBIOS:' || isSpatialHeading(detail)) ? 'pos-changesHeading' : detail === 'Receta original' ? 'pos-recipeOriginal' : undefined}
                    key={`${order.id}-${index}-${detailIndex}`}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PosPizzaMark() {
  return (
    <span className="pos-realPizza" aria-hidden="true">
      <span className="pos-pizzaDisc">
        <img src={pizzaIcon} alt="" />
      </span>
    </span>
  );
}

export function DayOrderCard({ order, onOpen }) {
  return (
    <button type="button" className="pos-dayOrderTicket" onClick={onOpen}>
      <strong>{getPosOrderCode(order)}</strong>
      <b>{formatMoney(order.total, order.currency || "EUR")}</b>
      <small className="pos-dayOrderCustomer">{getCustomerName(order)}</small>
      <small className="pos-dayOrderDate">{formatTime(order.date || order.createdAt)}</small>
      <small className="pos-dayOrderMovement">{asArray(order.products).map(item => `${lineQty(item)}× ${lineName(item)}`).join(" · ") || "Sin detalle de productos"}</small>
      <span className="pos-dayOrderTags">
        <em>Finalizada</em>
        <em>{isCashPaymentOrder(order) ? "Efectivo" : getOrderPayment(order).mode === "card" ? "Tarjeta" : "Pago sin especificar"}</em>
        <em>{getOrderType(order)}</em>
      </span>
    </button>
  );
}

export function PosLogin({ onStart }) {
  const target = accessDestination();
  const [savedLogin] = useState(() => {
    const saved = readRememberedLogin();
    return target.partnerSlug ? null : saved;
  });
  const [username, setUsername] = useState(target.partnerSlug || savedLogin?.username || "");
  const [password, setPassword] = useState("");
  const [rememberPin, setRememberPin] = useState(Boolean(savedLogin));
  const [storageError, setStorageError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = username.trim() && /^\d{6}$/.test(password.trim()) && !submitting;

  const submitLogin = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setError("");
      const response = await api.post("/partners/pos-login", {
        username: username.trim(),
        pin: password.trim(),
        partnerSlug: target.partnerSlug || undefined,
        storeSlug: target.storeSlug || undefined,
      });
      const data = response.data || {};

      if (!data.partnerId || !data.storeId) {
        setError("Esta cuenta aun no tiene una tienda asociada para usar el POS.");
        return;
      }

      try {
        if (rememberPin) localStorage.setItem(POS_REMEMBERED_LOGIN_KEY, JSON.stringify({ username: username.trim() }));
        else localStorage.removeItem(POS_REMEMBERED_LOGIN_KEY);
      } catch (_) { /* A storage failure must not prevent a successful login. */ }

      onStart({
        ...data,
        partnerId: data.partnerId,
        partnerName: data.partnerName || data.partnerSlug || "Partner",
        storeId: data.storeId,
        storeName: data.storeName || data.storeSlug || data.partnerName || "Store",
        deviceName: "Volta POS Virtual",
        pairedAt: new Date().toISOString(),
      });
    } catch (loginError) {
      setError("Usuario o PIN incorrectos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pos-loginScreen">
      <div className="pos-engineLines" />
      <EngineBackground />
      <PizzaBg className="pos-loginBgPizza" />

      <form className="pos-loginPanel" onSubmit={submitLogin}>
        <div className="pos-loginHero" aria-label="Volta POS">
          <img className="pos-loginLogoMark" src={voltaLogo} alt="Volta Pizza" />
          <div className="pos-loginPizzaRow" aria-hidden="true">
            <PosPizzaMark />
            <PosPizzaMark />
            <PosPizzaMark />
          </div>
          <span className="pos-kicker">{isNativePos ? 'Volta POS' : 'Volta POS Virtual'}</span>
        </div>

        <section className="pos-loginFormPanel">
          <h1>Entrar al POS</h1>
          {target.partnerSlug && <p>Negocio: <strong>{target.partnerSlug}</strong>{target.storeSlug ? ` · Tienda: ${target.storeSlug}` : ""}. Utiliza el PIN de esta tienda.</p>}
          <p>Usa el usuario del partner y el PIN de 6 digitos de tu tienda.</p>

          <div className="pos-loginField">
            <input
              id="pos-username"
              type="text"
              aria-label="Usuario"
              placeholder="Usuario"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="pos-loginField">
            <label htmlFor="pos-password">PIN de tienda · 6 dígitos</label>
            <div className="pos-passwordInput">
              <input
                id="pos-password"
                type={showPassword ? "text" : "password"}
                aria-label="PIN de tienda"
                aria-describedby="pos-pin-help"
                placeholder="PIN de tienda"
                autoComplete="current-password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button
                type="button"
                className={`pos-passwordToggle ${showPassword ? "is-visible" : ""}`}
                aria-label={showPassword ? "Ocultar PIN" : "Mostrar PIN"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar PIN" : "Mostrar PIN"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <label className="pos-rememberPin">
            <input type="checkbox" checked={rememberPin} onChange={event => {
              const checked = event.target.checked;
              setStorageError("");
              if (!checked) {
                try { localStorage.removeItem(POS_REMEMBERED_LOGIN_KEY); }
                catch (_) { setStorageError("No se pudo borrar el usuario guardado. Inténtalo de nuevo."); return; }
                setPassword("");
                setShowPassword(false);
              }
              setRememberPin(checked);
            }} />
            Recordar el usuario en este dispositivo
          </label>
          <p id="pos-pin-help" className="pos-pinHelp">
            {rememberPin ? "El usuario se guardará al entrar. El PIN no se guarda." : "Marca la opción para conservar tu usuario al salir del POS."}
          </p>
          {storageError && <div className="pos-loginError" role="alert">{storageError}</div>}
          {error ? <div className="pos-loginError">{error}</div> : null}

          <button className="pos-loginSubmit" type="submit" disabled={!canSubmit}>
            {submitting ? "Entrando..." : "Entrar al POS"}
          </button>
        </section>
      </form>
    </main>
  );
}

export function TicketPreview({ order }) {
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
  const cashPayment = isCashPaymentPending(order);

  return (
    <div className="pos-ticketPreview">
      <div className="pos-ticketBrand">VOLTA POS</div>
      <div className="pos-ticketCode">{getPosOrderCode(order)}</div>
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
      <div className={`pos-ticketBlock ${cashPayment ? "pos-ticketBlock--cashPayment" : ""}`}>
        <span>Pago</span>
        <strong>{getPaymentLabel(order)}</strong>
        {cashPayment && <small>Cobrar en caja antes de entregar.</small>}
      </div>
      {address && (
        <div className="pos-ticketBlock">
          <span>Direccion</span>
          <strong>{address}</strong>
        </div>
      )}
      {order.deliveryReviewRequired && <div className="pos-ticketBlock" role="alert"><strong>Revisar reparto</strong><small>Tarifa base aplicada. Confirmar dirección y cobertura con el cliente.</small></div>}
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

const OrderCard = memo(function OrderCard({ order, locked, onSelect }) {
                  const segment = getCustomerSegment(order);
                  const tags = getCustomerTags(order);
                  const address = getCustomerAddress(order);
                  const boosted = isBoostedOrder(order);
                  const vip = isVipOrder(order);
                  const schedule = getScheduledOrderState(order);
                  const cashPayment = isCashPaymentPending(order);

                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`pos-orderCard ${boosted ? "is-boosted" : ""} ${
                        vip ? "is-vip" : ""
                      } ${locked ? "is-scheduledLocked" : ""} ${
                        schedule.hasSchedule && !locked ? "is-scheduledReady" : ""
                      } ${
                        cashPayment ? "is-cashPayment" : ""
                      }`}
                      onClick={() => onSelect(order.id)}
                    >
                      {boosted && (
                        <div className={`pos-boostSeal pos-boostSeal--${getBoostSealTone(order)}`}>
                          <span>BOOTS</span>
                        </div>
                      )}

                      <div className="pos-orderIdRow">
                        <div>
                          <span>Pedido</span>
                          <strong>{getPosOrderCode(order)}</strong>
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
                        {order.deliveryReviewRequired && <div className="pos-orderCashPayment">Revisar reparto · tarifa base</div>}
                      </div>

                      <div className="pos-orderSummary">
                        <span>{getOrderType(order)}</span>
                        <span>{formatTime(order.date || order.createdAt)}</span>
                        <span className={cashPayment ? "pos-orderCashPayment" : ""}>
                          {getPaymentLabel(order)}
                        </span>
                        <b>{formatMoney(order.total, order.currency || "EUR")}</b>
                      </div>

                      {schedule.hasSchedule && (
                        <div className={`pos-orderSchedule ${locked ? "is-locked" : ""}`}>
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

});

export default function PosApp() {
  const [session, setSession, checkingSession] = useWebSession("pos", isNativePos);
  const [orders, setOrders] = useState([]);
  const [activePanel, setActivePanel] = useState("orders");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const disabledInventoryCount = inventoryItems.filter(item => !(item.exists && item.active)).length + inventoryProducts.filter(item => !item.active).length;
  useEffect(() => { setInventoryItems([]); setInventoryProducts([]); }, [session?.storeId]);
  useEffect(() => {
    if (!session?.storeId || activePanel === "inventory") return;
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const data = await fetchPosInventory(session.storeId);
        if (!cancelled) { setInventoryItems(data.ingredients); setInventoryProducts(data.products); }
      } catch (_) { /* Preserve the last confirmed inventory on network failure. */ }
      finally { running = false; }
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [session?.storeId, activePanel]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [dayOrders, setDayOrders] = useState([]);
  const [dayCursor, setDayCursor] = useState(null);
  const dayRequest = useRef(false);
  const [dayOrdersKpis, setDayOrdersKpis] = useState(null);
  const [dayOrdersLoading, setDayOrdersLoading] = useState(false);
  const [dayOrdersError, setDayOrdersError] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [storeActive, setStoreActive] = useState(false);
  const [operationsPaused, setOperationsPaused] = useState(false);
  const [savingPause, setSavingPause] = useState(false);
  const [pauseStateKnown, setPauseStateKnown] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [installedVersion, setInstalledVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState(null);
  const menuPanelRef = useRef(null);
  const menuButtonRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const panel = menuPanelRef.current;
    const previousOverflow = document.body.style.overflow;
    panel.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      panel.close();
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [printStatus, printNative] = usePosPrinting();
  const [message, setMessage, dismissMessage] = usePosNotice();
  const [newOrderNotice, setNewOrderNotice] = useState(null);
  useEffect(() => { if (newOrderNotice) setMenuOpen(false); }, [newOrderNotice]);
  const [readyConfirmOrder, setReadyConfirmOrder] = useState(null);
  const readyWrites = useRef(new Set());
  const completedOrderIds = useRef(new Set());
  const [savingReady, setSavingReady] = useState(false);
  const [readyCashReminderOrder, setReadyCashReminderOrder] = useState(null);
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

  const [nativePrinterStatus, setNativePrinterStatus] = useState({ realConnected: false, virtualReady: false, label: 'Conectando SUNMI' });
  useEffect(() => {
    if (!isNativePos) return;
    let mounted = true, running = false;
    const refresh = () => {
      if (running) return;
      running = true;
      nativeCall('printerStatus').then(status => { if (mounted) setNativePrinterStatus(current => JSON.stringify(current) === JSON.stringify(status) ? current : status); }).catch(() => {}).finally(() => { running = false; });
    };
    refresh(); const timer = setInterval(refresh, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);
  const printerStatus = isNativePos ? nativePrinterStatus : mockPrinter.getStatus();
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
  const showCheckoutAlert = shouldShowCheckoutAlert({ presence, online: trustState === "online", incomingOrder: newOrderNotice, now: clockTick });
  const showVisitorAlert = orders.length === 0 && showCheckoutAlert;
  const showPauseScreen = operationsPaused && activePanel === "orders";
  const showOrderUtilityFabs =
    activePanel !== "dayOrders" &&
    !reservationsOpen &&
    !customerHelpOpen;
  const shellClassName = [
    "pos-shell",
    activePanel === "dayOrders" ? "pos-shell--history" : "",
    operationsPaused ? "pos-shell--paused" : "",
    `pos-shell--${trustState}`,
    showCheckoutAlert ? "pos-shell--visitors" : "",
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
        const schedule = getScheduledOrderState(order, Date.now());
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
          subtitle: `${getPosOrderCode(order)} - ${formatMoney(order.total, order.currency || "EUR")}`,
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
    const timer = window.setInterval(() => setClockTick(Date.now()), selectedOrderSchedule?.hasSchedule ? 1000 : 5000);
    return () => window.clearInterval(timer);
  }, [selectedOrderSchedule?.hasSchedule]);

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

  const loadOrders = useCallback(async () => {
    if (!session?.partnerId || !session?.storeId) return;
    if (loadingOrdersRef.current) return;

    const requestId = loadOrdersRequestRef.current + 1;
    loadOrdersRequestRef.current = requestId;

    loadingOrdersRef.current = true;
    try {
      void unlockAudioContext().catch(() => {});
      setLoadingOrders(true);
      const lastAttemptAt = new Date().toISOString();
      setSyncHealth((current) => ({
        ...current,
        lastAttemptAt,
      }));

      const ordersResponse = await api.get("/api/myorders/pending", {
        params: { partnerId: session.partnerId, storeId: session.storeId },
        timeout: POS_REQUEST_TIMEOUT_MS,
      });
      if (requestId !== loadOrdersRequestRef.current) return;

      const received = Array.isArray(ordersResponse.data?.items) ? ordersResponse.data.items : [];
      const items = received.filter(item => !completedOrderIds.current.has(item.id));
      for (const id of completedOrderIds.current) if (!received.some(item => item.id === id)) completedOrderIds.current.delete(id);
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
      setOrders(current => JSON.stringify(current) === JSON.stringify(items) ? current : items);
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

  useEffect(() => {
    if (!session?.storeId) return undefined;
    let cancelled = false, running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const response = await api.get(`/api/presence/stores/${session.storeId}/status`, {
          params: { partnerId: session.partnerId }, timeout: POS_REQUEST_TIMEOUT_MS,
        });
        if (!cancelled && response.data?.presence) setPresence(current => JSON.stringify(current) === JSON.stringify(response.data.presence) ? current : response.data.presence);
      } catch (_) { /* Presence does not define order queue health. */ }
      finally { running = false; }
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [session?.storeId, session?.partnerId]);

  const loadDayOrders = useCallback(async (cursor = null) => {
    if (!session?.partnerId || !session?.storeId || dayRequest.current) return;
    dayRequest.current = true;

    try {
      setDayOrdersLoading(true);
      setDayOrdersError("");
      const response = await api.get("/api/myorders/summary", {
        params: {
          partnerId: session.partnerId,
          storeId: session.storeId,
          period: "today",
          view: "pos",
          ...(typeof cursor === "string" ? { cursor } : {}),
        },
      });
      const data = response.data || {};
      const completedOrders = Array.isArray(data?.orders)
        ? data.orders.filter(isCompletedPaidOrder)
        : [];
      setDayOrders(current => typeof cursor === "string" ? [...current, ...completedOrders.filter(item => !current.some(existing => existing.id === item.id))] : completedOrders);
      setDayCursor(data.nextCursor || null);
      setDayOrdersKpis(data?.kpis || null);
    } catch (error) {
      console.error(error);
      setDayOrdersError("No se pudieron cargar las ordenes del dia.");
    } finally {
      dayRequest.current = false;
      setDayOrdersLoading(false);
    }
  }, [session?.partnerId, session?.storeId]);

  useEffect(() => {
    if (!session) return undefined;

    seenIdsRef.current = new Set();
    completedOrderIds.current.clear();
    acceptedNoticeIdsRef.current = readAcceptedNoticeIds(session.storeId);
    boostStateRef.current = new Map();
    chatUnreadIdsRef.current = new Set();
    chatUnreadInitializedRef.current = false;
    loadOrders();
    const timer = window.setInterval(loadOrders, POLL_MS);
    return () => {
      window.clearInterval(timer);
      loadOrdersRequestRef.current += 1;
      loadingOrdersRef.current = false;
    };
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
    let cancelled = false;
    setPauseStateKnown(false);
    let running = false;
    const refreshStore = () => {
      if (running) return;
      running = true;
      return api.get(`/api/stores/${session.storeId}`, { timeout: POS_REQUEST_TIMEOUT_MS })
      .then((response) => {
        if (cancelled) return;
        const store = response?.data || response;
        setStoreMeta(current => JSON.stringify(current) === JSON.stringify(store || null) ? current : store || null);
        setStoreActive(store?.active !== false && store?.acceptingOrders !== false);
        setOperationsPaused(store?.operationsPaused === true);
        setPauseStateKnown(typeof store?.operationsPaused === "boolean");
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setPauseStateKnown(false);
      })
      .finally(() => { running = false; });
    };
    refreshStore();
    const timer = window.setInterval(refreshStore, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [session?.storeId]);

  const reservationsRequest = useRef(false);
  const loadReservations = useCallback(async () => {
    if (!session?.storeId || reservationsRequest.current) return;
    reservationsRequest.current = true;

    try {
      setLoadingReservations(true);
      const response = await api.get(`/api/reservations/today/${session.storeId}`, { timeout: POS_REQUEST_TIMEOUT_MS });
      const items = Array.isArray(response.data) ? response.data : [];
      setReservations(current => JSON.stringify(current) === JSON.stringify(items) ? current : items);
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar las reservas de hoy.");
    } finally {
      reservationsRequest.current = false;
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
    setSession(nextSession);
    setMessage(isNativePos ? "Terminal Volta conectado." : "POS virtual emparejado.");
  };

  const logoutSession = async () => {
    if (isNativePos) {
      try { await nativeCall('logout'); }
      catch (_) { window.location.reload(); return; }
    }
    setLogoutOpen(false);
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

  const toggleOperationsPause = async () => {
    if (!session?.storeId || savingPause || !pauseStateKnown) return;
    setSavingPause(true);
    setMenuOpen(false);
    try {
      const { data } = await api.patch(`/api/stores/${session.storeId}/operations-pause`, { paused: !operationsPaused });
      setOperationsPaused(data.operationsPaused === true);
    } catch (_) {
      setMessage("No se pudo confirmar el cambio de pausa. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setSavingPause(false);
    }
  };

  const toggleStore = async () => {
    if (!session?.storeId || savingStore) return;

    const nextActive = !storeActive;

    try {
      setSavingStore(true);
      const { data } = await api.patch(`/api/stores/${session.storeId}/order-reception`, {
        acceptingOrders: nextActive,
      });
      setStoreActive(data.active !== false && data.acceptingOrders === true);
      setOperationsPaused(data.operationsPaused === true);
      setMessage(nextActive ? data.operationsPaused ? "Pedidos programados abiertos. Se mantiene la pausa." : "Pedidos abiertos según los horarios de la tienda." : "Pedidos online cerrados.");
    } catch (error) {
      console.error(error);
      const blockers = error.response?.data?.blockers;
      setMessage(blockers?.length ? blockers.map(code => receptionText('es').blockers[code]).join(' ') : "No se pudo confirmar el cambio. Inténtalo de nuevo.");
    } finally {
      setSavingStore(false);
    }
  };

  const printOrder = async (order) => {
    if (!order) return;
    if (isNativePos) {
      await printNative('print', { orderId: order.id, lines: buildOrderLines(order) },
        `Ticket ${getPosOrderCode(order)}: impresión confirmada por SUNMI.`);
      return;
    }

    const openedWindowsPrint = printOrderWithWindowsDialog(order);

    try {
      await mockPrinter.printOrder(order);
      setMessage(
        openedWindowsPrint
          ? `Ticket ${getPosOrderCode(order)} abierto para imprimir en Windows.`
          : `Ticket ${getPosOrderCode(order)} guardado en impresora virtual. El navegador bloqueo la ventana de impresion.`
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
    setMessage("Este pedido está programado. Espera a la hora indicada para marcarlo como listo.");
  };

  const markReady = async (order) => {
    if (!order || readyWrites.current.has(order.id)) return;

    const schedule = getScheduledOrderState(order, Date.now());
    if (schedule.locked) {
      showReadyBlockedToast();
      return;
    }

    readyWrites.current.add(order.id);
    setSavingReady(true);
    try {
      const response = await api.patch(`/api/myorders/${order.id}/ready`);
      const notification = response.data?.notification;
      completedOrderIds.current.add(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSelectedOrderId(null);
      setReadyConfirmOrder(null);
      setReadyCashReminderOrder(null);
      setMessage(
        notification?.queued
          ? `Pedido ${getPosOrderCode(order)} marcado como listo. Aviso al cliente en cola de envío.`
          : notification?.ok
          ? `Pedido ${getPosOrderCode(order)} marcado como listo. Cliente notificado.`
          : `Pedido ${getPosOrderCode(order)} marcado como listo. Revisa la notificacion al cliente.`
      );
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo marcar como listo.");
    } finally {
      readyWrites.current.delete(order.id);
      setSavingReady(readyWrites.current.size > 0);
    }
  };

  const requestMarkReady = (order) => {
    if (!order) return;

    const schedule = getScheduledOrderState(order, Date.now());
    if (schedule.locked) {
      showReadyBlockedToast();
      return;
    }

    setReadyConfirmOrder(order);
    setReadyCashReminderOrder(null);
  };

  const confirmReadyRequest = (order) => {
    if (!order) return;

    if (isCashPaymentPending(order) && readyCashReminderOrder?.id !== order.id) {
      setReadyCashReminderOrder(order);
      return;
    }

    markReady(order);
  };

  const closeReadyConfirm = () => {
    setReadyConfirmOrder(null);
    setReadyCashReminderOrder(null);
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

    const question = customerHelpText.trim().slice(0, 70);
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
          ? `Mensaje enviado al cliente de ${getPosOrderCode(customerHelpOrder)}.`
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
      setMessage(`Pedido ${getPosOrderCode(newOrderNotice.order)} aceptado en POS.`);
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

  if (checkingSession) return <main className="pos-loginScreen">Comprobando acceso…</main>;

  if (!session) {
    return (
      <PosLogin
        onStart={startSession}
      />
    );
  }

  return (
    <main className={shellClassName}>
      {activePanel !== "dayOrders" && <header className="pos-topbar">
        <div className="pos-storeIdentity">
          <span className="pos-kicker">{isNativePos ? 'Volta POS' : 'Volta POS Virtual'}</span>
          <h1>{session.storeName}</h1>
          <small>{session.partnerName}</small>
        </div>

        <div className="app-toggle pos-storeToggle">
          <span className="app-toggle-label">
            {storeActive ? operationsPaused ? "En pausa · programados" : storeMeta?.orderStatus === 'outside_hours' ? "Fuera de horario · programados" : "Pedidos abiertos" : "Pedidos cerrados"}
          </span>
          <button
            type="button"
            onClick={toggleStore}
            aria-label={storeActive ? 'Cerrar pedidos' : 'Abrir pedidos'}
            aria-pressed={storeActive}
            disabled={savingStore || !storeMeta}
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
              ref={menuButtonRef}
              aria-expanded={menuOpen}
              aria-controls="pos-menu-panel"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Menu POS"
              title="Menu"
            >
              Menu
            </button>

            <button
              type="button"
              className="pos-logoutPill"
              onClick={() => setLogoutOpen(true)}
            >
              Salir
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
          <dialog id="pos-menu-panel" className="pos-menuPanel" ref={menuPanelRef} aria-labelledby="pos-menu-title"
            onCancel={event => { event.preventDefault(); setMenuOpen(false); }}
            onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right) setMenuOpen(false); } }}>
            <div className="pos-menuHeading"><div><small>VOLTA · POS</small><h2 id="pos-menu-title">Centro de operaciones</h2></div><button className="pos-menuClose" type="button" autoFocus onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" title="Cerrar menú"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></button></div>
            <div className="pos-menuContent">
            {(!storeActive || (pauseStateKnown && operationsPaused)) && (
            <section className={`pos-menuMode ${operationsPaused ? 'is-paused' : ''}`} aria-label="Modo de operaciones">
              <small>{session.storeName}</small>
              <strong>{!storeActive ? 'Tienda cerrada' : 'Operaciones en pausa'}</strong>
              <p>{!storeActive ? 'La tienda no acepta nuevas compras.' : 'Nuevas compras solo con fecha y hora programadas.'}</p>
            </section>
            )}
            <h3>Operaciones</h3>
            <button type="button" onClick={openDayOrders}>
              <strong>Operaciones del día</strong><small>Consultar pedidos finalizados y ventas</small>
            </button>
            <button type="button" onClick={toggleOperationsPause} disabled={savingPause || !pauseStateKnown || !storeActive}>
              <strong>{savingPause ? "Actualizando pausa…" : operationsPaused ? "Reanudar operaciones" : "Pausar operaciones"}</strong>
              <small>{operationsPaused ? 'Volver al servicio según el horario habitual' : 'Aceptar solo pedidos programados'}</small>
            </button>
            {!pauseStateKnown && <small>Esperando el estado de pausa del servidor.</small>}
            <h3>Comprobaciones del terminal</h3>
            <button
              type="button"
              onClick={async () => {
                await activateOrderAudio();
                setMenuOpen(false);
              }}
            >
              <strong>Probar sonido</strong><small>Comprobar el aviso de nuevos pedidos</small>
            </button>
            <button type="button" disabled={printStatus?.phase === 'printing'} onClick={async () => {
              setMenuOpen(false);
              try {
                const sample = { code: 'PRUEBA-58MM', storeName: session.storeName, total: 25.50, currency: 'EUR',
                  delivery: 'DELIVERY', customerData: {name:'Cliente de prueba',phone:'No llamar',address:'Calle de prueba con un nombre largo, numero 123, piso 4'},
                  products:[
                    {pizzaId:1,name:'Pizza de prueba con mozzarella y champiñones',quantity:1,size:'Grande',
                      removedIngredients:[{ingredientId:10,name:'Cebolla'},{ingredientId:11,name:'Champiñones frescos laminados'}],extras:[{name:'Mozzarella'}]},
                    {pizzaId:1,name:'Pizza de prueba con mozzarella y champiñones',quantity:1,size:'Grande'},
                    {type:'CUSTOM_BUILD',name:'Personalizada espacial',qty:1,size:'M',notes:'Cortar en ocho',ingredients:[
                      {name:'Bacon',placement:'RIGHT',quantity:'DOUBLE'},
                      {name:'Jamón',placement:'LEFT',quantity:'SIMPLE'},
                      {name:'Mozzarella',placement:'FULL',quantity:'SIMPLE'},
                      {name:'Champiñones frescos laminados',placement:'RIGHT',quantity:'SIMPLE'},
                      {name:'Piña',placement:'LEFT',quantity:'SIMPLE'},
                    ]},
                    {type:'HALF_HALF',name:'Dos recetas',qty:1,size:'M',leftName:'Barbacoa',rightName:'Hawaiana',extras:[
                      {name:'Piña',side:'B'}, {name:'Bacon',side:'A'},
                    ]},
                  ] };
                if (!isNativePos) {
                  await printOrder(sample);
                  return;
                }
                await printNative('printTest',{lines:[...buildOrderLines(sample),'Direccion de prueba: calle larga numero 123, piso 4','Caracteres: á é í ó ú ñ €']},
                  'Ticket de prueba confirmado por SUNMI. Comprueba FULL, DERECHA, IZQUIERDA, LADO 1 y LADO 2, cantidades y retiradas.');
              } catch (_) { setMessage('No se confirmó la impresión. Comprueba el papel antes de repetir.'); }
            }}><strong>Impresión de prueba</strong><small>Imprimir un ticket de comprobación</small></button>
            {isNativePos && <button type="button" onClick={() => {
              setMenuOpen(false); setUpdatesOpen(true);
            }}><strong>Actualizaciones</strong><small>Consultar novedades y elegir cuándo actualizar</small></button>}
            </div>
            <footer className="pos-menuFooter">{session.storeName} · Volta POS</footer>
          </dialog>
        )}
      </header>}

      {isNativePos && <PosUpdates open={updatesOpen} onOpen={() => setUpdatesOpen(true)} onClose={() => setUpdatesOpen(false)} onVersionChange={setInstalledVersion} onStatusChange={setUpdateStatus} />}
      {storeMeta && activePanel === "orders" && !menuOpen && !updatesOpen && <PosDayInfo city={storeMeta.city || session.storeCity || ""} zipCode={storeMeta.zipCode} latitude={storeMeta.latitude} longitude={storeMeta.longitude} />}
      <PosNotice message={message} onDismiss={dismissMessage} />
      {isNativePos && printStatus?.orderId === null && <PosPrintStatus status={printStatus} />}
      {logoutOpen && <PosLogoutDialog onCancel={() => setLogoutOpen(false)} onConfirm={logoutSession} />}
      {operationsPaused && activePanel !== "dayOrders" && (
        <section className={`pos-pauseBanner ${showPauseScreen ? "pos-pauseBanner--full" : ""}`} aria-label="Estado de operaciones">
          <div role="status"><strong>Operaciones en pausa</strong><span>Solo pedidos programados. La cola y los tickets volverán a mostrarse al reanudar.</span></div>
          <button type="button" onClick={toggleOperationsPause} disabled={savingPause || !pauseStateKnown}>
            {savingPause ? "Reanudando…" : "Reanudar operaciones"}
          </button>
        </section>
      )}
      {showCheckoutAlert && activePanel !== "dayOrders" && !showPauseScreen && (!showVisitorAlert || activePanel !== "orders") && (
        <div className="pos-checkoutBanner" role="status">Cliente finalizando pedido</div>
      )}

      {activePanel === "orders" && !showPauseScreen && (
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
                  <h2>{getPosOrderCode(selectedOrder)}</h2>
                </div>
                <button type="button" onClick={() => setSelectedOrderId(null)}>
                  Cola
                </button>
              </div>

              <TicketPreview order={selectedOrder} />

              <div className="pos-actionGrid pos-actionGrid--ticket">
                <button type="button" className="pos-button--secondary" disabled={printStatus?.phase === 'printing'} onClick={() => printOrder(selectedOrder)}>
                  {printStatus?.phase === 'printing' && printStatus.orderId === selectedOrder.id ? 'Imprimiendo…' : 'Imprimir'}
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
                </div>
              </div>
              {isNativePos && <PosPrintStatus status={printStatus?.orderId === selectedOrder.id ? printStatus : null} />}
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
                <>
                <div className="pos-visitorSignal" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <strong className="pos-checkoutMessage" role="status">Cliente finalizando pedido</strong>
                </>
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
              <PosClock />
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
                {orders.map(order => <OrderCard key={order.id} order={order} locked={getScheduledOrderState(order, clockTick).locked} onSelect={setSelectedOrderId} />)}
              </div>
            </div>
          )}
        </section>
      </div>
      )}

      {activePanel === "inventory" && (
        <main className="store-pos-panel pos-storePanel">
          <button type="button" className="pos-backToKitchen" onClick={() => { setSelectedOrderId(null); setActivePanel("orders"); }}>← Volver a cocina</button>
          <PosInventory key={session.storeId} session={session} ingredients={inventoryItems} setIngredients={setInventoryItems} products={inventoryProducts} setProducts={setInventoryProducts} />
        </main>
      )}

      {activePanel === "dayOrders" && (
        <div className="pos-workspace pos-workspace--dayOrders">
          <section className="pos-ordersPane pos-dayOrdersPane">
            <div className="pos-sectionHead">
              <div>
                <span>Operaciones del día</span>
                <h2>Operaciones finalizadas</h2>
                <small>
                  {dayOrdersKpis
                    ? `${dayOrdersKpis.ordersCount || 0} pedidos · ${formatMoney(dayOrdersKpis.revenue, dayOrders[0]?.currency || "EUR")}`
                    : "Resumen de pedidos y ventas"}
                </small>
              </div>
              <div className="pos-dayOrderActions">
                <button type="button" onClick={() => { setSelectedOrderId(null); setActivePanel("orders"); }}>Volver a pedidos</button>
                <button type="button" onClick={loadDayOrders} disabled={dayOrdersLoading}>{dayOrdersLoading ? "Actualizando…" : "Actualizar"}</button>
              </div>
            </div>

            {dayOrdersError && <div className="pos-emptySmall">{dayOrdersError}</div>}

            {dayOrdersLoading && dayOrders.length === 0 ? (
              <div className="pos-emptySmall">Cargando tickets del dia...</div>
            ) : dayOrders.length === 0 && !dayOrdersError ? (
              <div className="pos-emptySmall">Todavia no hay pedidos completados hoy.</div>
            ) : (
              <div className="pos-dayOrdersList" aria-label="Tickets del dia">
                {dayOrders.map((order) => (
                  <DayOrderCard
                    key={order.id}
                    order={order}
                    onOpen={() => {
                      setSelectedOrderId(order.id);
                      setActivePanel("orders");
                    }}
                  />
                ))}
              </div>
            )}
            {dayCursor && <button type="button" disabled={dayOrdersLoading} onClick={() => loadDayOrders(dayCursor)}>{dayOrdersLoading ? 'Cargando…' : 'Cargar más tickets'}</button>}
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
              <button type="button" className="pos-button--secondary" onClick={loadReservations} disabled={loadingReservations}>
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
              <button type="button" className="pos-button--secondary" onClick={() => setCustomerHelpOpen(false)}>
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
                        {getPosOrderCode(order)} - {getCustomerName(order)}
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
                    maxLength={70}
                    placeholder="Escribe aqui el mensaje exacto para el cliente..."
                  />
                  <small>{customerHelpText.trim().length}/70 - max. 1 part SMS</small>
                </label>
              </div>
            )}

            <div className="pos-actionGrid">
              <button type="button" className="pos-button--secondary" onClick={() => setCustomerHelpOpen(false)}>
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
        <div className="pos-modalBack" onClick={closeReadyConfirm}>
          <section
            className={`pos-reservationModal pos-readyConfirmModal ${
              readyCashReminderOrder?.id === readyConfirmOrder.id ? "is-cashReminder" : ""
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pos-sectionHead">
              <div>
                <span>
                  {readyCashReminderOrder?.id === readyConfirmOrder.id
                    ? "Pago en efectivo"
                    : "Confirmar Ready"}
                </span>
                <h2>
                  {readyCashReminderOrder?.id === readyConfirmOrder.id
                    ? "Recuerda cobrar este pedido"
                    : "Estas seguro de marcar como listo?"}
                </h2>
                <small>{getPosOrderCode(readyConfirmOrder)}</small>
              </div>
            </div>

            <div className="pos-readyConfirmCopy">
              {readyCashReminderOrder?.id === readyConfirmOrder.id
                ? "Recuerda que este pago es en efectivo. Cobra el importe antes de entregar el pedido."
                : "Se enviara la notificacion respectiva al cliente."}
            </div>

            <div className="pos-actionGrid">
              <button type="button" disabled={savingReady} onClick={() => confirmReadyRequest(readyConfirmOrder)}>
                {readyCashReminderOrder?.id === readyConfirmOrder.id
                  ? "Entendido, marcar listo"
                  : "Si, marcar listo"}
              </button>
              <button type="button" className="pos-button--secondary" onClick={closeReadyConfirm}>
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      {newOrderNotice && !operationsPaused && (
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
              <span>{getPosOrderCode(newOrderNotice.order)}</span>
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

      {activePanel !== "dayOrders" && <footer className="pos-footer">
        <div className="pos-versionControl">
          <span>© {new Date().getFullYear()} voltaPizza · {isNativePos ? `POS${installedVersion ? ` v${installedVersion}` : ''}` : 'POS Virtual'}</span>
          {isNativePos && <PosUpdateIndicator status={updateStatus} onOpen={() => setUpdatesOpen(true)} />}
        </div>
        <div className={`pos-printInline ${printerTone}`}>
          <span />
          {printerLabel}
          <small>{isNativePos || printerStatus.realConnected ? printerStatus.label : "modo prueba"}</small>
        </div>
      </footer>}
      {showOrderUtilityFabs && (
        <div className="pos-utilityDock">
          <button type="button" className={`pos-inventoryFab ${activePanel === "inventory" ? "active" : ""} ${disabledInventoryCount > 0 ? "has-disabled" : ""}`} aria-label={`Inventario: ${disabledInventoryCount} elementos desactivados`} title={disabledInventoryCount > 0 ? `${disabledInventoryCount} elementos desactivados` : "Inventario: todos disponibles"} aria-pressed={activePanel === "inventory"} onClick={() => { setMenuOpen(false); setActivePanel("inventory"); }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M3 13h8v8H3zM13 13h8v8h-8zM8 3h8v8H8zM7 13v3m10-3v3M12 3v3" /></svg>
            {disabledInventoryCount > 0 && <strong className="pos-inventoryCount" aria-live="polite" key={disabledInventoryCount}>{disabledInventoryCount}</strong>}
          </button>
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
        </div>
      )}
    </main>
  );
}
