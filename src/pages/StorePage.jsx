import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import OrderPortalTransition from "../components/Storefront/OrderPortalTransition";
import api from "../services/api";
import "../styles/Storefront.css";
import flagEs from "../assets/flags/es.svg";
import gridWatermarkLogo from "../assets/logo/the pizza sale enganine.png";
import {
  BRANDING_DEFAULTS,
  buildBrandThemeVars,
  getOfferButtonVariant,
} from "../constants/branding";
import {
  normalizeStorefrontButtonConfig,
  normalizeStorefrontMode,
} from "../constants/storefrontButtons";
import { buildStorefrontSeo, usePublicSeo } from "../utils/seo";

const TRENDING_TAB = "__TRENDING__";
const TOP_DEAL_TAB = "__TOP_DEAL__";
const PROMOS_TAB = "__PROMOS__";
const UPCOMING_TAB = "__UPCOMING__";
const CUSTOM_BASE_PRICE_FACTOR = 0.8;
const STOREFRONT_TERMS_VERSION = "2026-05-full-legal-v3";
const STOREFRONT_TERMS_KEY = `volta_storefront_terms_${STOREFRONT_TERMS_VERSION}`;
const STOREFRONT_VISITOR_KEY = "volta_storefront_visitor_id";
const DELIVERY_SELECTION_KEY = "volta_storefront_delivery_selection";
const CHECKOUT_PRESENCE_SIGNAL_TIMEOUT_MS = 1200;
const DEFAULT_BOOST_SETTINGS = {
  active: true,
  unitPrice: 0.2,
  maxOptions: 3,
  voltaSharePercent: 25,
  partnerSharePercent: 75,
};
const DEFAULT_TRENDING_PRICE_BAND = 0.5;
const TRENDING_PRICE_REFRESH_MS = 5000;
const PRODUCT_TAG_LABELS = {
  spicy: "Picante",
  vegan: "Vegano",
};
const RANDOM_SELECTION_CANONICAL_KEYS = new Set([
  "random_selection_1",
  "random_selection_2",
  "random_selection_3",
]);
const isGridFocusViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= 760;

const PayPalLogo = () => (
  <svg
    className="sf-paymentMethodPayPalLogo"
    viewBox="0 0 148 40"
    role="img"
    aria-label="PayPal"
    focusable="false"
  >
    <text x="0" y="29" fill="#003087" fontFamily="Arial, Helvetica, sans-serif" fontSize="28" fontWeight="700">
      Pay
    </text>
    <text x="49" y="29" fill="#009cde" fontFamily="Arial, Helvetica, sans-serif" fontSize="28" fontWeight="700">
      Pal
    </text>
  </svg>
);

const normalizeCheckoutPhoneInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 9) return digits;
  if (digits.length === 11 && digits.startsWith("34")) return digits.slice(2);
  if (digits.length > 9) return digits.slice(-9);
  return digits;
};

const normalizeCheckoutEmailInput = (value) => String(value || "").trim().toLowerCase();

const readDeliverySelection = ({ partnerSlug, storeSlug }) => {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(DELIVERY_SELECTION_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.partnerSlug && parsed.partnerSlug !== partnerSlug) return null;
    if (parsed.storeSlug && parsed.storeSlug !== storeSlug) return null;
    return parsed;
  } catch {
    return null;
  }
};

const compactTickerText = (value, maxLength = 34) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
};

const cleanDeliveryAddressTickerText = (value) => {
  const parts = String(value || "")
    .replace(/\s+/g, " ")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const streetLikePart =
    parts.find((part) => !/^\d{5}\b/.test(part) && !/^(spain|espana)$/i.test(part)) || "";
  const cleaned = streetLikePart
    .replace(/\b\d{5}\b/g, "")
    .replace(/\b(spain|espana)\b/gi, "")
    .replace(/[,\s]+$/g, "")
    .trim();

  return compactTickerText(cleaned, 30);
};

const getDeliveryDestinationTickerLabel = (selection) => {
  if (String(selection?.serviceMode || "").toLowerCase() !== "delivery") return "";

  const address = selection?.deliveryAddress || selection?.deliveryResolution?.formattedAddress || "";
  const addressLine2 = selection?.deliveryAddressLine2 || "";
  const formattedAddress = selection?.deliveryResolution?.formattedAddress || "";
  const postalCode =
    [addressLine2, address, formattedAddress]
      .map((value) => String(value || "").match(/\b\d{5}\b/)?.[0])
      .find(Boolean) || "";
  const destination =
    cleanDeliveryAddressTickerText(address) ||
    cleanDeliveryAddressTickerText(formattedAddress) ||
    cleanDeliveryAddressTickerText(addressLine2) ||
    postalCode;

  return destination;
};

const getPickupDestinationTickerLabel = (selection, store) => {
  const storeName = selection?.storeName || store?.storeName || store?.slug || "tienda";
  return compactTickerText(storeName, 30);
};

const storeAllowsPickup = (store) => store?.pickupEnabled !== false;
const storeAllowsDelivery = (store) => store?.deliveryEnabled !== false;

const getStoreServiceMode = (store, selection) => {
  const requestedMode =
    String(selection?.serviceMode || "").toLowerCase() === "delivery"
      ? "delivery"
      : String(selection?.serviceMode || "").toLowerCase() === "pickup"
        ? "pickup"
        : "";

  if (requestedMode === "delivery" && storeAllowsDelivery(store)) return "delivery";
  if (requestedMode === "pickup" && storeAllowsPickup(store)) return "pickup";
  if (storeAllowsPickup(store)) return "pickup";
  if (storeAllowsDelivery(store)) return "delivery";
  return "pickup";
};

const parseNonNegativeMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
};

const parseMaybeJson = (value, fallback) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizePositiveIds = (value) => {
  const list = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return [
    ...new Set(
      list
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    ),
  ];
};

const normalizePaymentPolicySettings = (value) => {
  const parsed = parseMaybeJson(parseMaybeJson(value, {}), {});
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const paypalEmail = String(source.paypalEmail || source.paypalAddress || "").trim();
  const cryptoWalletAddress = String(
    source.cryptoWalletAddress || source.cryptoAddress || source.walletAddress || ""
  ).trim();

  return {
    card: true,
    cash: Boolean(source.cash),
    cashStoreIds: normalizePositiveIds(source.cashStoreIds),
    paypal: Boolean(source.paypal) && Boolean(paypalEmail),
    paypalStoreIds: normalizePositiveIds(source.paypalStoreIds),
    paypalEmail,
    crypto: Boolean(source.crypto) && Boolean(cryptoWalletAddress),
    cryptoStoreIds: normalizePositiveIds(source.cryptoStoreIds),
    cryptoWalletAddress,
  };
};

const paymentStoreKey = (methodId) => `${methodId}StoreIds`;

const isPaymentMethodAllowedForStore = (settings, methodId, storeId) => {
  if (!settings?.[methodId]) return false;
  const storeIds = normalizePositiveIds(settings[paymentStoreKey(methodId)]);
  const numericStoreId = Number(storeId);

  return !storeIds.length || storeIds.includes(numericStoreId);
};

const isDeliveryFreeCouponData = (coupon) => {
  const markers = [
    coupon?.type,
    coupon?.campaign,
    coupon?.key,
    coupon?.meta?.type,
    coupon?.meta?.campaign,
  ].map((value) => String(value || "").toUpperCase());
  const couponCode = String(coupon?.code || coupon?.sampleCode || coupon?.displayCode || "").toUpperCase();

  return (
    markers.includes("DELIVERY_FREE") ||
    Boolean(coupon?.meta?.deliveryFree) ||
    couponCode.startsWith("VOL-DF")
  );
};

const hasCheckoutIdentity = (profile) =>
  Boolean(
    String(profile?.name || "").trim() &&
      normalizeCheckoutPhoneInput(profile?.phone).length === 9
  );

const hasBasicCustomerProfile = (profile) =>
  hasCheckoutIdentity(profile);

const getStorefrontVisitorId = () => {
  const fallback = () => `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  if (typeof window === "undefined") return fallback();

  try {
    let visitorId = window.localStorage.getItem(STOREFRONT_VISITOR_KEY) || "";
    if (!visitorId) {
      visitorId = fallback();
      window.localStorage.setItem(STOREFRONT_VISITOR_KEY, visitorId);
    }
    return visitorId;
  } catch {
    return fallback();
  }
};

const postStorefrontPresence = ({ partnerId, storeId, state }) => {
  const numericPartnerId = Number(partnerId);
  const numericStoreId = Number(storeId);

  if (!numericPartnerId || !numericStoreId) return Promise.resolve(null);

  return api
    .post("/api/presence/heartbeat", {
      partnerId: numericPartnerId,
      storeId: numericStoreId,
      visitorId: getStorefrontVisitorId(),
      state,
      path: typeof window === "undefined" ? "" : window.location.pathname,
    })
    .catch((err) => {
      console.warn("[presence] heartbeat failed", err);
      return null;
    });
};
const NON_INCENTIVE_LINE_SOURCES = new Set([
  "queue_boost",
  "incentive_reward",
  "promo",
  "offer",
  "coupon",
  "discount",
]);
const NON_INCENTIVE_LINE_TYPES = new Set([
  "queue_boost",
  "INCENTIVE_REWARD",
  "PROMO",
  "OFFER",
  "COUPON",
  "DISCOUNT",
]);
const CUSTOM_CATEGORY_ORDER = [
  "SALSAS",
  "QUESOS",
  "FIAMBRES",
  "CARNES",
  "PESCADOS",
  "DEL MAR",
  "VEGETALES",
  "SETAS",
  "COMPLEMENTOS",
];
const INGREDIENT_BASE_SIZE = "M";
const INGREDIENT_SIZE_DIAMETERS_CM = {
  XS: 20,
  S: 25,
  M: 30,
  L: 35,
  XL: 40,
  XXL: 45,
  ST: 30,
};
const INCENTIVE_TIME_ZONE = "Europe/Madrid";

function formatCountdown(totalMinutes) {
  if (totalMinutes <= 0) return "Cerrando ahora";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `Cierra en ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `Cierra en ${hours}h`;
  }

  return `Cierra en ${minutes}m`;
}

function buildClosingSnapshot(now, closeHour = 23, closeMinute = 30) {
  const closingTime = new Date(now);
  closingTime.setHours(closeHour, closeMinute, 0, 0);

  const diffMs = closingTime.getTime() - now.getTime();
  const diffMinutes = Math.max(Math.ceil(diffMs / 60000), 0);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const countdownValue =
    hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;

  return {
    countdownLabel: formatCountdown(diffMinutes),
    countdownValue,
    closingLabel: `Hoy ${String(closeHour).padStart(2, "0")}:${String(closeMinute).padStart(2, "0")}`,
  };
}

const SCHEDULE_SLOT_STEP_MINUTES = 15;
const SCHEDULE_OPEN_OFFSET_MINUTES = 30;
const SCHEDULE_DAYS_AHEAD = 5;
const FALLBACK_SCHEDULE_WINDOW = {
  openTime: 14 * 60,
  closeTime: 23 * 60 + 30,
};

function parseStoreTimeToMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);

    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);

      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        return hours * 60 + minutes;
      }
    }

    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return Math.trunc(numericValue);
    }
  }

  return null;
}

function clampScheduleMinute(value) {
  return Math.min(Math.max(value, 0), 24 * 60);
}

function roundUpToStep(minutes, step = SCHEDULE_SLOT_STEP_MINUTES) {
  return Math.ceil(minutes / step) * step;
}

function minutesToHHMM(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function isSameLocalDay(left, right) {
  if (!left || !right) return false;

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getMinutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function buildScheduleDays(nowDate) {
  return Array.from({ length: SCHEDULE_DAYS_AHEAD }, (_, index) => {
    const date = new Date(nowDate);
    date.setDate(nowDate.getDate() + index);
    date.setHours(0, 0, 0, 0);

    const weekDays = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const label =
      index === 0
        ? "Hoy"
        : index === 1
        ? "Manana"
        : `${weekDays[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;

    return {
      date,
      label,
    };
  });
}

function formatScheduledOrderLabel(date, nowDate) {
  if (!date) return "";

  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);

  const startOfNow = new Date(nowDate);
  startOfNow.setHours(0, 0, 0, 0);

  const diffDays = Math.round((startOfDate.getTime() - startOfNow.getTime()) / 86400000);
  const weekDays = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const dateLabel =
    diffDays === 0
      ? "Hoy"
      : diffDays === 1
      ? "Manana"
      : `${weekDays[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;

  return `${dateLabel} ${minutesToHHMM(getMinutesOfDay(date))}`;
}

function toLocalDateValue(date) {
  if (!date) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getScheduleWindowsForDate(store, date) {
  const storeHours = Array.isArray(store?.hours) ? store.hours : [];
  const dayOfWeek = date.getDay();
  const matchingHours = storeHours.filter((item) => Number(item.dayOfWeek) === dayOfWeek);
  const sourceHours = matchingHours.length ? matchingHours : [FALLBACK_SCHEDULE_WINDOW];

  return sourceHours
    .map((item) => {
      const openTime = parseStoreTimeToMinutes(item.openTime);
      const closeTime = parseStoreTimeToMinutes(item.closeTime);

      if (openTime == null || closeTime == null) return null;

      const start = clampScheduleMinute(openTime + SCHEDULE_OPEN_OFFSET_MINUTES);
      const end = clampScheduleMinute(closeTime);

      if (start >= end) return null;

      return { start, end };
    })
    .filter(Boolean);
}

function buildScheduleSlots({ store, selectedDate, nowDate }) {
  if (!selectedDate) return [];

  const nowMinutes = getMinutesOfDay(nowDate);
  const isToday = isSameLocalDay(selectedDate, nowDate);
  const slots = new Set();

  getScheduleWindowsForDate(store, selectedDate).forEach((window) => {
    const earliestMinute = isToday ? Math.max(window.start, nowMinutes) : window.start;
    const start = roundUpToStep(earliestMinute);

    for (let minute = start; minute <= window.end; minute += SCHEDULE_SLOT_STEP_MINUTES) {
      slots.add(minute);
    }
  });

  return [...slots].sort((left, right) => left - right);
}

function isFutureReservationSlot(selectedDate, time, nowDate) {
  if (!selectedDate || !time) return false;
  if (!isSameLocalDay(selectedDate, nowDate)) return true;

  const slotMinutes = parseStoreTimeToMinutes(time);
  if (slotMinutes == null) return false;

  return slotMinutes > getMinutesOfDay(nowDate);
}

function formatLaunchCountdown(launchAt, now) {
  const launchDate = new Date(launchAt);
  if (!launchAt || Number.isNaN(launchDate.getTime())) return "MUY PRONTO";

  const diffMs = launchDate.getTime() - now.getTime();
  if (diffMs <= 0) return "DISPONIBLE";

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${String(minutes).padStart(2, "0")}M`;
  return `${minutes}M`;
}

function formatLaunchDate(launchAt) {
  const launchDate = new Date(launchAt);
  if (!launchAt || Number.isNaN(launchDate.getTime())) return "Fecha por anunciar";

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(launchDate);
}

function filterMenuItems(items, query) {
  if (!query) return items;

  return items.filter((item) => {
    const pizzaName = String(item.name || "").toLowerCase();
    const pizzaCategory = String(item.category || "").toLowerCase();
    const tagMatch = (item.productTags || []).some((tag) =>
      String(PRODUCT_TAG_LABELS[tag] || tag || "").toLowerCase().includes(query)
    );
    const ingredientMatch = (item.ingredients || []).some((ingredient) =>
      String(ingredient.name || "").toLowerCase().includes(query)
    );

    return (
      pizzaName.includes(query) ||
      pizzaCategory.includes(query) ||
      tagMatch ||
      ingredientMatch
    );
  });
}

function filterPromos(items, query) {
  if (!query) return items;

  return items.filter((promo) => {
    const title = String(promo.title || "").toLowerCase();
    const description = String(promo.description || "").toLowerCase();
    const itemMatch = (promo.items || []).some((item) =>
      String(item.name || item.categoryName || item.category || "").toLowerCase().includes(query)
    );

    return title.includes(query) || description.includes(query) || itemMatch;
  });
}

function promoHasProducts(promo) {
  return Array.isArray(promo?.items) && promo.items.some((item) => item?.pizzaId || item?.name || item?.categoryName);
}

function filterTrendingItems(items, query) {
  return filterMenuItems(items, query).slice(0, 3);
}

const num = (value) => {
  if (value == null || value === "") return 0;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getApiErrorMessage = (error, fallback) => {
  try {
    const parsed = JSON.parse(error?.message || "");
    return parsed?.error || fallback;
  } catch {
    return error?.message || fallback;
  }
};

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const formatRepeatDate = (value) => {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const priceForSize = (priceBySize = {}, size = "M") => {
  const preferred = num(priceBySize?.[size]);
  if (preferred > 0) return preferred;

  for (const key of ["M", "S", "L", "XL", "XS"]) {
    const value = num(priceBySize?.[key]);
    if (value > 0) return value;
  }

  for (const value of Object.values(priceBySize || {})) {
    const parsed = num(value);
    if (parsed > 0) return parsed;
  }

  return 0;
};

const getDirectDiscountLabel = (discount) => {
  if (!discount) return "";
  const value = num(discount.value);

  if (discount.discountType === "PERCENT") {
    return `${Math.round(value)}% off hoy`;
  }

  return `EUR ${value.toFixed(2)} off hoy`;
};

const getOfferEndTargetMs = (offer, nowMs) => {
  const candidates = [];

  if (offer?.expiresAt) {
    const expiresAtMs = new Date(offer.expiresAt).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs) {
      candidates.push(expiresAtMs);
    }
  }

  const windowEnd = Number(offer?.windowEnd);
  if (Number.isFinite(windowEnd)) {
    const zonedNow = getZonedDate(nowMs);
    const minutesNow = zonedNow.getHours() * 60 + zonedNow.getMinutes();
    const windowStart =
      offer?.windowStart == null ? null : Number(offer.windowStart);
    const crossesMidnight =
      Number.isFinite(windowStart) && windowStart > windowEnd;
    const minutesLeft = crossesMidnight
      ? minutesNow < windowEnd
        ? windowEnd - minutesNow
        : 24 * 60 - minutesNow + windowEnd
      : windowEnd - minutesNow;

    if (minutesLeft > 0) {
      candidates.push(
        nowMs +
          minutesLeft * 60 * 1000 -
          zonedNow.getSeconds() * 1000 -
          zonedNow.getMilliseconds()
      );
    }
  }

  if (!candidates.length) return null;
  return Math.min(...candidates);
};

const formatOfferCountdown = (offer, nowMs) => {
  const targetMs = getOfferEndTargetMs(offer, nowMs);
  if (!targetMs) return "Limitada";

  const diffMs = Math.max(0, targetMs - nowMs);

  return formatDurationMs(diffMs);
};

const getOriginalPriceForSize = (item, size = "M") => {
  if (!item?.originalPriceBySize) return 0;
  return priceForSize(item.originalPriceBySize, size);
};

const getDiscountPercentForSize = (item, size = "M") => {
  const price = priceForSize(item?.priceBySize, size);
  const originalPrice = getOriginalPriceForSize(item, size);

  if (originalPrice <= price || originalPrice <= 0 || price <= 0) return 0;

  return Math.round(((originalPrice - price) / originalPrice) * 100);
};

const getDiscountSavingForSize = (item, size = "M") => {
  const price = priceForSize(item?.priceBySize, size);
  const originalPrice = getOriginalPriceForSize(item, size);

  return Math.max(0, roundMoney(originalPrice - price));
};

const getDealSize = (item) => {
  const sizes = Object.keys(item?.priceBySize || {}).filter(
    (size) => item.priceBySize?.[size] !== "" && item.priceBySize?.[size] != null
  );
  return sizes[0] || "M";
};

const getPricedSizeEntries = (priceBySize = {}) =>
  Object.entries(priceBySize || {})
    .map(([size, price]) => [size, num(price)])
    .filter(([, price]) => price > 0);

const getHighestPricedSize = (priceBySize = {}) => {
  const entries = getPricedSizeEntries(priceBySize);
  if (!entries.length) return "M";

  return entries.sort((left, right) => right[1] - left[1])[0][0];
};

const renderDirectDiscountBadge = (item) => {
  if (!hasTopDealPolicy(item)) return null;

  return (
    <span className="lsf-directDiscountBadge">
      <strong>{getDirectDiscountLabel(item.directDiscount)}</strong>
    </span>
  );
};

const renderTopDealAvailabilityPill = (item) => {
  const remaining = getTopDealRemainingQuantity(item);
  if (remaining == null) return null;

  return (
    <span className="lsf-topDealAvailabilityPill" aria-label={`${remaining} Top Deals disponibles`}>
      <strong>{remaining}</strong>
      <span>disp.</span>
    </span>
  );
};

const CartPlusIcon = () => (
  <svg className="lsf-card__cartIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M5 5h2.1l1.25 8.15a2 2 0 0 0 1.98 1.7h6.2a2 2 0 0 0 1.9-1.37l1.2-3.63H8.05"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.5 5.5h5M18 3v5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M10 19.5h.01M17 19.5h.01"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

const LikeIcon = () => (
  <svg className="lsf-card__metaIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7.2 10.2v9.1M10.1 9.6l3.2-6.1c.4-.7 1.3-.9 2-.5.6.3.8 1 .7 1.6l-.8 4.1h4.3c1.4 0 2.4 1.3 2.1 2.7l-1.3 5.4a3.1 3.1 0 0 1-3 2.4h-7.2a2 2 0 0 1-2-2v-5.1a2.4 2.4 0 0 1 2-2.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.2 10.2h4v9.1h-4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const GiftShareIcon = () => (
  <svg className="lsf-card__metaIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4.5 11h15v9h-15zM3.5 7.5h17V11h-17zM12 7.5V20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 7.5c-1.8-3-5.2-3.1-5.2-.8 0 1.8 2.2 2.2 5.2 2.2 3 0 5.2-.4 5.2-2.2 0-2.3-3.4-2.2-5.2.8Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.2 15.7h3.5m0 0-1.3-1.3m1.3 1.3-1.3 1.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FooterClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    />
    <path
      d="M12 7.25v5.1l3.25 2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FooterCalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7 3v4M17 3v4M4 9h16M5.5 5h13A2.5 2.5 0 0 1 21 7.5v11A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FooterPercentIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm4.03-12.53a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 1 1-1.06-1.06l6.5-6.5a.75.75 0 0 1 1.06 0ZM8.75 9.5a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Zm4 5a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Z" />
  </svg>
);

const IncentiveBanner = ({
  className = "",
  active = false,
  waiting = false,
  unlocked = false,
  eyebrow,
  message,
  counterLabel,
  rewardLabel,
  progress = 0,
  percent,
}) => {
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(Number.isFinite(progress) ? progress * 100 : 0))
  );
  const displayPercent = Math.min(
    100,
    Math.max(0, Math.round(Number.isFinite(percent) ? percent : progressPercent))
  );
  const markerPercent = Math.min(96, Math.max(4, displayPercent));
  const stateClass = active ? "is-active" : waiting ? "is-waiting" : "is-idle";

  return (
    <div
      className={`sf-incentiveBanner sf-incentiveBanner--lsf ${
        unlocked ? "is-complete" : ""
      } ${stateClass} ${className}`.trim()}
      style={{
        "--sf-incentive-progress": `${progressPercent}%`,
        "--sf-incentive-marker": `${markerPercent}%`,
      }}
    >
      <div className="sf-incentiveHead">
        <div className="sf-incentiveCopy">
          <span className="sf-incentiveEyebrow">{eyebrow}</span>
          <strong className="sf-incentiveMessageTicker">
            <span>{message}</span>
            <span aria-hidden="true">{message}</span>
          </strong>
        </div>
        {!unlocked && (
          <div className="sf-incentiveSignal" aria-label="Estado del incentivo">
            <span className="sf-incentiveTimer">{counterLabel}</span>
          </div>
        )}
      </div>

      {unlocked ? (
        <div className="sf-incentiveRewardStage" aria-label="Incentivo desbloqueado">
          <span>Felicidades</span>
          <strong>
            {rewardLabel}
            <span className="sf-incentiveRewardDesktopSuffix"> listo para este pedido</span>
          </strong>
          <span>Volta reward</span>
        </div>
      ) : active ? (
        <div
          className="sf-incentiveProgress"
          role="progressbar"
          aria-label="Progreso del incentivo"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={displayPercent}
        >
          <div className="sf-incentiveProgressTrack">
            <span className="sf-incentiveProgressFill" />
            <span className="sf-incentiveProgressStripes" />
            <span className="sf-incentiveProgressGlow" />
            <span className="sf-incentiveProgressMarker">{displayPercent}%</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

function IncentiveFocusModal({
  open,
  onClose,
  active,
  waiting,
  unlocked,
  remainingLabel,
  targetLabel,
  currentLabel,
  rewardLabel,
  message,
  counterLabel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const title = unlocked
    ? "Incentivo listo"
    : active
    ? "Te falta poco"
    : waiting
    ? "Proximo incentivo"
    : "Incentivo";

  return (
    <div className="sf-modalOverlay" onClick={onClose}>
      <div
        className="sf-modalCard sf-incentiveFocusModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-incentiveFocusTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="sf-modalCloseBtn" onClick={onClose} aria-label="Cerrar">
          x
        </button>
        <div className="sf-incentiveFocusModal__badge">
          <span>{unlocked ? "Premio" : active ? "Faltan" : "Incentivo"}</span>
          <strong>{unlocked ? rewardLabel : active ? remainingLabel : counterLabel}</strong>
        </div>
        <div className="sf-incentiveFocusModal__copy">
          <span>{counterLabel}</span>
          <h3 id="sf-incentiveFocusTitle">{title}</h3>
          <p>{message}</p>
        </div>
        {active && !unlocked && (
          <div className="sf-incentiveFocusModal__stats" aria-label="Detalle del incentivo">
            <span>
              <b>{currentLabel}</b>
              Pedido elegible
            </span>
            <span>
              <b>{targetLabel}</b>
              Meta
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CouponInfoModal({ open, onClose, onRemove, onValidate, validating = false, data }) {
  const [countdown, setCountdown] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!open || !data?.coupon?.expiresAt) {
      setCountdown("");
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const leftMs = Math.max(0, new Date(data.coupon.expiresAt).getTime() - Date.now());
      const nextSeconds = Math.floor(leftMs / 1000);
      const hours = Math.floor(nextSeconds / 3600);
      const minutes = Math.floor((nextSeconds % 3600) / 60);
      const seconds = nextSeconds % 60;

      setSecondsLeft(nextSeconds);
      setCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [open, data?.coupon?.expiresAt]);

  if (!open || !data) return null;

  const coupon = data.coupon;
  const severity =
    secondsLeft == null ? "ok" : secondsLeft <= 15 * 60 ? "critical" : secondsLeft <= 2 * 60 * 60 ? "warning" : "ok";
  const readableStatus = {
    valid: "APLICADO",
    empty_cart: "LISTO PARA PRODUCTOS",
    waiting_for_cart: "LISTO PARA PRODUCTOS",
    no_delivery_fee: "REQUIERE DELIVERY",
    min_not_met: "MINIMO PENDIENTE",
    wrong_area: "NO DISPONIBLE AQUI",
    not_started: "AUN NO ACTIVO",
    expired: "CADUCADO",
    used: "USADO",
    disabled: "DETENIDO",
    not_found: "NO ENCONTRADO",
  }[String(data.status || "").toLowerCase()] || String(data.status || "sin_estado").replace(/_/g, " ").toUpperCase();
  const pendingStatuses = new Set(["empty_cart", "waiting_for_cart", "min_not_met", "no_delivery_fee"]);
  const statusTone = data.valid ? "is-valid" : pendingStatuses.has(String(data.status || "").toLowerCase()) ? "is-pending" : "is-invalid";
  const discountPreview = (() => {
    if (!coupon) return "EUR 0.00";
    if (data.valid) return `EUR ${num(data.discount).toFixed(2)}`;
    if (isDeliveryFreeCouponData(coupon)) return "Envio gratis";
    if (coupon.kind === "AMOUNT") return `EUR ${num(data.discountPotential ?? coupon.amount).toFixed(2)}`;
    if (coupon.kind === "PERCENT") return `${num(coupon.percent)}%`;
    return `EUR ${num(data.discountPotential || data.discount).toFixed(2)}`;
  })();
  const discountLabel = data.valid ? "Descuento aplicado" : "Descuento aplicable";

  return (
    <div className="sf-modalOverlay" onClick={onClose}>
      <div className="sf-modalCard sf-couponInfoModal" onClick={(event) => event.stopPropagation()}>
        <div className="sf-cartModalHead">
          <div>
            <span>{data.valid ? "Cupon aplicado" : "Validacion de cupon"}</span>
            <h3>Condiciones de la oferta</h3>
          </div>
          <button type="button" className="sf-modalCloseBtn" onClick={onClose} aria-label="Cerrar">
            x
          </button>
        </div>

        <div className="sf-couponInfoBody">
          <div className={`sf-couponInfoStatus ${statusTone}`}>
            <strong>{data.message || "Revisa el estado del cupon."}</strong>
            <span>Estado: {readableStatus}</span>
          </div>

          {coupon ? (
            <>
              <div className="sf-couponCodeHero">
                <span>Codigo del cupon</span>
                <strong>{coupon.code}</strong>
              </div>
              {coupon.id && <p><b>Beneficio:</b> {formatCouponBenefit(coupon)}</p>}
              {coupon.expiresAt && <p><b>Caduca:</b> {formatCouponExpiry(coupon.expiresAt)}</p>}
              <p><b>{discountLabel}:</b> {discountPreview}</p>

              {coupon.expiresAt && (
                <div className={`sf-couponTimer sf-couponTimer--${severity}`} role="status" aria-live="polite">
                  <span>Quedan</span>
                  <strong>{countdown || "--:--:--"}</strong>
                </div>
              )}

              <h4>Condiciones</h4>
              <ul>
                <li>Valido por <b>1 cupon por pedido</b> y <b>no acumulable</b> con otros cupones.</li>
                <li>Se aplica sobre <b>productos</b>, no sobre gastos de envio ni Boost.</li>
                <li>Debe estar activo, dentro de horario y antes de su caducidad.</li>
                <li>El uso se registra al confirmar el pago.</li>
              </ul>
            </>
          ) : (
            <p>Introduce un codigo valido para ver las condiciones y aplicar el descuento.</p>
          )}
        </div>

        <div className="sf-cartActions sf-couponInfoActions">
          <button type="button" className="sf-primaryBtn" onClick={onValidate} disabled={validating}>
            {validating ? "Validando..." : "Validar cupon"}
          </button>
          {(coupon || data.valid) && (
            <button type="button" className="sf-secondaryBtn" onClick={onRemove}>
              Quitar cupon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StorefrontTermsGateModal({ open, onAccept, partnerName }) {
  if (!open) return null;

  return (
    <div className="sf-modalOverlay sf-termsGateOverlay">
      <div
        className="sf-modalCard sf-termsGateModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-terms-title"
      >
        <div className="sf-cartModalHead">
          <div>
            <span>{partnerName || "Volta Storefront"}</span>
            <h3 id="sf-terms-title">Terminos, privacidad, cookies y bases legales</h3>
          </div>
        </div>

        <div className="sf-termsGateBody">
          <p>
            Antes de entrar, acepta en un solo acto las condiciones de compra,
            privacidad, cookies esenciales y bases legales de promociones. Las
            cookies necesarias se usan para sesion, carrito, seguridad y guardar
            esta aceptacion.
          </p>

          <h4>Identificacion del responsable</h4>
          <p>
            MYCRUSHPIZZA, S.L. - CIF B-21998257. Plaza San Antonio 1 - Local A,
            32004 Ourense (Espana). Contacto: mycrushpizzaspain@gmail.com.
          </p>

          <h4>Terminos de compra</h4>
          <ul>
            <li>Precios en EUR con impuestos incluidos salvo indicacion distinta.</li>
            <li>Fotos, nombres, alergenos y descripciones buscan ser exactos, pero pueden existir pequenas variaciones.</li>
            <li>Revisa alergenos antes de confirmar; puede haber trazas por instalaciones compartidas.</li>
            <li>Productos sujetos a disponibilidad, stock, horario y zona de servicio de la tienda.</li>
            <li>El contrato de compra se perfecciona al confirmar el pedido y, cuando corresponda, completar el pago.</li>
            <li>Alimentos preparados o perecederos no admiten desistimiento de 14 dias una vez iniciada la preparacion.</li>
            <li>Las incidencias deben comunicarse con numero de pedido y, si procede, fotos.</li>
          </ul>

          <h4>Politica de prioridad Boost</h4>
          <ul>
            <li>Un pedido con Boost activo tiene prioridad operativa sobre cualquier pedido sin Boost, bajo cualquier circunstancia.</li>
            <li>Todos los pedidos con Boost se colocan siempre al inicio de la cola de pedidos pendientes.</li>
            <li>Dentro del bloque Boost, la prioridad depende del puesto comprado por el cliente: el puesto 1 es la prioridad mas alta, seguido por el puesto 2, puesto 3 y sucesivos.</li>
            <li>Despues de los pedidos Boost, los pedidos de clientes VIP tienen prioridad sobre el resto de pedidos sin Boost.</li>
            <li>Cuando varios pedidos Boost compiten por la misma intensidad, se ordenan por credito de cola, momento de pago y antiguedad del pedido.</li>
            <li>El Boost no cambia la disponibilidad de productos, horarios, zona de servicio ni el resto de condiciones del pedido.</li>
          </ul>

          <h4>Politica de cupones, promos e incentivos</h4>
          <ul>
            <li><b>Los cupones no son acumulables</b> con otros cupones.</li>
            <li>Un cupon solo aplica sobre <b>productos normales</b> elegibles.</li>
            <li>Los cupones <b>no aplican</b> sobre Promos, Top Deals, descuentos directos, Boost, envio ni recompensas gratis.</li>
            <li>Las Promos tienen <b>precio cerrado</b> y no reciben descuentos adicionales.</li>
            <li>Los Top Deals ya incluyen descuento directo y no reciben cupon.</li>
            <li>Los incentivos se calculan sobre el <b>gasto neto elegible</b>: productos normales menos cupon aplicado.</li>
            <li>El cupon se marca como usado al confirmar el pago y debe estar activo, vigente y dentro de sus condiciones.</li>
          </ul>

          <h4>Bases legales de promociones</h4>
          <ul>
            <li>Promos, cupones, Top Deals, Boost e incentivos pueden tener stock, horario, caducidad, zona y condiciones propias.</li>
            <li>La tienda puede corregir errores evidentes, cancelar abusos, duplicidades o usos fraudulentos.</li>
            <li>Las recompensas gratis dependen de cumplir el objetivo vigente en el momento de compra.</li>
            <li>Una promocion puede retirarse o cambiarse por causa tecnica, operativa o de disponibilidad.</li>
          </ul>

          <h4>Cupones, juegos promocionales y azar</h4>
          <ul>
            <li>Los juegos, ruletas, sorteos, dinamicas de azar o retos del portal son <b>promocionales</b> y no constituyen dinero, saldo ni premio canjeable en efectivo.</li>
            <li>Para participar o canjear recompensas promocionales debes ser <b>mayor de 18 anos</b>.</li>
            <li>Cada cupon o premio puede estar limitado a <b>1 uso</b>, una cuenta, un telefono, una zona, una tienda, una fecha, un horario o un stock disponible.</li>
            <li>Los cupones obtenidos en juegos pueden requerir validacion, estar asociados a un telefono/cliente y caducar automaticamente.</li>
            <li>No se permite automatizar participaciones, crear duplicados, revender cupones, manipular resultados o usar datos falsos.</li>
            <li>Si se detecta abuso, fraude, error tecnico o participacion no elegible, la tienda puede anular el cupon, premio o pedido asociado.</li>
            <li>La obtencion de un cupon no garantiza disponibilidad de producto; el descuento solo se aplica si el pedido cumple todas las condiciones vigentes.</li>
          </ul>

          <h4>Privacidad y comunicaciones</h4>
          <ul>
            <li>Tratamos datos de contacto, pedido, direccion o tienda, pago, soporte y datos tecnicos necesarios.</li>
            <li>Finalidades: gestionar pedido, cobro, entrega/recogida, soporte, seguridad, facturacion y obligaciones legales.</li>
            <li>El pago se procesa mediante pasarela certificada; no almacenamos numeros completos de tarjeta.</li>
            <li>Podemos usar proveedores de hosting, pago, mensajeria, mapas y soporte bajo garantias legales.</li>
            <li>Puedes ejercer derechos de acceso, rectificacion, supresion, oposicion, limitacion y portabilidad por email.</li>
          </ul>

          <h4>Cookies</h4>
          <ul>
            <li>Usamos cookies o almacenamiento local <b>necesario</b> para carrito, sesion, seguridad, preferencias y aceptacion legal.</li>
            <li>Servicios de pago o mapas pueden usar cookies tecnicas propias para seguridad y funcionamiento.</li>
            <li>Las cookies analiticas o publicitarias solo se habilitaran si se activan expresamente en el portal.</li>
            <li>Puedes borrar o bloquear cookies desde el navegador; algunas funciones podrian dejar de funcionar.</li>
          </ul>

          <p className="sf-termsGateNote">
            Al pulsar "Acepto y entrar" confirmas que has leido y aceptas estos
            terminos, condiciones promocionales, politica de privacidad, cookies
            necesarias y bases legales del portal.
          </p>
        </div>

        <div className="sf-termsGateActions">
          <button type="button" className="sf-primaryBtn" onClick={onAccept}>
            Acepto y entrar
          </button>
        </div>
      </div>
    </div>
  );
}

const renderDiscountPrice = ({
  price,
  originalPrice = 0,
  discountPercent = 0,
  isTicking = false,
  className = "",
}) => {
  const hasDiscount = originalPrice > price && price > 0 && discountPercent > 0;

  if (!hasDiscount) {
    return (
      <span className={`lsf-card__priceCurrent ${isTicking ? "is-ticking" : ""} ${className}`}>
        EUR {price.toFixed(2)}
      </span>
    );
  }

  return (
    <span
      className={`lsf-card__priceStack has-discount ${isTicking ? "is-ticking" : ""} ${className}`}
    >
      <span className="lsf-card__priceOld">EUR {originalPrice.toFixed(2)}</span>
      <span className="lsf-card__priceRow">
        <strong className="lsf-card__priceCurrent">EUR {price.toFixed(2)}</strong>
        <em>-{discountPercent}%</em>
      </span>
    </span>
  );
};

const renderStorefrontPrice = (item, size = "M") => {
  const price = priceForSize(item?.priceBySize, size);
  const originalPrice = getOriginalPriceForSize(item, size);
  const discountPercent = getDiscountPercentForSize(item, size);

  return renderDiscountPrice({ price, originalPrice, discountPercent });
};

const renderTrendingPrice = (item, size = "M", isTicking = false) => {
  const price = priceForSize(item?.priceBySize, size);
  const basePrice = priceForSize(getTrendingBasePriceBySize(item), size);
  const adjustment = roundMoney(price - basePrice);
  const trendTone =
    adjustment > 0 ? "is-up" : adjustment < 0 ? "is-down" : "is-flat";
  const adjustmentLabel =
    adjustment > 0
      ? `+EUR ${Math.abs(adjustment).toFixed(2)}`
      : adjustment < 0
      ? `-EUR ${Math.abs(adjustment).toFixed(2)}`
      : "+/- EUR 0.00";

  return (
    <span
      className={`lsf-topDealPrice lsf-trendingPriceStack ${trendTone} ${isTicking ? "is-ticking" : ""}`}
    >
      <span className="lsf-card__priceOld">BASE EUR {basePrice.toFixed(2)}</span>
      <span className="lsf-card__priceRow">
        <strong className="lsf-card__priceCurrent">EUR {price.toFixed(2)}</strong>
        <em>{adjustmentLabel}</em>
      </span>
    </span>
  );
};

const renderTopDealPrice = (item, size = "M", isTicking = false) => {
  const price = priceForSize(item?.priceBySize, size);
  const originalPrice = getOriginalPriceForSize(item, size);
  const discountPercent = getDiscountPercentForSize(item, size);
  const hasDiscount = originalPrice > price && price > 0;

  return (
    renderDiscountPrice({
      price,
      originalPrice: hasDiscount ? originalPrice : 0,
      discountPercent,
      isTicking,
      className: "lsf-topDealPrice",
    })
  );
};

const renderPromoPrice = (promo, menu = [], isTicking = false) => {
  const promoPrice = num(promo?.totalPrice);
  const originalTotal = getPromoOriginalTotal(promo, menu);
  const discountPercent = getPromoDiscountPercent(promo, menu);
  const hasDiscount = originalTotal > promoPrice && promoPrice > 0;

  return (
    renderDiscountPrice({
      price: promoPrice,
      originalPrice: hasDiscount ? originalTotal : 0,
      discountPercent,
      isTicking,
      className: "lsf-topDealPrice lsf-promoPriceStack",
    })
  );
};

const getProductApprovalBaseline = (item) => {
  const seed = String(item?.pizzaId || item?.id || item?.name || "pizza")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return {
    likes: 8 + (seed % 38),
    percent: 86 + (seed % 12),
  };
};

const getProductApprovalStats = (item) => {
  const approval = item?.approval || item?.likeStats || item?.rating || {};
  const realLikes = Math.max(
    0,
    Math.trunc(
      num(
        approval.likes ??
          approval.likeCount ??
          approval.positive ??
          item?.likes ??
          item?.likeCount
      )
    )
  );
  const dislikes = Math.max(
    0,
    Math.trunc(num(approval.dislikes ?? approval.dislikeCount ?? approval.negative))
  );
  const total = Math.max(
    realLikes + dislikes,
    Math.trunc(num(approval.total ?? approval.totalVotes ?? approval.votes))
  );
  const explicitPercent = num(
    approval.percent ?? approval.approvalPercent ?? approval.likePercent
  );
  const baseline = getProductApprovalBaseline(item);

  if (realLikes <= 0 && total <= 0) {
    return baseline;
  }

  const likes = baseline.likes + realLikes;
  const visibleTotal = baseline.likes + total;
  const percent =
    dislikes <= 0 && realLikes > 0
      ? 100
      : explicitPercent > 0 && total <= 0
      ? Math.min(100, Math.round(explicitPercent))
      : visibleTotal > 0
      ? Math.round((likes / visibleTotal) * 100)
      : 0;

  return { likes, percent };
};

const renderProductApprovalMeta = (item) => {
  const { likes, percent } = getProductApprovalStats(item);
  const likeLabel = likes === 1 ? "1 like" : `${likes} likes`;

  return (
    <div className="lsf-card__approval" aria-label={`Aprobacion ${percent}% con ${likeLabel}`}>
      <LikeIcon />
      <span>Like {percent}%</span>
      <strong>({likeLabel})</strong>
    </div>
  );
};

const renderProductGiftAction = (item) => {
  return (
    <button
      type="button"
      className="lsf-card__gift"
      onClick={(event) => event.stopPropagation()}
      aria-label={`Haz un regalo con ${item?.name || ""}`.trim()}
    >
      <span>Haz un regalo</span>
      <GiftShareIcon />
    </button>
  );
};

const isBeverageProduct = (item) =>
  normalizeSearchText(item?.category).includes("bebida");

const shouldShowProductTrustMeta = (item) =>
  !isBeverageProduct(item) && !hasTrendingPolicy(item) && !hasTopDealPolicy(item);

const getTopDealStickerLabel = (item, size = "M") => {
  const discountPercent = getDiscountPercentForSize(item, size);
  if (discountPercent > 0) return `-${discountPercent}%`;

  const discount = item?.directDiscount;
  const value = num(discount?.value);
  if (!discount || value <= 0) return "";

  if (discount.discountType === "PERCENT") return `-${Math.round(value)}%`;
  return "";
};

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const getTrendingPriceBand = (item) => {
  const band = Number(item?.trendingPricing?.band);
  return Number.isFinite(band) && band > 0 ? band : DEFAULT_TRENDING_PRICE_BAND;
};

const getTrendingBasePriceBySize = (item) => {
  const pricing = item?.trendingPricing;
  if (pricing?.basePriceBySize && typeof pricing.basePriceBySize === "object") {
    return pricing.basePriceBySize;
  }

  return item?.priceBySize || {};
};

const getHalfBasePriceBySize = (item) => {
  if (item?.trendingPricing) {
    return getTrendingBasePriceBySize(item);
  }

  return item?.priceBySize || {};
};

const priceForHalfSize = (item, size = "M") =>
  priceForSize(getHalfBasePriceBySize(item), size);

const withFloatingTrendingPrice = (item) => {
  if (!item?.trendingPricing) return item;

  const band = getTrendingPriceBand(item);
  const basePriceBySize = getTrendingBasePriceBySize(item);
  const priceBySize = {};
  const currentAdjustmentBySize = {};

  Object.entries(basePriceBySize || {}).forEach(([size, price]) => {
    const basePrice = num(price);
    if (basePrice <= 0) return;

    const adjustment = roundMoney((Math.random() * band * 2) - band);
    currentAdjustmentBySize[size] = adjustment;
    priceBySize[size] = roundMoney(Math.max(0, basePrice + adjustment));
  });

  if (!Object.keys(priceBySize).length) return item;

  return {
    ...item,
    priceBySize,
    trendingPricing: {
      ...item.trendingPricing,
      band,
      basePriceBySize,
      currentAdjustmentBySize,
      currentPriceBySize: priceBySize,
      updatedAt: new Date().toISOString(),
    },
  };
};

const withFloatingTrendingPrices = (items = []) =>
  items.map((item) => withFloatingTrendingPrice(item));

const mergeTrendingIntoMenu = (menuItems = [], trendingItems = []) => {
  const trendingByPizzaId = new Map(
    trendingItems
      .map((item) => [Number(item?.pizzaId), item])
      .filter(([pizzaId]) => Number.isInteger(pizzaId) && pizzaId > 0)
  );

  return menuItems.map((item) => {
    const trendingItem = trendingByPizzaId.get(Number(item?.pizzaId));
    if (!trendingItem) return item;

    return {
      ...item,
      ...trendingItem,
      directDiscount: null,
      originalPriceBySize: null,
      categoryId: item.categoryId,
      category: item.category,
      categoryPosition: item.categoryPosition,
      categoryCustomizable: item.categoryCustomizable,
      categoryHalfAndHalf: item.categoryHalfAndHalf,
    };
  });
};

const hasTrendingPolicy = (item) =>
  Boolean(item?.trendingPricing && item?.trend);

const hasTopDealPolicy = (item) =>
  Boolean(item?.directDiscount && !hasTrendingPolicy(item));

const getTopDealId = (item) => {
  const id = Number(item?.directDiscount?.id ?? item?.directDiscountId ?? item?.topDealId);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getTopDealRemainingQuantity = (item) => {
  if (!hasTopDealPolicy(item)) return null;

  const remaining = Number(item?.directDiscount?.remainingQuantity);
  return Number.isInteger(remaining) && remaining >= 0 ? remaining : null;
};

const getPurchaseMaxQty = (item, reservedTopDealQty = 0) => {
  let max = 12;
  const rawStock = Number(item?.stock);
  const remainingTopDealQty = getTopDealRemainingQuantity(item);
  const reserved = Math.max(0, Number(reservedTopDealQty || 0));

  if (Number.isFinite(rawStock) && rawStock > 0) {
    max = Math.min(max, rawStock);
  }

  if (remainingTopDealQty != null) {
    max = Math.min(max, Math.max(0, remainingTopDealQty - reserved));
  }

  return Math.max(0, max);
};

const getFeedDisplaySize = (item) => {
  if (hasTrendingPolicy(item)) {
    return getHighestPricedSize(getTrendingBasePriceBySize(item));
  }

  return getHighestPricedSize(item?.originalPriceBySize || item?.priceBySize);
};

const getFeedSortPrice = (item) =>
  priceForSize(item?.priceBySize, getFeedDisplaySize(item));

const getFeedPriority = (item) => {
  if (hasTrendingPolicy(item)) return 0;
  if (hasTopDealPolicy(item)) return 1;
  return 2;
};

const sortFeedItems = (items = []) =>
  items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftPriority = getFeedPriority(left.item);
      const rightPriority = getFeedPriority(right.item);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      if (leftPriority === 0) {
        const leftRank = Number(left.item?.trend?.rank || Number.MAX_SAFE_INTEGER);
        const rightRank = Number(right.item?.trend?.rank || Number.MAX_SAFE_INTEGER);

        if (leftRank !== rightRank) return leftRank - rightRank;
      }

      if (leftPriority === 1) {
        const leftSize = getDealSize(left.item);
        const rightSize = getDealSize(right.item);
        const byDiscount =
          getDiscountPercentForSize(right.item, rightSize) -
          getDiscountPercentForSize(left.item, leftSize);

        if (byDiscount !== 0) return byDiscount;
      }

      const byPrice = getFeedSortPrice(right.item) - getFeedSortPrice(left.item);
      if (byPrice !== 0) return byPrice;

      const byName = String(left.item?.name || "").localeCompare(
        String(right.item?.name || ""),
        "es",
        { sensitivity: "base" }
      );
      if (byName !== 0) return byName;

      return left.index - right.index;
    })
    .map(({ item }) => item);

const getTrendingPricingSnapshot = (item, size) => {
  if (!item?.trendingPricing) return null;

  const basePriceBySize = getTrendingBasePriceBySize(item);
  const basePrice = priceForSize(basePriceBySize, size);
  const chargedPrice = priceForSize(item.priceBySize, size);
  const band = getTrendingPriceBand(item);
  const adjustment =
    item.trendingPricing.currentAdjustmentBySize?.[size] != null
      ? num(item.trendingPricing.currentAdjustmentBySize[size])
      : roundMoney(chargedPrice - basePrice);

  return {
    mode: item.trendingPricing.mode || "FLOATING_BAND",
    rank: item.trend?.rank || null,
    sourceCategoryId: item.sourceCategoryId ?? item.categoryId ?? null,
    sourceCategory: item.sourceCategory || item.category || "",
    band,
    size,
    basePrice,
    chargedPrice,
    adjustment: roundMoney(adjustment),
    floorPrice: roundMoney(Math.max(0, basePrice - band)),
    ceilingPrice: roundMoney(basePrice + band),
    label:
      adjustment > 0
        ? "ADICIONAL_TRENDING"
        : adjustment < 0
        ? "ABONO_TRENDING"
        : "SIN_AJUSTE_TRENDING",
    lockedAt: new Date().toISOString(),
  };
};

const freezeProductSelectionPrice = (item) => {
  if (!item || typeof item !== "object") return null;

  return {
    ...item,
    priceBySize: { ...(item.priceBySize || {}) },
    originalPriceBySize: { ...(item.originalPriceBySize || {}) },
    trendingPricing:
      item.trendingPricing && typeof item.trendingPricing === "object"
        ? {
            ...item.trendingPricing,
            basePriceBySize: { ...(item.trendingPricing.basePriceBySize || {}) },
            currentPriceBySize: { ...(item.trendingPricing.currentPriceBySize || {}) },
            currentAdjustmentBySize: {
              ...(item.trendingPricing.currentAdjustmentBySize || {}),
            },
          }
        : item.trendingPricing || null,
    trend:
      item.trend && typeof item.trend === "object"
        ? { ...item.trend }
        : item.trend || null,
    directDiscount:
      item.directDiscount && typeof item.directDiscount === "object"
        ? { ...item.directDiscount }
        : item.directDiscount || null,
    productTags: Array.isArray(item.productTags) ? [...item.productTags] : item.productTags,
  };
};

const formatTrendingAdjustmentLabel = (trendingPricing) => {
  if (!trendingPricing) return "";

  const adjustment = roundMoney(trendingPricing.adjustment);
  if (adjustment === 0) return "Precio trending sin ajuste";

  const abs = Math.abs(adjustment).toFixed(2);
  return adjustment > 0
    ? `Adicional trending +EUR ${abs}`
    : `Abono trending -EUR ${abs}`;
};

const formatDurationMs = (value) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}D ${hours}H`;
  }

  if (hours > 0) {
    return `${hours}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
  }

  return `${minutes}M ${String(seconds).padStart(2, "0")}S`;
};

const getZonedDate = (nowMs) => {
  const zoned = new Date(nowMs).toLocaleString("sv-SE", {
    timeZone: INCENTIVE_TIME_ZONE,
  });

  return new Date(zoned.replace(" ", "T"));
};

const getIncentiveWindowTimeLeftMs = (incentive, nowMs) => {
  if (!incentive || incentive.windowEnd == null) return null;

  const windowEnd = Number(incentive.windowEnd);
  if (!Number.isFinite(windowEnd)) return null;

  const zonedNow = getZonedDate(nowMs);
  const minutesNow = zonedNow.getHours() * 60 + zonedNow.getMinutes();
  const windowStart =
    incentive.windowStart == null ? null : Number(incentive.windowStart);

  const crossesMidnight =
    Number.isFinite(windowStart) && windowStart > windowEnd;
  const minutesLeft = crossesMidnight
    ? minutesNow < windowEnd
      ? windowEnd - minutesNow
      : 24 * 60 - minutesNow + windowEnd
    : windowEnd - minutesNow;

  return Math.max(
    0,
    minutesLeft * 60 * 1000 -
      zonedNow.getSeconds() * 1000 -
      zonedNow.getMilliseconds()
  );
};

const getActiveIncentiveTimeLeftMs = (incentive, nowMs) => {
  if (!incentive) return null;

  const candidates = [];
  if (incentive.endsAt) {
    const endsAtMs = new Date(incentive.endsAt).getTime();
    if (Number.isFinite(endsAtMs)) {
      candidates.push(endsAtMs - nowMs);
    }
  }

  const windowLeft = getIncentiveWindowTimeLeftMs(incentive, nowMs);
  if (windowLeft != null) candidates.push(windowLeft);

  if (!candidates.length) return null;
  return Math.max(0, Math.min(...candidates));
};

const getNextIncentiveStartsInMs = (nextIncentive, nowMs) => {
  if (!nextIncentive || nextIncentive.startsInMs == null) return null;

  const startsInMs = Number(nextIncentive.startsInMs);
  if (!Number.isFinite(startsInMs)) return null;

  const fetchedAtMs = Number(nextIncentive.fetchedAtMs || nowMs);
  return Math.max(0, startsInMs - Math.max(0, nowMs - fetchedAtMs));
};

const scaleIngredientPriceForSize = (basePrice, size = INGREDIENT_BASE_SIZE) => {
  const price = num(basePrice);
  if (price <= 0) return 0;

  const baseDiameter =
    INGREDIENT_SIZE_DIAMETERS_CM[INGREDIENT_BASE_SIZE] || 30;
  const targetDiameter =
    INGREDIENT_SIZE_DIAMETERS_CM[size] || baseDiameter;
  const areaFactor = (targetDiameter * targetDiameter) / (baseDiameter * baseDiameter);

  return roundMoney(price * areaFactor);
};

const capWords = (value = "") => {
  const lowerWords = ["de", "del", "y", "con", "al"];

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, index) => {
      if (index !== 0 && lowerWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

const joinWithY = (items = []) => {
  const clean = items.filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} y ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} y ${clean[clean.length - 1]}`;
};

const formatCustomBuilderSubject = (categoryName) => {
  const clean = String(categoryName || "").trim();
  if (!clean) return "producto";

  return clean;
};

const seededPick = (seed, items) => {
  if (!items.length) return "";
  const value = Math.abs(Number(seed) || 1);
  return items[value % items.length];
};

const CRUSH_CLOSERS = [
  "First taste, first love.",
  "Sabor que no se olvida.",
  "Te mira y caes.",
  "Una mordida y listo.",
  "Crush confirmado en 10 segundos.",
  "Te enamora sin avisar.",
];

const ALLERGEN_LABELS = {
  CELERY: "apio",
  CRUSTACEANS: "crustaceos",
  EGG: "huevo",
  FISH: "pescado",
  GLUTEN: "gluten",
  LUPIN: "altramuces",
  MILK: "leche",
  MOLLUSCS: "moluscos",
  MUSTARD: "mostaza",
  NUTS: "frutos secos",
  PEANUTS: "cacahuetes",
  SESAME: "sesamo",
  SHELLFISH: "marisco",
  SOY: "soja",
  SULFITES: "sulfitos",
};

const normalizeAllergenLabel = (value) => {
  const key = String(value || "").trim().toUpperCase();
  if (!key) return "";
  return ALLERGEN_LABELS[key] || key.toLowerCase().replace(/_/g, " ");
};

const getProductAllergens = (item) => {
  const allergenSet = new Set();

  (item?.ingredients || []).forEach((ingredient) => {
    (Array.isArray(ingredient?.allergens) ? ingredient.allergens : []).forEach((allergen) => {
      const label = normalizeAllergenLabel(allergen);
      if (label) allergenSet.add(label);
    });
  });

  return [...allergenSet].sort((left, right) =>
    left.localeCompare(right, "es", { sensitivity: "base" })
  );
};

const getIngredientAllergens = (ingredient) =>
  (Array.isArray(ingredient?.allergens) ? ingredient.allergens : [])
    .map((allergen) => normalizeAllergenLabel(allergen))
    .filter(Boolean);

const normalizeAllergenList = (allergens = []) =>
  [
    ...new Set(
      (Array.isArray(allergens) ? allergens : [])
        .map((allergen) => normalizeAllergenLabel(allergen))
        .filter(Boolean)
    ),
  ].sort((left, right) =>
    left.localeCompare(right, "es", { sensitivity: "base" })
  );

const getAllergensFromIngredients = (ingredients = []) => {
  const allergenSet = new Set();

  ingredients.forEach((ingredient) => {
    getIngredientAllergens(ingredient).forEach((allergen) => {
      allergenSet.add(allergen);
    });
  });

  return [...allergenSet].sort((left, right) =>
    left.localeCompare(right, "es", { sensitivity: "base" })
  );
};

const renderAllergenNotice = (allergens = []) => {
  const normalizedAllergens = normalizeAllergenList(allergens);
  if (normalizedAllergens.length === 0) return null;

  return (
    <div className="sf-allergenAlert" role="note" aria-label="Aviso de alergenos">
      <span>Alergenos</span>
      <div>
        {normalizedAllergens.map((allergen) => (
          <strong key={allergen}>{allergen}</strong>
        ))}
      </div>
    </div>
  );
};

const normalizeProductTagList = (productTags = []) =>
  (Array.isArray(productTags) ? productTags : [])
    .map((tag) => {
      const value = String(tag || "").trim();
      if (!value) return null;
      return {
        value,
        label: PRODUCT_TAG_LABELS[value] || value,
      };
    })
    .filter(Boolean);

const renderProductTagNotice = (productTags = []) => {
  const tags = normalizeProductTagList(productTags);
  if (tags.length === 0) return null;

  return (
    <div className="sf-productTagNotice" role="note" aria-label="Avisos especiales">
      <span>Avisos especiales</span>
      <div>
        {tags.map((tag) => (
          <strong key={tag.value} className={`sf-productTagNotice__chip sf-productTagNotice__chip--${tag.value}`}>
            {tag.label}
          </strong>
        ))}
      </div>
    </div>
  );
};

const formatCustomPlacementLabel = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "FULL") return "Entera";
  if (raw === "LEFT") return "Mitad izquierda";
  if (raw === "RIGHT") return "Mitad derecha";
  return value ? String(value) : "";
};

const formatCustomQuantityLabel = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "DOUBLE") return "Doble";
  if (raw === "SIMPLE") return "Simple";
  return value ? String(value) : "";
};

const buildCustomIngredientDetail = (ingredient) => {
  const name = String(ingredient?.name || ingredient?.label || "Ingrediente").trim();
  const placement =
    ingredient?.placementLabel || formatCustomPlacementLabel(ingredient?.placement);
  const quantity =
    ingredient?.quantityLabel || formatCustomQuantityLabel(ingredient?.quantity);
  const meta = [placement, quantity].filter(Boolean).join(" - ");

  return {
    ingredientId: ingredient?.ingredientId ?? ingredient?.id ?? null,
    name,
    category: ingredient?.category || "OTROS",
    placement: ingredient?.placement || "",
    quantity: ingredient?.quantity || "SIMPLE",
    placementLabel: placement,
    quantityLabel: quantity,
    label: meta ? `${name}: ${meta}` : name,
  };
};

const normalizeIngredientKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isRandomSelectionIngredient = (ingredient = {}) => {
  const canonicalKey = String(ingredient?.canonicalKey || "");
  if (RANDOM_SELECTION_CANONICAL_KEYS.has(canonicalKey)) return true;

  return /^random selection [123]$/.test(
    normalizeIngredientKey(ingredient?.name)
  );
};

const hasRandomSelectionIngredients = (item = {}) =>
  Array.isArray(item?.ingredients) &&
  item.ingredients.some(isRandomSelectionIngredient);

const buildPizzaLine = (item) => {
  if (hasRandomSelectionIngredients(item)) {
    return {
      line: "Pizza con ingredientes de random selection.",
      closer: "",
    };
  }

  const ingredients = Array.isArray(item?.ingredients)
    ? item.ingredients.map((ingredient) => capWords(ingredient?.name)).filter(Boolean)
    : [];

  const line = item?.description
    ? item.description
    : ingredients.length
    ? `${joinWithY(ingredients)}.`
    : "Ingredientes seleccionados a mano.";

  return {
    line,
    closer: seededPick((Number(item?.pizzaId) || 1) + 13, CRUSH_CLOSERS),
  };
};

const getAvailableSizes = (item) => {
  const explicitSizes = Array.isArray(item?.selectSize)
    ? item.selectSize.filter(Boolean)
    : [];

  if (explicitSizes.length) return explicitSizes;

  return Object.entries(item?.priceBySize || {})
    .filter(([, value]) => value !== "" && value != null && num(value) > 0)
    .map(([size]) => size);
};

const priceForExtraSize = (extra, size) => {
  const sized = num(extra?.priceBySize?.[size]);
  if (sized > 0) return sized;
  return num(extra?.price);
};

const getCustomIngredientPrice = (ingredient) => {
  const base = num(ingredient?.basePrice ?? ingredient?.costPrice);
  const quantityMultiplier = ingredient?.quantity === "DOUBLE" ? 2 : 1;
  const placementMultiplier = ingredient?.placement === "FULL" ? 1 : 0.5;

  if (!ingredient?.placement) return 0;
  return base * quantityMultiplier * placementMultiplier;
};

const getCartLineQty = (line) => {
  const qty = Number(line?.qty ?? line?.quantity ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const getTopDealCartQuantity = (cartLines = [], discountId = null) => {
  const numericDiscountId = Number(discountId);
  if (!Number.isInteger(numericDiscountId) || numericDiscountId <= 0) return 0;

  return cartLines.reduce(
    (sum, line) => (getTopDealId(line) === numericDiscountId ? sum + getCartLineQty(line) : sum),
    0
  );
};

const normalizeRepeatPhoneInput = (value) => {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("0034") && digits.length > 9) {
    digits = digits.slice(4);
  }

  if (digits.startsWith("34") && digits.length === 11) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 9);
};

const normalizeSearchText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const isPizzaLikeCategory = (value = "") => {
  const normalized = normalizeSearchText(value);
  return normalized.includes("pizza");
};

const getCustomCategoryKey = (item) => {
  const categoryId = Number(item?.categoryId);
  if (Number.isInteger(categoryId) && categoryId > 0) {
    return `category:${categoryId}`;
  }

  return `category-name:${normalizeSearchText(item?.category || "productos")}`;
};

const getLowestPriceBySize = (items = []) => {
  const result = {};

  items.forEach((item) => {
    getAvailableSizes(item).forEach((size) => {
      const price = priceForSize(item.priceBySize, size);
      if (price <= 0) return;

      if (!result[size] || price < result[size]) {
        result[size] = price;
      }
    });
  });

  return result;
};

const isHalfPizzaCandidate = (item) => {
  if (item?.categoryHalfAndHalf !== true) {
    return false;
  }

  const sizes = getAvailableSizes(item);
  if (!sizes.length) return false;

  return sizes.some((size) => priceForHalfSize(item, size) > 0);
};

const normalizeCartLine = (line, index = 0) => {
  const qty = getCartLineQty(line);
  const price = num(line?.price ?? line?.unitPrice ?? line?.amount);
  const source = line?.source || "";
  const type = line?.type || "";
  const extras = Array.isArray(line?.extras)
    ? line.extras.map((extra) => ({
        id: extra?.id ?? extra?.ingredientId ?? extra?.code ?? `extra-${index}`,
        ingredientId: extra?.ingredientId ?? extra?.id ?? null,
        name: extra?.name ?? extra?.label ?? extra?.ingredientName ?? "Extra",
        label: extra?.label ?? extra?.name ?? extra?.ingredientName ?? "Extra",
        side: extra?.side || extra?.placement || "",
        placement: extra?.placement || extra?.side || "",
        allergens: Array.isArray(extra?.allergens) ? extra.allergens : [],
        price: num(extra?.price ?? extra?.amount),
      }))
    : [];
  const ingredients = Array.isArray(line?.ingredients)
    ? line.ingredients.map((ingredient) => ({
        id: ingredient?.id ?? ingredient?.ingredientId ?? null,
        ingredientId: ingredient?.ingredientId ?? ingredient?.id ?? null,
        name: ingredient?.name ?? ingredient?.label ?? "Ingrediente",
        category: ingredient?.category || "OTROS",
        placement: ingredient?.placement || "",
        quantity: ingredient?.quantity || "SIMPLE",
        placementLabel: ingredient?.placementLabel || "",
        quantityLabel: ingredient?.quantityLabel || "",
        basePrice: num(ingredient?.basePrice),
        price: num(ingredient?.price),
        allergens: Array.isArray(ingredient?.allergens) ? ingredient.allergens : [],
      }))
    : [];
  const customDetails =
    line?.customDetails && typeof line.customDetails === "object"
      ? {
          ...line.customDetails,
          ingredients: Array.isArray(line.customDetails.ingredients)
            ? line.customDetails.ingredients.map(buildCustomIngredientDetail)
            : ingredients.map(buildCustomIngredientDetail),
        }
      : ingredients.length
      ? {
          ingredients: ingredients.map(buildCustomIngredientDetail),
          summary: ingredients.map((ingredient) => buildCustomIngredientDetail(ingredient).label).join(" | "),
        }
      : null;
  const extrasTotal = extras.reduce((sum, extra) => sum + num(extra.price), 0);
  const subtotal = num(line?.subtotal) || (price + extrasTotal) * qty;

  return {
    cartLineId: line?.cartLineId || line?.repeatLineId || `${Date.now()}-${index}`,
    pizzaId: line?.pizzaId ?? line?.id ?? null,
    mainPizzaId: line?.mainPizzaId ?? null,
    mainName: line?.mainName || "",
    leftPizzaId: line?.leftPizzaId ?? null,
    rightPizzaId: line?.rightPizzaId ?? null,
    leftName: line?.leftName || "",
    rightName: line?.rightName || "",
    name: line?.name || line?.label || "Producto",
    categoryId: line?.categoryId ?? null,
    category: line?.category || "",
    size: line?.size || line?.selectedSize || "M",
    qty,
    price,
    extras,
    ingredients,
    allergens: Array.isArray(line?.allergens) ? line.allergens : [],
    subtotal,
    type,
    image: line?.image || "",
    source,
    customDetails,
    customMeta: line?.customMeta && typeof line.customMeta === "object" ? line.customMeta : null,
    halfMeta: line?.halfMeta && typeof line.halfMeta === "object" ? line.halfMeta : null,
    incentiveId: line?.incentiveId ?? null,
    rewardPizzaId: line?.rewardPizzaId ?? null,
    promoId: line?.promoId ?? null,
    promoItems: Array.isArray(line?.promoItems) ? line.promoItems : [],
    directDiscount: line?.directDiscount || null,
    trendingPricing:
      line?.trendingPricing && typeof line.trendingPricing === "object"
        ? line.trendingPricing
        : null,
  };
};

const isIncentiveRewardCartLine = (line) => {
  const source = String(line?.source || "").trim();
  const type = String(line?.type || "").trim();

  return source === "incentive_reward" || type === "INCENTIVE_REWARD";
};

const isCouponCartLine = (line) => {
  const source = String(line?.source || "").trim();
  const type = String(line?.type || "").trim();

  return source === "coupon" || type === "COUPON";
};

const isCouponEligibleCartLine = (line) => {
  const source = String(line?.source || "").trim().toLowerCase();
  const type = String(line?.type || "").trim().toUpperCase();
  const cartLineId = String(line?.cartLineId || "").trim().toLowerCase();

  if (isCouponCartLine(line)) return false;
  if (isIncentiveRewardCartLine(line)) return false;
  if (source === "queue_boost" || type === "QUEUE_BOOST") return false;
  if (source === "promo" || type === "PROMO" || line?.promoId || cartLineId.startsWith("promo-")) return false;
  if (Array.isArray(line?.promoItems) && line.promoItems.length > 0) return false;
  if (["offer", "discount", "direct_discount", "direct-discount", "top_deal", "topdeal"].includes(source)) return false;
  if (["OFFER", "DISCOUNT", "DIRECT_DISCOUNT", "DIRECT-DISCOUNT", "TOP_DEAL", "TOPDEAL"].includes(type)) return false;
  if (line?.directDiscount) return false;

  return num(line?.subtotal) > 0;
};

const isIncentiveEligibleCartLine = (line) => {
  const source = String(line?.source || "").trim();
  const type = String(line?.type || "").trim();

  if (NON_INCENTIVE_LINE_SOURCES.has(source)) return false;
  if (NON_INCENTIVE_LINE_TYPES.has(type)) return false;
  if (line?.directDiscount) return false;

  return true;
};

const getCartLinePayableTotal = (line) => {
  if (isIncentiveRewardCartLine(line)) return 0;
  return num(line?.subtotal);
};

function formatPromoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

const formatCouponBenefit = (coupon) => {
  if (!coupon) return "Sin beneficio disponible";

  if (coupon.kind === "AMOUNT") {
    return `Descuento fijo (-EUR ${num(coupon.amount).toFixed(2)})`;
  }

  if (coupon.kind === "PERCENT") {
    const percent = num(coupon.percent);
    const cap = coupon.maxAmount != null ? ` (tope EUR ${num(coupon.maxAmount).toFixed(2)})` : "";
    return `Descuento ${percent}%${cap}`;
  }

  return coupon.title || "Cupon";
};

const formatCouponExpiry = (value) => {
  if (!value) return "Sin caducidad definida";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin caducidad definida";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const isPromoCategoryItem = (promoItem) =>
  ["CATEGORY", "CHOICE"].includes(String(promoItem?.type || "").trim().toUpperCase());

const getPromoCategoryName = (promoItem) =>
  String(promoItem?.categoryName || promoItem?.category || promoItem?.name || "Categoria").trim();

const getPromoOptionIds = (promoItem) =>
  Array.isArray(promoItem?.optionProductIds)
    ? promoItem.optionProductIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];

const getPromoRequiredChoiceCount = (promoItem) => {
  const quantity = Number(promoItem?.quantity || promoItem?.qty || 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
};

const getPromoChoiceKey = (promoItem, index) =>
  `promo-choice-${
    getPromoOptionIds(promoItem).join("-") ||
    promoItem?.categoryId ||
    normalizeSearchText(getPromoCategoryName(promoItem)) ||
    index
  }-${index}`;

const getPromoCategoryOptions = (promoItem, menu = []) => {
  const categoryId = Number(promoItem?.categoryId);
  const categoryName = normalizeSearchText(getPromoCategoryName(promoItem));
  const requestedSize = String(promoItem?.size || "").trim();
  const optionIds = getPromoOptionIds(promoItem);

  return menu
    .filter((item) => {
      if (optionIds.length && !optionIds.includes(Number(item?.pizzaId))) return false;

      const itemCategoryId = Number(item?.categoryId);
      const idMatch =
        Number.isInteger(categoryId) &&
        categoryId > 0 &&
        Number.isInteger(itemCategoryId) &&
        itemCategoryId === categoryId;
      const nameMatch =
        categoryName &&
        normalizeSearchText(item?.category || item?.categoryName) === categoryName;

      if (!optionIds.length && !idMatch && !nameMatch) return false;
      if (!requestedSize) return true;
      return getAvailableSizes(item).includes(requestedSize);
    })
    .sort((left, right) =>
      String(left.name || "").localeCompare(String(right.name || ""), "es", {
        sensitivity: "base",
      })
    );
};

const getPromoItemLabel = (item) =>
  isPromoCategoryItem(item)
    ? `Elige ${getPromoRequiredChoiceCount(item)} de ${getPromoCategoryName(item)}${item.size ? ` ${item.size}` : ""}`
    : `${item.quantity || 1}x ${item.name}${item.size ? ` ${item.size}` : ""}`;

const findPromoMenuItem = (promoItem, menu = []) => {
  if (isPromoCategoryItem(promoItem)) {
    return getPromoCategoryOptions(promoItem, menu)[0] || null;
  }

  const itemId = Number(promoItem?.pizzaId ?? promoItem?.id ?? promoItem?.productId);
  if (itemId) {
    const byId = menu.find((item) => Number(item?.pizzaId) === itemId);
    if (byId) return byId;
  }

  const itemName = normalizeSearchText(promoItem?.name);
  if (!itemName) return null;

  return menu.find((item) => normalizeSearchText(item?.name) === itemName) || null;
};

const getPromoOriginalTotal = (promo, menu = []) => {
  const promoItems = Array.isArray(promo?.items) ? promo.items : [];

  return roundMoney(
    promoItems.reduce((sum, promoItem) => {
      const qty = Math.max(1, Number(promoItem?.quantity || promoItem?.qty || 1));

      if (isPromoCategoryItem(promoItem)) {
        const prices = getPromoCategoryOptions(promoItem, menu)
          .map((item) => {
            const size = promoItem?.size || getDealSize(item);
            return (
              priceForSize(item?.originalPriceBySize, size) ||
              priceForSize(item?.priceBySize, size)
            );
          })
          .filter((price) => price > 0);
        const price = prices.length ? Math.min(...prices) : num(promoItem?.unitPrice);
        return sum + price * qty;
      }

      const menuItem = findPromoMenuItem(promoItem, menu);
      const size = promoItem?.size || getDealSize(menuItem);
      const price =
        priceForSize(menuItem?.originalPriceBySize, size) ||
        priceForSize(menuItem?.priceBySize, size) ||
        num(promoItem?.price || promoItem?.unitPrice || promoItem?.amount);

      return sum + price * qty;
    }, 0)
  );
};

const getPromoDiscountPercent = (promo, menu = []) => {
  const originalTotal = getPromoOriginalTotal(promo, menu);
  const promoPrice = num(promo?.totalPrice);

  if (originalTotal <= promoPrice || originalTotal <= 0 || promoPrice <= 0) return 0;
  return Math.round(((originalTotal - promoPrice) / originalTotal) * 100);
};

const sortTopDealsByDiscount = (items = []) =>
  items.slice().sort((left, right) => {
    const leftSize = getDealSize(left);
    const rightSize = getDealSize(right);
    const byPercent =
      getDiscountPercentForSize(right, rightSize) -
      getDiscountPercentForSize(left, leftSize);
    if (byPercent !== 0) return byPercent;

    return (
      getDiscountSavingForSize(right, rightSize) -
      getDiscountSavingForSize(left, leftSize)
    );
  });

function countryCodeToFlag(code) {
  const normalized = String(code || "").trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(normalized)) return "";

  return String.fromCodePoint(
    ...[...normalized].map((char) => 127397 + char.charCodeAt(0))
  );
}

const COUNTRY_FLAG_MAP = {
  ES: flagEs,
};

function CountryFlag({ countryCode }) {
  const normalized = String(countryCode || "").trim().toUpperCase();
  const src = COUNTRY_FLAG_MAP[normalized];

  // ✅ si existe imagen → usar imagen
  if (src) {
    return <img className="sf-countryFlag" src={src} alt="" aria-hidden="true" />;
  }

  // ✅ fallback emoji
  const emoji = countryCodeToFlag(normalized);

  if (!emoji) return null;

  return (
    <span className="sf-countryFlag sf-countryFlag--emoji" aria-hidden="true">
      {emoji}
    </span>
  );
}

export default function StorePage() {
  const { partnerSlug, storeSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const orderSelection = useMemo(() => {
    const state = location.state && typeof location.state === "object" ? location.state : {};
    if (state.serviceMode) return state;
    return readDeliverySelection({ partnerSlug, storeSlug }) || state;
  }, [location.state, partnerSlug, storeSlug]);

  const [menu, setMenu] = useState([]);
  const [trending, setTrending] = useState([]);
  const trendingRef = useRef([]);
  const [upcoming, setUpcoming] = useState([]);
  const [promos, setPromos] = useState([]);
  const [promoPickerOpen, setPromoPickerOpen] = useState(false);
  const [pendingPromo, setPendingPromo] = useState(null);
  const [promoPickerSelections, setPromoPickerSelections] = useState({});
  const [promoPickerMessage, setPromoPickerMessage] = useState("");
  const [store, setStore] = useState(null);
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [search, setSearch] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState("");
  const [couponInfoOpen, setCouponInfoOpen] = useState(false);
  const [couponInfoData, setCouponInfoData] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [hasDeliveryFreeCouponAvailable, setHasDeliveryFreeCouponAvailable] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [reservationDate, setReservationDate] = useState(null);
  const [reservationTime, setReservationTime] = useState("");
  const [reservationPartySize, setReservationPartySize] = useState(2);
  const [reservationName, setReservationName] = useState("");
  const [reservationPhone, setReservationPhone] = useState("");
  const [reservationAvailability, setReservationAvailability] = useState([]);
  const [reservationCapacity, setReservationCapacity] = useState(0);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [reservationMessage, setReservationMessage] = useState("");
  const [reservationMissingFields, setReservationMissingFields] = useState([]);
  const [reservationShaking, setReservationShaking] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatPhone, setRepeatPhone] = useState("");
  const [repeatDraft, setRepeatDraft] = useState(null);
  const [repeatOptions, setRepeatOptions] = useState([]);
  const [repeatMessage, setRepeatMessage] = useState("");
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [repeatSearched, setRepeatSearched] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutTrackingCode, setCheckoutTrackingCode] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutProfileOpen, setCheckoutProfileOpen] = useState(false);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [cashConfirmationOpen, setCashConfirmationOpen] = useState(false);
  const [pendingCashProfile, setPendingCashProfile] = useState(null);
  const [checkoutPaymentMode, setCheckoutPaymentMode] = useState("card");
  const [checkoutProfileForm, setCheckoutProfileForm] = useState({
    name: "",
    phone: "",
  });
  const [savedCustomerProfile, setSavedCustomerProfile] = useState(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProductSnapshot, setSelectedProductSnapshot] = useState(null);
  const [productSelection, setProductSelection] = useState({
    size: "",
    qty: 1,
    extras: {},
  });
  const [extrasAvail, setExtrasAvail] = useState([]);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [showAllExtras, setShowAllExtras] = useState(false);
  const [halfModalOpen, setHalfModalOpen] = useState(false);
  const [halfAIndex, setHalfAIndex] = useState(0);
  const [halfBIndex, setHalfBIndex] = useState(1);
  const [halfQty, setHalfQty] = useState(1);
  const [halfSize, setHalfSize] = useState("");
  const [halfExtras, setHalfExtras] = useState({ A: {}, B: {} });
  const [halfExtrasAvail, setHalfExtrasAvail] = useState([]);
  const [halfExtrasLoading, setHalfExtrasLoading] = useState(false);
  const [openHalfExtrasA, setOpenHalfExtrasA] = useState(false);
  const [openHalfExtrasB, setOpenHalfExtrasB] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customCategoryKey, setCustomCategoryKey] = useState("");
  const [customCategoryUses, setCustomCategoryUses] = useState([]);
  const [customUsesLoading, setCustomUsesLoading] = useState(false);
  const [customIngredientsCatalog, setCustomIngredientsCatalog] = useState([]);
  const [customSize, setCustomSize] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customIngredients, setCustomIngredients] = useState({});
  const [customPendingIngredients, setCustomPendingIngredients] = useState({});
  const [customOpenSection, setCustomOpenSection] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [bootsOpen, setBootsOpen] = useState(false);
  const [bootsQueuePosition, setBootsQueuePosition] = useState(null);
  const [bootsQueueLoading, setBootsQueueLoading] = useState(false);
  const [bootsTargetPosition, setBootsTargetPosition] = useState("1");
  const [bootsMessage, setBootsMessage] = useState("");
  const [boostSettings, setBoostSettings] = useState(DEFAULT_BOOST_SETTINGS);
  const [activeIncentive, setActiveIncentive] = useState(null);
  const [nextIncentive, setNextIncentive] = useState(null);
  const [storeAverageTicket, setStoreAverageTicket] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [incentiveNowMs, setIncentiveNowMs] = useState(() => Date.now());
  const [flippedId, setFlippedId] = useState(null);
  const [tick, setTick] = useState(false);
  const [lsfSurfaceDocked, setLsfSurfaceDocked] = useState(false);
  const [gridFocusMode, setGridFocusMode] = useState(false);
  const [gridFocusTransition, setGridFocusTransition] = useState("");
  const [gridFocusSwipePreview, setGridFocusSwipePreview] = useState(null);
  const [offerTabsManual, setOfferTabsManual] = useState(false);
  const [gridIncentiveOpen, setGridIncentiveOpen] = useState(false);
  const lsfSurfaceRef = useRef(null);
  const tabsScrollerRef = useRef(null);
  const tabsAutoPauseUntilRef = useRef(0);
  const tabsScrollRafRef = useRef(0);
  const tabsScrollSettleTimeoutRef = useRef(0);
  const tabsScrollOriginRef = useRef("");
  const ignoreTabsScrollUntilRef = useRef(0);
  const tabsDragRef = useRef(null);
  const suppressTabsClickUntilRef = useRef(0);
  const commercialTabClickTimeoutRef = useRef(0);
  const lastCommercialTabClickRef = useRef({ id: "", at: 0 });
  const commercialAutoSwitchAtRef = useRef(0);
  const gridSwipeRef = useRef(null);
  const gridStageRef = useRef(null);
  const gridFocusTransitionTimeoutRef = useRef(0);
  const halfSwipeRef = useRef(null);
  const suppressGridClickUntilRef = useRef(0);
  const incentiveZeroRefreshRef = useRef(false);
  const dismissedRewardIncentiveIdsRef = useRef(new Set());
  const autoCouponApplyRef = useRef("");
  const lsfSurfaceStickySuspended = Boolean(
    productModalOpen ||
      cartOpen ||
      checkoutProfileOpen ||
      checkoutLoading ||
      halfModalOpen ||
      customModalOpen ||
      repeatOpen ||
      scheduleOpen ||
      reservationOpen ||
      bootsOpen ||
      couponInfoOpen ||
      cashConfirmationOpen ||
      (portalReady && !termsAccepted)
  );
  const storefrontSeo = useMemo(
    () => buildStorefrontSeo({ partner, store, partnerSlug, storeSlug }),
    [partner, partnerSlug, store, storeSlug]
  );

  usePublicSeo(storefrontSeo);

  const resetMobileInputViewport = useCallback((input, { resetGridStage = false } = {}) => {
    input?.blur?.();

    const settleViewport = () => {
      if (resetGridStage) {
        gridStageRef.current?.scrollTo?.({
          top: 0,
          left: 0,
          behavior: "smooth",
        });
      }
      window.scrollTo?.({
        top: window.scrollY,
        left: 0,
        behavior: "auto",
      });
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(settleViewport);
    });
    window.setTimeout(settleViewport, 80);
    window.setTimeout(settleViewport, 260);
    window.setTimeout(settleViewport, 520);
  }, []);

  const submitGridFocusSearch = useCallback(
    (event) => {
      event.preventDefault();
      resetMobileInputViewport(event.currentTarget.querySelector(".sf-engineSearch"), {
        resetGridStage: true,
      });
    },
    [resetMobileInputViewport]
  );

  useEffect(() => {
    let rafId = 0;

    const updateDockedState = () => {
      rafId = 0;
      const surface = lsfSurfaceRef.current;
      if (!surface || window.innerWidth > 760 || lsfSurfaceStickySuspended) {
        setLsfSurfaceDocked(false);
        return;
      }

      const isScrolled = window.scrollY > 16;
      setLsfSurfaceDocked(isScrolled);
    };

    const requestUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateDockedState);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [lsfSurfaceStickySuspended]);

  useEffect(() => {
    if (portalReady && !termsAccepted) {
      setGridFocusMode(false);
      setGridFocusTransition("");
    }
  }, [portalReady, termsAccepted]);

  useEffect(() => {
    const closeDesktopGridFocus = () => {
      if (isGridFocusViewport()) return;
      setGridFocusMode(false);
      setGridFocusTransition("");
      setGridFocusSwipePreview(null);
      window.clearTimeout(gridFocusTransitionTimeoutRef.current);
    };

    closeDesktopGridFocus();
    window.addEventListener("resize", closeDesktopGridFocus);
    return () => window.removeEventListener("resize", closeDesktopGridFocus);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(gridFocusTransitionTimeoutRef.current);
      window.clearTimeout(commercialTabClickTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      setTermsAccepted(window.localStorage.getItem(STOREFRONT_TERMS_KEY) === "accepted");
    } catch {
      setTermsAccepted(false);
    }
  }, []);

  const acceptStorefrontTerms = useCallback(() => {
    try {
      window.localStorage.setItem(STOREFRONT_TERMS_KEY, "accepted");
    } catch {
      // Ignore storage failures; the current session can still continue.
    }
    setTermsAccepted(true);
  }, []);

  useEffect(() => {
    setPortalReady(false);
    const timer = window.setTimeout(() => setPortalReady(true), 900);
    return () => window.clearTimeout(timer);
  }, [partnerSlug, storeSlug]);

  const fetchIncentiveSnapshot = useCallback(async (partnerIdValue) => {
    const partnerId = Number(partnerIdValue);

    if (!partnerId) {
      setActiveIncentive(null);
      setNextIncentive(null);
      return;
    }

    try {
      const data = await api.get(`/api/incentives/active/one?partnerId=${partnerId}`);
      setActiveIncentive(data?.active || null);
      setNextIncentive(
        data?.next
          ? {
              ...data.next,
              fetchedAtMs: Date.now(),
            }
          : null
      );
    } catch (incentiveErr) {
      console.error(incentiveErr);
      setActiveIncentive(null);
      setNextIncentive(null);
    }
  }, []);

  useEffect(() => {
    if (!partnerSlug || !storeSlug) return;

    const loadStorefront = async () => {
      try {
        const [menuData, partnerData] = await Promise.all([
          api.get(`/stores/${partnerSlug}/${storeSlug}/menu`),
          api.get(`/partners/${partnerSlug}`),
        ]);

        const rawMenu = Array.isArray(menuData?.menu) ? menuData.menu : [];
        const nextTrending = Array.isArray(menuData?.trending)
          ? withFloatingTrendingPrices(menuData.trending)
          : [];
        const nextMenu = mergeTrendingIntoMenu(rawMenu, nextTrending);
        const nextUpcoming = Array.isArray(menuData?.upcoming)
          ? menuData.upcoming
          : [];
        const nextPromos = Array.isArray(menuData?.promos) ? menuData.promos : [];

        trendingRef.current = nextTrending;
        setMenu(nextMenu);
        setTrending(nextTrending);
        setUpcoming(nextUpcoming);
        setPromos(nextPromos);
        setStore(menuData?.store || null);
        setPartner(partnerData || null);
        setBoostSettings(menuData?.boostSettings || DEFAULT_BOOST_SETTINGS);
        setActiveIncentive(null);
        setNextIncentive(null);
        setStoreAverageTicket(num(menuData?.incentiveStats?.averageTicket));

        const partnerId = partnerData?.id;

        await fetchIncentiveSnapshot(partnerId);

      } catch (err) {
        console.error(err);
        setError("Error loading menu");
      }
    };

    loadStorefront();
  }, [fetchIncentiveSnapshot, partnerSlug, storeSlug]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIncentiveNowMs(Date.now());
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!partner?.id) return undefined;

    const intervalId = window.setInterval(() => {
      fetchIncentiveSnapshot(partner.id);
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchIncentiveSnapshot, partner?.id]);

  useEffect(() => {
    if (!partner?.id || !store?.id) return undefined;

    const sendPresence = () => {
      if (document.visibilityState === "hidden") return;

      const state = cartOpen || cart.length > 0 ? "cart" : "browsing";
      postStorefrontPresence({
        partnerId: partner.id,
        storeId: store.id,
        state,
      });
    };

    sendPresence();
    const intervalId = window.setInterval(sendPresence, 15000);
    document.addEventListener("visibilitychange", sendPresence);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", sendPresence);
    };
  }, [cart.length, cartOpen, partner?.id, store?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick(true);
      const currentTrending = trendingRef.current;
      const nextTrending = currentTrending.some((item) => item?.trendingPricing)
        ? withFloatingTrendingPrices(currentTrending)
        : currentTrending;
      trendingRef.current = nextTrending;
      setTrending(nextTrending);
      setMenu((currentMenu) => mergeTrendingIntoMenu(currentMenu, nextTrending));
      window.setTimeout(() => setTick(false), 600);
    }, TRENDING_PRICE_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const loadBootsQueuePosition = useCallback(async () => {
    if (!partner?.id || !store?.id) {
      setBootsQueuePosition(null);
      return;
    }

    try {
      setBootsQueueLoading(true);
      const params = new URLSearchParams({
        partnerId: String(partner.id),
        storeId: String(store.id),
        take: "200",
      });
      const data = await api.get(`/api/myorders/pending?${params.toString()}`);
      const pendingCount = Number(
        data?.queueSize ?? (Array.isArray(data?.items) ? data.items.length : 0)
      );

      setBootsQueuePosition(
        Number.isFinite(pendingCount) && pendingCount > 0
          ? Math.trunc(pendingCount)
          : 0
      );
    } catch (err) {
      console.error(err);
      setBootsQueuePosition(null);
    } finally {
      setBootsQueueLoading(false);
    }
  }, [partner?.id, store?.id]);

  useEffect(() => {
    loadBootsQueuePosition();
  }, [loadBootsQueuePosition]);

  useEffect(() => {
    if (bootsOpen) {
      loadBootsQueuePosition();
    }
  }, [bootsOpen, loadBootsQueuePosition]);

  const cartDraftStorageKey = useMemo(
    () => `volta-repeat-cart-draft:${partnerSlug || "partner"}:${storeSlug || "store"}`,
    [partnerSlug, storeSlug]
  );
  const customerProfileStorageKey = useMemo(
    () => `volta-checkout-customer:${partnerSlug || "partner"}`,
    [partnerSlug]
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(customerProfileStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      if (hasCheckoutIdentity(parsed)) {
        const normalized = {
          id: parsed.id || parsed.customerId || null,
          name: String(parsed.name || "").trim(),
          phone: normalizeCheckoutPhoneInput(parsed.phone),
          email: normalizeCheckoutEmailInput(parsed.email),
        };
        setSavedCustomerProfile(normalized);
        setCheckoutProfileForm((current) => ({
          name: current.name || normalized.name,
          phone: current.phone || normalized.phone,
        }));
      }
    } catch {
      setSavedCustomerProfile(null);
    }
  }, [customerProfileStorageKey]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartDraftStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      if (Array.isArray(parsed?.items) && parsed.items.length) {
        setCart((current) =>
          current.length ? current : parsed.items.map((item, index) => normalizeCartLine(item, index))
        );
      }
    } catch {
      // Ignore invalid stored drafts.
    }
  }, [cartDraftStorageKey]);

  useEffect(() => {
    try {
      if (cart.length === 0) {
        window.localStorage.removeItem(cartDraftStorageKey);
        return;
      }

      window.localStorage.setItem(
        cartDraftStorageKey,
        JSON.stringify({
          source: "active_cart",
          savedAt: new Date().toISOString(),
          items: cart,
        })
      );
    } catch {
      // Ignore storage failures; checkout can continue without persistence.
    }
  }, [cart, cartDraftStorageKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const orderCode = params.get("order_code") || "";
    const sessionId = params.get("session_id") || "";
    let cancelled = false;
    const rejectedPaymentStatuses = new Set(["failed", "failure", "rejected", "declined", "error"]);
    const rejectedPaymentMessage =
      "Pago rechazado. Tu banco o la pasarela no pudo aprobar el cobro. No hemos pasado el pedido a cocina; revisa la tarjeta, saldo o metodo de pago e intentalo de nuevo.";

    if (paymentStatus === "success") {
      setCheckoutTrackingCode(orderCode);
      setCheckoutMessage("Confirmando el pago con Stripe para pasar el pedido a cocina...");
      setCartOpen(true);

      const confirmPayment = async () => {
        try {
          if (sessionId) {
            const confirmation = await api.post("/api/checkout/session/confirm", {
              sessionId,
            });
            if (!cancelled && confirmation?.orderCode) {
              setCheckoutTrackingCode(confirmation.orderCode);
            }
          }

          if (cancelled) return;

          setCheckoutMessage(
            orderCode || sessionId
              ? "Pago recibido. Tu pedido ya entro en cocina. Tambien te enviamos el enlace de seguimiento por SMS."
              : "Pago recibido. Tu pedido ya entro en cocina."
          );
          setCart([]);
          try {
            window.localStorage.removeItem(cartDraftStorageKey);
          } catch {
            // Ignore storage cleanup failures.
          }
        } catch (error) {
          console.error("[StorePage] payment confirmation failed", error);
          if (!cancelled) {
            const errorCode = error?.response?.data?.error || error?.message;
            setCheckoutTrackingCode("");
            setCheckoutMessage(
              errorCode === "payment_not_paid"
                ? rejectedPaymentMessage
                : "No pudimos confirmar el pago con Stripe. Si el banco aprobo el cobro, espera unos segundos y vuelve a intentarlo desde seguimiento."
            );
          }
        }
      };

      confirmPayment();
    }

    if (rejectedPaymentStatuses.has(paymentStatus)) {
      setCheckoutTrackingCode("");
      setCheckoutMessage(rejectedPaymentMessage);
      setCartOpen(true);
    }

    if (paymentStatus === "cancel") {
      setCheckoutTrackingCode("");
      setCheckoutMessage("Pago cancelado. Puedes seguir comprando o intentarlo de nuevo.");
      setCartOpen(true);
    }

    return () => {
      cancelled = true;
    };
  }, [cartDraftStorageKey]);

  const themeStyle = useMemo(
    () => {
      const theme = buildBrandThemeVars({
        brandPrimary: partner?.brandPrimary || BRANDING_DEFAULTS.brandPrimary,
        brandSecondary: partner?.brandSecondary || BRANDING_DEFAULTS.brandSecondary,
        brandAccent: partner?.brandAccent || BRANDING_DEFAULTS.brandAccent,
        brandSurface: partner?.brandSurface || "#FFF7E8",
        brandTextColor: partner?.brandTextColor || BRANDING_DEFAULTS.brandTextColor,
        brandFontFamily: partner?.brandFontFamily || BRANDING_DEFAULTS.brandFontFamily,
      });

      return {
        "--sf-theme-primary": theme.primary,
        "--sf-theme-secondary": theme.secondary,
        "--sf-theme-accent": theme.accent,
        "--sf-theme-surface": theme.surface,
        "--sf-theme-text": theme.text,
        "--sf-theme-text-soft": theme.textSoft,
        "--sf-theme-text-muted": theme.textMuted,
        "--sf-theme-on-primary": theme.onPrimary,
        "--sf-theme-on-secondary": theme.onSecondary,
        "--sf-theme-on-accent": theme.onAccent,
        "--sf-theme-on-surface": theme.onSurface,
        "--sf-font-family": theme.fontFamily,
        "--sf-grid-watermark-logo": `url("${partner?.brandLogoUrl || gridWatermarkLogo}")`,
      };
    },
    [partner]
  );

  const offerVariant = useMemo(
    () =>
      getOfferButtonVariant(
        partner?.brandOfferButtonStyle || BRANDING_DEFAULTS.brandOfferButtonStyle
      ),
    [partner?.brandOfferButtonStyle]
  );

  const storefrontMode = useMemo(
    () => normalizeStorefrontMode(partner?.storefrontMode),
    [partner?.storefrontMode]
  );

  const storefrontButtons = useMemo(
    () => normalizeStorefrontButtonConfig(partner?.storefrontButtonConfig),
    [partner?.storefrontButtonConfig]
  );

  const isStorefrontButtonVisible = useCallback(
    (buttonId) => storefrontButtons[buttonId] !== false,
    [storefrontButtons]
  );

  const categories = useMemo(() => {
    const uniques = new Map();

    menu.forEach((item) => {
      const key = item.categoryId || item.category;
      if (!key || !item.category) return;
      if (!uniques.has(key)) {
        uniques.set(key, {
          id: getCustomCategoryKey(item),
          name: item.category,
          position: Number.isFinite(Number(item.categoryPosition))
            ? Number(item.categoryPosition)
            : 999,
        });
      }
    });

    return [...uniques.values()].sort((left, right) => {
      const byPosition = left.position - right.position;
      if (byPosition !== 0) return byPosition;

      return left.name.localeCompare(right.name, "es", {
        sensitivity: "base",
      });
    });
  }, [menu]);

  const topDeals = useMemo(
    () => sortTopDealsByDiscount(menu.filter(hasTopDealPolicy)),
    [menu]
  );

  const menuCatalog = useMemo(() => {
    const byId = new Map();

    [...menu, ...trending].forEach((item) => {
      if (!item?.pizzaId) return;
      byId.set(Number(item.pizzaId), item);
    });

    return [...byId.values()];
  }, [menu, trending]);

  const visiblePromos = useMemo(
    () => promos.filter(promoHasProducts),
    [promos]
  );

  const commercialTabs = useMemo(
    () => [
      { id: TRENDING_TAB, label: "Trending", tone: "trending" },
      ...(topDeals.length ? [{ id: TOP_DEAL_TAB, label: "Top Deal", tone: "deal" }] : []),
      ...(visiblePromos.length ? [{ id: PROMOS_TAB, label: "Promos", tone: "promo" }] : []),
      ...(upcoming.length ? [{ id: UPCOMING_TAB, label: "Proximos", tone: "upcoming" }] : []),
    ],
    [topDeals.length, upcoming.length, visiblePromos.length]
  );

  const categoryTabs = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        label: category.name,
      })),
    [categories]
  );

  const tabs = useMemo(
    () => [...commercialTabs, ...categoryTabs],
    [categoryTabs, commercialTabs]
  );

  useEffect(() => {
    if (!tabs.length) {
      setActiveTab("");
      return;
    }

    const validTabIds = new Set(tabs.map((tab) => tab.id));
    const defaultTabId = categories[0]?.id || tabs[0].id;

    setActiveTab((current) =>
      validTabIds.has(current) ? current : defaultTabId
    );
  }, [categories, tabs]);

  const baseFilteredMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterMenuItems(menu, query);
  }, [menu, search]);
  const isProductSearchActive = search.trim().length > 0;

  const filteredUpcoming = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterMenuItems(upcoming, query);
  }, [upcoming, search]);

  const filteredPromos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterPromos(visiblePromos, query)
      .slice()
      .sort((left, right) => getPromoDiscountPercent(right, menuCatalog) - getPromoDiscountPercent(left, menuCatalog));
  }, [menuCatalog, search, visiblePromos]);

  const filteredTopDeals = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterMenuItems(topDeals, query);
  }, [search, topDeals]);

  const fallbackTrending = useMemo(
    () =>
      menu.slice(0, 3).map((item, index) => ({
        ...item,
        trend: {
          rank: index + 1,
          soldLast7Days: 0,
          soldPrevious7Days: 0,
          soldAllTime: 0,
          trendDelta: 0,
          trendPercent: 0,
          lastOrderedAt: null,
          lastOrderedLabel: "Aun sin ventas",
          rankingBasis: "menuFallback",
        },
      })),
    [menu]
  );

  const filteredTrending = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterTrendingItems(trending.length ? trending : fallbackTrending, query);
  }, [fallbackTrending, search, trending]);

  const visibleMenu = useMemo(() => {
    if (activeTab === PROMOS_TAB || activeTab === UPCOMING_TAB || activeTab === TOP_DEAL_TAB) return [];

    if (activeTab === TRENDING_TAB) {
      return [];
    }

    return sortFeedItems(
      baseFilteredMenu.filter((item) => getCustomCategoryKey(item) === activeTab)
    );
  }, [activeTab, baseFilteredMenu]);

  const activeTabLabel =
    tabs.find((tab) => tab.id === activeTab)?.label || "Trending";
  const isCommercialTabActive =
    activeTab === TRENDING_TAB ||
    activeTab === TOP_DEAL_TAB ||
    activeTab === PROMOS_TAB ||
    activeTab === UPCOMING_TAB;

  const gridContext = useMemo(() => {
    const cleanSearch = search.trim();

    if (cleanSearch) {
      return {
        eyebrow: "Busqueda",
        label: cleanSearch,
        count: baseFilteredMenu.length,
        tone: "search",
      };
    }

    if (activeTab === TOP_DEAL_TAB) {
      return {
        eyebrow: "Oferta",
        label: "Top Deal",
        count: filteredTopDeals.length,
        tone: "deal",
      };
    }

    if (activeTab === PROMOS_TAB) {
      return {
        eyebrow: "Oferta",
        label: "Promos",
        count: filteredPromos.length,
        tone: "promo",
      };
    }

    if (activeTab === TRENDING_TAB) {
      return {
        eyebrow: "Oferta",
        label: "Trending",
        count: filteredTrending.length,
        tone: "trending",
      };
    }

    if (activeTab === UPCOMING_TAB) {
      return {
        eyebrow: "Oferta",
        label: "Proximos",
        count: filteredUpcoming.length,
        tone: "upcoming",
      };
    }

    return {
      eyebrow: "Categoria",
      label: activeTabLabel,
      count: visibleMenu.length,
      tone: "category",
    };
  }, [
    activeTab,
    activeTabLabel,
    baseFilteredMenu.length,
    filteredPromos.length,
    filteredTopDeals.length,
    filteredTrending.length,
    filteredUpcoming.length,
    search,
    visibleMenu.length,
  ]);

  const pauseTabsTicker = useCallback((durationMs = 5200) => {
    tabsAutoPauseUntilRef.current = performance.now() + durationMs;
  }, []);

  const resumeTabsTicker = useCallback(() => {
    const nextSwitchAt = performance.now() + 3000;
    tabsAutoPauseUntilRef.current = 0;
    commercialAutoSwitchAtRef.current = nextSwitchAt;
    setOfferTabsManual(false);
  }, []);

  const getCategoryZeroOffset = useCallback((scroller) => {
    if (!scroller) return 0;

    const categoryGroup = scroller.querySelector(".lsf-categoryTabs");
    if (categoryGroup) {
      const categoryStyles = window.getComputedStyle(categoryGroup);
      const categoryPaddingLeft =
        Number.parseFloat(categoryStyles.paddingLeft || "0") || 0;
      return categoryGroup.offsetLeft + categoryPaddingLeft;
    }

    const segment = scroller.querySelector(".lsf-segmentTabs");
    if (!segment) return 0;

    const styles = window.getComputedStyle(scroller);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    return segment.offsetWidth + gap;
  }, []);

  const alignCategoryTabToZero = useCallback(
    (tabId, behavior = "smooth") => {
      const scroller = tabsScrollerRef.current;
      if (!scroller || !tabId) return false;

      const escapedTabId =
        window.CSS?.escape?.(tabId) || String(tabId).replace(/"/g, '\\"');
      const activeButton = scroller.querySelector(`[data-tab-id="${escapedTabId}"]`);
      if (!activeButton?.classList?.contains("lsf-tab--category")) return false;

      const scrollerRect = scroller.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const buttonLeft =
        buttonRect.left - scrollerRect.left + scroller.scrollLeft;
      const nextLeft = Math.max(0, buttonLeft - getCategoryZeroOffset(scroller));
      scroller.scrollLeft = nextLeft;
      if (behavior !== "auto") {
        scroller.scrollTo({
          left: nextLeft,
          behavior,
        });
      }
      return true;
    },
    [getCategoryZeroOffset]
  );

  const selectStorefrontTab = useCallback(
    (tabId, pauseDurationMs = 5200, options = {}) => {
      if (options.manual) {
        tabsAutoPauseUntilRef.current = Number.POSITIVE_INFINITY;
        commercialAutoSwitchAtRef.current = Number.POSITIVE_INFINITY;
        setOfferTabsManual(true);
      } else {
        pauseTabsTicker(pauseDurationMs);
      }
      tabsScrollOriginRef.current = "";
      ignoreTabsScrollUntilRef.current = performance.now() + (options.manual ? 1100 : 520);
      alignCategoryTabToZero(tabId);
      setActiveTab(tabId);
    },
    [alignCategoryTabToZero, pauseTabsTicker]
  );

  const selectCategoryTab = useCallback(
    (tabId) => {
      window.clearTimeout(commercialTabClickTimeoutRef.current);
      lastCommercialTabClickRef.current = { id: "", at: 0 };
      selectStorefrontTab(tabId, 30000, { manual: true });
    },
    [selectStorefrontTab]
  );

  const activateCommercialTab = useCallback(
    (tabId, pauseDurationMs = 30000) => {
      selectStorefrontTab(tabId, pauseDurationMs, { manual: true });
    },
    [selectStorefrontTab]
  );

  const selectNextCommercialTab = useCallback(() => {
    if (!commercialTabs.length) return;

    const currentIndex = commercialTabs.findIndex((tab) => tab.id === activeTab);
    const nextIndex = currentIndex >= 0
      ? (currentIndex + 1) % commercialTabs.length
      : 0;

    activateCommercialTab(commercialTabs[nextIndex].id, 30000);
  }, [activateCommercialTab, activeTab, commercialTabs]);

  const handleCommercialTabClick = useCallback(
    (tabId) => {
      const nowMs = performance.now();
      const lastClick = lastCommercialTabClickRef.current;

      if (lastClick.id === tabId && nowMs - lastClick.at < 320) {
        window.clearTimeout(commercialTabClickTimeoutRef.current);
        lastCommercialTabClickRef.current = { id: "", at: 0 };
        resumeTabsTicker();
        return;
      }

      lastCommercialTabClickRef.current = { id: tabId, at: nowMs };
      window.clearTimeout(commercialTabClickTimeoutRef.current);

      const wasManual = offerTabsManual;

      commercialTabClickTimeoutRef.current = window.setTimeout(() => {
        if (!wasManual || !isCommercialTabActive) {
          activateCommercialTab(tabId, 30000);
          return;
        }

        selectNextCommercialTab();
      }, 230);
    },
    [
      activateCommercialTab,
      isCommercialTabActive,
      offerTabsManual,
      resumeTabsTicker,
      selectNextCommercialTab,
    ]
  );

  const handleCommercialTabDoubleClick = useCallback(
    (event) => {
      event.preventDefault();
      window.clearTimeout(commercialTabClickTimeoutRef.current);
      lastCommercialTabClickRef.current = { id: "", at: 0 };
      resumeTabsTicker();
    },
    [resumeTabsTicker]
  );

  const moveStorefrontTab = useCallback(
    (direction) => {
      if (isProductSearchActive || tabs.length < 2) return;

      const currentIndex = Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTab)
      );
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
      selectStorefrontTab(tabs[nextIndex].id, 6400);
    },
    [activeTab, isProductSearchActive, selectStorefrontTab, tabs]
  );

  const openGridFocusMode = useCallback((entry = "tap", direction = 0) => {
    if (!isGridFocusViewport()) return;
    window.clearTimeout(gridFocusTransitionTimeoutRef.current);
    setGridFocusSwipePreview(null);
    const directionClass =
      entry === "swipe"
        ? direction < 0
          ? "from-right"
          : "from-left"
        : "from-bottom";
    setGridFocusTransition(`is-grid-focus-entering ${directionClass}`);
    setGridFocusMode(true);
    setLsfSurfaceDocked(true);
    gridFocusTransitionTimeoutRef.current = window.setTimeout(() => {
      setGridFocusTransition("");
    }, 520);
  }, []);

  const updateGridFocusSwipePreview = useCallback((deltaX) => {
    const progress = Math.min(1, Math.abs(deltaX) / 132);
    const clampedX = Math.max(-220, Math.min(220, deltaX * 0.9));
    setGridFocusSwipePreview({
      offsetX: `${Math.round(clampedX)}px`,
      lift: `${Math.round(progress * -10)}px`,
      scale: (1 - progress * 0.055).toFixed(3),
      radius: `${Math.round(18 + progress * 14)}px`,
      shadowY: `${Math.round(progress * 24)}px`,
      shadowBlur: `${Math.round(progress * 46)}px`,
      backdropOpacity: (0.42 + progress * 0.48).toFixed(3),
      progress: Number(progress.toFixed(3)),
      directionClass: deltaX < 0 ? "from-right" : "from-left",
    });
  }, []);

  const clearGridFocusSwipePreview = useCallback(() => {
    setGridFocusSwipePreview(null);
  }, []);

  const syncActiveTabFromTabsScroll = useCallback((options = {}) => {
    const scroller = tabsScrollerRef.current;
    if (!scroller || isProductSearchActive || !categoryTabs.length) return;
    if (isCommercialTabActive) return;
    const shouldAlign = options.align === true;

    const categoryButtons = Array.from(
      scroller.querySelectorAll(".lsf-categoryTabs .lsf-tab--category")
    );
    if (!categoryButtons.length) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const markerX = scrollerRect.left + getCategoryZeroOffset(scroller);
    const visibleButtons = categoryButtons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.right > markerX && rect.left < scrollerRect.right;
    });

    if (!visibleButtons.length) return;

    const markerTolerance = 4;
    const nextButton =
      visibleButtons.find(
        (button) => button.getBoundingClientRect().left >= markerX - markerTolerance
      ) || visibleButtons[visibleButtons.length - 1];

    const nextTabId = nextButton?.dataset?.tabId;
    if (!nextTabId) return;

    tabsScrollOriginRef.current = nextTabId;
    setActiveTab((current) => (current === nextTabId ? current : nextTabId));

    if (shouldAlign) {
      ignoreTabsScrollUntilRef.current = performance.now() + 520;
      window.requestAnimationFrame(() => {
        alignCategoryTabToZero(nextTabId, "auto");
      });
    }
  }, [
    alignCategoryTabToZero,
    categoryTabs.length,
    getCategoryZeroOffset,
    isCommercialTabActive,
    isProductSearchActive,
  ]);

  const handleTabsScroll = useCallback(() => {
    pauseTabsTicker(6200);
    if (performance.now() < ignoreTabsScrollUntilRef.current) return;

    if (tabsScrollRafRef.current) {
      window.cancelAnimationFrame(tabsScrollRafRef.current);
    }

    tabsScrollRafRef.current = window.requestAnimationFrame(() => {
      tabsScrollRafRef.current = 0;
      syncActiveTabFromTabsScroll();
    });

    window.clearTimeout(tabsScrollSettleTimeoutRef.current);
    tabsScrollSettleTimeoutRef.current = window.setTimeout(() => {
      syncActiveTabFromTabsScroll({ align: true });
    }, 160);
  }, [pauseTabsTicker, syncActiveTabFromTabsScroll]);

  const handleTabsPointerDown = useCallback(
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target?.closest?.(".lsf-tab--segment")) return;
      if (event.target?.closest?.("input, textarea, select")) return;

      const scroller = tabsScrollerRef.current;
      if (!scroller) return;
      const categoryTab = event.target?.closest?.(".lsf-tab--category");

      pauseTabsTicker(6200);
      tabsDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        scrollLeft: scroller.scrollLeft,
        moved: false,
        categoryTabId: categoryTab?.dataset?.tabId || "",
      };
      scroller.setPointerCapture?.(event.pointerId);
      scroller.classList.add("is-dragging");
    },
    [pauseTabsTicker]
  );

  const handleTabsPointerMove = useCallback(
    (event) => {
      const drag = tabsDragRef.current;
      const scroller = tabsScrollerRef.current;
      if (!drag || !scroller || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      if (Math.abs(deltaX) < 4 && !drag.moved) return;

      drag.moved = true;
      pauseTabsTicker(6200);
      scroller.scrollLeft = drag.scrollLeft - deltaX;
      event.preventDefault();
    },
    [pauseTabsTicker]
  );

  const finishTabsDrag = useCallback((event) => {
    const drag = tabsDragRef.current;
    const scroller = tabsScrollerRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const categoryTabId = !drag.moved ? drag.categoryTabId : "";

    if (drag.moved) {
      suppressTabsClickUntilRef.current = performance.now() + 320;
    } else if (categoryTabId) {
      suppressTabsClickUntilRef.current = performance.now() + 120;
    }

    tabsDragRef.current = null;
    scroller?.releasePointerCapture?.(event.pointerId);
    scroller?.classList.remove("is-dragging");

    if (categoryTabId) {
      selectCategoryTab(categoryTabId);
    }
  }, [selectCategoryTab]);

  const handleTabsClickCapture = useCallback((event) => {
    if (performance.now() > suppressTabsClickUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleGridPointerDown = useCallback((event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target?.closest?.("button, a, input, textarea, select")) return;

    gridSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      startedAt: performance.now(),
      swiping: false,
    };
  }, []);

  const handleGridPointerMove = useCallback(
    (event) => {
      const gesture = gridSwipeRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      gesture.lastX = event.clientX;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;

      if (Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
        gesture.swiping = true;
        pauseTabsTicker(6200);
        if (!gridFocusMode && isGridFocusViewport()) updateGridFocusSwipePreview(deltaX);
      }
    },
    [gridFocusMode, pauseTabsTicker, updateGridFocusSwipePreview]
  );

  const handleGridPointerEnd = useCallback(
    (event) => {
      const gesture = gridSwipeRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      gridSwipeRef.current = null;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      const elapsed = performance.now() - gesture.startedAt;
      const isHorizontalSwipe =
        Math.abs(deltaX) >= 48 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.18 &&
        elapsed < 900;

      clearGridFocusSwipePreview();

      if (!isHorizontalSwipe) {
        if (gesture.swiping) suppressGridClickUntilRef.current = performance.now() + 180;
        return;
      }

      suppressGridClickUntilRef.current = performance.now() + 360;
      if (gridFocusMode) {
        moveStorefrontTab(deltaX < 0 ? 1 : -1);
        return;
      }

      if (!isGridFocusViewport()) {
        moveStorefrontTab(deltaX < 0 ? 1 : -1);
        return;
      }

      openGridFocusMode("swipe", deltaX);
    },
    [clearGridFocusSwipePreview, gridFocusMode, moveStorefrontTab, openGridFocusMode]
  );

  const handleGridClickCapture = useCallback((event) => {
    if (performance.now() < suppressGridClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (
      isGridFocusViewport() &&
      !gridFocusMode &&
      !event.target?.closest?.("button, a, input, textarea, select")
    ) {
      event.preventDefault();
      event.stopPropagation();
      openGridFocusMode();
    }
  }, [gridFocusMode, openGridFocusMode]);

  const handleGridTouchStart = useCallback((event) => {
    if (event.target?.closest?.("button, a, input, textarea, select")) return;
    const touch = event.touches?.[0];
    if (!touch) return;

    gridSwipeRef.current = {
      pointerId: "touch",
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      startedAt: performance.now(),
      swiping: false,
    };
  }, []);

  const handleGridTouchMove = useCallback(
    (event) => {
      const gesture = gridSwipeRef.current;
      const touch = event.touches?.[0];
      if (!gesture || gesture.pointerId !== "touch" || !touch) return;

      gesture.lastX = touch.clientX;
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      if (Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
        gesture.swiping = true;
        pauseTabsTicker(6200);
        if (!gridFocusMode && isGridFocusViewport()) updateGridFocusSwipePreview(deltaX);
      }
    },
    [gridFocusMode, pauseTabsTicker, updateGridFocusSwipePreview]
  );

  const handleGridTouchEnd = useCallback(
    (event) => {
      const gesture = gridSwipeRef.current;
      const touch = event.changedTouches?.[0];
      if (!gesture || gesture.pointerId !== "touch" || !touch) return;

      gridSwipeRef.current = null;
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      const elapsed = performance.now() - gesture.startedAt;
      const isHorizontalSwipe =
        Math.abs(deltaX) >= 48 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.18 &&
        elapsed < 900;

      clearGridFocusSwipePreview();

      if (!isHorizontalSwipe) {
        if (gesture.swiping) suppressGridClickUntilRef.current = performance.now() + 180;
        return;
      }

      suppressGridClickUntilRef.current = performance.now() + 360;
      if (gridFocusMode) {
        moveStorefrontTab(deltaX < 0 ? 1 : -1);
        return;
      }

      if (!isGridFocusViewport()) {
        moveStorefrontTab(deltaX < 0 ? 1 : -1);
        return;
      }

      openGridFocusMode("swipe", deltaX);
    },
    [clearGridFocusSwipePreview, gridFocusMode, moveStorefrontTab, openGridFocusMode]
  );

  useEffect(() => {
    const scroller = tabsScrollerRef.current;
    if (!scroller || tabs.length < 5) return undefined;

    let frame = 0;
    let lastTimestamp = performance.now();
    tabsAutoPauseUntilRef.current = performance.now() + 2600;

    const tickTabs = (timestamp) => {
      const elapsed = Math.min(40, timestamp - lastTimestamp);
      lastTimestamp = timestamp;

      if (
        timestamp > tabsAutoPauseUntilRef.current &&
        document.visibilityState === "visible" &&
        scroller.scrollWidth > scroller.clientWidth + 4
      ) {
        scroller.scrollLeft += elapsed * 0.028;
        if (scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 2) {
          scroller.scrollLeft = 0;
        }
      }

      frame = window.requestAnimationFrame(tickTabs);
    };

    frame = window.requestAnimationFrame(tickTabs);
    return () => window.cancelAnimationFrame(frame);
  }, [tabs.length]);

  useEffect(() => {
    if (gridFocusMode || offerTabsManual || !commercialTabs.length || isProductSearchActive) return undefined;

    let frame = 0;

    const tickCommercialTabs = (timestamp) => {
      if (
        document.visibilityState === "visible" &&
        timestamp >= tabsAutoPauseUntilRef.current &&
        timestamp >= commercialAutoSwitchAtRef.current
      ) {
        const currentIndex = commercialTabs.findIndex((tab) => tab.id === activeTab);
        const nextIndex = currentIndex >= 0
          ? (currentIndex + 1) % commercialTabs.length
          : 0;

        setActiveTab(commercialTabs[nextIndex].id);
        tabsScrollOriginRef.current = "";
        commercialAutoSwitchAtRef.current = timestamp + 3000;
      }

      frame = window.requestAnimationFrame(tickCommercialTabs);
    };

    frame = window.requestAnimationFrame(tickCommercialTabs);
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, commercialTabs, gridFocusMode, isProductSearchActive, offerTabsManual]);

  useEffect(() => {
    const scroller = tabsScrollerRef.current;
    if (!scroller || !activeTab) return;

    tabsScrollOriginRef.current = "";

    ignoreTabsScrollUntilRef.current = performance.now() + 520;
    if (alignCategoryTabToZero(activeTab)) {
      return;
    }

    const escapedActiveTab =
      window.CSS?.escape?.(activeTab) || String(activeTab).replace(/"/g, '\\"');
    const activeButton = scroller.querySelector(`[data-tab-id="${escapedActiveTab}"]`);
    activeButton?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab, alignCategoryTabToZero]);

  const reservationEnabled = Boolean(store?.acceptsReservations);
  const storePhone = String(store?.tlf || "").trim();
  const phoneHref = storePhone
    ? `tel:${storePhone.replace(/[^\d+]/g, "")}`
    : null;
  const deliveryLabel = useMemo(() => {
    if (!partner) return "Delivery activo";

    if (partner.deliveryPricingMode === "VARIABLE") {
      const baseFee = Number(partner.deliveryFeeBase || 0);
      const baseKm = Number(partner.deliveryBaseKm || 0);

      if (baseFee > 0 && baseKm > 0) {
        return `Delivery desde EUR${baseFee.toFixed(2)} · ${baseKm} km`;
      }

      if (baseFee > 0) {
        return `Delivery desde EUR${baseFee.toFixed(2)}`;
      }

      return "Delivery variable";
    }

    const fixedFee = Number(partner.deliveryFeeFixed || 0);

    if (fixedFee > 0) {
      return `Delivery EUR${fixedFee.toFixed(2)}`;
    }

    return "Delivery activo";
  }, [partner]);
  const deliveryMetaLabel = useMemo(() => {
    if (!partner) return "Modo activo";

    const radiusKm = Number(partner.deliveryRadiusKm || 0);
    const pricingLabel =
      partner.deliveryPricingMode === "VARIABLE"
        ? "Tarifa variable"
        : "Tarifa fija";

    if (radiusKm > 0) {
      return `${pricingLabel} - ${radiusKm} km`;
    }

    return pricingLabel;
  }, [partner]);
  const countryBadgeLabel = useMemo(() => {
    const countryCode = String(partner?.country || "").trim().toUpperCase();

    if (!countryCode) return "Zona activa";

    return countryCode;
  }, [partner?.country]);
  const closingSnapshot = useMemo(() => buildClosingSnapshot(now), [now]);
  const scheduleDays = useMemo(() => buildScheduleDays(now), [now]);
  const scheduleSlots = useMemo(
    () => buildScheduleSlots({ store, selectedDate: scheduledAt, nowDate: now }),
    [now, scheduledAt, store]
  );
  const scheduleSelectedMinutes = scheduledAt ? getMinutesOfDay(scheduledAt) : null;
  const scheduledAtIsValid =
    scheduledAt && scheduleSelectedMinutes != null && scheduleSlots.includes(scheduleSelectedMinutes);
  const scheduledOrderLabel = scheduledAtIsValid
    ? formatScheduledOrderLabel(scheduledAt, now)
    : "";
  const reservationDays = scheduleDays;
  const reservationDateValue = reservationDate ? toLocalDateValue(reservationDate) : "";
  const visibleReservationAvailability = useMemo(
    () =>
      reservationAvailability.filter((slot) =>
        isFutureReservationSlot(reservationDate, slot.time, now)
      ),
    [now, reservationAvailability, reservationDate]
  );
  const reservationCanConfirm =
    Boolean(store?.id) &&
    Boolean(reservationDateValue) &&
    Boolean(reservationTime) &&
    reservationName.trim().length > 0 &&
    normalizeRepeatPhoneInput(reservationPhone).length >= 7;
  const reservationMissingSet = useMemo(
    () => new Set(reservationMissingFields),
    [reservationMissingFields]
  );
  const reservationMissingClass = (field) =>
    reservationMissingSet.has(field)
      ? `is-missing ${reservationShaking ? "is-shaking" : ""}`
      : "";
  const clearReservationMissing = useCallback((field) => {
    setReservationMissingFields((current) => current.filter((item) => item !== field));
  }, []);
  const triggerReservationMissingShake = useCallback(() => {
    const missingFields = [];

    if (!store?.id) missingFields.push("store");
    if (!reservationDateValue) missingFields.push("date");
    if (!reservationTime) missingFields.push("time");
    if (reservationName.trim().length === 0) missingFields.push("name");
    if (normalizeRepeatPhoneInput(reservationPhone).length < 7) missingFields.push("phone");

    setReservationMissingFields(missingFields);

    if (missingFields.length === 0) return false;

    setReservationShaking(false);
    window.setTimeout(() => setReservationShaking(true), 0);
    window.setTimeout(() => setReservationShaking(false), 560);
    setReservationMessage("Completa los campos marcados para confirmar la reserva.");
    return true;
  }, [reservationDateValue, reservationName, reservationPhone, reservationTime, store?.id]);

  useEffect(() => {
    if (!scheduleOpen || scheduledAt) return;

    const firstAvailableDay = scheduleDays.find((day) =>
      buildScheduleSlots({ store, selectedDate: day.date, nowDate: now }).length > 0
    );

    if (firstAvailableDay) {
      setScheduledAt(new Date(firstAvailableDay.date));
    }
  }, [now, scheduleDays, scheduleOpen, scheduledAt, store]);

  useEffect(() => {
    if (!scheduledAt || scheduledAtIsValid || scheduleSelectedMinutes === 0) return;

    setScheduledAt(null);
  }, [scheduleSelectedMinutes, scheduledAt, scheduledAtIsValid]);

  useEffect(() => {
    if (!reservationOpen) return;

    setReservationDate((current) => current || new Date(reservationDays[0]?.date || now));
    setReservationTime("");
    setReservationMessage("");
    setReservationMissingFields([]);
    setReservationShaking(false);
  }, [now, reservationDays, reservationOpen]);

  useEffect(() => {
    if (!reservationOpen || !store?.id || !reservationDateValue) return undefined;

    let cancelled = false;
    const params = new URLSearchParams({
      storeId: String(store.id),
      date: reservationDateValue,
      partySize: String(reservationPartySize),
    });

    setReservationLoading(true);
    api
      .get(`/api/reservations/availability?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        const data = response?.data || response || {};
        const availability = Array.isArray(data?.availability) ? data.availability : [];
        const futureAvailability = availability.filter((slot) =>
          isFutureReservationSlot(reservationDate, slot.time, now)
        );
        setReservationAvailability(availability);
        setReservationCapacity(Number(data?.capacity || 0));
        setReservationTime((current) => {
          const stillAvailable = futureAvailability.some(
            (slot) => slot.time === current && slot.canFit !== false
          );
          return stillAvailable ? current : "";
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setReservationAvailability([]);
        setReservationCapacity(0);
        setReservationMessage("No pudimos cargar la disponibilidad.");
      })
      .finally(() => {
        if (!cancelled) {
          setReservationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [now, reservationDate, reservationDateValue, reservationOpen, reservationPartySize, store?.id]);

  useEffect(() => {
    if (!reservationTime) return;

    const stillVisible = visibleReservationAvailability.some(
      (slot) => slot.time === reservationTime && slot.canFit !== false
    );

    if (!stillVisible) {
      setReservationTime("");
    }
  }, [reservationTime, visibleReservationAvailability]);

  const createReservation = useCallback(async () => {
    if (!reservationCanConfirm) {
      triggerReservationMissingShake();
      return;
    }

    try {
      setReservationLoading(true);
      await api.post("/api/reservations", {
        storeId: Number(store.id),
        customerName: reservationName.trim(),
        customerPhone: normalizeRepeatPhoneInput(reservationPhone),
        partySize: Number(reservationPartySize),
        reservationDate: reservationDateValue,
        reservationTime,
      });

      setReservationTime("");
      setReservationMessage("");
      setReservationOpen(false);
    } catch (err) {
      console.error(err);
      setReservationMessage("No se pudo crear la reserva. Revisa la hora o la capacidad.");
    } finally {
      setReservationLoading(false);
    }
  }, [
    reservationCanConfirm,
    reservationDateValue,
    reservationName,
    reservationPartySize,
    reservationPhone,
    reservationTime,
    store?.id,
    triggerReservationMissingShake,
  ]);

  const utilityPills = useMemo(
    () => [
      {
        key: "city",
        tone: "neutral",
        primary: store?.city || "Pizza Engine",
        secondary: countryBadgeLabel,
      },
      {
        key: "delivery",
        tone: "neutral",
        primary: deliveryLabel,
        secondary: deliveryMetaLabel,
      },
      ...(reservationEnabled
        ? [
            {
              key: "reservations",
              tone: "accent live",
              primary: "Reserva",
              secondary: "Hoy",
            },
          ]
        : []),
      {
        key: "closing",
        tone: "dark live",
        primary: "Cierra en",
        secondary: closingSnapshot.countdownValue,
      },
    ],
    [closingSnapshot, countryBadgeLabel, deliveryLabel, deliveryMetaLabel, reservationEnabled, store?.city]
  );

  useEffect(() => {
    if (!partner && !store) return;

    console.log("[StorePage] utility pills debug", {
      storeCity: store?.city,
      partnerCountry: partner?.country,
      deliveryPricingMode: partner?.deliveryPricingMode,
      deliveryRadiusKm: partner?.deliveryRadiusKm,
      deliveryFeeFixed: partner?.deliveryFeeFixed,
      deliveryFeeBase: partner?.deliveryFeeBase,
      deliveryLabel,
      deliveryMetaLabel,
      utilityPills,
    });
  }, [deliveryLabel, deliveryMetaLabel, partner, store, utilityPills]);

  const selectedProduct = useMemo(() => {
    if (selectedProductSnapshot) return selectedProductSnapshot;
    if (!selectedProductId) return null;

    const allProducts = [
      ...menu,
      ...trending,
      ...upcoming,
    ];

    return allProducts.find(
      (item) => Number(item.pizzaId) === Number(selectedProductId)
    ) || null;
  }, [menu, selectedProductId, selectedProductSnapshot, trending, upcoming]);

  const selectedProductSizes = useMemo(
    () => getAvailableSizes(selectedProduct),
    [selectedProduct]
  );
  const selectedTopDealId = useMemo(
    () => getTopDealId(selectedProduct),
    [selectedProduct]
  );
  const selectedTopDealCartQty = useMemo(
    () => getTopDealCartQuantity(cart, selectedTopDealId),
    [cart, selectedTopDealId]
  );
  const selectedProductMaxQty = useMemo(
    () => getPurchaseMaxQty(selectedProduct, selectedTopDealCartQty),
    [selectedProduct, selectedTopDealCartQty]
  );
  const selectedTopDealRemainingQty = selectedProduct
    ? getTopDealRemainingQuantity(selectedProduct)
    : null;

  const selectedBasePrice = selectedProduct
    ? priceForSize(
        selectedProduct.priceBySize,
        productSelection.size || selectedProductSizes[0] || "M"
      )
    : 0;

  const selectedExtras = useMemo(
    () =>
      extrasAvail
        .filter((extra) => productSelection.extras[extra.ingredientId])
        .map((extra) => ({
          id: extra.ingredientId,
          name: extra.name || extra.ingredientName || "Extra",
          allergens: Array.isArray(extra.allergens) ? extra.allergens : [],
          price: priceForExtraSize(extra, productSelection.size),
        })),
    [extrasAvail, productSelection.extras, productSelection.size]
  );

  const selectedExtrasTotal = selectedExtras.reduce(
    (sum, extra) => sum + num(extra.price),
    0
  );
  const selectedUnitTotal = selectedBasePrice + selectedExtrasTotal;
  const selectedLineTotal = selectedUnitTotal * Number(productSelection.qty || 1);
  const productModalReady = Boolean(selectedProduct && productSelection.size && selectedProductMaxQty > 0);
  const selectedProductAllergens = useMemo(
    () => getProductAllergens(selectedProduct),
    [selectedProduct]
  );
  const selectedPurchaseAllergens = useMemo(
    () =>
      [
        ...new Set([
          ...selectedProductAllergens,
          ...getAllergensFromIngredients(selectedExtras),
        ]),
      ].sort((left, right) =>
        left.localeCompare(right, "es", { sensitivity: "base" })
      ),
    [selectedExtras, selectedProductAllergens]
  );
  const sortedExtras = useMemo(
    () => [...extrasAvail].sort((left, right) => num(right.price) - num(left.price)),
    [extrasAvail]
  );
  const visibleExtras = showAllExtras ? sortedExtras : sortedExtras.slice(0, 3);
  const halfItems = useMemo(() => {
    const pizzaItems = menu.filter(isHalfPizzaCandidate);

    return [...pizzaItems].sort((left, right) => {
      const leftSize = getAvailableSizes(left)[0] || "M";
      const rightSize = getAvailableSizes(right)[0] || "M";
      return priceForHalfSize(right, rightSize) - priceForHalfSize(left, leftSize);
    });
  }, [menu]);
  const getHalfNavigableItems = useCallback(
    (otherIndex) => {
      const other = halfItems[otherIndex] || null;
      const candidates = halfSize
        ? halfItems.filter((item) => getAvailableSizes(item).includes(halfSize))
        : halfItems;

      if (!other || !halfSize) return candidates;

      return candidates.filter((item) =>
        getAvailableSizes(item).some((size) => getAvailableSizes(other).includes(size))
      );
    },
    [halfItems, halfSize]
  );
  const halfA = halfItems[halfAIndex] || null;
  const halfB = halfItems[halfBIndex] || null;
  const halfSizeOptions = useMemo(() => {
    if (!halfA || !halfB) return [];
    const sizesA = getAvailableSizes(halfA);
    const sizesB = getAvailableSizes(halfB);
    return sizesA.filter((size) => sizesB.includes(size));
  }, [halfA, halfB]);
  const halfPricing = useMemo(() => {
    if (!halfSize || !halfA || !halfB) {
      return {
        basePrice: 0,
        priceA: 0,
        priceB: 0,
        source: null,
      };
    }

    const priceA = priceForHalfSize(halfA, halfSize);
    const priceB = priceForHalfSize(halfB, halfSize);
    const source = priceA >= priceB ? halfA : halfB;

    return {
      basePrice: Math.max(priceA, priceB),
      priceA,
      priceB,
      source,
    };
  }, [halfA, halfB, halfSize]);
  const halfBasePrice = halfPricing.basePrice;
  const halfPricingSource = halfPricing.source;
  const sortedHalfExtras = useMemo(
    () => [...halfExtrasAvail].sort((left, right) => num(right.price) - num(left.price)),
    [halfExtrasAvail]
  );
  const getHalfSideExtras = useCallback(
    (side) =>
      sortedHalfExtras
        .filter((extra) => halfExtras[side]?.[extra.ingredientId])
        .map((extra) => ({
          id: extra.ingredientId,
          name: extra.name || extra.ingredientName || "Extra",
          allergens: Array.isArray(extra.allergens) ? extra.allergens : [],
          side,
          price: priceForExtraSize(extra, halfSize),
        })),
    [halfExtras, halfSize, sortedHalfExtras]
  );
  const halfSelectedExtrasA = useMemo(
    () => getHalfSideExtras("A"),
    [getHalfSideExtras]
  );
  const halfSelectedExtrasB = useMemo(
    () => getHalfSideExtras("B"),
    [getHalfSideExtras]
  );
  const halfSelectedExtras = useMemo(
    () => [...halfSelectedExtrasA, ...halfSelectedExtrasB],
    [halfSelectedExtrasA, halfSelectedExtrasB]
  );
  const halfExtrasTotal = halfSelectedExtras.reduce(
    (sum, extra) => sum + num(extra.price),
    0
  );
  const halfGrandTotal = (halfBasePrice + halfExtrasTotal) * Number(halfQty || 1);
  const halfModalReady = Boolean(halfA && halfB && halfSize);
  const halfPurchaseAllergens = useMemo(
    () =>
      [
        ...new Set([
          ...getProductAllergens(halfA),
          ...getProductAllergens(halfB),
          ...getAllergensFromIngredients(halfSelectedExtras),
        ]),
      ].sort((left, right) =>
        left.localeCompare(right, "es", { sensitivity: "base" })
      ),
    [halfA, halfB, halfSelectedExtras]
  );
  const hasExplicitCustomCategories = useMemo(
    () => menu.some((item) => item?.categoryCustomizable === true),
    [menu]
  );
  const customCategoryOptions = useMemo(() => {
    const grouped = new Map();

    menu.forEach((item) => {
      const categoryName = item?.category || "Productos";
      const isCustomizable =
        item?.categoryCustomizable === true ||
        (!hasExplicitCustomCategories && isPizzaLikeCategory(categoryName));

      if (!isCustomizable) return;

      const key = getCustomCategoryKey(item);
      const current =
        grouped.get(key) || {
          key,
          categoryId: item.categoryId ?? null,
          name: categoryName,
          baseName: item.cookingMethod || categoryName,
          position: Number.isFinite(Number(item.categoryPosition))
            ? Number(item.categoryPosition)
            : 999,
          samplePizzaId: item.pizzaId,
          sampleImage: item.image || "",
          products: [],
        };

      current.products.push(item);
      if (!current.sampleImage && item.image) current.sampleImage = item.image;
      if (!current.baseName && item.cookingMethod) {
        current.baseName = item.cookingMethod;
      }

      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map((category) => {
        const lowestPriceBySize = getLowestPriceBySize(category.products);
        const selectSize = Object.keys(lowestPriceBySize);

        return {
          ...category,
          selectSize,
          priceBySize: Object.fromEntries(
            Object.entries(lowestPriceBySize).map(([size, price]) => [
              size,
              roundMoney(price * CUSTOM_BASE_PRICE_FACTOR),
            ])
          ),
          minMenuPrice: Math.min(
            ...Object.values(lowestPriceBySize).filter((price) => price > 0)
          ),
        };
      })
      .filter((category) => category.selectSize.length > 0)
      .sort((left, right) => {
        const byPosition = left.position - right.position;
        if (byPosition !== 0) return byPosition;

        return left.name.localeCompare(right.name, "es", {
          sensitivity: "base",
        });
      });
  }, [hasExplicitCustomCategories, menu]);
  const selectedCustomCategory = useMemo(
    () =>
      customCategoryOptions.find(
        (category) => category.key === customCategoryKey
      ) || null,
    [customCategoryKey, customCategoryOptions]
  );
  const selectedCustomBase = selectedCustomCategory;
  const customBuilderSubject = formatCustomBuilderSubject(
    selectedCustomCategory?.name
  );
  const customBuilderKicker = selectedCustomCategory
    ? `Arma tu ${customBuilderSubject}`
    : "Personalizar";
  const customBuilderTitle = selectedCustomCategory
    ? `Construye tu ${customBuilderSubject}`
    : "Que quieres personalizar";
  const customBasePrice = useMemo(() => {
    if (!selectedCustomBase || !customSize) return 0;
    return priceForSize(selectedCustomBase.priceBySize, customSize);
  }, [customSize, selectedCustomBase]);
  const customUseByIngredientId = useMemo(
    () =>
      new Map(
        customCategoryUses.map((use) => [
          Number(use.ingredientId),
          use,
        ])
      ),
    [customCategoryUses]
  );
  const scopedCustomIngredientsCatalog = useMemo(() => {
    if (!selectedCustomCategory) return [];

    if (customUsesLoading) return [];

    if (!customCategoryUses.length) return [];

    return customCategoryUses.map((use) => {
      const catalogIngredient = customIngredientsCatalog.find(
        (ingredient) => Number(ingredient.id) === Number(use.ingredientId)
      );

      return {
        ...(catalogIngredient || {}),
        ...use,
        id: use.ingredientId ?? use.id,
        name: use.name || catalogIngredient?.name || "Ingrediente",
        category: use.category || catalogIngredient?.category || "OTROS",
        costPrice: use.costPrice ?? catalogIngredient?.costPrice,
      };
    });
  }, [
    customCategoryUses,
    customUsesLoading,
    customIngredientsCatalog,
    selectedCustomCategory,
  ]);
  const customIngredientsByCategory = useMemo(() => {
    const grouped = {};

    scopedCustomIngredientsCatalog.forEach((ingredient) => {
      const category = String(ingredient?.category || "OTROS").trim().toUpperCase();
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(ingredient);
    });

    Object.keys(grouped).forEach((category) => {
      grouped[category] = [...grouped[category]].sort((left, right) => {
        const leftName = normalizeSearchText(left.name);
        const rightName = normalizeSearchText(right.name);

        if (category === "SALSAS") {
          if (leftName.includes("tomate")) return -1;
          if (rightName.includes("tomate")) return 1;
        }

        if (category === "QUESOS") {
          if (leftName.includes("mozz")) return -1;
          if (rightName.includes("mozz")) return 1;
        }

        return String(left.name || "").localeCompare(String(right.name || ""));
      });
    });

    return grouped;
  }, [scopedCustomIngredientsCatalog]);
  const selectedCustomIngredientIds = useMemo(
    () => Object.keys(customIngredients).map((id) => Number(id)),
    [customIngredients]
  );
  const customSelectedAllergens = useMemo(
    () =>
      getAllergensFromIngredients(
        selectedCustomIngredientIds
          .map((id) =>
            scopedCustomIngredientsCatalog.find(
              (ingredient) => Number(ingredient.id) === Number(id)
            )
          )
          .filter(Boolean)
      ),
    [scopedCustomIngredientsCatalog, selectedCustomIngredientIds]
  );
  const customHasIngredient = selectedCustomIngredientIds.length > 0;
  const customHasBase = Boolean(selectedCustomCategory);
  const customHasSize = Boolean(customSize);
  const customReady = customHasBase && customHasSize && customHasIngredient;
  const customIngredientsTotal = useMemo(
    () =>
      Object.values(customIngredients).reduce(
        (sum, ingredient) => sum + getCustomIngredientPrice(ingredient),
        0
      ),
    [customIngredients]
  );
  const customGrandTotal =
    (customBasePrice + customIngredientsTotal) * Number(customQty || 1);
  const customOrderedCategories = useMemo(() => {
    const existing = Object.keys(customIngredientsByCategory);
    return [
      ...CUSTOM_CATEGORY_ORDER.filter((category) => existing.includes(category)),
      ...existing.filter((category) => !CUSTOM_CATEGORY_ORDER.includes(category)).sort(),
    ];
  }, [customIngredientsByCategory]);
  const getCustomIngredientUnitPrice = useCallback(
    (ingredient) => {
      const use = customUseByIngredientId.get(Number(ingredient?.id));
      if (use) {
        return scaleIngredientPriceForSize(
          use.costPrice ?? ingredient?.costPrice ?? use.price,
          customSize
        );
      }

      return scaleIngredientPriceForSize(ingredient?.costPrice, customSize);
    },
    [customUseByIngredientId, customSize]
  );

  useEffect(() => {
    if (halfItems.length < 2) return;
    setHalfAIndex((current) => Math.min(current, halfItems.length - 1));
    setHalfBIndex((current) => {
      if (current >= halfItems.length) return 1;
      return current === halfAIndex ? (current + 1) % halfItems.length : current;
    });
  }, [halfAIndex, halfItems.length]);

  useEffect(() => {
    if (!selectedProduct || !productModalOpen) return;

    const sizes = getAvailableSizes(selectedProduct);
    setProductSelection((current) => {
      if (current.size && sizes.includes(current.size)) return current;
      return {
        ...current,
        size: sizes.length === 1 ? sizes[0] : "",
      };
    });
  }, [productModalOpen, selectedProduct]);

  useEffect(() => {
    if (!selectedProduct?.categoryId || !productModalOpen) {
      setExtrasAvail([]);
      return;
    }

    const loadExtras = async () => {
      try {
        setExtrasLoading(true);
        const params = new URLSearchParams({
          categoryId: String(selectedProduct.categoryId),
          storeId: String(store?.id || ""),
        });
        const data = await api.get(`/api/ingredient-extras?${params.toString()}`);
        setExtrasAvail(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setExtrasAvail([]);
      } finally {
        setExtrasLoading(false);
      }
    };

    loadExtras();
  }, [productModalOpen, selectedProduct?.categoryId, store?.id]);

  useEffect(() => {
    if (!halfModalOpen || !halfPricingSource?.categoryId) {
      setHalfExtrasAvail([]);
      return;
    }

    const loadHalfExtras = async () => {
      try {
        setHalfExtrasLoading(true);
        const params = new URLSearchParams({
          categoryId: String(halfPricingSource.categoryId),
          storeId: String(store?.id || ""),
        });
        const data = await api.get(`/api/ingredient-extras?${params.toString()}`);
        setHalfExtrasAvail(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setHalfExtrasAvail([]);
      } finally {
        setHalfExtrasLoading(false);
      }
    };

    loadHalfExtras();
  }, [halfModalOpen, halfPricingSource?.categoryId, store?.id]);

  useEffect(() => {
    if (!halfModalOpen) return;

    const validIds = new Set(
      halfExtrasAvail
        .map((extra) => String(extra?.ingredientId ?? ""))
        .filter(Boolean)
    );

    setHalfExtras((current) => {
      let changed = false;
      const next = { A: {}, B: {} };

      ["A", "B"].forEach((side) => {
        Object.entries(current[side] || {}).forEach(([ingredientId, selected]) => {
          if (!selected || !validIds.has(String(ingredientId))) {
            if (selected) changed = true;
            return;
          }

          next[side][ingredientId] = selected;
        });
      });

      return changed ? next : current;
    });
  }, [halfExtrasAvail, halfModalOpen]);

  useEffect(() => {
    if (!halfModalOpen) return;
    if (halfSizeOptions.length === 1) {
      setHalfSize(halfSizeOptions[0]);
    } else if (!halfSizeOptions.includes(halfSize)) {
      setHalfSize("");
    }
  }, [halfModalOpen, halfSize, halfSizeOptions]);

  useEffect(() => {
    if (!customModalOpen) return;

    const loadCustomBuildData = async () => {
      try {
        setCustomLoading(true);
        let ingredientsData = [];

        try {
          ingredientsData = store?.id
            ? await api.get(`/stores/${store.id}/ingredients`)
            : await api.get("/ingredients");
        } catch (ingredientsErr) {
          console.error(ingredientsErr);
          ingredientsData = await api.get("/ingredients");
        }

        const ingredients = Array.isArray(ingredientsData) ? ingredientsData : [];

        setCustomIngredientsCatalog(
          ingredients.filter((ingredient) => {
            const status = String(ingredient?.status || "ACTIVE").toUpperCase();
            const category = normalizeSearchText(ingredient?.category);
            const storeEnabled =
              ingredient.exists == null ||
              (ingredient.exists === true && ingredient.active !== false);

            return storeEnabled && status === "ACTIVE" && !category.includes("bebida");
          })
        );
      } catch (err) {
        console.error(err);
        setCustomIngredientsCatalog([]);
      } finally {
        setCustomLoading(false);
      }
    };

    loadCustomBuildData();
  }, [customModalOpen, partner?.id, store?.id]);

  useEffect(() => {
    if (!customModalOpen || !selectedCustomCategory?.categoryId) {
      setCustomCategoryUses([]);
      return;
    }

    const loadCustomCategoryUses = async () => {
      try {
        setCustomUsesLoading(true);
        const params = new URLSearchParams({
          categoryId: String(selectedCustomCategory.categoryId),
          storeId: String(store?.id || ""),
        });
        const data = await api.get(`/api/ingredient-category-uses?${params.toString()}`);
        setCustomCategoryUses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setCustomCategoryUses([]);
      } finally {
        setCustomUsesLoading(false);
      }
    };

    loadCustomCategoryUses();
  }, [customModalOpen, selectedCustomCategory?.categoryId, store?.id]);

  useEffect(() => {
    if (!customModalOpen || !customSize) return;

    setCustomIngredients((current) => {
      const next = {};

      Object.entries(current).forEach(([id, data]) => {
        const ingredient = customIngredientsCatalog.find(
          (item) => Number(item.id) === Number(id)
        );

        next[id] = {
          ...data,
          basePrice: getCustomIngredientUnitPrice(ingredient || data),
        };
      });

      return next;
    });

    setCustomPendingIngredients((current) => {
      const next = {};

      Object.entries(current).forEach(([id, data]) => {
        const ingredient = customIngredientsCatalog.find(
          (item) => Number(item.id) === Number(id)
        );

        next[id] = {
          ...data,
          basePrice: getCustomIngredientUnitPrice(ingredient || data),
        };
      });

      return next;
    });
  }, [
    customIngredientsCatalog,
    customModalOpen,
    customSize,
    getCustomIngredientUnitPrice,
  ]);

  useEffect(() => {
    if (!customModalOpen) return;
    setCustomCategoryKey("");
    setCustomSize("");
    setCustomQty(1);
    setCustomIngredients({});
    setCustomPendingIngredients({});
    setCustomOpenSection("BASE");
  }, [customModalOpen]);

  useEffect(() => {
    if (!selectedProduct) return;

    setProductSelection((current) => {
      const qty = Number(current.qty || 1);
      if (qty <= selectedProductMaxQty) return current;

      return {
        ...current,
        qty: Math.max(1, selectedProductMaxQty),
      };
    });
  }, [selectedProduct, selectedProductMaxQty]);

  const openProductModal = (item) => {
    const snapshot = freezeProductSelectionPrice(item);
    const sizes = getAvailableSizes(snapshot);
    setSelectedProductId(item.pizzaId);
    setSelectedProductSnapshot(snapshot);
    setProductSelection({
      size: sizes.length === 1 ? sizes[0] : "",
      qty: 1,
      extras: {},
    });
    setShowAllExtras(false);
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setProductModalOpen(false);
    setSelectedProductSnapshot(null);
  };

  const addProductLine = () => {
    if (!selectedProduct || !productSelection.size) return;
    if (selectedProductMaxQty <= 0) return;
    const qty = Math.min(Number(productSelection.qty || 1), selectedProductMaxQty);

    const trendingPricing = getTrendingPricingSnapshot(
      selectedProduct,
      productSelection.size
    );

    const line = {
      cartLineId: `${selectedProduct.pizzaId}-${Date.now()}`,
      pizzaId: selectedProduct.pizzaId,
      name: selectedProduct.name,
      categoryId: selectedProduct.categoryId ?? null,
      category: selectedProduct.category,
      size: productSelection.size,
      qty,
      price: selectedBasePrice,
      extras: selectedExtras,
      allergens: selectedPurchaseAllergens,
      subtotal: selectedUnitTotal * qty,
      image: selectedProduct.image || "",
      directDiscount: trendingPricing ? null : selectedProduct.directDiscount || null,
      source: trendingPricing ? "trending" : undefined,
      trendingPricing: trendingPricing
        ? {
            ...trendingPricing,
            adjustmentTotal: roundMoney(
              trendingPricing.adjustment * qty
            ),
          }
        : null,
    };

    setCart((current) => [...current, line]);
    closeProductModal();
  };

  const decProductQty = () => {
    setProductSelection((current) => ({
      ...current,
      qty: Math.max(1, Number(current.qty || 1) - 1),
    }));
  };

  const incProductQty = () => {
    setProductSelection((current) => ({
      ...current,
      qty: Math.min(selectedProductMaxQty, Number(current.qty || 1) + 1),
    }));
  };

  const toggleProductExtra = (ingredientId) => {
    setProductSelection((current) => ({
      ...current,
      extras: {
        ...current.extras,
        [ingredientId]: !current.extras[ingredientId],
      },
    }));
  };

  const moveHalf = (side, direction) => {
    if (halfItems.length < 2) return;

    const setter = side === "A" ? setHalfAIndex : setHalfBIndex;
    const otherIndex = side === "A" ? halfBIndex : halfAIndex;
    const navigable = getHalfNavigableItems(otherIndex);
    if (navigable.length < 2) return;

    setter((current) => {
      const currentItem = halfItems[current];
      const currentNavIndex = Math.max(
        navigable.findIndex((item) => Number(item.pizzaId) === Number(currentItem?.pizzaId)),
        0
      );
      let nextNavIndex = (currentNavIndex + direction + navigable.length) % navigable.length;
      let nextItem = navigable[nextNavIndex];

      if (Number(nextItem?.pizzaId) === Number(halfItems[otherIndex]?.pizzaId)) {
        nextNavIndex = (nextNavIndex + direction + navigable.length) % navigable.length;
        nextItem = navigable[nextNavIndex];
      }

      const nextIndex = halfItems.findIndex(
        (item) => Number(item.pizzaId) === Number(nextItem?.pizzaId)
      );

      return nextIndex >= 0 ? nextIndex : current;
    });
  };

  const handleHalfPointerStart = (event, side, canNavigate) => {
    if (!canNavigate || event.target?.closest?.("button, a, input, textarea, select")) return;
    if (typeof window !== "undefined" && window.innerWidth > 720) return;

    halfSwipeRef.current = {
      side,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      swiping: false,
    };
  };

  const handleHalfPointerMove = (event) => {
    const gesture = halfSwipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (Math.abs(deltaY) > 14 && Math.abs(deltaY) > Math.abs(deltaX) * 1.18) {
      gesture.swiping = true;
      if (event.cancelable) event.preventDefault();
    }
  };

  const handleHalfPointerEnd = (event) => {
    const gesture = halfSwipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    halfSwipeRef.current = null;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const elapsed = performance.now() - gesture.startedAt;
    const isVerticalSwipe =
      Math.abs(deltaY) >= 44 &&
      Math.abs(deltaY) > Math.abs(deltaX) * 1.18 &&
      elapsed < 900;

    if (isVerticalSwipe) {
      moveHalf(gesture.side, deltaY < 0 ? 1 : -1);
    }
  };

  const toggleHalfExtra = (side, ingredientId) => {
    setHalfExtras((current) => ({
      ...current,
      [side]: {
        ...current[side],
        [ingredientId]: !current[side]?.[ingredientId],
      },
    }));
  };

  const openHalfModal = () => {
    setHalfQty(1);
    setHalfSize("");
    setHalfExtras({ A: {}, B: {} });
    setOpenHalfExtrasA(false);
    setOpenHalfExtrasB(false);
    setHalfAIndex(0);
    setHalfBIndex(halfItems.length > 1 ? 1 : 0);
    setHalfModalOpen(true);
  };

  const addHalfLine = () => {
    if (!halfModalReady) return;

    const priceA = halfPricing.priceA;
    const priceB = halfPricing.priceB;
    const main = halfPricingSource || (priceA >= priceB ? halfA : halfB);
    const subtotal = halfGrandTotal;

    const line = {
      cartLineId: `half-${halfA.pizzaId}-${halfB.pizzaId}-${Date.now()}`,
      type: "HALF_HALF",
      pizzaId: main.pizzaId,
      mainPizzaId: main.pizzaId,
      mainName: main.name,
      leftPizzaId: halfA.pizzaId,
      rightPizzaId: halfB.pizzaId,
      leftName: halfA.name,
      rightName: halfB.name,
      name: `${halfA.name} / ${halfB.name}`,
      category: main.category,
      size: halfSize,
      qty: Number(halfQty || 1),
      price: halfBasePrice,
      extras: halfSelectedExtras,
      allergens: halfPurchaseAllergens,
      subtotal,
      halfMeta: {
        priceRule: "MOST_EXPENSIVE_HALF",
        priceMode: "BASE_PRICE_NO_TRENDING",
        pricingSourcePizzaId: main.pizzaId,
        pricingSourceName: main.name,
        leftPrice: priceA,
        rightPrice: priceB,
      },
      image: main.image || halfA.image || halfB.image || "",
    };

    setCart((current) => [...current, line]);
    setHalfModalOpen(false);
  };

  const updateCustomIngredientDraft = (ingredient, updates) => {
    setCustomPendingIngredients((current) => {
      const existing = current[ingredient.id] || customIngredients[ingredient.id] || {
        ingredientId: ingredient.id,
        name: ingredient.name,
        basePrice: getCustomIngredientUnitPrice(ingredient),
        placement: null,
        quantity: "SIMPLE",
      };
      const updated = {
        ...existing,
        basePrice: getCustomIngredientUnitPrice(ingredient),
        ...updates,
      };

      if (!updated.placement) {
        const copy = { ...current };
        delete copy[ingredient.id];
        return copy;
      }

      return {
        ...current,
        [ingredient.id]: updated,
      };
    });
  };

  const advanceCustomIngredientCategory = (categoryName) => {
    const currentIndex = customOrderedCategories.indexOf(categoryName);
    const nextCategory =
      currentIndex >= 0
        ? customOrderedCategories.slice(currentIndex + 1).find(
            (name) => (customIngredientsByCategory[name] || []).length > 0
          )
        : "";

    setCustomOpenSection(nextCategory || null);
  };

  const confirmCustomIngredient = (ingredient, categoryName) => {
    const pending = customPendingIngredients[ingredient.id];
    if (!pending?.placement || !pending?.quantity) return;

    setCustomIngredients((current) => ({
      ...current,
      [ingredient.id]: pending,
    }));
    setCustomPendingIngredients((current) => {
      const copy = { ...current };
      delete copy[ingredient.id];
      return copy;
    });
    advanceCustomIngredientCategory(categoryName);
  };

  const removeCustomIngredient = (ingredientId) => {
    setCustomIngredients((current) => {
      const copy = { ...current };
      delete copy[ingredientId];
      return copy;
    });
    setCustomPendingIngredients((current) => {
      const copy = { ...current };
      delete copy[ingredientId];
      return copy;
    });
  };

  const openCustomModal = () => {
    setCustomModalOpen(true);
  };

  const addCustomLine = () => {
    if (!selectedCustomCategory || !customReady) return;

    const ingredients = Object.entries(customIngredients).map(([id, data]) => {
      const catalogIngredient = scopedCustomIngredientsCatalog.find(
        (ingredient) => Number(ingredient.id) === Number(id)
      ) || customIngredientsCatalog.find(
        (ingredient) => Number(ingredient.id) === Number(id)
      );

      return {
        id: Number(id),
        ingredientId: Number(id),
        name: catalogIngredient?.name || data.name || "Ingrediente",
        category: catalogIngredient?.category || "OTROS",
        placement: data.placement,
        quantity: data.quantity,
        placementLabel:
          data.placement === "FULL"
            ? "Entera"
            : data.placement === "LEFT"
            ? "Mitad izquierda"
            : data.placement === "RIGHT"
            ? "Mitad derecha"
            : data.placement,
        quantityLabel: data.quantity === "DOUBLE" ? "Doble" : "Simple",
        basePrice: Number(data.basePrice || catalogIngredient?.costPrice || 0),
        allergens: Array.isArray(catalogIngredient?.allergens)
          ? catalogIngredient.allergens
          : [],
        price: getCustomIngredientPrice(data),
      };
    });
    const customDetailIngredients = ingredients.map(buildCustomIngredientDetail);

    const line = {
      cartLineId: `custom-${selectedCustomCategory.key}-${Date.now()}`,
      type: "CUSTOM_BUILD",
      pizzaId: selectedCustomCategory.samplePizzaId,
      name: `Personalizada ${selectedCustomCategory.name}`,
      category: selectedCustomCategory.name,
      size: customSize,
      qty: Number(customQty || 1),
      price: customBasePrice,
      ingredients,
      allergens: customSelectedAllergens,
      extras: [],
      subtotal: customGrandTotal,
      customDetails: {
        categoryName: selectedCustomCategory.name,
        baseProductName:
          selectedCustomBase?.name ||
          selectedCustomCategory.baseName ||
          selectedCustomCategory.name,
        ingredients: customDetailIngredients,
        summary: customDetailIngredients.map((ingredient) => ingredient.label).join(" | "),
      },
      customMeta: {
        categoryId: selectedCustomCategory.categoryId,
        categoryName: selectedCustomCategory.name,
        baseName: selectedCustomCategory.baseName,
        basePizzaId: selectedCustomBase?.pizzaId || selectedCustomCategory.samplePizzaId || null,
        baseProductName: selectedCustomBase?.name || selectedCustomCategory.baseName || selectedCustomCategory.name,
        pricingRule: "CATEGORY_BASELINE",
        basePriceFactor: CUSTOM_BASE_PRICE_FACTOR,
      },
      image: selectedCustomCategory.sampleImage || "",
    };

    setCart((current) => [...current, line]);
    setCustomModalOpen(false);
  };

  const cartCount = useMemo(
    () => cart.filter((item) => !isCouponCartLine(item)).reduce((sum, item) => sum + getCartLineQty(item), 0),
    [cart]
  );
  const deliveryCheckoutFee = useMemo(() => {
    const serviceMode = getStoreServiceMode(store, orderSelection);
    const resolution = orderSelection?.deliveryResolution || {};

    if (serviceMode !== "delivery") return 0;

    const resolvedFee = parseNonNegativeMoney(resolution.deliveryFee);
    if (resolvedFee > 0) return resolvedFee;

    if (partner?.deliveryPricingMode === "VARIABLE") {
      return parseNonNegativeMoney(partner.deliveryFeeBase);
    }

    return parseNonNegativeMoney(partner?.deliveryFeeFixed);
  }, [orderSelection, partner?.deliveryFeeBase, partner?.deliveryFeeFixed, partner?.deliveryPricingMode, store]);
  const paymentPolicySettings = useMemo(
    () => normalizePaymentPolicySettings(partner?.paymentPolicySettings),
    [partner?.paymentPolicySettings]
  );
  const cashPaymentEnabled = isPaymentMethodAllowedForStore(paymentPolicySettings, "cash", store?.id);
  const availablePaymentMethods = useMemo(() => {
    const methods = [
      {
        id: "card",
        icon: "▰",
        title: "Tarjeta",
        description: "Pago online con tarjeta o Klarna en Stripe.",
        ready: true,
      },
    ];

    if (cashPaymentEnabled) {
      methods.push({
        id: "cash",
        icon: "€",
        title: "Efectivo",
        description: "Paga al recibir o recoger.",
        ready: true,
      });
    }

    if (isPaymentMethodAllowedForStore(paymentPolicySettings, "paypal", store?.id)) {
      methods.push({
        id: "paypal",
        icon: <PayPalLogo />,
        title: "PayPal",
        description: "Medio externo pendiente de conexion.",
        ready: false,
      });
    }

    if (isPaymentMethodAllowedForStore(paymentPolicySettings, "crypto", store?.id)) {
      methods.push({
        id: "crypto",
        icon: "₿",
        title: "Cartera virtual",
        description: "Pago con billetera externa pendiente de conexion.",
        ready: false,
      });
    }

    return methods;
  }, [cashPaymentEnabled, paymentPolicySettings, store?.id]);
  const shouldShowPaymentMethodModal = availablePaymentMethods.length > 1;

  useEffect(() => {
    if (!shouldShowPaymentMethodModal && paymentMethodModalOpen) {
      setPaymentMethodModalOpen(false);
    }
  }, [paymentMethodModalOpen, shouldShowPaymentMethodModal]);

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + getCartLinePayableTotal(item), 0),
    [cart]
  );
  const cartTotal = useMemo(
    () => Math.round((cartSubtotal + deliveryCheckoutFee) * 100) / 100,
    [cartSubtotal, deliveryCheckoutFee]
  );
  const minimumPaymentAmount = useMemo(() => {
    const value = Number(partner?.minimumPaymentAmount || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [partner?.minimumPaymentAmount]);
  const minimumPaymentMissing = Math.max(0, minimumPaymentAmount - cartTotal);
  const cartBelowMinimumPayment =
    cartCount > 0 && minimumPaymentAmount > 0 && minimumPaymentMissing > 0.004;
  const couponEligibleSubtotal = useMemo(
    () => cart.filter(isCouponEligibleCartLine).reduce((sum, item) => sum + num(item.subtotal), 0),
    [cart]
  );
  const couponDiscountTotal = useMemo(
    () => cart.filter(isCouponCartLine).reduce((sum, item) => sum + Math.abs(num(item.subtotal)), 0),
    [cart]
  );
  const hasDeliveryFreeCouponApplied = useMemo(
    () => cart.some((line) => isCouponCartLine(line) && isDeliveryFreeCouponData(line.coupon)),
    [cart]
  );
  const couponFooterPercent = useMemo(() => {
    if (couponDiscountTotal <= 0 || couponEligibleSubtotal <= 0) return 0;
    return Math.max(
      1,
      Math.min(99, Math.round((couponDiscountTotal / couponEligibleSubtotal) * 100))
    );
  }, [couponDiscountTotal, couponEligibleSubtotal]);
  const removeCouponFromCart = useCallback(() => {
    setCart((current) => current.filter((line) => !isCouponCartLine(line)));
    setCouponCode("");
    setCouponStatus("");
    setCouponInfoData(null);
  }, []);
  const applyCouponCode = useCallback(async (
    rawCode,
    { openInfo = true, openCartOnValid = true } = {}
  ) => {
    const code = String(rawCode || "").trim().toUpperCase();
    setCouponCode(code);

    if (!code) {
      const emptyData = {
        valid: false,
        status: "empty",
        message: "Escribe un cupon para validarlo.",
        coupon: null,
        discount: 0,
      };
      setCouponStatus(emptyData.message);
      setCouponInfoData(emptyData);
      if (openInfo) setCouponInfoOpen(true);
      return emptyData;
    }

    try {
      setCouponLoading(true);
      setCouponStatus("Validando cupon...");
      const response = await api.post("/api/coupons/validate", {
        partnerId: Number(partner?.id || store?.partnerId),
        storeId: Number(store?.id),
        code,
        subtotal: couponEligibleSubtotal,
        deliveryFee: deliveryCheckoutFee,
      });
      const data = response?.data || response || {};

      setCouponInfoData(data);
      if (openInfo) setCouponInfoOpen(true);
      setCouponStatus(data?.message || "Cupon revisado.");

      if (data?.valid && num(data.discount) > 0 && data?.coupon?.code) {
        const isDeliveryFree = isDeliveryFreeCouponData(data.coupon);
        const discount = isDeliveryFree
          ? Math.min(num(data.discount), deliveryCheckoutFee)
          : Math.min(num(data.discount), couponEligibleSubtotal);
        autoCouponApplyRef.current = `active:${data.coupon.code}:${store?.id}:${couponEligibleSubtotal.toFixed(2)}:${deliveryCheckoutFee.toFixed(2)}`;
        const line = {
          cartLineId: `coupon-${data.coupon.code}`,
          type: "COUPON",
          source: "coupon",
          couponId: data.coupon.id,
          couponCode: data.coupon.code,
          name: isDeliveryFree ? `Delivery Free ${data.coupon.code}` : `Cupon ${data.coupon.code}`,
          category: "Descuento",
          size: isDeliveryFree ? "Envio gratis" : data.coupon.title || "Oferta",
          qty: 1,
          price: -discount,
          subtotal: -discount,
          discount,
          coupon: data.coupon,
        };

        setCart((current) => [
          ...current.filter((item) => !isCouponCartLine(item)),
          line,
        ]);
        if (openCartOnValid) setCartOpen(true);
      } else {
        setCart((current) => current.filter((item) => !isCouponCartLine(item)));
      }

      return data;
    } catch (err) {
      console.error(err);
      const errorData = {
        valid: false,
        status: "error",
        message: "No pudimos validar el cupon ahora.",
        coupon: null,
        discount: 0,
      };
      setCouponStatus(errorData.message);
      setCouponInfoData(errorData);
      if (openInfo) setCouponInfoOpen(true);
      return errorData;
    } finally {
      setCouponLoading(false);
    }
  }, [couponEligibleSubtotal, deliveryCheckoutFee, partner?.id, store?.id, store?.partnerId]);

  const validateCouponCode = async (event) => {
    event.preventDefault();
    resetMobileInputViewport(event.currentTarget?.querySelector("input"));
    await applyCouponCode(couponCode, { openInfo: true, openCartOnValid: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const incomingCoupon = String(params.get("coupon") || "").trim().toUpperCase();
    const shouldOpenCouponInfo =
      params.get("openCoupon") === "1" || params.get("couponSource") === "gallery";

    if (!incomingCoupon) return;

    setCouponCode(incomingCoupon);

    if (params.get("openCart") === "1") {
      setCartOpen(true);
    }

    if (!store?.id || !(partner?.id || store?.partnerId)) return;

    const applyKey = `${incomingCoupon}:${store.id}:${couponEligibleSubtotal.toFixed(2)}:${deliveryCheckoutFee.toFixed(2)}`;
    if (autoCouponApplyRef.current === applyKey) return;
    autoCouponApplyRef.current = applyKey;

    applyCouponCode(incomingCoupon, { openInfo: shouldOpenCouponInfo, openCartOnValid: true });
  }, [
    applyCouponCode,
    couponEligibleSubtotal,
    deliveryCheckoutFee,
    location.search,
    partner?.id,
    store?.id,
    store?.partnerId,
  ]);

  useEffect(() => {
    const code = String(couponCode || couponInfoData?.coupon?.code || "").trim().toUpperCase();
    if (!code || !store?.id || !(partner?.id || store?.partnerId)) return;
    if (couponEligibleSubtotal <= 0 && deliveryCheckoutFee <= 0) return;
    if (cart.some(isCouponCartLine)) return;

    const applyKey = `cart:${code}:${store.id}:${couponEligibleSubtotal.toFixed(2)}:${deliveryCheckoutFee.toFixed(2)}`;
    if (autoCouponApplyRef.current === applyKey) return;
    autoCouponApplyRef.current = applyKey;

    applyCouponCode(code, { openInfo: false, openCartOnValid: false });
  }, [
    applyCouponCode,
    cart,
    couponCode,
    couponEligibleSubtotal,
    deliveryCheckoutFee,
    couponInfoData?.coupon?.code,
    partner?.id,
    store?.id,
    store?.partnerId,
  ]);

  useEffect(() => {
    const couponLine = cart.find(isCouponCartLine);
    if (!couponLine || !store?.id || !(partner?.id || store?.partnerId)) return;

    const code = String(couponLine.couponCode || couponCode || couponInfoData?.coupon?.code || "")
      .trim()
      .toUpperCase();
    if (!code) return;

    const isDeliveryFreeLine = isDeliveryFreeCouponData(couponLine.coupon);
    if (couponEligibleSubtotal <= 0 && (!isDeliveryFreeLine || deliveryCheckoutFee <= 0)) {
      autoCouponApplyRef.current = "";
      setCart((current) => current.filter((item) => !isCouponCartLine(item)));
      const blockedData = {
        valid: false,
        status: "no_eligible_products",
        message: isDeliveryFreeLine
          ? "El cupon Delivery Free necesita un pedido con envio."
          : "El cupon no aplica a Promos, Top Deals, Boost ni recompensas.",
        coupon: couponLine.coupon || { code },
        discount: 0,
      };
      setCouponStatus(blockedData.message);
      setCouponInfoData(blockedData);
      return;
    }

    const applyKey = `active:${code}:${store.id}:${couponEligibleSubtotal.toFixed(2)}:${deliveryCheckoutFee.toFixed(2)}`;
    if (autoCouponApplyRef.current === applyKey) return;
    autoCouponApplyRef.current = applyKey;

    applyCouponCode(code, { openInfo: false, openCartOnValid: false });
  }, [
    applyCouponCode,
    cart,
    couponCode,
    couponEligibleSubtotal,
    deliveryCheckoutFee,
    couponInfoData?.coupon?.code,
    partner?.id,
    store?.id,
    store?.partnerId,
  ]);

  useEffect(() => {
    const partnerId = Number(partner?.id || store?.partnerId);
    if (!partnerId) {
      setHasDeliveryFreeCouponAvailable(false);
      return;
    }

    let cancelled = false;

    const loadDeliveryFreeCouponStatus = async () => {
      try {
        const data = await api.get(`/api/coupons/gallery-pools?partnerId=${partnerId}`);
        const cards = Array.isArray(data?.cards) ? data.cards : [];
        if (!cancelled) {
          setHasDeliveryFreeCouponAvailable(cards.some(isDeliveryFreeCouponData));
        }
      } catch (error) {
        if (!cancelled) setHasDeliveryFreeCouponAvailable(false);
      }
    };

    loadDeliveryFreeCouponStatus();

    return () => {
      cancelled = true;
    };
  }, [partner?.id, store?.partnerId]);

  const startCheckout = useCallback(async (paymentMode = "card", profileOverride = null, options = {}) => {
    const normalizedPaymentMode = paymentMode === "cash" ? "cash" : "card";
    const cashConfirmed = Boolean(options?.cashConfirmed);

    if (profileOverride?.preventDefault) {
      profileOverride = null;
    }

    const serviceMode = getStoreServiceMode(store, orderSelection);

    if (normalizedPaymentMode === "cash" && !cashPaymentEnabled) {
      setCheckoutMessage("Esta tienda no tiene efectivo activo para pedidos online.");
      setCartOpen(true);
      return;
    }

    if (!cartCount || cartTotal <= 0) {
      setCheckoutMessage("Agrega productos al carrito antes de pagar.");
      return;
    }

    if (cartBelowMinimumPayment) {
      setCheckoutMessage(
        `El pago minimo es ${formatMoney(
          minimumPaymentAmount,
          partner?.currency || "EUR"
        )}. Faltan ${formatMoney(minimumPaymentMissing, partner?.currency || "EUR")}.`
      );
      setCartOpen(true);
      return;
    }

    if (
      serviceMode === "delivery" &&
      !String(orderSelection?.deliveryAddress || orderSelection?.deliveryResolution?.formattedAddress || "").trim()
    ) {
      setCheckoutMessage("Confirma la direccion de entrega antes de pagar.");
      setCartOpen(true);
      return;
    }

    const basicProfile = hasBasicCustomerProfile(profileOverride)
      ? profileOverride
      : hasBasicCustomerProfile(savedCustomerProfile)
      ? savedCustomerProfile
      : null;

    if (!basicProfile) {
      setCheckoutPaymentMode(normalizedPaymentMode);
      setPendingCashProfile(null);
      setCashConfirmationOpen(false);
      setCheckoutProfileForm((current) => ({
        name: current.name || "",
        phone: normalizeCheckoutPhoneInput(current.phone || repeatPhone),
      }));
      setCheckoutProfileOpen(true);
      setCartOpen(false);
      setCheckoutMessage("");
      return;
    }

    if (normalizedPaymentMode === "cash" && !cashConfirmed) {
      setCheckoutPaymentMode("cash");
      setPendingCashProfile(basicProfile);
      setCheckoutProfileOpen(false);
      setPaymentMethodModalOpen(false);
      setCartOpen(false);
      setCheckoutMessage("");
      setCashConfirmationOpen(true);
      return;
    }

    try {
      setCheckoutLoading(true);
      setCheckoutMessage("");
      const deliveryResolution = orderSelection?.deliveryResolution || {};
      const deliveryMethod = serviceMode === "delivery" ? "COURIER" : "PICKUP";
      const deliveryCoords = deliveryResolution?.coords || {};
      const deliveryAddress =
        serviceMode === "delivery"
          ? orderSelection?.deliveryAddress || deliveryResolution?.formattedAddress || ""
          : "";
      const deliveryAddressLine2 =
        serviceMode === "delivery" ? orderSelection?.deliveryAddressLine2 || "" : "";
      const checkoutProfile = {
        id: basicProfile.id || basicProfile.customerId || null,
        name: String(basicProfile.name || "").trim(),
        phone: normalizeCheckoutPhoneInput(basicProfile.phone),
        email: normalizeCheckoutEmailInput(basicProfile.email),
        address_1: [deliveryAddress, deliveryAddressLine2].filter(Boolean).join(", "),
      };
      const checkoutResponse = await api.post("/api/checkout/session", {
        partnerId: Number(partner?.id || store?.partnerId),
        storeId: Number(store?.id),
        cart,
        total: cartTotal,
        currency: partner?.currency || "EUR",
        paymentMode: normalizedPaymentMode,
        scheduledFor: scheduledAtIsValid ? scheduledAt.toISOString() : null,
        customer: checkoutProfile,
        delivery: {
          method: deliveryMethod,
          address: deliveryAddress,
          addressLine2: deliveryAddressLine2,
          lat: deliveryCoords?.lat,
          lng: deliveryCoords?.lng,
          deliveryFee: deliveryCheckoutFee,
          distanceKm: deliveryResolution?.nearestStore?.distanceKm,
        },
        frontendOrigin: window.location.origin,
        returnPath: window.location.pathname,
      });
      const checkoutData = checkoutResponse?.data || checkoutResponse || {};
      const checkoutUrl =
        checkoutData?.url ||
        checkoutData?.session?.url ||
        checkoutData?.checkout?.url ||
        checkoutData?.data?.url;

      if (checkoutUrl) {
        try {
          const nextProfile = {
            id: checkoutData?.customerId || checkoutProfile.id || null,
            name: checkoutProfile.name,
            phone: checkoutProfile.phone,
            email: checkoutProfile.email,
          };
          window.localStorage.setItem(customerProfileStorageKey, JSON.stringify(nextProfile));
          setSavedCustomerProfile(nextProfile);
        } catch {
          setSavedCustomerProfile(checkoutProfile);
        }
        await Promise.race([
          postStorefrontPresence({
            partnerId: partner?.id || store?.partnerId,
            storeId: store?.id,
            state: "checkout",
          }),
          new Promise((resolve) => window.setTimeout(resolve, CHECKOUT_PRESENCE_SIGNAL_TIMEOUT_MS)),
        ]);
        setCheckoutProfileOpen(false);
        window.location.assign(checkoutUrl);
        return;
      }

      if (normalizedPaymentMode === "cash" && checkoutData?.orderCode) {
        const nextProfile = {
          id: checkoutData?.customerId || checkoutProfile.id || null,
          name: checkoutProfile.name,
          phone: checkoutProfile.phone,
          email: checkoutProfile.email,
        };
        try {
          window.localStorage.setItem(customerProfileStorageKey, JSON.stringify(nextProfile));
        } catch {
          // Profile persistence is non-critical for confirmed cash orders.
        }
        setSavedCustomerProfile(nextProfile);
        setCheckoutTrackingCode(checkoutData.orderCode);
        setCheckoutProfileOpen(false);
        setCashConfirmationOpen(false);
        setPendingCashProfile(null);
        setCheckoutMessage("Pedido confirmado. Pagaras en efectivo al recibir o recoger.");
        setCart([]);
        try {
          window.localStorage.removeItem(cartDraftStorageKey);
        } catch {
          // Ignore storage cleanup failures.
        }
        setCartOpen(true);
        return;
      }

      console.warn("[StorePage] checkout session without url", checkoutData);
      setCheckoutMessage("No pudimos abrir el metodo de pago. Intentalo de nuevo.");
      setCartOpen(true);
    } catch (err) {
      console.error(err);
      const errorCode = err.response?.data?.error;
      const messages = {
        stripe_not_configured: "Stripe no esta configurado para esta tienda.",
        cash_payment_not_allowed: "Esta tienda no tiene efectivo activo para pedidos online.",
        delivery_method_not_allowed: "Esta tienda no tiene activo ese metodo de entrega.",
        coupon_not_available: "El cupon ya no esta disponible. Quitalo y valida de nuevo.",
        coupon_not_applicable: "El cupon ya no aplica a este carrito.",
        coupon_not_stackable: "Solo puedes usar un cupon por pedido.",
        top_deal_not_available: "Ese Top Deal ya no esta disponible. Quitalo y vuelve a elegirlo.",
        top_deal_quantity_unavailable: `Quedan ${
          err.response?.data?.remainingQuantity ?? 0
        } unidades de ese Top Deal. Ajusta el carrito y vuelve a intentarlo.`,
        customer_profile_required: "Necesitamos tu nombre y telefono para hacer seguimiento al pedido.",
        custom_build_missing_ingredients:
          "La pizza personalizada no tiene ingredientes guardados. Quitala y vuelve a armarla.",
        amount_too_low: "El importe es demasiado bajo para procesar el pago.",
        minimum_payment_not_met: `El pago minimo es ${formatMoney(
          err.response?.data?.minimumPaymentAmount || minimumPaymentAmount,
          partner?.currency || "EUR"
        )}.`,
        stripe_session_url_missing: "Stripe creo la sesion sin URL de pago. Intentalo de nuevo.",
        database_unavailable: "No pudimos conectar con la base de datos. Intentalo de nuevo en unos segundos.",
        checkout_failed: "Stripe no pudo crear la sesion de pago.",
      };
      setCheckoutMessage(messages[errorCode] || "No pudimos iniciar el pago.");
      setCartOpen(true);
    } finally {
      setCheckoutLoading(false);
    }
  }, [
    cart,
    cartDraftStorageKey,
    cartCount,
    cartTotal,
    cartBelowMinimumPayment,
    cashPaymentEnabled,
    customerProfileStorageKey,
    deliveryCheckoutFee,
    minimumPaymentAmount,
    minimumPaymentMissing,
    orderSelection,
    partner?.currency,
    partner?.id,
    repeatPhone,
    scheduledAt,
    scheduledAtIsValid,
    savedCustomerProfile,
    store?.id,
    store?.partnerId,
    store?.pickupEnabled,
    store?.deliveryEnabled,
  ]);

  const handlePrimaryCheckout = useCallback(() => {
    const readyMethods = availablePaymentMethods.filter((method) => method.ready);
    if (shouldShowPaymentMethodModal) {
      setCheckoutMessage("");
      setCartOpen(false);
      setPaymentMethodModalOpen(true);
      return;
    }

    startCheckout(readyMethods[0]?.id || "card");
  }, [availablePaymentMethods, shouldShowPaymentMethodModal, startCheckout]);

  const selectPaymentMethod = useCallback(
    (method) => {
      if (!method?.ready) {
        setCheckoutMessage(`${method?.title || "Este metodo"} aun no esta conectado.`);
        return;
      }

      setPaymentMethodModalOpen(false);
      startCheckout(method.id);
    },
    [startCheckout]
  );
  const confirmCashCheckout = useCallback(() => {
    startCheckout("cash", pendingCashProfile, { cashConfirmed: true });
  }, [pendingCashProfile, startCheckout]);

  const changeCashPaymentMethod = useCallback(() => {
    setCashConfirmationOpen(false);
    setPendingCashProfile(null);
    setCheckoutPaymentMode("card");
    setCheckoutMessage("");
    setCartOpen(true);
  }, []);

  const selectedCheckoutPaymentMode =
    cashPaymentEnabled && checkoutPaymentMode === "cash" ? "cash" : "card";
  const cartCheckoutLabel =
    selectedCheckoutPaymentMode === "cash" ? "Confirmar pedido" : "Pagar ahora";

  const cartProductSubtotal = useMemo(
    () => {
      const eligibleGross = cart
        .filter(isIncentiveEligibleCartLine)
        .reduce((sum, item) => sum + num(item.subtotal), 0);

      return Math.max(0, roundMoney(eligibleGross - couponDiscountTotal));
    },
    [cart, couponDiscountTotal]
  );
  const cartHasBoost = useMemo(
    () => cart.some((line) => line?.source === "queue_boost"),
    [cart]
  );
  const boostCurrency = partner?.currency || "EUR";
  const bootsCurrentPosition = Number.isFinite(Number(bootsQueuePosition))
    ? Number(bootsQueuePosition)
    : null;
  const bootsPositionLabel =
    bootsCurrentPosition == null ? "--" : String(bootsCurrentPosition);
  const bootsOptions = useMemo(
    () =>
      Array.from(
        {
          length: Math.min(
            Number(boostSettings.maxOptions || DEFAULT_BOOST_SETTINGS.maxOptions),
            Math.max(bootsCurrentPosition || 0, 0)
          ),
        },
        (_, index) => {
          const targetPosition = index + 1;
          const jumps = Math.max((bootsCurrentPosition || 0) - targetPosition + 1, 0);

          return {
            targetPosition,
            jumps,
            amount: Math.round(jumps * Number(boostSettings.unitPrice || 0) * 100) / 100,
          };
        }
      ),
    [boostSettings.maxOptions, boostSettings.unitPrice, bootsCurrentPosition]
  );
  const selectedBootsOption =
    bootsOptions.find(
      (option) => String(option.targetPosition) === String(bootsTargetPosition)
    ) || bootsOptions[0];
  const selectedBootsJumpLabel = selectedBootsOption
    ? selectedBootsOption.jumps === 1
      ? "1 puesto"
      : `${selectedBootsOption.jumps} puestos`
    : "Sin salto";
  const selectedBootsTargetLabel = selectedBootsOption
    ? `#${selectedBootsOption.targetPosition}`
    : "--";
  const repeatPreviewLines = useMemo(
    () =>
      Array.isArray(repeatDraft?.items)
        ? repeatDraft.items.map((item, index) => normalizeCartLine(item, index))
        : [],
    [repeatDraft]
  );
  const repeatPreviewTotal = repeatPreviewLines.reduce(
    (sum, line) => sum + getCartLinePayableTotal(line),
    0
  );
  const repeatPreviewExtras = useMemo(
    () =>
      Array.isArray(repeatDraft?.extras)
        ? repeatDraft.extras.map((extra, index) => ({
            id: extra?.id ?? extra?.ingredientId ?? extra?.code ?? `repeat-extra-${index}`,
            name: extra?.name ?? extra?.label ?? extra?.ingredientName ?? "Extra",
            price: num(extra?.price ?? extra?.amount ?? extra?.subtotal),
          }))
        : [],
    [repeatDraft]
  );
  const repeatOrderSlots = useMemo(() => {
    const normalized = Array.isArray(repeatOptions) ? repeatOptions.slice(0, 3) : [];
    while (normalized.length < 3) normalized.push(null);
    return normalized;
  }, [repeatOptions]);
  const incentiveTarget = useMemo(() => {
    if (!activeIncentive) return 0;

    if (activeIncentive.triggerMode === "FIXED") {
      return num(activeIncentive.fixedAmount);
    }

    const percent = num(activeIncentive.percentOverAvg);
    return roundMoney(storeAverageTicket * (1 + percent / 100));
  }, [activeIncentive, storeAverageTicket]);
  const incentiveProgress = incentiveTarget > 0
    ? Math.min(cartProductSubtotal / incentiveTarget, 1)
    : 0;
  const incentiveRemaining = Math.max(incentiveTarget - cartProductSubtotal, 0);
  const incentiveUnlocked = activeIncentive && incentiveTarget > 0 && incentiveRemaining <= 0;
  const incentiveRewardName =
    activeIncentive?.rewardPizza?.name || "tu recompensa";
  const incentiveRewardLabel = `${incentiveRewardName} GRATIS`;
  const incentiveRewardPizza = useMemo(() => {
    const rewardId = Number(activeIncentive?.rewardPizzaId || activeIncentive?.rewardPizza?.id);
    if (!rewardId) return null;

    return (
      menu.find((item) => Number(item.pizzaId) === rewardId) ||
      (activeIncentive?.rewardPizza
        ? {
            pizzaId: rewardId,
            name: activeIncentive.rewardPizza.name,
            category: activeIncentive.rewardPizza.category || "Incentivo",
            image: activeIncentive.rewardPizza.image || "",
            selectSize: activeIncentive.rewardPizza.selectSize || ["M"],
            priceBySize: activeIncentive.rewardPizza.priceBySize || {},
          }
        : null)
    );
  }, [activeIncentive, menu]);
  const incentiveRewardSize = useMemo(() => {
    const sizes = getAvailableSizes(incentiveRewardPizza);
    if (sizes.includes("M")) return "M";
    return sizes[0] || "M";
  }, [incentiveRewardPizza]);
  const incentiveRewardPrice = useMemo(() => {
    if (!incentiveRewardPizza) return 0;
    return priceForSize(incentiveRewardPizza.priceBySize, incentiveRewardSize);
  }, [incentiveRewardPizza, incentiveRewardSize]);
  const activeIncentiveTimeLeftMs = useMemo(
    () => getActiveIncentiveTimeLeftMs(activeIncentive, incentiveNowMs),
    [activeIncentive, incentiveNowMs]
  );
  const nextIncentiveStartsInMs = useMemo(
    () => getNextIncentiveStartsInMs(nextIncentive, incentiveNowMs),
    [nextIncentive, incentiveNowMs]
  );
  const incentivePercent = activeIncentive
    ? Math.round(incentiveProgress * 100)
    : 0;
  const incentiveMessage = activeIncentive
    ? incentiveUnlocked
      ? `${incentiveRewardLabel} desbloqueado`
      : `Faltan ${formatMoney(
          incentiveRemaining,
          partner?.currency || "EUR"
        )} para desbloquear ${incentiveRewardLabel}`
    : nextIncentive
    ? `Proximo incentivo: ${nextIncentive.name}`
    : "No hay incentivo activo ahora";
  const incentiveEyebrow = activeIncentive
    ? incentiveUnlocked
      ? "Premio conseguido"
      : "Incentivo activo"
    : nextIncentive
    ? "Proximo incentivo"
    : "Proximo incentivo";
  const incentiveCounterLabel = activeIncentive
    ? activeIncentiveTimeLeftMs == null
      ? "Activo ahora"
      : `Termina en ${formatDurationMs(activeIncentiveTimeLeftMs)}`
    : nextIncentiveStartsInMs == null
    ? "Sin horario"
    : `Disponible en ${formatDurationMs(nextIncentiveStartsInMs)}`;
  const hasGridIncentiveBanner = Boolean(activeIncentive || nextIncentive);
  const incentiveCurrency = partner?.currency || "EUR";
  const gridIncentiveRemainingLabel = formatMoney(incentiveRemaining, incentiveCurrency);
  const gridIncentiveTargetLabel = formatMoney(incentiveTarget, incentiveCurrency);
  const gridIncentiveCurrentLabel = formatMoney(cartProductSubtotal, incentiveCurrency);
  const gridIncentiveButtonLabel = incentiveUnlocked
    ? "Premio listo"
    : activeIncentive
    ? `Faltan ${gridIncentiveRemainingLabel}`
    : "Proximo incentivo";
  const gridIncentiveButtonValue = incentiveUnlocked
    ? incentiveRewardName
    : activeIncentive
    ? `para ${incentiveRewardName}`
    : nextIncentiveStartsInMs == null
    ? nextIncentive?.name || "Incentivo"
    : `en ${formatDurationMs(nextIncentiveStartsInMs)}`;
  useEffect(() => {
    if (!partner?.id) return undefined;

    const currentCountdown = activeIncentive
      ? activeIncentiveTimeLeftMs
      : nextIncentiveStartsInMs;

    if (currentCountdown == null) return undefined;

    if (currentCountdown > 0) {
      incentiveZeroRefreshRef.current = false;
      return undefined;
    }

    if (incentiveZeroRefreshRef.current) return undefined;
    incentiveZeroRefreshRef.current = true;

    fetchIncentiveSnapshot(partner.id);
    const retryId = window.setTimeout(() => {
      fetchIncentiveSnapshot(partner.id);
    }, 2000);

    return () => {
      window.clearTimeout(retryId);
    };
  }, [
    activeIncentive,
    activeIncentiveTimeLeftMs,
    fetchIncentiveSnapshot,
    nextIncentiveStartsInMs,
    partner?.id,
  ]);

  useEffect(() => {
    if (!hasGridIncentiveBanner) setGridIncentiveOpen(false);
  }, [hasGridIncentiveBanner]);

  useEffect(() => {
    const activeId = Number(activeIncentive?.id);

    if (!activeId) {
      setCart((current) => current.filter((line) => !isIncentiveRewardCartLine(line)));
      return;
    }

    setCart((current) => {
      const withoutOtherIncentives = current.filter(
        (line) =>
          !isIncentiveRewardCartLine(line) ||
          Number(line.incentiveId) === activeId
      );

      if (!incentiveUnlocked) {
        return withoutOtherIncentives.filter(
          (line) => !isIncentiveRewardCartLine(line)
        );
      }

      const alreadyInCart = withoutOtherIncentives.some(
        (line) =>
          isIncentiveRewardCartLine(line) &&
          Number(line.incentiveId) === activeId
      );

      if (
        alreadyInCart ||
        dismissedRewardIncentiveIdsRef.current.has(activeId) ||
        !incentiveRewardPizza ||
        incentiveRewardPrice <= 0
      ) {
        return withoutOtherIncentives;
      }

      return [
        ...withoutOtherIncentives,
        {
          cartLineId: `incentive-${activeId}`,
          type: "INCENTIVE_REWARD",
          source: "incentive_reward",
          incentiveId: activeId,
          rewardPizzaId: Number(
            activeIncentive.rewardPizzaId || incentiveRewardPizza.pizzaId
          ),
          pizzaId: Number(
            activeIncentive.rewardPizzaId || incentiveRewardPizza.pizzaId
          ),
          name: incentiveRewardName,
          category: incentiveRewardPizza.category || "Incentivo",
          size: incentiveRewardSize,
          qty: 1,
          price: -incentiveRewardPrice,
          subtotal: -incentiveRewardPrice,
          extras: [],
          ingredients: [],
          allergens: [],
          image: incentiveRewardPizza.image || "",
        },
      ];
    });
  }, [
    activeIncentive,
    incentiveRewardName,
    incentiveRewardPizza,
    incentiveRewardPrice,
    incentiveRewardSize,
    incentiveUnlocked,
  ]);

  const loadRepeatOrder = async (event) => {
    event?.preventDefault();

    const phone = normalizeRepeatPhoneInput(repeatPhone);
    if (!phone) {
      setRepeatMessage("Escribe el telefono usado en el pedido anterior.");
      return;
    }

    if (phone.length !== 9) {
      setRepeatMessage("Introduce un telefono de 9 digitos.");
      return;
    }

    try {
      setRepeatLoading(true);
      setRepeatMessage("");
      setRepeatSearched(false);
      setRepeatPhone(phone);
      const params = new URLSearchParams({
        partnerId: String(partner?.id || ""),
        storeId: String(store?.id || ""),
        phone,
      });
      const data = await api.get(`/api/myorders/repeat/recent?${params.toString()}`);
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      const drafts = orders.map((item) => item?.cartDraft).filter(Boolean).slice(0, 3);

      setRepeatOptions(drafts);
      setRepeatDraft(null);
      setRepeatSearched(true);
      setRepeatMessage(
        drafts.length
          ? "Elige uno de tus ultimos pedidos para repetirlo."
          : "No encontramos pedidos anteriores para este telefono."
      );
    } catch (err) {
      console.error(err);
      setRepeatDraft(null);
      setRepeatOptions([]);
      setRepeatSearched(true);
      setRepeatMessage(
        getApiErrorMessage(err, "No encontramos un pedido anterior para repetir.")
      );
    } finally {
      setRepeatLoading(false);
    }
  };

  const repeatFoundOrder = (draft = repeatDraft) => {
    const lines = Array.isArray(draft?.items)
      ? draft.items.map((item, index) => normalizeCartLine(item, index))
      : [];

    if (!draft || lines.length === 0) return;

    setCart(lines);
    try {
      window.localStorage.setItem(cartDraftStorageKey, JSON.stringify(draft));
    } catch {
      // The in-memory draft is enough if storage is unavailable.
    }
    if (hasBasicCustomerProfile(draft?.customerData)) {
      const repeatProfile = {
        id: draft.customerData.id || draft.customerId || null,
        name: String(draft.customerData.name || "").trim(),
        phone: normalizeCheckoutPhoneInput(draft.customerData.phone),
        email: normalizeCheckoutEmailInput(draft.customerData.email),
      };

      setSavedCustomerProfile(repeatProfile);
      setCheckoutProfileForm({
        name: repeatProfile.name,
        phone: repeatProfile.phone,
      });
      try {
        window.localStorage.setItem(customerProfileStorageKey, JSON.stringify(repeatProfile));
      } catch {
        // Current state is enough if storage is unavailable.
      }
    }
    setRepeatMessage("Pedido repetido y anadido al carrito.");
    setRepeatOpen(false);
  };

  const promoNeedsChoices = (promo) =>
    Array.isArray(promo?.items) && promo.items.some(isPromoCategoryItem);

  const openPromoPicker = (promo) => {
    setPendingPromo(promo);
    setPromoPickerSelections({});
    setPromoPickerMessage("");
    setPromoPickerOpen(true);
  };

  const closePromoPicker = () => {
    setPromoPickerOpen(false);
    setPendingPromo(null);
    setPromoPickerSelections({});
    setPromoPickerMessage("");
  };

  const choosePromoOption = (choiceKey, item, maxChoices = 1) => {
    setPromoPickerSelections((current) => {
      const currentItems = Array.isArray(current[choiceKey]) ? current[choiceKey] : [];
      const exists = currentItems.some((selected) => Number(selected?.pizzaId) === Number(item?.pizzaId));
      const nextItems = exists
        ? currentItems.filter((selected) => Number(selected?.pizzaId) !== Number(item?.pizzaId))
        : currentItems.length >= maxChoices
          ? [...currentItems.slice(1), item]
          : [...currentItems, item];

      return {
        ...current,
        [choiceKey]: nextItems,
      };
    });
    setPromoPickerMessage("");
  };

  const addPromoLine = (promo, selections = {}) => {
    const promoId = Number(promo?.id);
    const totalPrice = roundMoney(num(promo?.totalPrice));
    if (!promoId || totalPrice <= 0) return;

    const promoItems = Array.isArray(promo.items)
      ? promo.items.map((item, index) => {
          if (isPromoCategoryItem(item)) {
            const choiceKey = getPromoChoiceKey(item, index);
            const selectedItems = Array.isArray(selections[choiceKey]) ? selections[choiceKey] : [];

            return selectedItems.map((selected) => ({
              promoItemType: "CHOICE",
              pizzaId: selected?.pizzaId ?? null,
              name: selected?.name || getPromoCategoryName(item),
              categoryId: selected?.categoryId ?? item?.categoryId ?? null,
              category: selected?.category || getPromoCategoryName(item),
              selectedFromCategory: getPromoCategoryName(item),
              size: item?.size || getDealSize(selected),
              quantity: 1,
            }));
          }

          return {
            promoItemType: "PRODUCT",
            pizzaId: item?.pizzaId ?? null,
            name: item?.name || `Producto ${index + 1}`,
            categoryId: item?.categoryId ?? null,
            category: item?.category || "",
            size: item?.size || "",
            quantity: getCartLineQty(item),
          };
        })
          .flat()
      : [];

    const line = {
      cartLineId: `promo-${promoId}-${Date.now()}`,
      type: "PROMO",
      source: "promo",
      promoId,
      name: promo.title || "Promo",
      category: "Promo",
      size: "",
      qty: 1,
      price: totalPrice,
      subtotal: totalPrice,
      promoItems,
      extras: [],
      ingredients: [],
      allergens: [],
      image: promo.image || "",
    };

    setCart((current) => [...current, line]);
  };

  const handlePromoAdd = (promo) => {
    if (promoNeedsChoices(promo)) {
      openPromoPicker(promo);
      return;
    }

    addPromoLine(promo);
  };

  const confirmPromoPicker = () => {
    if (!pendingPromo) return;
    const missingChoice = (pendingPromo.items || []).some(
      (item, index) =>
        isPromoCategoryItem(item) &&
        (Array.isArray(promoPickerSelections[getPromoChoiceKey(item, index)])
          ? promoPickerSelections[getPromoChoiceKey(item, index)].length
          : 0) !== getPromoRequiredChoiceCount(item)
    );

    if (missingChoice) {
      setPromoPickerMessage("Completa la cantidad exacta de cada eleccion de la promo.");
      return;
    }

    addPromoLine(pendingPromo, promoPickerSelections);
    closePromoPicker();
  };

  const activateBoots = () => {
    if (!selectedBootsOption) return;
    if (cartHasBoost) {
      setBootsMessage("Ya tienes un Boost en el carrito. Borralo para elegir otro.");
      return;
    }

    const boostLine = {
      cartLineId: `queue-boost-${store?.id || "store"}`,
      type: "queue_boost",
      source: "queue_boost",
      name: "Boost de emergencia",
      category: "Boost",
      size: `Posicion #${selectedBootsOption.targetPosition}`,
      qty: 1,
      price: selectedBootsOption.amount,
      subtotal: selectedBootsOption.amount,
      image: "",
      boost: {
        currentPosition: bootsCurrentPosition,
        targetPosition: selectedBootsOption.targetPosition,
        positionsToJump: selectedBootsOption.jumps,
        unitPrice: Number(boostSettings.unitPrice || 0),
        voltaSharePercent: Number(boostSettings.voltaSharePercent || 25),
        partnerSharePercent: Number(boostSettings.partnerSharePercent || 75),
        amount: selectedBootsOption.amount,
        currency: boostCurrency,
      },
    };

    setCart((current) => [...current, boostLine]);
    setBootsMessage("Boost anadido al carrito. Se cobrara al finalizar la compra.");
    setBootsOpen(false);
  };

  const renderTrendingBadge = (item) => {
    if (!hasTrendingPolicy(item)) return null;

    const rank = Number(item.trend?.rank || 0) || 1;

    return (
      <div className="lsf-trendingRank">
        <span>#{rank}</span>
        <strong>Trending</strong>
      </div>
    );
  };

  const renderTrendingKpis = (item) => {
    if (!hasTrendingPolicy(item)) return null;

    const trend = item.trend || {};
    const soldTotal = Number(trend.soldAllTime || 0);

    return (
      <div className="lsf-trendingRibbon" aria-label="Demanda trending">
        <span className="lsf-trendingDemand">
          <strong>{soldTotal}</strong>
          <span>vendidos</span>
        </span>
      </div>
    );
  };

  const renderOfferRibbon = (label, prefix = "Termina en:", variant = "deal") => {
    if (!label) return null;

    return (
      <div className={`lsf-offerRibbon lsf-offerRibbon--${variant}`}>
        <span>{prefix}</span>
        <strong>{label}</strong>
      </div>
    );
  };

  const renderCategoryDealCountdown = (item) => {
    const label = hasTopDealPolicy(item)
      ? formatOfferCountdown(item.directDiscount, incentiveNowMs)
      : "";

    if (!label) return null;

    return (
      <div className="lsf-categoryDealCountdown">
        <span>Termina en:</span>
        <strong>{label}</strong>
      </div>
    );
  };

  const renderProductOfferOverlay = (item, baseSize, { showTrustMeta = false } = {}) => {
    const availabilityPill = renderTopDealAvailabilityPill(item);

    return (
      <div className={`lsf-card__overlay ${showTrustMeta ? "lsf-card__overlay--trust" : ""}`}>
        <div className="lsf-card__ticker">
          <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
            {item.name}
          </div>
        </div>
        {showTrustMeta && renderProductApprovalMeta(item)}
        {availabilityPill ? (
          <div className="lsf-card__dealMeta">
            {renderTopDealPrice(item, baseSize, tick)}
            {availabilityPill}
          </div>
        ) : (
          <div className={`lsf-card__price ${tick ? "is-ticking" : ""}`}>
            {hasTrendingPolicy(item)
              ? renderTrendingPrice(item, baseSize, tick)
              : renderStorefrontPrice(item, baseSize)}
          </div>
        )}
        {showTrustMeta && renderProductGiftAction(item)}
      </div>
    );
  };

  const renderProductTags = (item) => {
    const tags = Array.isArray(item?.productTags)
      ? item.productTags
          .map((tag) => ({
            value: tag,
            label: PRODUCT_TAG_LABELS[tag] || tag,
          }))
          .filter((tag) => tag.label)
          .slice(0, 3)
      : [];

    if (!tags.length) return null;

    return (
      <div className="lsf-productTags" aria-label="Etiquetas del producto">
        {tags.map((tag) => (
          <span key={tag.value} className={`lsf-productTag lsf-productTag--${tag.value}`}>
            {tag.label}
          </span>
        ))}
      </div>
    );
  };

  const renderProductCard = (item) => {
    const flipped = flippedId === item.pizzaId;
    const image = item.image || "";
    const baseSize = getFeedDisplaySize(item);
    const { line, closer } = buildPizzaLine(item);

    return (
      <div
        key={item.pizzaId}
        className={`lsf-card ${hasTopDealPolicy(item) ? "lsf-card--topDeal" : ""} ${hasTrendingPolicy(item) ? "lsf-card--trending has-trending-metrics" : ""} lsf-flip ${flipped ? "is-flipped" : ""}`}
        onClick={() =>
          setFlippedId((current) =>
            current === item.pizzaId ? null : item.pizzaId
          )
        }
        role="listitem"
      >
        <div className="lsf-flip__inner">
          <div className="lsf-flip__front">
            <div className={`lsf-card__image ${hasTopDealPolicy(item) ? "lsf-topDealImage" : ""}`}>
              {image ? (
                <img src={image} alt={item.name} />
              ) : (
                <div className="lsf-card__img is-placeholder">
                  <span>Pizza</span>
                </div>
              )}
            </div>
            {renderDirectDiscountBadge(item, incentiveNowMs)}
            {renderTrendingBadge(item)}
            {renderTrendingKpis(item) || renderCategoryDealCountdown(item)}
            {renderProductTags(item)}

            <button
              type="button"
              className="lsf-card__addbtn"
              onClick={(event) => {
                event.stopPropagation();
                openProductModal(item);
              }}
              aria-label={`Comprar ${item.name}`}
            >
              <CartPlusIcon />
            </button>

            {renderProductOfferOverlay(item, baseSize, {
              showTrustMeta: shouldShowProductTrustMeta(item),
            })}
          </div>

          <div className="lsf-flip__back">
            <div className="lsf-flip-desc">
              <div className="lsf-flip-title">Tu crush sin filtro</div>
              <div className="lsf-flip-line">{line}</div>
              <div className="lsf-flip-closer">{closer}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTopDealCard = (item) => {
    const flipped = flippedId === `top-deal-${item.pizzaId}`;
    const image = item.image || "";
    const baseSize = getDealSize(item);
    const discountSticker = getTopDealStickerLabel(item, baseSize);
    const countdownLabel = formatOfferCountdown(item.directDiscount, incentiveNowMs);
    const { line, closer } = buildPizzaLine(item);

    return (
      <div key={item.pizzaId} className="lsf-topDealItem" role="listitem">
        <div
          className={`lsf-card lsf-card--topDeal ${hasTrendingPolicy(item) ? "lsf-card--trending has-trending-metrics" : ""} lsf-flip ${flipped ? "is-flipped" : ""}`}
          onClick={() =>
            setFlippedId((current) =>
              current === `top-deal-${item.pizzaId}` ? null : `top-deal-${item.pizzaId}`
            )
          }
        >
          <div className="lsf-flip__inner">
            <div className="lsf-flip__front">
              <div className="lsf-card__image lsf-topDealImage">
                {image ? (
                  <img src={image} alt={item.name} />
                ) : (
                  <div className="lsf-card__img is-placeholder">
                    <span>Deal</span>
                  </div>
                )}
              </div>

              <span className="lsf-topDealBadge">Top Deal</span>
              {renderTrendingBadge(item)}
              {renderTrendingKpis(item) || renderOfferRibbon(countdownLabel, "Termina en:", "deal")}
              {renderProductTags(item)}
              {discountSticker && (
                <span className="lsf-topDealDiscountSticker">
                  <strong>{discountSticker}</strong>
                  <small>off</small>
                </span>
              )}

              <button
                type="button"
                className="lsf-card__addbtn"
                onClick={(event) => {
                  event.stopPropagation();
                  openProductModal(item);
                }}
                aria-label={`Comprar ${item.name}`}
              >
                <CartPlusIcon />
              </button>

              <div className="lsf-card__overlay lsf-card__overlay--deal">
                <div className="lsf-card__ticker">
                  <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                    {item.name}
                  </div>
                </div>
                <div className="lsf-card__dealMeta">
                  {renderTopDealPrice(item, baseSize, tick)}
                  {renderTopDealAvailabilityPill(item)}
                </div>
              </div>
            </div>

            <div className="lsf-flip__back">
              <div className="lsf-flip-desc">
                <div className="lsf-flip-title">Top Deal</div>
                <div className="lsf-flip-line">{line}</div>
                <div className="lsf-flip-closer">{closer}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  if (error) {
    return (
      <div className="sf-error">
        <div className="sf-errorCard">{error}</div>
      </div>
    );
  }

  if (!store || !portalReady) {
    return (
      <OrderPortalTransition
        title="Loading store"
        eyebrow="Store launch"
        mode="store"
        partnerName={orderSelection?.storeName || orderSelection?.partnerName || storeSlug}
      />
    );
  }

  const renderStoreInfoTicker = () => {
    const showSelectProductsPrompt = isStorefrontButtonVisible("selectProducts");
    const serviceMode = getStoreServiceMode(store, orderSelection);
    const deliveryDestinationLabel = getDeliveryDestinationTickerLabel(orderSelection);
    const orderModeLabel =
      serviceMode === "delivery"
        ? deliveryDestinationLabel || "Direccion pendiente"
        : getPickupDestinationTickerLabel(orderSelection, store);
    const orderModeCaption =
      serviceMode === "delivery" ? "Enviaremos a:" : "Pedido a recoger:";
    const orderModeAria =
      serviceMode === "delivery"
        ? `${orderModeCaption} ${orderModeLabel}`
        : `${orderModeCaption} ${orderSelection?.storeName || store.storeName}`;
    const changeModeLabel =
      serviceMode === "delivery" ? "Cambiar a recogida" : "Cambiar a delivery";
    const tickerLabel = [
      `Bienvenidos a ${partner?.name || store.storeName}`,
      store?.city || "Ciudad",
      store.storeName,
      orderModeAria,
      showSelectProductsPrompt ? "Selecciona productos" : "",
      changeModeLabel,
    ].filter(Boolean).join(", ");

    return (
      <button
        type="button"
        className={`sf-engineUtilityPill sf-lsfStoreTicker ${
          orderModeLabel ? "has-order-mode" : ""
        } ${
          deliveryDestinationLabel ? "has-delivery-destination" : ""
        } sf-lsfStoreTicker--${serviceMode}`}
        aria-label={tickerLabel}
        data-mobile-label={orderModeLabel || `${store?.city || "Ciudad"} - ${store.storeName}`}
        title={changeModeLabel}
        onClick={() =>
          navigate(`/${partnerSlug}/order`, {
            state: {
              orderTrail: "change-service",
              partnerName: partner?.name || store?.partnerName || store?.storeName,
              storeName: store?.storeName,
              currentStoreSlug: storeSlug,
              currentServiceMode: serviceMode,
              returnToStorePath: `/${partnerSlug}/${storeSlug}`,
            },
          })
        }
      >
        <span className={`sf-orderModeStatic sf-orderModeStatic--${serviceMode}`}>
          <span className="sf-orderModeTicker">
            <span className="sf-orderModeTickerTrack">
              <span className="sf-orderModeTickerLine">{orderModeCaption}</span>
              <strong className="sf-orderModeTickerLine">{orderModeLabel}</strong>
            </span>
          </span>
        </span>
        <span className="sf-engineUtilityPillTicker">
          <span className="sf-engineUtilityPillTrack">
            <span className="sf-engineUtilityPillLine">
              Bienvenidos a
            </span>
            <span className="sf-engineUtilityPillLine">
              {partner?.name || store.storeName}
            </span>
            <span className="sf-engineUtilityPillLine">
              {store?.city || "Ciudad"}
            </span>
            <span className="sf-engineUtilityPillLine">
              <span className="sf-engineUtilityPillInline">
                <CountryFlag countryCode={partner?.country} />
                <span>{store.storeName}</span>
              </span>
            </span>
            <span className={`sf-engineUtilityPillLine sf-engineUtilityPillLine--mode sf-engineUtilityPillLine--mode-${serviceMode}`}>
              {orderModeLabel}
            </span>
            {showSelectProductsPrompt && (
              <span className="sf-engineUtilityPillLine sf-engineUtilityPillLine--select">
                Selecciona productos
              </span>
            )}
          </span>
        </span>
        <span className="sf-orderModeSwitch" aria-hidden="true">
          <span className="sf-orderModeSwitchText">Cambiar</span>
        </span>
      </button>
    );
  };

  // eslint-disable-next-line no-unused-vars
  const renderScheduleButton = () =>
    isStorefrontButtonVisible("scheduleOrder") ? (
      <button
        type="button"
        className={`lsf-schedulebtn ${scheduledOrderLabel ? "has-schedule" : ""}`}
        onClick={() => setScheduleOpen(true)}
        title={scheduledOrderLabel || "Programar pedido"}
      >
        <span className="lsf-schedulebtn__icon" aria-hidden="true">â±</span>
        <span className="lsf-schedulebtn__text">{scheduledOrderLabel || "Programar"}</span>
      </button>
    ) : null;

  // eslint-disable-next-line no-unused-vars
  const renderCartButton = () => (
    <button
      type="button"
      className={`lsf-cartbtn ${cartCount > 0 ? "is-active" : ""}`}
      onClick={() => setCartOpen(true)}
      aria-label="Abrir carrito"
    >
      <span className="lsf-cartbtn__icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="M8 9h9.2l5.5 28.2c.8 4.1 4.4 7 8.6 7h17.8c3.9 0 7.4-2.5 8.5-6.3l5.4-18.1c.8-2.7-1.2-5.4-4-5.4H22.4l-1.2-6.1C20.8 6.4 19.2 5 17.3 5H8a4 4 0 0 0 0 8Z" />
          <path d="M29 58a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm22 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
        </svg>
      </span>
      <span className="lsf-cartbtn__count">{cartCount}</span>
      <span className="lsf-cartbtn__total">â‚¬{cartTotal.toFixed(2)}</span>
    </button>
  );

  const renderScheduleButtonSafe = () =>
    isStorefrontButtonVisible("scheduleOrder") ? (
      <button
        type="button"
        className={`lsf-schedulebtn ${scheduledOrderLabel ? "has-schedule" : ""}`}
        onClick={() => setScheduleOpen(true)}
        title={scheduledOrderLabel || "Programar pedido"}
      >
        <span className="lsf-schedulebtn__icon" aria-hidden="true">{"\u23F1"}</span>
        <span className="lsf-schedulebtn__text">{scheduledOrderLabel || "Programar"}</span>
      </button>
    ) : null;

  const renderCartButtonSafe = () => (
    <button
      type="button"
      className={`lsf-cartbtn ${cartCount > 0 ? "is-active" : ""}`}
      onClick={() => setCartOpen(true)}
      aria-label="Abrir carrito"
    >
      <span className="lsf-cartbtn__icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="M8 9h9.2l5.5 28.2c.8 4.1 4.4 7 8.6 7h17.8c3.9 0 7.4-2.5 8.5-6.3l5.4-18.1c.8-2.7-1.2-5.4-4-5.4H22.4l-1.2-6.1C20.8 6.4 19.2 5 17.3 5H8a4 4 0 0 0 0 8Z" />
          <path d="M29 58a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm22 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
        </svg>
      </span>
      <span className="lsf-cartbtn__count">{cartCount}</span>
      <span className="lsf-cartbtn__total">{"\u20AC"}{cartTotal.toFixed(2)}</span>
    </button>
  );

  const renderCallButtonSafe = () =>
    isStorefrontButtonVisible("call") ? (
      <button
        type="button"
        className="lsf-callbtn"
        onClick={() => {
          if (phoneHref) window.location.href = phoneHref;
        }}
        disabled={!phoneHref}
        aria-label="Llamar a la pizzeria"
        title={phoneHref ? "Llamar a la pizzeria" : "Telefono no disponible"}
      >
        <span className="lsf-callbtn__icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" focusable="false">
            <path d="M22.3 8.5c2.1-1.1 4.7-.4 6 1.6l5.2 8.1c1.2 1.8 1 4.2-.4 5.8l-3.4 3.8c2.6 5.1 6.8 9.3 11.9 11.9l3.8-3.4c1.6-1.4 4-1.6 5.8-.4l8.1 5.2c2 1.3 2.7 3.9 1.6 6l-3 5.7c-1.1 2.1-3.4 3.4-5.8 3.1C28.5 53.2 10.8 35.5 8.1 11.9c-.3-2.4 1-4.7 3.1-5.8l5.7-3Z" />
          </svg>
        </span>
      </button>
    ) : null;

  const activeCommercialTabIndex = isCommercialTabActive
    ? Math.max(0, commercialTabs.findIndex((tab) => tab.id === activeTab))
    : 0;
  const activeCommercialTab =
    commercialTabs[activeCommercialTabIndex] || commercialTabs[0] || null;

  const renderGridFocusBackContent = () => {
    if (isProductSearchActive) {
      return baseFilteredMenu.length ? (
        <div className="lsf-searchResultsStage">
          <div className="lsf-searchResultsHead">
            <span>Busqueda global</span>
            <strong>{baseFilteredMenu.length} productos</strong>
          </div>
          <div className="lsf-grid-wrap">
            <div className="lsf-grid lsf-grid--searchResults" role="list">
              {baseFilteredMenu.map((item) => renderProductCard(item))}
            </div>
          </div>
        </div>
      ) : null;
    }

    if (activeTab === TOP_DEAL_TAB) {
      return filteredTopDeals.length ? (
        <div className="lsf-grid-wrap">
          <div className="lsf-grid lsf-grid--topDeals" role="list">
            {filteredTopDeals.map((item) => renderTopDealCard(item))}
          </div>
        </div>
      ) : null;
    }

    if (activeTab === PROMOS_TAB) {
      return filteredPromos.length ? (
        <div className="lsf-grid-wrap">
          <div className="lsf-grid lsf-grid--promos" role="list">
            {filteredPromos.map((promo) => {
              const promoItems = Array.isArray(promo.items) ? promo.items : [];
              const promoDiscountPercent = getPromoDiscountPercent(promo, menuCatalog);
              const promoCountdown = formatOfferCountdown(promo, incentiveNowMs);

              return (
                <div
                  key={`grid-focus-back-promo-${promo.id}`}
                  className="lsf-card lsf-card--promo lsf-flip"
                  role="listitem"
                >
                  <div className="lsf-flip__inner">
                    <div className="lsf-flip__front">
                      <div className={`lsf-card__image lsf-promoImage ${promo.image ? "has-image" : ""}`}>
                        {promo.image ? (
                          <img src={promo.image} alt={promo.title} />
                        ) : (
                          <div className="lsf-card__img is-placeholder">
                            <span>Promo</span>
                          </div>
                        )}
                      </div>
                      <span className="lsf-promoBadge">Promo</span>
                      {promoDiscountPercent > 0 && (
                        <span className="lsf-topDealDiscountSticker lsf-promoDiscountSticker">
                          <strong>-{promoDiscountPercent}%</strong>
                          <small>off</small>
                        </span>
                      )}
                      {renderOfferRibbon(promoCountdown, "Termina en:", "promo")}
                      <div className="lsf-card__overlay">
                        <div className="lsf-card__ticker">
                          <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                            {promo.title}
                          </div>
                        </div>
                        {renderPromoPrice(promo, menuCatalog, tick)}
                      </div>
                    </div>
                    <div className="lsf-flip__back">
                      <div className="lsf-flip-desc lsf-promoFlipDesc">
                        <div className="lsf-flip-title">Contenido</div>
                        <div className="lsf-promoFlipList">
                          {promoItems.length ? (
                            promoItems.map((item, index) => (
                              <span key={`grid-focus-back-promo-item-${promo.id}-${item.pizzaId || item.name || index}`}>
                                {getPromoItemLabel(item)}
                              </span>
                            ))
                          ) : (
                            <span>Promo activa</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null;
    }

    if (activeTab === TRENDING_TAB) {
      return filteredTrending.length ? (
        <div className="lsf-grid-wrap">
          <div className="lsf-grid lsf-grid--trending" role="list">
            {filteredTrending.map((item) => renderProductCard(item))}
          </div>
        </div>
      ) : null;
    }

    if (activeTab === UPCOMING_TAB) {
      return filteredUpcoming.length ? (
        <div className="lsf-grid-wrap">
          <div className="lsf-grid lsf-grid--upcoming" role="list">
            {filteredUpcoming.map((item) => renderProductCard(item))}
          </div>
        </div>
      ) : null;
    }

    return visibleMenu.length ? (
      <div className="lsf-grid-wrap">
        <div className="lsf-grid" role="list">
          {visibleMenu.map((item) => renderProductCard(item))}
        </div>
      </div>
    ) : null;
  };

  const explicitOrderMode = String(orderSelection?.serviceMode || "").toLowerCase();
  const directDeliveryGateRequired =
    storeAllowsDelivery(store) &&
    !storeAllowsPickup(store) &&
    explicitOrderMode !== "delivery";

  return (
    <div
      className={`sf-shell sf-shell--mode-${storefrontMode} ${gridFocusMode ? "is-grid-focused" : ""} ${gridFocusTransition} ${
        gridFocusSwipePreview
          ? `is-grid-focus-swiping ${gridFocusSwipePreview.directionClass}`
          : ""
        }`}
      style={{
        ...themeStyle,
        ...(gridFocusSwipePreview
          ? {
              "--sf-grid-swipe-offset-x": gridFocusSwipePreview.offsetX,
              "--sf-grid-swipe-lift": gridFocusSwipePreview.lift,
              "--sf-grid-swipe-scale": gridFocusSwipePreview.scale,
              "--sf-grid-swipe-radius": gridFocusSwipePreview.radius,
              "--sf-grid-swipe-shadow-y": gridFocusSwipePreview.shadowY,
              "--sf-grid-swipe-shadow-blur": gridFocusSwipePreview.shadowBlur,
              "--sf-grid-swipe-backdrop-opacity": gridFocusSwipePreview.backdropOpacity,
            }
          : {}),
      }}
    >
      {directDeliveryGateRequired && (
        <div className="sf-modalOverlay sf-serviceGateOverlay">
          <div className="sf-modalCard sf-serviceGateModal">
            <span>Solo delivery</span>
            <h3>Esta pizzeria solo hace delivery</h3>
            <p>Confirma tu direccion para revisar cobertura antes de entrar al menu.</p>
            <div className="sf-serviceGateActions">
              <button
                type="button"
                className="sf-secondaryBtn"
                onClick={() => navigate(`/${partnerSlug}`)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="sf-primaryBtn"
                onClick={() =>
                  navigate(`/${partnerSlug}/order`, {
                    state: {
                      orderTrail: "delivery-only-store",
                      partnerName: partner?.name || store?.partnerName || store?.storeName,
                      storeName: store?.storeName,
                      currentStoreSlug: storeSlug,
                      startServiceMode: "delivery",
                    },
                  })
                }
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {gridFocusSwipePreview && !gridFocusMode && (
        <div className="sf-gridFocusBackPage" aria-hidden="true">
          <div className="lsf-gridFocusSearch">
            <div className="sf-engineSearchWrap">
              {!search && (
                <span className="sf-engineSearchTicker" aria-hidden="true">
                  <span className="sf-engineSearchTickerTrack">
                    <span>Buscar pizza o ingrediente...</span>
                  </span>
                </span>
              )}
              <input
                className="sf-engineSearch"
                type="search"
                placeholder=""
                value={search}
                readOnly
                tabIndex={-1}
              />
              <button
                type="button"
                className="sf-engineSearchBtn"
                aria-label="Buscar"
                tabIndex={-1}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="11"
                    cy="11"
                    r="6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M16 16l4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div
            className={`lsf-gridContext lsf-gridContext--${gridContext.tone} ${
              hasGridIncentiveBanner ? "has-grid-incentive" : ""
            }`}
          >
            <div className="lsf-gridContext__category">
              <span>{gridContext.eyebrow}</span>
              <strong>{gridContext.label}</strong>
              <em>
                {gridContext.count === 1
                  ? "1 producto"
                  : `${gridContext.count} productos`}
              </em>
            </div>
          </div>
          {renderGridFocusBackContent()}
        </div>
      )}
      <div className="sf-wrap sf-menu">
        <section className="sf-storeHeader sf-storeHeader--desktop">

          <div className="lsf-top__actions">
            {renderStoreInfoTicker()}
            {isStorefrontButtonVisible("scheduleOrder") && (
              <button
                type="button"
                className={`lsf-schedulebtn ${scheduledOrderLabel ? "has-schedule" : ""}`}
                onClick={() => setScheduleOpen(true)}
                title={scheduledOrderLabel || "Programar pedido"}
              >
                <span className="lsf-schedulebtn__icon" aria-hidden="true">⏱</span>
                <span className="lsf-schedulebtn__text">{scheduledOrderLabel || "Programar"}</span>
              </button>
            )}

            <button
              type="button"
              className={`lsf-cartbtn ${cartCount > 0 ? "is-active" : ""}`}
              onClick={() => setCartOpen(true)}
              aria-label="Abrir carrito"
            >
              <span className="lsf-cartbtn__icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" focusable="false">
                  <path d="M8 9h9.2l5.5 28.2c.8 4.1 4.4 7 8.6 7h17.8c3.9 0 7.4-2.5 8.5-6.3l5.4-18.1c.8-2.7-1.2-5.4-4-5.4H22.4l-1.2-6.1C20.8 6.4 19.2 5 17.3 5H8a4 4 0 0 0 0 8Z" />
                  <path d="M29 58a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm22 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                </svg>
              </span>
              <span className="lsf-cartbtn__count">{cartCount}</span>
              <span className="lsf-cartbtn__total">€{cartTotal.toFixed(2)}</span>
            </button>
            {renderCallButtonSafe()}
          </div>
        </section>

        <section
          ref={lsfSurfaceRef}
          className={`sf-lsfSurface lsf-wrapper lsf-mobile ${
            lsfSurfaceStickySuspended
              ? "is-sticky-suspended"
              : lsfSurfaceDocked
                ? "is-docked"
                : ""
          }`}
        >
          <div className="sf-lsfNavCeiling">
            <div className="sf-lsfMobileHeader">
              <div className="sf-lsfMobileInfo">
                {renderStoreInfoTicker()}
              </div>

              <div className="sf-lsfMobileHeaderActions">
                {renderScheduleButtonSafe()}
                {renderCartButtonSafe()}
                {renderCallButtonSafe()}
              </div>
            </div>

            <div className="sf-lsfActionSearchLine">
              {isStorefrontButtonVisible("coupons") && (
                <button
                  type="button"
                  className={
                    storefrontMode === "commercial-light"
                      ? `sf-couponEntryBtn ${hasDeliveryFreeCouponAvailable ? "has-delivery-free" : ""}`
                      : `sf-offersBtn sf-lsfOfferBtn sf-lsfOfferBtn--mobilePunch ${offerVariant.className} ${
                          hasDeliveryFreeCouponAvailable ? "has-delivery-free" : ""
                        }`
                  }
                  onClick={() =>
                    navigate(`/${partnerSlug}/coupons`, {
                      state: { returnToStorePath: `/${partnerSlug}/${storeSlug}` },
                    })
                  }
                >
                  <span
                    className={
                      storefrontMode === "commercial-light"
                        ? "sf-couponEntryBtn__label"
                        : "sf-offersBtnLabel"
                    }
                  >
                    {hasDeliveryFreeCouponAvailable ? (
                      <>
                        <span>COUPONS</span>
                        <span>ENVIO GRATIS</span>
                      </>
                    ) : (
                      offerVariant.label
                    )}
                  </span>
                </button>
              )}

              {isStorefrontButtonVisible("halfAndHalf") && (
                <button
                  type="button"
                  className={`lsf-buildmode ${halfModalOpen ? "is-active" : ""}`}
                  onClick={openHalfModal}
                >
                  Mitad / Mitad
                </button>
              )}
              {isStorefrontButtonVisible("customPizza") && (
                <button
                  type="button"
                  className={`lsf-buildmode ${customModalOpen ? "is-active" : ""}`}
                  onClick={openCustomModal}
                >
                  Arma tu pizza
                </button>
              )}

              <div className="sf-lsfSearchCluster">
                <div className="sf-engineSearchRow sf-engineSearchRow--lsf">
                  <div className="sf-engineSearchWrap">
                    <input
                      className="sf-engineSearch"
                      type="search"
                      placeholder="Buscar pizza o ingrediente..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          resetMobileInputViewport(event.currentTarget);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="sf-imageSearchBtn"
                      aria-label="Buscar por imagen en construccion"
                      data-tooltip="En construccion"
                      onClick={(event) => event.preventDefault()}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M8 4H5.8A1.8 1.8 0 0 0 4 5.8V8M16 4h2.2A1.8 1.8 0 0 1 20 5.8V8M4 16v2.2A1.8 1.8 0 0 0 5.8 20H8M20 16v2.2A1.8 1.8 0 0 1 18.2 20H16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3.2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="sf-engineSearchBtn"
                      aria-label="Buscar"
                      onClick={() => {
                        resetMobileInputViewport(document.activeElement);
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle
                          cx="11"
                          cy="11"
                          r="6.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        />
                        <path
                          d="M16 16l4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {storefrontMode !== "commercial-light" && isStorefrontButtonVisible("repeatOrder") && (
                  <button
                    type="button"
                    className={`sf-repeatOrderBtn ${cartCount > 0 ? "has-draft" : ""}`}
                    onClick={() => setRepeatOpen(true)}
                    aria-label="Repetir pedido anterior"
                    title="Repetir pedido anterior"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M8 7H5v-3M5.6 7A7.2 7.2 0 1 1 4.9 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 12h6M12 9v6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="sf-repeatOrderBtn__mark" aria-hidden="true">R</span>
                    <span className="sf-repeatOrderBtn__label">Repetir pedido</span>
                  </button>
                )}
              </div>
            </div>

            <IncentiveBanner
              active={Boolean(activeIncentive)}
              waiting={!activeIncentive && Boolean(nextIncentive)}
              unlocked={Boolean(incentiveUnlocked)}
              eyebrow={incentiveEyebrow}
              message={incentiveMessage}
              counterLabel={incentiveCounterLabel}
              rewardLabel={incentiveRewardLabel}
              progress={incentiveProgress}
              percent={incentivePercent}
            />

            <div
              className="lsf-tabs"
              ref={tabsScrollerRef}
              role="tablist"
              aria-label="Categorias del menu"
              onClickCapture={handleTabsClickCapture}
              onPointerDown={handleTabsPointerDown}
              onPointerMove={handleTabsPointerMove}
              onPointerUp={finishTabsDrag}
              onPointerCancel={finishTabsDrag}
              onWheel={() => pauseTabsTicker(6200)}
              onScroll={handleTabsScroll}
            >
              <div
                className={`lsf-segmentTabs is-count-${commercialTabs.length} ${
                  offerTabsManual ? "is-manual" : "is-auto"
                }`}
                aria-label="Ofertas destacadas"
              >
                <span className="lsf-segmentTabs__mobile">
                  {activeCommercialTab && (
                    <button
                      key={activeCommercialTab.id}
                      type="button"
                      data-tab-id={activeCommercialTab.id}
                      data-offer-index={activeCommercialTabIndex}
                      className={`lsf-tab lsf-tab--segment lsf-tab--offer-${activeCommercialTab.tone} ${
                        activeTab === activeCommercialTab.id ? "is-active" : ""
                      }`}
                      onClick={() => handleCommercialTabClick(activeCommercialTab.id)}
                      onDoubleClick={handleCommercialTabDoubleClick}
                    >
                      {activeCommercialTab.label}
                    </button>
                  )}
                </span>
                <span className="lsf-segmentTabs__desktop">
                  {commercialTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      data-tab-id={tab.id}
                      className={`lsf-tab lsf-tab--segment lsf-tab--offer-${tab.tone} ${
                        activeTab === tab.id ? "is-active" : ""
                      }`}
                      onClick={() => handleCommercialTabClick(tab.id)}
                      onDoubleClick={handleCommercialTabDoubleClick}
                    >
                      {tab.label}
                    </button>
                  ))}
                </span>
              </div>

              <div className="lsf-categoryTabs" aria-label="Categorias">
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    data-tab-id={tab.id}
                    data-active={activeTab === tab.id ? "true" : undefined}
                    className={`lsf-tab lsf-tab--category ${activeTab === tab.id ? "is-active" : ""}`}
                    onClick={() => selectCategoryTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

       

        <section className="sf-engineCard sf-engineCard--lsf">
          <div
            ref={gridStageRef}
            className="sf-engineGridStage sf-engineGridStage--lsf"
            onPointerDown={handleGridPointerDown}
            onPointerMove={handleGridPointerMove}
            onPointerUp={handleGridPointerEnd}
            onPointerCancel={handleGridPointerEnd}
            onTouchStart={handleGridTouchStart}
            onTouchMove={handleGridTouchMove}
            onTouchEnd={handleGridTouchEnd}
            onTouchCancel={handleGridTouchEnd}
            onClickCapture={handleGridClickCapture}
          >
            {gridFocusMode && (
              <>
                <div className="lsf-gridFocusActions">
                  {hasGridIncentiveBanner && (
                    <button
                      type="button"
                      className={`lsf-gridContext__incentiveButton ${
                        incentiveUnlocked ? "is-ready" : activeIncentive ? "is-active" : "is-waiting"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setGridIncentiveOpen(true);
                      }}
                      aria-label={incentiveMessage}
                      title={incentiveMessage}
                    >
                      <span>{gridIncentiveButtonLabel}</span>
                      <strong>{gridIncentiveButtonValue}</strong>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`lsf-cartbtn lsf-gridFocusCart ${cartCount > 0 ? "is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCartOpen(true);
                    }}
                    aria-label="Abrir carrito"
                    title="Abrir carrito"
                  >
                    <span className="lsf-cartbtn__icon" aria-hidden="true">
                      <svg viewBox="0 0 64 64" focusable="false">
                        <path d="M8 9h9.2l5.5 28.2c.8 4.1 4.4 7 8.6 7h17.8c3.9 0 7.4-2.5 8.5-6.3l5.4-18.1c.8-2.7-1.2-5.4-4-5.4H22.4l-1.2-6.1C20.8 6.4 19.2 5 17.3 5H8a4 4 0 0 0 0 8Z" />
                        <path d="M29 58a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm22 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                      </svg>
                    </span>
                    <span className="lsf-cartbtn__count">{cartCount}</span>
                    <span className="lsf-cartbtn__total">{"\u20AC"}{cartTotal.toFixed(2)}</span>
                  </button>
                  <button
                    type="button"
                    className="lsf-gridContext__exit"
                    onClick={(event) => {
                      event.stopPropagation();
                      setGridFocusMode(false);
                      setLsfSurfaceDocked(window.scrollY > 16);
                    }}
                    aria-label="Volver a la vista completa"
                    title="Vista completa"
                  >
                    Ver todo
                  </button>
                </div>
                <div className="lsf-gridFocusSearch">
                  <form className="sf-engineSearchWrap" onSubmit={submitGridFocusSearch}>
                    <input
                      className="sf-engineSearch"
                      type="search"
                      placeholder="Buscar pizza o ingrediente..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          resetMobileInputViewport(event.currentTarget, { resetGridStage: true });
                        }
                      }}
                    />
                    <button
                      type="submit"
                      className="sf-engineSearchBtn"
                      aria-label="Buscar"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle
                          cx="11"
                          cy="11"
                          r="6.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        />
                        <path
                          d="M16 16l4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </form>
                </div>
              </>
            )}
            <div
              className={`lsf-gridContext lsf-gridContext--${gridContext.tone} ${
                gridFocusMode && hasGridIncentiveBanner ? "has-grid-incentive" : ""
              }`}
              aria-live="polite"
            >
              <div className="lsf-gridContext__category">
                <span>{gridContext.eyebrow}</span>
                <strong>{gridContext.label}</strong>
                <em>
                  {gridContext.count === 1
                    ? "1 producto"
                    : `${gridContext.count} productos`}
                </em>
              </div>
              {false && (
                <button
                  type="button"
                  className={`lsf-gridContext__incentiveButton ${
                    incentiveUnlocked ? "is-ready" : activeIncentive ? "is-active" : "is-waiting"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setGridIncentiveOpen(true);
                  }}
                  aria-label={incentiveMessage}
                  title={incentiveMessage}
                >
                  <span>{gridIncentiveButtonLabel}</span>
                  <strong>{gridIncentiveButtonValue}</strong>
                </button>
              )}
              {false && (
                <button
                  type="button"
                  className={`lsf-gridContext__cart ${cartCount > 0 ? "is-active" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCartOpen(true);
                  }}
                  aria-label="Abrir carrito"
                  title="Abrir carrito"
                >
                  <span aria-hidden="true">🛒</span>
                  <strong>{cartCount}</strong>
                  <em>{"\u20AC"}{cartTotal.toFixed(2)}</em>
                </button>
              )}
              {false && (
                <button
                  type="button"
                  className="lsf-gridContext__exit"
                  onClick={(event) => {
                    event.stopPropagation();
                    setGridFocusMode(false);
                    setLsfSurfaceDocked(window.scrollY > 16);
                  }}
                  aria-label="Volver a la vista completa"
                  title="Vista completa"
                >
                  Ver todo
                </button>
              )}
            </div>

            {isProductSearchActive ? (
              baseFilteredMenu.length === 0 ? (
                <div className="sf-engineEmptyState">
                  <strong>Busqueda</strong>
                  <p>No hay productos que coincidan con "{search.trim()}".</p>
                </div>
              ) : (
                <div className="lsf-searchResultsStage">
                  <div className="lsf-searchResultsHead">
                    <span>Busqueda global</span>
                    <strong>{baseFilteredMenu.length} productos</strong>
                  </div>
                  <div className="lsf-grid-wrap">
                    <div className="lsf-grid lsf-grid--searchResults" role="list">
                      {baseFilteredMenu.map((item) => renderProductCard(item))}
                    </div>
                  </div>
                </div>
              )
            ) : activeTab === TOP_DEAL_TAB ? (
              filteredTopDeals.length === 0 ? (
                <div className="sf-engineEmptyState">
                  <strong>Top Deal</strong>
                  <p>No hay descuentos directos visibles para esta busqueda.</p>
                </div>
              ) : (
                <div className="lsf-grid-wrap">
                  <div className="lsf-grid lsf-grid--topDeals" role="list">
                    {filteredTopDeals.map((item) => renderTopDealCard(item))}
                  </div>
                </div>
              )
            ) : activeTab === PROMOS_TAB ? (
              filteredPromos.length === 0 ? (
                <div className="sf-engineEmptyState">
                  <strong>Promos</strong>
                  <p>No hay promos visibles para esta busqueda.</p>
                </div>
              ) : (
                <div className="lsf-grid-wrap">
                  <div className="lsf-grid lsf-grid--promos" role="list">
                    {filteredPromos.map((promo) => {
                      const promoFlipId = `promo-${promo.id}`;
                      const flipped = flippedId === promoFlipId;
                      const promoItems = Array.isArray(promo.items) ? promo.items : [];
                      const promoDiscountPercent = getPromoDiscountPercent(promo, menuCatalog);
                      const promoCountdown = formatOfferCountdown(promo, incentiveNowMs);

                      return (
                        <div
                          key={promo.id}
                          className={`lsf-card lsf-card--promo lsf-flip ${flipped ? "is-flipped" : ""}`}
                          onClick={() =>
                            setFlippedId((current) =>
                              current === promoFlipId ? null : promoFlipId
                            )
                          }
                          role="listitem"
                        >
                          <div className="lsf-flip__inner">
                            <div className="lsf-flip__front">
                              <div className={`lsf-card__image lsf-promoImage ${promo.image ? "has-image" : ""}`}>
                                {promo.image ? (
                                  <img src={promo.image} alt={promo.title} />
                                ) : (
                                  <div className="lsf-card__img is-placeholder">
                                    <span>Promo</span>
                                  </div>
                                )}
                              </div>

                              <span className="lsf-promoBadge">Promo</span>
                              {promoDiscountPercent > 0 && (
                                <span className="lsf-topDealDiscountSticker lsf-promoDiscountSticker">
                                  <strong>-{promoDiscountPercent}%</strong>
                                  <small>off</small>
                                </span>
                              )}
                              {renderOfferRibbon(promoCountdown, "Termina en:", "promo")}

                              <button
                                type="button"
                                className="lsf-card__addbtn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handlePromoAdd(promo);
                                }}
                                aria-label={`Elegir promo ${promo.title}`}
                              >
                                <CartPlusIcon />
                              </button>

                              <div className="lsf-card__overlay">
                                <div className="lsf-card__ticker">
                                  <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                                    {promo.title}
                                  </div>
                                </div>
                                {renderPromoPrice(promo, menuCatalog, tick)}
                              </div>
                            </div>

                            <div className="lsf-flip__back">
                              <div className="lsf-flip-desc lsf-promoFlipDesc">
                                <div className="lsf-flip-title">Contenido</div>
                                <div className="lsf-promoFlipList">
                                  {promoItems.length ? (
                                    promoItems.map((item, index) => (
                                      <span key={`${promo.id}-${item.pizzaId || item.name || index}`}>
                                        {getPromoItemLabel(item)}
                                      </span>
                                    ))
                                  ) : (
                                    <span>Promo activa</span>
                                  )}
                                </div>
                                <div className="lsf-flip-closer">
                                  {[formatPromoDate(promo.activeFrom), formatPromoDate(promo.expiresAt)]
                                    .filter(Boolean)
                                    .join(" - ") || "Oferta limitada"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : activeTab === TRENDING_TAB ? (
              filteredTrending.length === 0 ? (
                <div className="sf-engineEmptyState">
                  <strong>Trending</strong>
                  <p>No hay pizzas trending visibles para esta busqueda.</p>
                </div>
              ) : (
                <div className="lsf-grid-wrap">
                  <div className="lsf-grid lsf-grid--trending" role="list">
                    {filteredTrending.map((item) => renderProductCard(item))}
                  </div>
                </div>
              )
            ) : activeTab === UPCOMING_TAB ? (
              filteredUpcoming.length === 0 ? (
                <div className="sf-engineEmptyState">
                  <strong>Proximos</strong>
                  <p>No hay lanzamientos visibles para esta busqueda.</p>
                </div>
              ) : (
                <div className="lsf-grid-wrap">
                  <div className="lsf-grid lsf-grid--upcoming" role="list">
                    {filteredUpcoming.map((item) => {
                      const upcomingFlipId = `upcoming-${item.pizzaId}`;
                      const flipped = flippedId === upcomingFlipId;
                      const image = item.image || "";
                      const baseSize = getFeedDisplaySize(item);
                      const { line } = buildPizzaLine(item);

                      return (
                        <div
                          key={item.pizzaId}
                          className={`lsf-card lsf-card--upcoming lsf-flip ${flipped ? "is-flipped" : ""}`}
                          onClick={() =>
                            setFlippedId((current) =>
                              current === upcomingFlipId ? null : upcomingFlipId
                            )
                          }
                          role="listitem"
                        >
                          <div className="lsf-flip__inner">
                            <div className="lsf-flip__front">
                              <div className="lsf-card__image lsf-upcomingImage">
                                {image ? (
                                  <img src={image} alt={item.name} />
                                ) : (
                                  <div className="lsf-card__img is-placeholder">
                                    <span>Proximo</span>
                                  </div>
                                )}
                              </div>

                              <span className="lsf-upcomingBadge">Proximo</span>
                              {renderDirectDiscountBadge(item, incentiveNowMs)}
                              {renderOfferRibbon(
                                formatLaunchCountdown(item.launchAt, now),
                                "Comienza en:",
                                "upcoming"
                              )}
                              {renderProductTags(item)}

                              <button
                                type="button"
                                className="lsf-card__addbtn lsf-card__addbtn--disabled"
                                onClick={(event) => event.stopPropagation()}
                                disabled
                                aria-label={`${item.name} aun no disponible`}
                              >
                                <CartPlusIcon />
                              </button>

                              {renderProductOfferOverlay(item, baseSize)}
                            </div>

                            <div className="lsf-flip__back">
                              <div className="lsf-flip-desc lsf-upcomingFlipDesc">
                                <div className="lsf-flip-title">Lanzamiento</div>
                                <div className="lsf-flip-line">
                                  {formatLaunchDate(item.launchAt)}
                                </div>
                                <div className="lsf-flip-closer">{line}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : visibleMenu.length === 0 ? (
              <div className="sf-engineEmptyState">
                <strong>{activeTabLabel}</strong>
                <p>No hay productos visibles para esta pestana ahora mismo.</p>
              </div>
            ) : (
              <div className="lsf-grid-wrap">
                <div className="lsf-grid" role="list">
                  {visibleMenu.map((item) => {
                    const flipped = flippedId === item.pizzaId;
                    const image = item.image || "";
                    const baseSize = getFeedDisplaySize(item);
                    const { line, closer } = buildPizzaLine(item);

                    return (
                      <div
                        key={item.pizzaId}
                        className={`lsf-card ${hasTrendingPolicy(item) ? "lsf-card--trending has-trending-metrics" : ""} lsf-flip ${flipped ? "is-flipped" : ""}`}
                        onClick={() =>
                          setFlippedId((current) =>
                            current === item.pizzaId ? null : item.pizzaId
                          )
                        }
                        role="listitem"
                      >
                        <div className="lsf-flip__inner">
                          <div className="lsf-flip__front">
                            <div className="lsf-card__image">
                              {image ? (
                                <img src={image} alt={item.name} />
                              ) : (
                                <div className="lsf-card__img is-placeholder">
                                  <span>🍕</span>
                                </div>
                              )}
                            </div>
                            {renderDirectDiscountBadge(item, incentiveNowMs)}
                            {renderTrendingBadge(item)}
                            {renderTrendingKpis(item) ||
                              renderOfferRibbon(
                                hasTopDealPolicy(item) ? formatOfferCountdown(item.directDiscount, incentiveNowMs) : "",
                                "Termina en:",
                                "deal"
                              )}
                            {renderProductTags(item)}

                            <button
                              type="button"
                              className="lsf-card__addbtn"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProductModal(item);
                              }}
                              aria-label={`Comprar ${item.name}`}
                            >
                              <CartPlusIcon />
                            </button>

                            {renderProductOfferOverlay(item, baseSize, {
                              showTrustMeta: shouldShowProductTrustMeta(item),
                            })}
                          </div>

                          <div className="lsf-flip__back">
                            <div className="lsf-flip-desc">
                              <div className="lsf-flip-title">Tu crush sin filtro</div>
                              <div className="lsf-flip-line">{line}</div>
                              <div className="lsf-flip-closer">{closer}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="sf-stickyFooterShell" style={themeStyle}>
        <div className="sf-stickyFooter">
          {storefrontMode === "commercial-light" ? (
            <>
              {isStorefrontButtonVisible("payNow") && (cartCount > 0 || checkoutLoading) && (
                <button
                  type="button"
                  className="sf-engineBottomBtn sf-engineBottomBtn--pay"
                  onClick={handlePrimaryCheckout}
                  disabled={cartCount === 0 || checkoutLoading}
                >
                  <span>{checkoutLoading ? "Estas muy cerca" : "Pay now"}</span>
                  {cartCount > 0 && !checkoutLoading && <small>EUR {cartTotal.toFixed(2)}</small>}
                </button>
              )}

              {isStorefrontButtonVisible("scheduleOrder") && (
                <button
                  type="button"
                  className={`sf-footerNavItem sf-footerNavItem--schedule ${
                    scheduledOrderLabel ? "is-active" : ""
                  }`}
                  onClick={() => setScheduleOpen(true)}
                  aria-label={scheduledOrderLabel || "Programar pedido"}
                  title={scheduledOrderLabel || "Programar pedido"}
                >
                  <span className="sf-footerNavIcon" aria-hidden="true"><FooterClockIcon /></span>
                  <span className="sf-footerNavLabel sf-footerNavLabel--ticker">
                    <span>Programar</span>
                    <span>Pedido</span>
                  </span>
                </button>
              )}

              {isStorefrontButtonVisible("reservations") && (
                <button
                  type="button"
                  className="sf-footerNavItem sf-footerNavItem--reservation"
                  onClick={() => setReservationOpen(true)}
                  disabled={!reservationEnabled}
                  aria-label="Reservar mesa"
                  title={reservationEnabled ? "Reservar mesa" : "Reservas no disponibles"}
                >
                  <span className="sf-footerNavIcon" aria-hidden="true"><FooterCalendarIcon /></span>
                  <span className="sf-footerNavLabel sf-footerNavLabel--ticker">
                    <span>Reservas</span>
                    <span>Activas</span>
                  </span>
                </button>
              )}

              {isStorefrontButtonVisible("repeatOrder") && (
                <button
                  type="button"
                  className={`sf-footerNavItem sf-footerNavItem--repeat ${cartCount > 0 ? "has-draft" : ""}`}
                  onClick={() => setRepeatOpen(true)}
                  aria-label="Repetir pedido anterior"
                  title="Repetir pedido anterior"
                >
                  <span
                    className={`sf-repeatOrderBtn sf-footerRepeatVisual ${
                      cartCount > 0 ? "has-draft" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <span className="sf-repeatOrderBtn__mark" aria-hidden="true">R</span>
                  </span>
                </button>
              )}

              {isStorefrontButtonVisible("couponCode") && (
                <form
                  className={`sf-couponDock sf-footerNavItem sf-footerNavItem--coupons ${
                    couponCode.trim() ? "has-code" : ""
                  }`}
                  onSubmit={validateCouponCode}
                  onClick={(event) => {
                    if (!couponCode.trim()) return;
                    if (couponLoading) return;
                    if (event.target.closest("input")) return;
                    event.currentTarget.requestSubmit?.();
                  }}
                >
                  <span className="sf-couponDockIcon sf-footerNavIcon" aria-hidden="true">
                    <FooterPercentIcon />
                  </span>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(event) => {
                      setCouponCode(event.target.value.toUpperCase());
                      setCouponStatus("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        resetMobileInputViewport(event.currentTarget);
                        event.currentTarget.form?.requestSubmit?.();
                      }
                    }}
                    placeholder="Codigo cupon"
                    aria-label="Codigo cupon"
                  />
                  <button type="submit" disabled={couponLoading || couponCode.trim().length === 0}>
                    {couponLoading ? "..." : "Validar"}
                  </button>
                  <span
                    className={`sf-couponDockTicker sf-footerNavLabel ${
                      couponFooterPercent > 0
                        ? "is-applied"
                        : hasDeliveryFreeCouponApplied
                          ? "is-applied"
                        : couponCode.trim()
                          ? "is-ready"
                          : ""
                    }`}
                    aria-live="polite"
                  >
                    <span>
                      {hasDeliveryFreeCouponApplied
                        ? "DELIVERY FREE"
                        : couponFooterPercent > 0
                        ? `${couponFooterPercent}% OFF`
                        : couponCode.trim()
                          ? "Validar"
                          : hasDeliveryFreeCouponAvailable
                            ? "Cupones"
                          : "Cupones"}
                    </span>
                    <span>
                      {hasDeliveryFreeCouponApplied
                        ? "Aplicado"
                        : couponFooterPercent > 0
                        ? "Aplicado"
                        : couponCode.trim()
                          ? "Validar"
                          : hasDeliveryFreeCouponAvailable
                            ? "Delivery Free aqui"
                          : "Aqui"}
                    </span>
                  </span>
                  {couponStatus && <small>{couponStatus}</small>}
                </form>
              )}

              {isStorefrontButtonVisible("boost") && (
                <button
                  type="button"
                  className="sf-footerStatus sf-footerStatus--boots sf-footerNavItem sf-footerNavItem--boost"
                  onClick={() => setBootsOpen(true)}
                  disabled={boostSettings.active === false}
                >
                  <span className="sf-boostQueueMini" aria-hidden="true">
                    <span>Pos</span>
                    <strong>{bootsPositionLabel}</strong>
                  </span>
                  <span className="sf-bootsCounter" aria-label={`Posicion ${bootsPositionLabel} en espera`}>
                    <span>POS</span>
                    <strong>{bootsPositionLabel}</strong>
                  </span>
                  <span className="sf-bootsTicker" aria-label="Boots para subir posicion en la cola">
                    <span className="sf-bootsTickerTrack">
                      <span>Boost UP</span>
                      <span>Subir cola</span>
                      <span>Prioridad</span>
                    </span>
                  </span>
                  <span className="sf-bootsMobileTicker sf-footerNavLabel" aria-hidden="true">
                    <span>Boost Up</span>
                    <span>Get Now</span>
                  </span>
                </button>
              )}
            </>
          ) : (
            <>
          {isStorefrontButtonVisible("scheduleOrder") && (
            <button
              type="button"
              className={`sf-engineBottomBtn sf-engineBottomBtn--scheduleDock ${
                scheduledOrderLabel ? "has-schedule" : ""
              }`}
              onClick={() => setScheduleOpen(true)}
              aria-label={scheduledOrderLabel || "Programar pedido"}
              title={scheduledOrderLabel || "Programar pedido"}
            >
              <span className="lsf-schedulebtn__icon" aria-hidden="true">{"\u23F1"}</span>
              <small className="sf-footerMiniTicker" aria-hidden="true">
                <span>{scheduledOrderLabel || "Horario"}</span>
                <span>Pedido</span>
              </small>
            </button>
          )}

          {isStorefrontButtonVisible("reservations") && (
            <button
              type="button"
              className="sf-engineBottomBtn sf-engineBottomBtn--reservation"
              onClick={() => setReservationOpen(true)}
              disabled={!reservationEnabled}
            >
              <span>Reservas</span>
              <small className="sf-footerMiniTicker" aria-hidden="true">
                <span>Reserva</span>
                <span>Mesa</span>
              </small>
            </button>
          )}

          {isStorefrontButtonVisible("payNow") && (cartCount > 0 || checkoutLoading) && (
            <button
              type="button"
              className="sf-engineBottomBtn sf-engineBottomBtn--pay"
              onClick={handlePrimaryCheckout}
              disabled={cartCount === 0 || checkoutLoading}
            >
              <span>{checkoutLoading ? "Estas muy cerca" : "Pay now"}</span>
              {cartCount > 0 && !checkoutLoading && <small>EUR {cartTotal.toFixed(2)}</small>}
            </button>
          )}

          {isStorefrontButtonVisible("couponCode") && (
            <form
              className={`sf-couponDock ${couponCode.trim() ? "has-code" : ""}`}
              onSubmit={validateCouponCode}
              onClick={(event) => {
                if (!couponCode.trim()) return;
                if (couponLoading) return;
                if (event.target.closest("input")) return;
                event.currentTarget.requestSubmit?.();
              }}
            >
              <span className="sf-couponDockIcon">%</span>
              <input
                type="text"
                value={couponCode}
                onChange={(event) => {
                  setCouponCode(event.target.value.toUpperCase());
                  setCouponStatus("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    resetMobileInputViewport(event.currentTarget);
                    event.currentTarget.form?.requestSubmit?.();
                  }
                }}
                placeholder="Codigo cupon"
              />
              <button type="submit" disabled={couponLoading || couponCode.trim().length === 0}>
                {couponLoading ? "..." : "Validar"}
              </button>
              <span
                className={`sf-couponDockTicker ${
                  couponFooterPercent > 0
                    ? "is-applied"
                    : hasDeliveryFreeCouponApplied
                      ? "is-applied"
                    : couponCode.trim()
                      ? "is-ready"
                      : ""
                }`}
                aria-live="polite"
              >
                <span>
                  {hasDeliveryFreeCouponApplied
                    ? "DELIVERY FREE"
                    : couponFooterPercent > 0
                      ? `${couponFooterPercent}% OFF`
                      : couponCode.trim()
                        ? "Validar"
                        : hasDeliveryFreeCouponAvailable
                          ? "Cupones"
                          : "Cupones"}
                </span>
                <span>
                  {hasDeliveryFreeCouponApplied
                    ? "Aplicado"
                    : couponFooterPercent > 0
                      ? "Aplicado"
                      : couponCode.trim()
                        ? "Validar"
                        : hasDeliveryFreeCouponAvailable
                          ? "Delivery Free aqui"
                          : "Aqui"}
                </span>
              </span>
              {couponStatus && <small>{couponStatus}</small>}
            </form>
          )}

          {isStorefrontButtonVisible("boost") && (
            <button
              type="button"
              className="sf-footerStatus sf-footerStatus--boots"
              onClick={() => setBootsOpen(true)}
              disabled={boostSettings.active === false}
            >
              <span className="sf-bootsCounter" aria-label={`Posicion ${bootsPositionLabel} en espera`}>
                <span>POS</span>
                <strong>{bootsPositionLabel}</strong>
              </span>
              <span className="sf-bootsTicker" aria-label="Boots para subir posicion en la cola">
                <span className="sf-bootsTickerTrack">
                  <span>Boost UP</span>
                  <span>Subir cola</span>
                  <span>Prioridad</span>
                </span>
              </span>
              <span className="sf-bootsMobileTicker" aria-hidden="true">
                <span>POS {bootsPositionLabel}</span>
                <span>BOOST UP</span>
              </span>
            </button>
          )}
            </>
          )}
        </div>
      </div>

      {productModalOpen && (
        <div className="sf-modalOverlay" onClick={closeProductModal}>
          <div
            className="sf-modalCard sf-productModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>Producto</span>
                <h3>{selectedProduct?.name || "Pizza"}</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={closeProductModal}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            {selectedProduct && (
              <div className="sf-productPicker">
                <div className="sf-productPickerHero">
                  {selectedProduct.image ? (
                    <img src={selectedProduct.image} alt={selectedProduct.name} />
                  ) : (
                    <div className="sf-productPickerPlaceholder">Pizza</div>
                  )}
                </div>

                {hasTopDealPolicy(selectedProduct) && (
                  <div className="sf-directDiscountNotice">
                    <strong>{getDirectDiscountLabel(selectedProduct.directDiscount)}</strong>
                    {selectedTopDealRemainingQty != null && (
                      <small>{selectedProductMaxQty} disponibles para agregar</small>
                    )}
                  </div>
                )}

                <div className="sf-productPickerDesc">
                  {(() => {
                    const { line, closer } = buildPizzaLine(selectedProduct);
                    return (
                      <>
                        <strong>Tu crush sin filtro</strong>
                        <span>{line} {closer}</span>
                      </>
                    );
                  })()}
                </div>

                {hasRandomSelectionIngredients(selectedProduct) && (
                  <div className="sf-randomSelectionNotice">
                    Pizza con ingredientes de random selection. Si tienes alergias, consulta antes de pedir.
                  </div>
                )}

                {renderAllergenNotice(selectedPurchaseAllergens)}
                {renderProductTagNotice(selectedProduct.productTags)}

                <div className="sf-productPickerRow">
                  <span>Qty</span>
                  <div className="sf-qtyControl">
                    <button
                      type="button"
                      onClick={decProductQty}
                      disabled={Number(productSelection.qty || 1) <= 1}
                    >
                      -
                    </button>
                    <strong>{productSelection.qty}</strong>
                    <button
                      type="button"
                      onClick={incProductQty}
                      disabled={Number(productSelection.qty || 1) >= selectedProductMaxQty}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="sf-productPickerRow sf-productPickerRow--stack">
                  <span>Size</span>
                  <div className="sf-sizeOptions">
                    {selectedProductSizes.map((size) => {
                      const active = productSelection.size === size;
                      const price = priceForSize(selectedProduct.priceBySize, size);
                      const originalPrice = getOriginalPriceForSize(selectedProduct, size);

                      return (
                        <button
                          key={size}
                          type="button"
                          className={`sf-sizeChip ${active ? "is-active" : ""}`}
                          onClick={() =>
                            setProductSelection((current) => ({
                              ...current,
                              size,
                            }))
                          }
                        >
                          <span>{size}</span>
                          {originalPrice > price && price > 0 && (
                            <em className="sf-sizeChipOldPrice">EUR {originalPrice.toFixed(2)}</em>
                          )}
                          <strong>EUR {price.toFixed(2)}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sf-productPickerRow sf-productPickerRow--stack">
                  <span>Extras</span>
                  {extrasLoading ? (
                    <div className="sf-mutedLine">Cargando extras...</div>
                  ) : sortedExtras.length === 0 ? (
                    <div className="sf-mutedLine">No hay extras para esta pizza.</div>
                  ) : (
                    <div className="sf-extrasList">
                      {visibleExtras.map((extra) => {
                        const checked = Boolean(productSelection.extras[extra.ingredientId]);
                        const price = priceForExtraSize(extra, productSelection.size);

                        return (
                          <label key={extra.ingredientId} className="sf-extraItem">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProductExtra(extra.ingredientId)}
                            />
                            <span>{extra.name || extra.ingredientName}</span>
                            <strong>+EUR {price.toFixed(2)}</strong>
                          </label>
                        );
                      })}

                      {sortedExtras.length > 3 && (
                        <button
                          type="button"
                          className="sf-showMoreBtn"
                          onClick={() => setShowAllExtras((current) => !current)}
                        >
                          {showAllExtras
                            ? "Mostrar menos"
                            : `Mostrar ${sortedExtras.length - 3} mas`}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="sf-productPickerActions">
                  <button
                    type="button"
                    className="sf-secondaryBtn"
                    onClick={closeProductModal}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    className="sf-primaryBtn"
                    disabled={!productModalReady}
                    onClick={addProductLine}
                  >
                    {selectedProduct && productSelection.size && selectedProductMaxQty <= 0
                      ? "Sin unidades disponibles"
                      : productModalReady
                      ? `Add to cart - EUR ${selectedLineTotal.toFixed(2)}`
                      : "Selecciona size"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {promoPickerOpen && pendingPromo && (
        <div className="sf-modalOverlay" onClick={closePromoPicker}>
          <div
            className="sf-modalCard sf-promoPickerModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>Promo</span>
                <h3>{pendingPromo.title || "Elige tu promo"}</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={closePromoPicker}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <div className="sf-promoPickerBody">
              {(pendingPromo.items || []).map((item, index) => {
                if (!isPromoCategoryItem(item)) {
                  return (
                    <div key={`fixed-${item.pizzaId || item.name || index}`} className="sf-promoFixedLine">
                      <strong>{item.name}</strong>
                      <span>{item.quantity || 1}x{item.size ? ` ${item.size}` : ""}</span>
                    </div>
                  );
                }

                const choiceKey = getPromoChoiceKey(item, index);
                const options = getPromoCategoryOptions(item, menuCatalog);
                const requiredCount = getPromoRequiredChoiceCount(item);
                const selectedItems = Array.isArray(promoPickerSelections[choiceKey])
                  ? promoPickerSelections[choiceKey]
                  : [];
                const selectedIds = new Set(selectedItems.map((selected) => Number(selected?.pizzaId)));

                return (
                  <section key={choiceKey} className="sf-promoChoiceGroup">
                    <div className="sf-promoChoiceHead">
                      <strong>Elige {requiredCount} de {getPromoCategoryName(item)}</strong>
                      <span>{selectedItems.length}/{requiredCount}{item.size ? ` - ${item.size}` : ""}</span>
                    </div>

                    {options.length ? (
                      <div className="sf-promoChoiceGrid">
                        {options.map((option) => {
                          const active = selectedIds.has(Number(option.pizzaId));
                          const size = item.size || getDealSize(option);

                          return (
                            <button
                              key={option.pizzaId}
                              type="button"
                              className={`sf-promoChoiceOption ${active ? "is-selected" : ""}`}
                              onClick={() => choosePromoOption(choiceKey, option, requiredCount)}
                            >
                              <span className="sf-promoChoiceImage">
                                {option.image ? (
                                  <img src={option.image} alt={option.name} />
                                ) : (
                                  <span>{String(option.name || "P").slice(0, 1)}</span>
                                )}
                              </span>
                              <span>
                                <strong>{option.name}</strong>
                                <small>{size || option.category || "Producto"}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="sf-promoChoiceEmpty">
                        No hay productos disponibles en esta categoria.
                      </div>
                    )}
                  </section>
                );
              })}

              {promoPickerMessage && (
                <div className="sf-reservationMessage is-error">{promoPickerMessage}</div>
              )}
            </div>

            <div className="sf-productPickerActions">
              <button type="button" className="sf-secondaryBtn" onClick={closePromoPicker}>
                Cancelar
              </button>
              <button type="button" className="sf-primaryBtn" onClick={confirmPromoPicker}>
                Add to cart - EUR {num(pendingPromo.totalPrice).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="sf-modalOverlay" onClick={() => setCartOpen(false)}>
          <div
            className="sf-modalCard sf-cartModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>{cart.length === 0 && checkoutMessage ? "Pedido confirmado" : "Carrito"}</span>
                <h3>
                  {cart.length === 0 && checkoutMessage
                    ? checkoutMessage.includes("efectivo")
                      ? "Pedido confirmado"
                      : "Pago recibido"
                    : `EUR ${cartTotal.toFixed(2)}`}
                </h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={() => setCartOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            {checkoutMessage && (
              <div className={`sf-reservationMessage ${
                checkoutMessage.includes("Pago recibido") || checkoutMessage.includes("Pedido confirmado")
                  ? "is-success"
                  : checkoutMessage.includes("Pago rechazado")
                  ? "is-error"
                  : ""
              }`}>
                {checkoutMessage}
                {checkoutTrackingCode && (
                  <Link to={`/seguimiento/${checkoutTrackingCode}`} className="sf-trackingInlineLink">
                    Ver seguimiento
                  </Link>
                )}
              </div>
            )}

            {cart.length === 0 ? (
              checkoutMessage ? (
                <div className="sf-cartActions sf-cartActions--confirmation">
                  {checkoutTrackingCode && (
                    <Link to={`/seguimiento/${checkoutTrackingCode}`} className="sf-primaryBtn">
                      Ver seguimiento
                    </Link>
                  )}
                  <button
                    type="button"
                    className="sf-secondaryBtn"
                    onClick={() => {
                      setCheckoutMessage("");
                      setCheckoutTrackingCode("");
                      setCartOpen(false);
                    }}
                  >
                    Volver a la tienda
                  </button>
                </div>
              ) : (
                <div className="sf-cartEmpty">Carrito vacio.</div>
              )
            ) : (
              <>
                <div className="sf-cartList">
                  {cart.map((line, index) => (
                    <div key={line.cartLineId || index} className="sf-cartRow">
                      <div className="sf-cartRowMain">
                        <strong>
                          {isIncentiveRewardCartLine(line)
                            ? `${line.name} GRATIS`
                            : line.name}
                        </strong>
                        {isIncentiveRewardCartLine(line) && (
                          <span>Incentivo #{line.incentiveId} - {line.size} x {line.qty}</span>
                        )}
                        {line.source === "queue_boost" ? (
                          <span>
                            Cola {line.boost?.currentPosition ? `#${line.boost.currentPosition}` : ""}
                            {" -> "}
                            #{line.boost?.targetPosition || line.size}
                          </span>
                        ) : isCouponCartLine(line) ? (
                          <span>{line.size || "Descuento aplicado al carrito"}</span>
                        ) : isIncentiveRewardCartLine(line) ? null : line.type === "PROMO" ? (
                          <span>
                            {Array.isArray(line.promoItems) && line.promoItems.length
                              ? line.promoItems
                                  .map((item) => `${item.quantity || 1}x ${item.name}${item.size ? ` ${item.size}` : ""}`)
                                  .join(", ")
                              : "Precio cerrado de promo"}
                          </span>
                        ) : line.type === "HALF_HALF" ? (
                          <span>
                            Mitad A: {line.leftName || "Pizza"} / Mitad B: {line.rightName || "Pizza"} - {line.size} x {line.qty}
                          </span>
                        ) : (
                          <span>
                            {line.size} x {line.qty}
                          </span>
                        )}
                        {line.source === "queue_boost" && (
                          <small>
                            Nueva posicion #{line.boost?.targetPosition || line.size?.replace(/\D/g, "") || ""}
                          </small>
                        )}
                        {line.extras?.length > 0 && (
                          <small>
                            + {line.extras.map((extra) =>
                              extra.side ? `${extra.name} (${extra.side})` : extra.name
                            ).join(", ")}
                          </small>
                        )}
                        {line.trendingPricing && (
                          <small>{formatTrendingAdjustmentLabel(line.trendingPricing)}</small>
                        )}
                        {line.ingredients?.length > 0 && (
                          <small>
                            {line.ingredients.map((ingredient) =>
                              `${ingredient.name} (${ingredient.placement}/${ingredient.quantity})`
                            ).join(", ")}
                          </small>
                        )}
                        {line.allergens?.length > 0 && (
                          <small>Alergenos: {line.allergens.join(", ")}</small>
                        )}
                      </div>
                      <div className="sf-cartRowSide">
                        <strong>
                          {isIncentiveRewardCartLine(line)
                            ? `Ahorras EUR ${Math.abs(num(line.subtotal)).toFixed(2)}`
                            : isCouponCartLine(line)
                            ? `-EUR ${Math.abs(num(line.subtotal)).toFixed(2)}`
                            : `EUR ${num(line.subtotal).toFixed(2)}`}
                        </strong>
                        <button
                          type="button"
                          className="sf-modalCloseBtn sf-cartRemoveBtn"
                          onClick={() => {
                            if (isIncentiveRewardCartLine(line) && line.incentiveId) {
                              dismissedRewardIncentiveIdsRef.current.add(
                                Number(line.incentiveId)
                              );
                            }

                            setCart((current) =>
                              current.filter((_, lineIndex) => lineIndex !== index)
                            );
                          }}
                          aria-label={`Eliminar ${line.name}`}
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="sf-cartFoot">
                  <div className="sf-cartFootLine">
                    <span>Subtotal</span>
                    <strong>EUR {(cartSubtotal + couponDiscountTotal).toFixed(2)}</strong>
                  </div>
                  {couponDiscountTotal > 0 && (
                    <div className="sf-cartFootLine">
                      <span>Cupon</span>
                      <strong>-EUR {couponDiscountTotal.toFixed(2)}</strong>
                    </div>
                  )}
                  {deliveryCheckoutFee > 0 && (
                    <div className="sf-cartFootLine">
                      <span>Envio</span>
                      <strong>EUR {deliveryCheckoutFee.toFixed(2)}</strong>
                    </div>
                  )}
                  <div className="sf-cartFootLine sf-cartFootLine--total">
                    <span>Total</span>
                    <strong>EUR {cartTotal.toFixed(2)}</strong>
                  </div>
                  {cartBelowMinimumPayment && (
                    <div className="sf-cartMinimumNotice">
                      Pago minimo {formatMoney(minimumPaymentAmount, partner?.currency || "EUR")}.
                      Faltan {formatMoney(minimumPaymentMissing, partner?.currency || "EUR")}.
                    </div>
                  )}
                  <div className="sf-cartPaymentPanel">
                    <div className="sf-cartPaymentHead">
                      <span>Metodo de pago</span>
                      <small>
                        {selectedCheckoutPaymentMode === "cash"
                          ? "Efectivo al recibir o recoger"
                          : "Tarjeta, Link o Klarna en Stripe"}
                      </small>
                    </div>
                    <div
                      className={`sf-cartPaymentToggle ${cashPaymentEnabled ? "" : "is-single"}`}
                      role="radiogroup"
                      aria-label="Metodo de pago"
                    >
                      <button
                        type="button"
                        className={`sf-cartPaymentOption ${
                          selectedCheckoutPaymentMode === "card" ? "is-active" : ""
                        }`}
                        role="radio"
                        aria-checked={selectedCheckoutPaymentMode === "card"}
                        onClick={() => setCheckoutPaymentMode("card")}
                        disabled={checkoutLoading}
                      >
                        <span>Tarjeta</span>
                        <small>Stripe, Link o Klarna</small>
                      </button>
                      {cashPaymentEnabled && (
                        <button
                          type="button"
                          className={`sf-cartPaymentOption ${
                            selectedCheckoutPaymentMode === "cash" ? "is-active" : ""
                          }`}
                          role="radio"
                          aria-checked={selectedCheckoutPaymentMode === "cash"}
                          onClick={() => setCheckoutPaymentMode("cash")}
                          disabled={checkoutLoading}
                        >
                          <span>Efectivo</span>
                          <small>Al recibir o recoger</small>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="sf-cartActions sf-cartActions--checkout">
                    <button
                      type="button"
                      className="sf-primaryBtn sf-cartCheckoutBtn"
                      onClick={() => startCheckout(selectedCheckoutPaymentMode)}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? "Preparando tu pago..." : cartCheckoutLabel}
                    </button>
                    <button
                      type="button"
                      className="sf-cartContinueBtn"
                      onClick={() => setCartOpen(false)}
                    >
                      Seguir comprando
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cashConfirmationOpen && (
        <div className="sf-modalOverlay sf-cashConfirmOverlay">
          <div
            className="sf-modalCard sf-cashConfirmModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sf-cashConfirmTitle"
          >
            <div className="sf-cashConfirmHero">
              <span className="sf-cashConfirmMark" aria-hidden="true">EUR</span>
              <div>
                <span>Confirmacion final</span>
                <h3 id="sf-cashConfirmTitle">Este pedido se paga en efectivo</h3>
              </div>
            </div>

            <div className="sf-cashConfirmBody">
              <p>
                No haremos ningun cobro online. El pedido se enviara a la tienda y
                pagaras <strong>{formatMoney(cartTotal, partner?.currency || "EUR")}</strong>{" "}
                en efectivo {getStoreServiceMode(store, orderSelection) === "delivery"
                  ? "cuando recibas el pedido"
                  : "cuando recojas el pedido"}.
              </p>
              <div className="sf-cashConfirmRoute">
                <span>{getStoreServiceMode(store, orderSelection) === "delivery" ? "Delivery" : "Pickup"}</span>
                <strong>
                  {getStoreServiceMode(store, orderSelection) === "delivery"
                    ? orderSelection?.deliveryAddress || orderSelection?.deliveryResolution?.formattedAddress || "Direccion confirmada"
                    : orderSelection?.storeName || store?.storeName || "Tienda seleccionada"}
                </strong>
              </div>
            </div>

            <div className="sf-cashConfirmActions">
              <button
                type="button"
                className="sf-secondaryBtn"
                onClick={changeCashPaymentMethod}
                disabled={checkoutLoading}
              >
                Cambiar medio de pago
              </button>
              <button
                type="button"
                className="sf-primaryBtn sf-cashConfirmBtn"
                onClick={confirmCashCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Enviando pedido..." : "Ordenar y pagar en efectivo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentMethodModalOpen && shouldShowPaymentMethodModal && (
        <div
          className="sf-modalOverlay"
          onClick={() => !checkoutLoading && setPaymentMethodModalOpen(false)}
        >
          <div
            className="sf-modalCard sf-paymentMethodModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>Metodo de pago</span>
                <h3>Como quieres pagar?</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={() => setPaymentMethodModalOpen(false)}
                disabled={checkoutLoading}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <div className="sf-paymentMethodGrid">
              {availablePaymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={`sf-paymentMethodCard sf-paymentMethodCard--${method.id} ${
                    method.ready ? "is-ready" : "is-disabled"
                  }`}
                  onClick={() => selectPaymentMethod(method)}
                  disabled={checkoutLoading}
                >
                  <span className="sf-paymentMethodMark" aria-hidden="true">
                    {method.icon}
                  </span>
                  <span className="sf-paymentMethodCopy">
                    <strong>{method.title}</strong>
                    <small>{method.description}</small>
                  </span>
                  {!method.ready && <em>Proximamente</em>}
                </button>
              ))}
            </div>

            {checkoutMessage && (
              <div className="sf-reservationMessage">{checkoutMessage}</div>
            )}

            <div className="sf-paymentMethodTotal">
              <span>Total</span>
              <strong>EUR {cartTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {checkoutProfileOpen && (
        <div className="sf-modalOverlay" onClick={() => !checkoutLoading && setCheckoutProfileOpen(false)}>
          <div
            className="sf-modalCard sf-checkoutProfileModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>Seguimiento del pedido</span>
                <h3>Datos de contacto</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={() => setCheckoutProfileOpen(false)}
                disabled={checkoutLoading}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <form
              className="sf-checkoutProfileForm"
              onSubmit={(event) => {
                event.preventDefault();
                const nextProfile = {
                  name: String(checkoutProfileForm.name || "").trim(),
                  phone: normalizeCheckoutPhoneInput(checkoutProfileForm.phone),
                };

                if (!hasBasicCustomerProfile(nextProfile)) {
                  setCheckoutMessage("Escribe tu nombre y un telefono de 9 digitos.");
                  return;
                }

                setSavedCustomerProfile(nextProfile);
                startCheckout(checkoutPaymentMode, nextProfile);
              }}
            >
              <label>
                <span>Nombre</span>
                <input
                  type="text"
                  value={checkoutProfileForm.name}
                  onChange={(event) =>
                    setCheckoutProfileForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Tu nombre"
                  autoComplete="name"
                  disabled={checkoutLoading}
                />
              </label>

              <label>
                <span>Telefono</span>
                <input
                  type="tel"
                  value={checkoutProfileForm.phone}
                  onChange={(event) =>
                    setCheckoutProfileForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="612345678"
                  autoComplete="tel"
                  disabled={checkoutLoading}
                />
              </label>

              {checkoutMessage && (
                <div className="sf-reservationMessage">{checkoutMessage}</div>
              )}

              <div className="sf-cartActions">
                <button
                  type="button"
                  className="sf-secondaryBtn"
                  onClick={() => setCheckoutProfileOpen(false)}
                  disabled={checkoutLoading}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="sf-primaryBtn"
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? "Preparando tu pago..." : "Continuar al pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {halfModalOpen && (
        <div className="sf-modalOverlay" onClick={() => setHalfModalOpen(false)}>
          <div
            className="sf-modalCard sf-productModal sf-halfModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>Mitad / Mitad</span>
                <h3>Pizza mitad / mitad</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={() => setHalfModalOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            {halfItems.length < 2 ? (
              <div className="sf-cartEmpty">No hay suficientes pizzas disponibles.</div>
            ) : (
              <div className="sf-halfPicker">
                <div className="sf-halfSlots">
                  {[
                    { side: "A", item: halfA, otherIndex: halfBIndex },
                    { side: "B", item: halfB, otherIndex: halfAIndex },
                  ].map(({ side, item, otherIndex }) => {
                    const canNavigate = getHalfNavigableItems(otherIndex).length > 1;

                    return (
                    <div
                      key={side}
                      className={`sf-halfSlot ${canNavigate ? "is-swipeable" : ""}`}
                      onPointerDown={(event) => handleHalfPointerStart(event, side, canNavigate)}
                      onPointerMove={handleHalfPointerMove}
                      onPointerUp={handleHalfPointerEnd}
                      onPointerCancel={() => {
                        halfSwipeRef.current = null;
                      }}
                    >
                      <div className="sf-halfSlotLabel">Mitad {side}</div>
                      <button
                        type="button"
                        className="sf-halfNavBtn"
                        onClick={() => moveHalf(side, -1)}
                        disabled={!canNavigate}
                        aria-label={`Pizza anterior mitad ${side}`}
                      >
                        ^
                      </button>
                      <div className="sf-halfImage">
                        {item?.image ? (
                          <img src={item.image} alt={item.name} />
                        ) : (
                          <div className="sf-productPickerPlaceholder">Pizza</div>
                        )}
                      </div>
                      <strong>{item?.name || "Pizza"}</strong>
                      <button
                        type="button"
                        className="sf-halfNavBtn"
                        onClick={() => moveHalf(side, 1)}
                        disabled={!canNavigate}
                        aria-label={`Pizza siguiente mitad ${side}`}
                      >
                        v
                      </button>
                    </div>
                    );
                  })}
                </div>

                <div className="sf-productPickerRow">
                  <span>Qty</span>
                  <div className="sf-qtyControl">
                    <button
                      type="button"
                      onClick={() => setHalfQty((qty) => Math.max(1, Number(qty || 1) - 1))}
                      disabled={Number(halfQty || 1) <= 1}
                    >
                      -
                    </button>
                    <strong>{halfQty}</strong>
                    <button
                      type="button"
                      onClick={() => setHalfQty((qty) => Math.min(12, Number(qty || 1) + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="sf-productPickerRow sf-productPickerRow--stack">
                  <span>Size</span>
                  {halfSizeOptions.length === 0 ? (
                    <div className="sf-mutedLine">No hay tamanos compatibles.</div>
                  ) : (
                    <div className="sf-sizeOptions">
                      {halfSizeOptions.map((size) => {
                        const active = halfSize === size;
                        const price = Math.max(
                          priceForHalfSize(halfA, size),
                          priceForHalfSize(halfB, size)
                        );

                        return (
                          <button
                            key={size}
                            type="button"
                            className={`sf-sizeChip ${active ? "is-active" : ""}`}
                            onClick={() => setHalfSize(size)}
                          >
                            <span>{size}</span>
                            <strong>EUR {price.toFixed(2)}</strong>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {renderAllergenNotice(halfPurchaseAllergens)}

                {[
                  {
                    side: "A",
                    label: "Extras Mitad A",
                    open: openHalfExtrasA,
                    toggle: () => setOpenHalfExtrasA((value) => !value),
                  },
                  {
                    side: "B",
                    label: "Extras Mitad B",
                    open: openHalfExtrasB,
                    toggle: () => setOpenHalfExtrasB((value) => !value),
                  },
                ].map(({ side, label, open, toggle }) => (
                  <div key={side} className="sf-productPickerRow sf-productPickerRow--stack">
                    <button type="button" className="sf-halfExtrasToggle" onClick={toggle}>
                      <span>{label}</span>
                      <strong>{open ? "^" : "v"}</strong>
                    </button>

                    {open && (
                      halfExtrasLoading ? (
                        <div className="sf-mutedLine">Cargando extras...</div>
                      ) : sortedHalfExtras.length === 0 ? (
                        <div className="sf-mutedLine">No hay extras.</div>
                      ) : (
                        <div className="sf-extrasList sf-halfExtrasList">
                          {sortedHalfExtras.map((extra) => {
                            const checked = Boolean(halfExtras[side]?.[extra.ingredientId]);
                            const price = priceForExtraSize(extra, halfSize);

                            return (
                              <label key={`${side}-${extra.ingredientId}`} className="sf-extraItem">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleHalfExtra(side, extra.ingredientId)}
                                />
                                <span>{extra.name || extra.ingredientName}</span>
                                <strong>+EUR {price.toFixed(2)}</strong>
                              </label>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                ))}

                <div className="sf-productPickerActions sf-builderStickyActions">
                  <div className="sf-builderTotal">
                    <span>Total</span>
                    <strong>EUR {halfGrandTotal.toFixed(2)}</strong>
                  </div>
                  <button
                    type="button"
                    className="sf-primaryBtn"
                    disabled={!halfModalReady}
                    onClick={addHalfLine}
                  >
                    {halfModalReady
                      ? `Add to cart - EUR ${halfGrandTotal.toFixed(2)}`
                      : "Selecciona size"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {customModalOpen && (
        <div className="sf-modalOverlay sf-modalOverlay--custom" onClick={() => setCustomModalOpen(false)}>
          <div
            className="sf-modalCard sf-productModal sf-customModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>{customBuilderKicker}</span>
                <h3>{customBuilderTitle}</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={() => setCustomModalOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            {customLoading ? (
              <div className="sf-cartEmpty">Cargando ingredientes...</div>
            ) : (
              <div
                className={`sf-customBuilder ${
                  selectedCustomCategory ? "sf-customBuilder--active" : ""
                }`}
              >
                {!selectedCustomCategory && (
                <div className="sf-customStart">
                  {customCategoryOptions.length === 0 ? (
                    <div className="sf-mutedLine">
                      No hay categorias personalizables en esta tienda.
                    </div>
                  ) : (
                    <div className="sf-customStartGrid" aria-label="Categorias personalizables">
                      {customCategoryOptions.map((category) => {
                        const fromPrice = priceForSize(
                          category.priceBySize,
                          category.selectSize[0]
                        );

                        return (
                          <button
                            key={category.key}
                            type="button"
                            className="sf-customStartCard"
                            onClick={() => {
                              const sizes = getAvailableSizes(category);
                              setCustomCategoryKey(category.key);
                              setCustomSize(sizes.length === 1 ? sizes[0] : "");
                              setCustomIngredients({});
                              setCustomPendingIngredients({});
                              setCustomOpenSection("BASE");
                            }}
                          >
                            {category.sampleImage ? (
                              <img src={category.sampleImage} alt="" aria-hidden="true" />
                            ) : (
                              <span className="sf-customCategorySlideArt" aria-hidden="true" />
                            )}
                            <span>{category.name}</span>
                            <small>
                              {category.selectSize.join(" / ")}
                              {fromPrice ? ` - base desde EUR ${fromPrice.toFixed(2)}` : ""}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                )}

                {selectedCustomCategory && (
                <>
                <div className="sf-customBuilderBody">
                  <section className="sf-customAccordion">
                    <button
                      type="button"
                      className={`sf-customAccordionHead ${
                        !selectedCustomCategory ? "is-disabled" : ""
                      }`}
                      onClick={() => {
                        if (!selectedCustomCategory) return;
                        setCustomOpenSection((current) =>
                          current === "BASE" ? null : "BASE"
                        );
                      }}
                    >
                      <span>BASE</span>
                      <strong>
                        {selectedCustomBase && (
                          `${selectedCustomBase.baseName}${customSize ? ` ${customSize}` : ""}`
                        )}
                        {!selectedCustomBase && "Primero elige categoria"}
                      </strong>
                    </button>

                    {customOpenSection === "BASE" && selectedCustomBase && (
                      <div className="sf-customAccordionBody">
                        <div className="sf-customBaseSummary">
                          <span>{selectedCustomBase.baseName}</span>
                          <small>{selectedCustomBase.products.length} productos de referencia</small>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomCategoryKey("");
                              setCustomSize("");
                              setCustomQty(1);
                              setCustomIngredients({});
                              setCustomPendingIngredients({});
                              setCustomOpenSection("BASE");
                            }}
                          >
                            Cambiar
                          </button>
                        </div>

                        <div className="sf-productPickerRow sf-productPickerRow--stack">
                          <span>Tamano</span>
                          <div className="sf-sizeOptions">
                            {getAvailableSizes(selectedCustomBase).map((size) => {
                              const active = customSize === size;
                              const price = priceForSize(
                                selectedCustomBase.priceBySize,
                                size
                              );

                              return (
                                <button
                                  key={size}
                                  type="button"
                                  className={`sf-sizeChip ${active ? "is-active" : ""}`}
                                  onClick={() => {
                                    setCustomSize(size);
                                    setCustomPendingIngredients({});
                                    setCustomOpenSection("BASE");
                                  }}
                                >
                                  <span>{size}</span>
                                  <strong>EUR {price.toFixed(2)}</strong>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="sf-productPickerRow">
                          <span>Qty</span>
                          <div className="sf-qtyControl">
                            <button
                              type="button"
                              onClick={() =>
                                setCustomQty((qty) =>
                                  Math.max(1, Number(qty || 1) - 1)
                                )
                              }
                              disabled={Number(customQty || 1) <= 1}
                            >
                              -
                            </button>
                            <strong>{customQty}</strong>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomQty((qty) =>
                                  Math.min(12, Number(qty || 1) + 1)
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="sf-customNextBtn"
                          disabled={!customSize || customOrderedCategories.length === 0}
                          onClick={() =>
                            setCustomOpenSection(customOrderedCategories[0] || "BASE")
                          }
                        >
                          <span>
                            {customSize
                              ? `${customQty} pizza${Number(customQty || 1) === 1 ? "" : "s"} ${customSize}`
                              : "Elige tamano"}
                          </span>
                          <strong>Elegir ingredientes</strong>
                        </button>
                      </div>
                    )}
                  </section>

                  {selectedCustomCategory && customHasSize && customUsesLoading && (
                    <div className="sf-customEmptyLine">Cargando opciones para {selectedCustomCategory.name}...</div>
                  )}

                  {selectedCustomCategory &&
                    customHasSize &&
                    !customUsesLoading &&
                    customOrderedCategories.length === 0 && (
                      <div className="sf-customEmptyLine">
                        No hay ingredientes personalizables configurados para {selectedCustomCategory.name}.
                      </div>
                    )}

                  {customOrderedCategories.map((categoryName) => {
                    const ingredients = customIngredientsByCategory[categoryName] || [];
                    const selectedCount = ingredients.filter((ingredient) =>
                      selectedCustomIngredientIds.includes(Number(ingredient.id))
                    ).length;
                    const isOpen = customOpenSection === categoryName;
                    const isLocked = !customHasBase || !customHasSize;

                    return (
                      <section key={categoryName} className="sf-customAccordion">
                        <button
                          type="button"
                          className={`sf-customAccordionHead ${isLocked ? "is-disabled" : ""}`}
                          onClick={() => {
                            if (isLocked) return;
                            setCustomOpenSection((current) =>
                              current === categoryName ? null : categoryName
                            );
                          }}
                        >
                          <span>{categoryName}</span>
                          <strong>
                            {selectedCount > 0
                              ? `${selectedCount} seleccionado${selectedCount === 1 ? "" : "s"}`
                              : isLocked
                              ? "Completa el paso anterior"
                              : "Elegir"}
                          </strong>
                        </button>

                        {isOpen && !isLocked && (
                          <div className="sf-customAccordionBody">
                            {ingredients.map((ingredient) => {
                              const selected = customIngredients[ingredient.id] || null;
                              const pending = customPendingIngredients[ingredient.id] || null;
                              const activeSelection = pending || selected;
                              const confirmReady = Boolean(pending?.placement && pending?.quantity);
                              const placementName =
                                activeSelection?.placement === "FULL"
                                  ? "Full"
                                  : activeSelection?.placement === "LEFT"
                                  ? "Left"
                                  : activeSelection?.placement === "RIGHT"
                                  ? "Right"
                                  : "";

                              return (
                                <div
                                  key={ingredient.id}
                                  className={`sf-customIngredient ${confirmReady ? "is-confirm-ready" : ""}`}
                                >
                                  <div className="sf-customIngredientHead">
                                    <strong>
                                      {ingredient.name}
                                      {placementName ? ` (${placementName})` : ""}
                                    </strong>
                                    <span>
                                      {customUsesLoading
                                        ? "..."
                                        : `EUR ${getCustomIngredientUnitPrice(ingredient).toFixed(2)}`}
                                    </span>
                                  </div>

                                  <div
                                    className={`sf-customIngredientControls ${
                                      activeSelection?.placement ? "has-selection" : ""
                                    }`}
                                  >
                                    <div
                                      className={`sf-customPlacement ${
                                        activeSelection?.placement ? "is-selected" : ""
                                      } ${confirmReady ? "is-confirm-ready" : ""}`}
                                    >
                                      {activeSelection?.placement ? (
                                        <div className="sf-customPlacementFlip">
                                          <button
                                            type="button"
                                            className={`sf-sizeChip sf-customPlacementFace sf-customPlacementFace--choice ${
                                              selected?.placement === activeSelection.placement ? "is-active" : ""
                                            }`}
                                            onClick={() =>
                                              updateCustomIngredientDraft(ingredient, {
                                                placement: activeSelection.placement,
                                                quantity: activeSelection.quantity || "SIMPLE",
                                              })
                                            }
                                          >
                                            <span>{activeSelection.placement}</span>
                                          </button>
                                          {confirmReady && (
                                            <button
                                              type="button"
                                              className="sf-customConfirmBtn sf-customPlacementFace sf-customPlacementFace--confirm"
                                              onClick={() => confirmCustomIngredient(ingredient, categoryName)}
                                            >
                                              Agregar
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        ["FULL", "LEFT", "RIGHT"].map((placement) => (
                                        <button
                                          key={placement}
                                          type="button"
                                          className={`sf-sizeChip ${
                                            activeSelection?.placement === placement ? "is-active" : ""
                                          }`}
                                          onClick={() =>
                                            updateCustomIngredientDraft(ingredient, {
                                              placement,
                                              quantity: pending?.quantity || selected?.quantity || "SIMPLE",
                                            })
                                          }
                                        >
                                          <span>{placement}</span>
                                        </button>
                                        ))
                                      )}
                                    </div>

                                    {activeSelection?.placement && (
                                      <div className="sf-customIngredientExpanded">
                                        <div className="sf-customToggle">
                                          {["SIMPLE", "DOUBLE"].map((quantity) => (
                                            <button
                                              key={quantity}
                                              type="button"
                                              className={`sf-sizeChip ${
                                                activeSelection.quantity === quantity ? "is-active" : ""
                                              }`}
                                              onClick={() => {
                                                updateCustomIngredientDraft(ingredient, { quantity });
                                              }}
                                            >
                                              <span>{quantity === "DOUBLE" ? "Doble" : "Simple"}</span>
                                            </button>
                                          ))}
                                        </div>
                                        <strong>
                                          EUR {getCustomIngredientPrice(activeSelection).toFixed(2)}
                                        </strong>
                                        <button
                                          type="button"
                                          className="sf-modalCloseBtn sf-customRemove"
                                          onClick={() => removeCustomIngredient(ingredient.id)}
                                          aria-label={`Quitar ${ingredient.name}`}
                                        >
                                          x
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>

                <div className="sf-productPickerActions sf-builderStickyActions">
                  <div className="sf-builderTotal">
                    <span>Total armado</span>
                    <strong>EUR {customGrandTotal.toFixed(2)}</strong>
                  </div>
                  <button
                    type="button"
                    className="sf-primaryBtn"
                    disabled={!customReady}
                    onClick={addCustomLine}
                  >
                    {customReady
                      ? `Add to cart - EUR ${customGrandTotal.toFixed(2)}`
                      : "Completa la personalizacion"}
                  </button>
                </div>
                </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {repeatOpen && (
        <div className="sf-modalOverlay" onClick={() => setRepeatOpen(false)}>
          <div className="sf-modalCard sf-repeatModal" onClick={(event) => event.stopPropagation()}>
            <h3>Repetir pedido</h3>
            <p>
              Busca el ultimo pedido con tu telefono, revisa el contenido y
              repitelo cuando este correcto.
            </p>

            <form className="sf-repeatForm" onSubmit={loadRepeatOrder}>
              <label>
                <span>Telefono</span>
                <input
                  type="tel"
                  value={repeatPhone}
                  onChange={(event) => {
                    setRepeatPhone(normalizeRepeatPhoneInput(event.target.value));
                    setRepeatDraft(null);
                    setRepeatOptions([]);
                    setRepeatSearched(false);
                    setRepeatMessage("");
                  }}
                  placeholder="600000000"
                  inputMode="numeric"
                  maxLength={9}
                />
              </label>
              <button type="submit" className="sf-primaryBtn" disabled={repeatLoading}>
                {repeatLoading ? "Buscando..." : "Ver ultimos 3"}
              </button>
            </form>

            {repeatSearched && (
              <div className="sf-repeatChoices" aria-label="Ultimos tres pedidos">
                {repeatOrderSlots.map((draft, index) => {
                  if (!draft) {
                    return (
                      <div key={`empty-${index}`} className="sf-repeatChoice is-empty">
                        <span>Slot {index + 1}</span>
                        <strong>Sin pedido</strong>
                        <small>Cuando haya mas compras, apareceran aqui.</small>
                      </div>
                    );
                  }

                  const lines = Array.isArray(draft.items)
                    ? draft.items.map((item, itemIndex) => normalizeCartLine(item, itemIndex))
                    : [];
                  const preview = lines.slice(0, 2);
                  const total = lines.reduce((sum, line) => sum + getCartLinePayableTotal(line), 0);

                  return (
                    <button
                      key={draft.sourceOrderId || draft.sourceOrderCode || index}
                      type="button"
                      className="sf-repeatChoice"
                      onClick={() => repeatFoundOrder(draft)}
                      disabled={lines.length === 0}
                    >
                      <span>Pedido {draft.sourceOrderCode || `#${index + 1}`}</span>
                      <strong>{formatMoney(total, draft.currency)}</strong>
                      <small>{formatRepeatDate(draft.createdFromOrderAt)}</small>
                      <div className="sf-repeatChoiceLines">
                        {preview.map((line, lineIndex) => (
                          <em key={line.cartLineId || lineIndex}>
                            {line.qty}x {line.name}
                          </em>
                        ))}
                        {lines.length > preview.length && (
                          <em>+{lines.length - preview.length} producto(s)</em>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {repeatDraft && (
              <div className="sf-repeatSummary">
                <span>Pedido {repeatDraft.sourceOrderCode}</span>
                <div className="sf-repeatLines">
                  {repeatPreviewLines.map((line, index) => (
                    <div key={line.cartLineId || index} className="sf-repeatLine">
                      <div>
                        <strong>{line.name}</strong>
                        <small>
                          {line.size} x {line.qty}
                          {line.extras?.length > 0
                            ? ` · Extra ${line.extras.map((extra) => extra.name).join(", ")}`
                            : ""}
                        </small>
                      </div>
                      <em>{formatMoney(line.subtotal, repeatDraft.currency)}</em>
                    </div>
                  ))}
                  {repeatPreviewExtras.map((extra) => (
                    <div key={extra.id} className="sf-repeatLine sf-repeatLine--extra">
                      <div>
                        <strong>{extra.name}</strong>
                        <small>Extra</small>
                      </div>
                      <em>{formatMoney(extra.price, repeatDraft.currency)}</em>
                    </div>
                  ))}
                </div>
                <strong>
                  Total pedido: {formatMoney(repeatPreviewTotal, repeatDraft.currency)}
                </strong>
              </div>
            )}

            {repeatMessage && <div className="sf-bootsMessage">{repeatMessage}</div>}

            <div className="sf-bootsActions">
              <button type="button" className="sf-secondaryBtn" onClick={() => setRepeatOpen(false)}>
                Cerrar
              </button>
              {repeatDraft && (
                <button
                  type="button"
                  className="sf-secondaryBtn"
                  onClick={() => {
                    setRepeatDraft(null);
                    try {
                      window.localStorage.removeItem(cartDraftStorageKey);
                    } catch {
                      // Nothing to clean when storage is unavailable.
                    }
                    setRepeatMessage("Borrador de carrito eliminado.");
                  }}
                >
                  Borrar borrador
                </button>
              )}
              {repeatDraft && (
                <button
                  type="button"
                  className="sf-primaryBtn"
                  onClick={repeatFoundOrder}
                  disabled={repeatPreviewLines.length === 0}
                >
                  Repetir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {scheduleOpen && (
        <div className="sf-modalOverlay" onClick={() => setScheduleOpen(false)}>
          <div className="sf-modalCard sf-scheduleModal" onClick={(event) => event.stopPropagation()}>
            <div className="sf-scheduleHead">
              <div>
                <span>Entrega</span>
                <h3>Programar pedido</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                aria-label="Cerrar programacion"
                onClick={() => setScheduleOpen(false)}
              >
                x
              </button>
            </div>

            <div className="sf-schedule">
              <div className="sf-scheduleSection">
                <div className="sf-scheduleLabel">Fecha</div>
                <div className="sf-scheduleDaysGrid">
                  {scheduleDays.map((day) => {
                    const daySlots = buildScheduleSlots({
                      store,
                      selectedDate: day.date,
                      nowDate: now,
                    });
                    const selected = scheduledAt && isSameLocalDay(scheduledAt, day.date);
                    const disabled = daySlots.length === 0;

                    return (
                      <button
                        type="button"
                        key={day.date.toISOString()}
                        className={`sf-scheduleDayChip ${selected ? "is-selected" : ""}`}
                        onClick={() => {
                          if (disabled) return;

                          const nextDate = new Date(day.date);
                          const preferredMinutes = scheduledAt ? getMinutesOfDay(scheduledAt) : null;

                          if (preferredMinutes != null && daySlots.includes(preferredMinutes)) {
                            nextDate.setHours(
                              Math.floor(preferredMinutes / 60),
                              preferredMinutes % 60,
                              0,
                              0
                            );
                          }

                          setScheduledAt(nextDate);
                        }}
                        disabled={disabled}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {scheduledAt && (
                <div className="sf-scheduleSection">
                  <div className="sf-scheduleLabel">Hora</div>

                  {scheduleSlots.length > 0 ? (
                    <div className="sf-scheduleHoursGrid">
                      {scheduleSlots.map((minute) => {
                        const selected = scheduleSelectedMinutes === minute;

                        return (
                          <button
                            type="button"
                            key={minute}
                            className={`sf-scheduleHourChip ${selected ? "is-selected" : ""}`}
                            onClick={() => {
                              const nextDate = new Date(scheduledAt);
                              nextDate.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
                              setScheduledAt(nextDate);
                            }}
                          >
                            {minutesToHHMM(minute)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="sf-scheduleEmpty">
                      No quedan bloques disponibles para esta fecha.
                    </div>
                  )}
                </div>
              )}

              <div className="sf-scheduleFooter">
                <button
                  type="button"
                  className="sf-secondaryBtn"
                  onClick={() => {
                    setScheduledAt(null);
                    setScheduleOpen(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="sf-primaryBtn"
                  onClick={() => {
                    if (!scheduledAtIsValid) return;
                    setScheduleOpen(false);
                  }}
                  disabled={!scheduledAtIsValid}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reservationOpen && (
        <div className="sf-modalOverlay" onClick={() => setReservationOpen(false)}>
          <div
            className="sf-modalCard sf-scheduleModal sf-reservationModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-scheduleHead">
              <div>
                <span>Mesa</span>
                <h3>Reservar mesa</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                aria-label="Cerrar reservas"
                onClick={() => setReservationOpen(false)}
              >
                x
              </button>
            </div>

            <div className="sf-schedule sf-reservation">
              <div className={`sf-reservationStore ${reservationMissingClass("store")}`}>
                <span>Tienda</span>
                <strong>{store?.storeName || "Tienda seleccionada"}</strong>
                <small>
                  Capacidad de reservas:{" "}
                  {reservationCapacity > 0
                    ? `${reservationCapacity} personas`
                    : "pendiente de disponibilidad"}
                </small>
              </div>

              <div className="sf-reservationForm">
                <label>
                  <span>Personas</span>
                  <select
                    value={reservationPartySize}
                    onChange={(event) => {
                      setReservationPartySize(Number(event.target.value));
                      setReservationMessage("");
                    }}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>
                        {value} persona{value === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={reservationMissingClass("name")}>
                  <span>Nombre</span>
                  <input
                    value={reservationName}
                    onChange={(event) => {
                      setReservationName(event.target.value);
                      clearReservationMissing("name");
                      setReservationMessage("");
                    }}
                    placeholder="Tu nombre"
                  />
                </label>

                <label className={reservationMissingClass("phone")}>
                  <span>Telefono</span>
                  <input
                    value={reservationPhone}
                    onChange={(event) => {
                      setReservationPhone(event.target.value);
                      clearReservationMissing("phone");
                      setReservationMessage("");
                    }}
                    placeholder="Telefono"
                    inputMode="tel"
                  />
                </label>
              </div>

              <div className={`sf-scheduleSection ${reservationMissingClass("date")}`}>
                <div className="sf-scheduleLabel">Fecha</div>
                <div className="sf-scheduleDaysGrid">
                  {reservationDays.map((day) => {
                    const selected = reservationDate && isSameLocalDay(reservationDate, day.date);

                    return (
                      <button
                        type="button"
                        key={day.date.toISOString()}
                        className={`sf-scheduleDayChip ${selected ? "is-selected" : ""}`}
                        onClick={() => {
                          setReservationDate(new Date(day.date));
                          setReservationTime("");
                          setReservationMessage("");
                          clearReservationMissing("date");
                          clearReservationMissing("time");
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`sf-scheduleSection ${reservationMissingClass("time")}`}>
                <div className="sf-scheduleLabel">Hora</div>

                {reservationLoading && visibleReservationAvailability.length === 0 ? (
                  <div className="sf-scheduleEmpty">Cargando disponibilidad...</div>
                ) : visibleReservationAvailability.length > 0 ? (
                  <div className="sf-scheduleHoursGrid">
                    {visibleReservationAvailability.map((slot) => {
                      const occupied = Number(slot.occupied || 0);
                      const available = Number(slot.available || 0);
                      const capacity = Number(reservationCapacity || 0);
                      const ratio = capacity > 0 ? occupied / capacity : 0;
                      const canFit = slot.canFit !== false && available >= reservationPartySize;
                      const selected = reservationTime === slot.time;
                      const level = !canFit
                        ? "is-full"
                        : ratio >= 0.7
                        ? "is-high"
                        : ratio >= 0.3
                        ? "is-medium"
                        : "is-low";

                      return (
                        <button
                          type="button"
                          key={slot.time}
                          className={`sf-scheduleHourChip sf-reservationSlot ${level} ${
                            selected ? "is-selected" : ""
                          }`}
                          disabled={!canFit}
                          onClick={() => {
                            setReservationTime(slot.time);
                            setReservationMessage("");
                            clearReservationMissing("time");
                          }}
                        >
                          <span>{slot.time}</span>
                          <small>{canFit ? `${occupied}/${capacity}` : "Full"}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="sf-scheduleEmpty">
                    No hay bloques disponibles para esta fecha.
                  </div>
                )}
              </div>

              {reservationMessage && (
                <div
                  className={`sf-reservationMessage ${
                    reservationMessage.includes("correctamente") ? "is-success" : ""
                  }`}
                >
                  {reservationMessage}
                </div>
              )}

              <div className="sf-scheduleFooter">
                <button
                  type="button"
                  className="sf-secondaryBtn"
                  onClick={() => setReservationOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`sf-primaryBtn ${!reservationCanConfirm ? "is-softDisabled" : ""}`}
                  onClick={createReservation}
                  disabled={reservationLoading}
                  aria-disabled={!reservationCanConfirm}
                >
                  {reservationLoading ? "Confirmando..." : "Confirmar reserva"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bootsOpen && (
        <div className="sf-modalOverlay" onClick={() => setBootsOpen(false)}>
          <div className="sf-modalCard sf-bootsModal" onClick={(event) => event.stopPropagation()}>
            <div className="sf-bootsHero">
              <div className="sf-bootsHeroTop">
                <div className="sf-bootsPulse" aria-hidden="true">!!</div>
                <div>
                  <span>Prioridad de cola</span>
                  <h3>Boost de emergencia</h3>
                </div>
              </div>
              <p>
                Sube este pedido en la cola y bloquea la posicion elegida antes de pagar.
              </p>

              <div className="sf-bootsRoute" aria-label="Resumen de salto en cola">
                <div className="sf-bootsCurrent">
                  <span>Ahora</span>
                  <strong>#{bootsPositionLabel}</strong>
                  <small>
                    {bootsQueueLoading
                      ? "Actualizando cola..."
                      : bootsCurrentPosition == null
                      ? "Cola no disponible"
                      : "Posicion actual"}
                  </small>
                </div>
                <div className="sf-bootsRouteArrow" aria-hidden="true">
                  <span />
                </div>
                <div className="sf-bootsCurrent sf-bootsCurrent--target">
                  <span>Objetivo</span>
                  <strong>{selectedBootsTargetLabel}</strong>
                  <small>
                    {selectedBootsOption
                      ? `${selectedBootsJumpLabel} arriba`
                      : "Elige posicion"}
                  </small>
                </div>
              </div>
            </div>

            <div className="sf-bootsOptionGroup" role="radiogroup" aria-label="Posiciones disponibles">
              <span>Elige tu salto</span>
              {bootsOptions.length === 0 ? (
                <div className="sf-bootsEmpty">
                  No hay posiciones disponibles para activar Boost ahora mismo.
                </div>
              ) : bootsOptions.map((option) => {
                const active =
                  String(option.targetPosition) === String(bootsTargetPosition);

                return (
                  <button
                    key={option.targetPosition}
                    type="button"
                    className={`sf-bootsOption ${active ? "is-active" : ""}`}
                    onClick={() => {
                      setBootsTargetPosition(String(option.targetPosition));
                      setBootsMessage("");
                    }}
                    role="radio"
                    aria-checked={active}
                  >
                    <strong>#{option.targetPosition}</strong>
                    <span>
                      {option.jumps === 1
                        ? "Sube 1 puesto"
                        : `Sube ${option.jumps} puestos`}
                    </span>
                    <em>{formatMoney(option.amount, boostCurrency)}</em>
                  </button>
                );
              })}
            </div>

            <small className="sf-bootsCheckoutNote">
              {cartHasBoost
                ? "Ya tienes un Boost en el carrito. Solo se permite uno por sesion."
                : "El Boost se anadira a tu carrito y se cobrara al finalizar la compra."}
            </small>

            {bootsMessage && <div className="sf-bootsMessage">{bootsMessage}</div>}

            <div className="sf-bootsActions">
              <button type="button" className="sf-secondaryBtn" onClick={() => setBootsOpen(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="sf-primaryBtn sf-bootsActivate"
                onClick={activateBoots}
                disabled={!selectedBootsOption || bootsQueueLoading || cartHasBoost}
              >
                {cartHasBoost
                  ? "Boost ya en carrito"
                  : selectedBootsOption
                  ? `Activar Boost - ${formatMoney(selectedBootsOption.amount, boostCurrency)}`
                  : "Activar Boost"}
              </button>
            </div>
          </div>
        </div>
      )}

      <IncentiveFocusModal
        open={gridIncentiveOpen}
        onClose={() => setGridIncentiveOpen(false)}
        active={Boolean(activeIncentive)}
        waiting={!activeIncentive && Boolean(nextIncentive)}
        unlocked={Boolean(incentiveUnlocked)}
        remainingLabel={gridIncentiveRemainingLabel}
        targetLabel={gridIncentiveTargetLabel}
        currentLabel={gridIncentiveCurrentLabel}
        rewardLabel={incentiveRewardLabel}
        message={incentiveMessage}
        counterLabel={incentiveCounterLabel}
      />

      <CouponInfoModal
        open={couponInfoOpen}
        data={couponInfoData}
        validating={couponLoading}
        onClose={() => setCouponInfoOpen(false)}
        onRemove={() => {
          removeCouponFromCart();
          setCouponInfoOpen(false);
        }}
        onValidate={async () => {
          const result = await applyCouponCode(couponInfoData?.coupon?.code || couponCode, {
            openInfo: false,
            openCartOnValid: true,
          });
          const closableStatuses = new Set(["empty_cart", "waiting_for_cart"]);
          if (result?.valid || closableStatuses.has(String(result?.status || "").toLowerCase())) {
            setCouponInfoOpen(false);
            if (result?.valid) setCartOpen(true);
          }
        }}
      />

      <StorefrontTermsGateModal
        open={portalReady && !termsAccepted}
        partnerName={partner?.name || store?.partnerName || store?.storeName}
        onAccept={acceptStorefrontTerms}
      />
    </div>
  );
}
