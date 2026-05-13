import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/Storefront.css";
import flagEs from "../assets/flags/es.svg";
import {
  BRANDING_DEFAULTS,
  buildBrandThemeVars,
  getOfferButtonVariant,
} from "../constants/branding";

const TRENDING_TAB = "__TRENDING__";
const PROMOS_TAB = "__PROMOS__";
const UPCOMING_TAB = "__UPCOMING__";
const HALF_CATEGORY_ID = 3;
const CUSTOM_BASE_PRICE_FACTOR = 0.8;
const DEFAULT_BOOST_SETTINGS = {
  active: true,
  unitPrice: 0.2,
  maxOptions: 3,
  voltaSharePercent: 25,
  partnerSharePercent: 75,
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

function formatLaunchCountdown(launchAt, now) {
  const launchDate = new Date(launchAt);
  if (!launchAt || Number.isNaN(launchDate.getTime())) return "Muy pronto";

  const diffMs = launchDate.getTime() - now.getTime();
  if (diffMs <= 0) return "Disponible ahora";

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
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
    const ingredientMatch = (item.ingredients || []).some((ingredient) =>
      String(ingredient.name || "").toLowerCase().includes(query)
    );

    return (
      pizzaName.includes(query) ||
      pizzaCategory.includes(query) ||
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
      String(item.name || "").toLowerCase().includes(query)
    );

    return title.includes(query) || description.includes(query) || itemMatch;
  });
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

const formatTrendPercent = (value) => {
  const parsed = Number(value || 0);
  if (parsed > 0) return `+${parsed}%`;
  if (parsed < 0) return `${parsed}%`;
  return "0%";
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

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const formatDurationMs = (value) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
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
  if (!Array.isArray(allergens) || allergens.length === 0) return null;

  return (
    <div className="sf-allergenAlert" role="note" aria-label="Aviso de alergenos">
      <span>Atencion alergenos</span>
      <div>
        {allergens.map((allergen) => (
          <strong key={allergen}>{allergen}</strong>
        ))}
      </div>
    </div>
  );
};

const buildPizzaLine = (item) => {
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

  return sizes.some((size) => priceForSize(item.priceBySize, size) > 0);
};

const normalizeCartLine = (line, index = 0) => {
  const qty = getCartLineQty(line);
  const price = num(line?.price ?? line?.unitPrice ?? line?.amount);
  const source = line?.source || "";
  const type = line?.type || "";
  const extras = Array.isArray(line?.extras)
    ? line.extras.map((extra) => ({
        id: extra?.id ?? extra?.ingredientId ?? extra?.code ?? `extra-${index}`,
        name: extra?.name ?? extra?.label ?? extra?.ingredientName ?? "Extra",
        price: num(extra?.price ?? extra?.amount),
      }))
    : [];
  const extrasTotal = extras.reduce((sum, extra) => sum + num(extra.price), 0);
  const subtotal = num(line?.subtotal) || (price + extrasTotal) * qty;

  return {
    cartLineId: line?.cartLineId || line?.repeatLineId || `${Date.now()}-${index}`,
    pizzaId: line?.pizzaId ?? line?.id ?? null,
    name: line?.name || line?.label || "Producto",
    category: line?.category || "",
    size: line?.size || line?.selectedSize || "M",
    qty,
    price,
    extras,
    subtotal,
    type,
    image: line?.image || "",
    source,
    incentiveId: line?.incentiveId ?? null,
    rewardPizzaId: line?.rewardPizzaId ?? null,
    promoId: line?.promoId ?? null,
    promoItems: Array.isArray(line?.promoItems) ? line.promoItems : [],
  };
};

const isIncentiveRewardCartLine = (line) => {
  const source = String(line?.source || "").trim();
  const type = String(line?.type || "").trim();

  return source === "incentive_reward" || type === "INCENTIVE_REWARD";
};

const isIncentiveEligibleCartLine = (line) => {
  const source = String(line?.source || "").trim();
  const type = String(line?.type || "").trim();

  if (NON_INCENTIVE_LINE_SOURCES.has(source)) return false;
  if (NON_INCENTIVE_LINE_TYPES.has(type)) return false;

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

  const [menu, setMenu] = useState([]);
  const [trending, setTrending] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [promos, setPromos] = useState([]);
  const [store, setStore] = useState(null);
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatPhone, setRepeatPhone] = useState("");
  const [repeatDraft, setRepeatDraft] = useState(null);
  const [repeatMessage, setRepeatMessage] = useState("");
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
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
  const [customOpenSection, setCustomOpenSection] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const customCategoryCarouselRef = useRef(null);
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
  const incentiveZeroRefreshRef = useRef(false);
  const dismissedRewardIncentiveIdsRef = useRef(new Set());

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

        const nextMenu = Array.isArray(menuData?.menu) ? menuData.menu : [];
        const nextTrending = Array.isArray(menuData?.trending)
          ? menuData.trending
          : [];
        const nextUpcoming = Array.isArray(menuData?.upcoming)
          ? menuData.upcoming
          : [];
        const nextPromos = Array.isArray(menuData?.promos) ? menuData.promos : [];

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
    }, 1000);

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
    const intervalId = window.setInterval(() => {
      setTick(true);
      window.setTimeout(() => setTick(false), 600);
    }, 5000);

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

  const themeStyle = useMemo(
    () => {
      const theme = buildBrandThemeVars({
        brandPrimary: partner?.brandPrimary || "#4B11B2",
        brandSecondary: partner?.brandSecondary || "#FFBF2D",
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

  const tabs = useMemo(
    () => [
      { id: TRENDING_TAB, label: "Trending" },
      { id: PROMOS_TAB, label: "Promos" },
      ...(upcoming.length ? [{ id: UPCOMING_TAB, label: "Proximos" }] : []),
      ...categories.map((category) => ({
        id: category.id,
        label: category.name,
      })),
    ],
    [categories, upcoming.length]
  );

  useEffect(() => {
    if (!categories.length) {
      setActiveTab("");
      return;
    }

    const validCategoryIds = new Set(categories.map((category) => category.id));
    setActiveTab((current) =>
      validCategoryIds.has(current) ? current : categories[0].id
    );
  }, [categories]);

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
    return filterPromos(promos, query);
  }, [promos, search]);

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
    if (activeTab === PROMOS_TAB || activeTab === UPCOMING_TAB) return [];

    if (activeTab === TRENDING_TAB) {
      return [];
    }

    return baseFilteredMenu.filter(
      (item) => getCustomCategoryKey(item) === activeTab
    );
  }, [activeTab, baseFilteredMenu]);

  const activeTabLabel =
    tabs.find((tab) => tab.id === activeTab)?.label || "Trending";
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
    if (!selectedProductId) return null;

    const allProducts = [
      ...menu,
      ...trending,
      ...upcoming,
    ];

    return allProducts.find(
      (item) => Number(item.pizzaId) === Number(selectedProductId)
    ) || null;
  }, [menu, selectedProductId, trending, upcoming]);

  const selectedProductSizes = useMemo(
    () => getAvailableSizes(selectedProduct),
    [selectedProduct]
  );

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
  const productModalReady = Boolean(selectedProduct && productSelection.size);
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
      return priceForSize(right.priceBySize, rightSize) - priceForSize(left.priceBySize, leftSize);
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
  const halfBasePrice = useMemo(() => {
    if (!halfSize || !halfA || !halfB) return 0;
    return Math.max(
      priceForSize(halfA.priceBySize, halfSize),
      priceForSize(halfB.priceBySize, halfSize)
    );
  }, [halfA, halfB, halfSize]);
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
  const customMissingSteps = [
    !customHasBase ? "base" : null,
    !customHasSize ? "tamano" : null,
    !customHasIngredient ? "al menos un ingrediente" : null,
  ].filter(Boolean);
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
  const scrollCustomCategoryCarousel = useCallback((direction) => {
    const node = customCategoryCarouselRef.current;
    if (!node) return;

    node.scrollBy({
      left: direction * Math.max(180, node.clientWidth * 0.7),
      behavior: "smooth",
    });
  }, []);
  const customOrderedCategories = useMemo(() => {
    const existing = Object.keys(customIngredientsByCategory);
    return [
      ...CUSTOM_CATEGORY_ORDER.filter((category) => existing.includes(category)),
      ...existing.filter((category) => !CUSTOM_CATEGORY_ORDER.includes(category)).sort(),
    ];
  }, [customIngredientsByCategory]);
  const getNextCustomSection = useCallback(
    (categoryName) => {
      const currentIndex = customOrderedCategories.indexOf(categoryName);
      if (currentIndex === -1) return null;

      return customOrderedCategories[currentIndex + 1] || null;
    },
    [customOrderedCategories]
  );
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
    if (!halfModalOpen) return;

    const loadHalfExtras = async () => {
      try {
        setHalfExtrasLoading(true);
        const categoryIds = [
          halfA?.categoryId,
          halfB?.categoryId,
          HALF_CATEGORY_ID,
        ]
          .map((id) => Number(id))
          .filter((id, index, ids) => Number.isInteger(id) && id > 0 && ids.indexOf(id) === index);

        const results = await Promise.all(
          categoryIds.map(async (categoryId) => {
            const params = new URLSearchParams({
              categoryId: String(categoryId),
              storeId: String(store?.id || ""),
            });
            try {
              const data = await api.get(`/api/ingredient-extras?${params.toString()}`);
              return Array.isArray(data) ? data : [];
            } catch {
              return [];
            }
          })
        );
        const byIngredient = new Map();
        results.flat().forEach((extra) => {
          const key = extra?.ingredientId ?? extra?.id ?? extra?.name;
          if (!key || byIngredient.has(key)) return;
          byIngredient.set(key, extra);
        });
        setHalfExtrasAvail([...byIngredient.values()]);
      } catch (err) {
        console.error(err);
        setHalfExtrasAvail([]);
      } finally {
        setHalfExtrasLoading(false);
      }
    };

    loadHalfExtras();
  }, [halfA?.categoryId, halfB?.categoryId, halfModalOpen, store?.id]);

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
  }, [
    customIngredientsCatalog,
    customModalOpen,
    customSize,
    getCustomIngredientUnitPrice,
  ]);

  useEffect(() => {
    if (
      !customModalOpen ||
      !selectedCustomCategory ||
      !customHasSize ||
      customUsesLoading ||
      customOrderedCategories.length === 0
    ) {
      return;
    }

    if (customOpenSection === "BASE") {
      setCustomOpenSection(customOrderedCategories[0]);
    }
  }, [
    customUsesLoading,
    customHasSize,
    customModalOpen,
    customOpenSection,
    customOrderedCategories,
    selectedCustomCategory,
  ]);

  useEffect(() => {
    if (!customModalOpen) return;
    setCustomCategoryKey("");
    setCustomSize("");
    setCustomQty(1);
    setCustomIngredients({});
    setCustomOpenSection("BASE");
  }, [customModalOpen]);

  const openProductModal = (item) => {
    const sizes = getAvailableSizes(item);
    setSelectedProductId(item.pizzaId);
    setProductSelection({
      size: sizes.length === 1 ? sizes[0] : "",
      qty: 1,
      extras: {},
    });
    setShowAllExtras(false);
    setProductModalOpen(true);
  };

  const addProductLine = () => {
    if (!selectedProduct || !productSelection.size) return;

    const line = {
      cartLineId: `${selectedProduct.pizzaId}-${Date.now()}`,
      pizzaId: selectedProduct.pizzaId,
      name: selectedProduct.name,
      category: selectedProduct.category,
      size: productSelection.size,
      qty: Number(productSelection.qty || 1),
      price: selectedBasePrice,
      extras: selectedExtras,
      allergens: selectedPurchaseAllergens,
      subtotal: selectedLineTotal,
      image: selectedProduct.image || "",
    };

    setCart((current) => [...current, line]);
    try {
      window.localStorage.removeItem(cartDraftStorageKey);
    } catch {
      // Ignore storage cleanup failures.
    }
    setProductModalOpen(false);
    setCartOpen(true);
  };

  const decProductQty = () => {
    setProductSelection((current) => ({
      ...current,
      qty: Math.max(1, Number(current.qty || 1) - 1),
    }));
  };

  const incProductQty = () => {
    const stockMax =
      selectedProduct?.stock == null ? 12 : Math.max(1, Number(selectedProduct.stock));
    const max = Math.min(12, stockMax || 12);
    setProductSelection((current) => ({
      ...current,
      qty: Math.min(max, Number(current.qty || 1) + 1),
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

    const priceA = priceForSize(halfA.priceBySize, halfSize);
    const priceB = priceForSize(halfB.priceBySize, halfSize);
    const main = priceA >= priceB ? halfA : halfB;
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
        pricingSourcePizzaId: main.pizzaId,
        pricingSourceName: main.name,
        leftPrice: priceA,
        rightPrice: priceB,
      },
      image: main.image || halfA.image || halfB.image || "",
    };

    setCart((current) => [...current, line]);
    try {
      window.localStorage.removeItem(cartDraftStorageKey);
    } catch {
      // Ignore storage cleanup failures.
    }
    setHalfModalOpen(false);
    setCartOpen(true);
  };

  const updateCustomIngredient = (ingredient, updates) => {
    setCustomIngredients((current) => {
      const existing = current[ingredient.id] || {
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

  const removeCustomIngredient = (ingredientId) => {
    setCustomIngredients((current) => {
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
      const catalogIngredient = customIngredientsCatalog.find(
        (ingredient) => Number(ingredient.id) === Number(id)
      );

      return {
        id: Number(id),
        ingredientId: Number(id),
        name: catalogIngredient?.name || data.name || "Ingrediente",
        placement: data.placement,
        quantity: data.quantity,
        allergens: Array.isArray(catalogIngredient?.allergens)
          ? catalogIngredient.allergens
          : [],
        price: getCustomIngredientPrice(data),
      };
    });

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
      customMeta: {
        categoryId: selectedCustomCategory.categoryId,
        categoryName: selectedCustomCategory.name,
        baseName: selectedCustomCategory.baseName,
        pricingRule: "CATEGORY_BASELINE",
        basePriceFactor: CUSTOM_BASE_PRICE_FACTOR,
      },
      image: selectedCustomCategory.sampleImage || "",
    };

    setCart((current) => [...current, line]);
    try {
      window.localStorage.removeItem(cartDraftStorageKey);
    } catch {
      // Ignore storage cleanup failures.
    }
    setCustomModalOpen(false);
    setCartOpen(true);
  };

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + getCartLineQty(item), 0),
    [cart]
  );
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + getCartLinePayableTotal(item), 0),
    [cart]
  );
  const cartProductSubtotal = useMemo(
    () =>
      cart
        .filter(isIncentiveEligibleCartLine)
        .reduce((sum, item) => sum + num(item.subtotal), 0),
    [cart]
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
      setRepeatPhone(phone);
      const params = new URLSearchParams({
        partnerId: String(partner?.id || ""),
        storeId: String(store?.id || ""),
        phone,
      });
      const data = await api.get(`/api/myorders/repeat/latest?${params.toString()}`);
      const draft = data?.cartDraft || null;

      setRepeatDraft(draft);
      setRepeatMessage(
        draft?.sourceOrderCode
          ? `Pedido ${draft.sourceOrderCode} encontrado.`
          : "Pedido anterior encontrado."
      );
    } catch (err) {
      console.error(err);
      setRepeatDraft(null);
      setRepeatMessage(
        getApiErrorMessage(err, "No encontramos un pedido anterior para repetir.")
      );
    } finally {
      setRepeatLoading(false);
    }
  };

  const repeatFoundOrder = () => {
    if (!repeatDraft || repeatPreviewLines.length === 0) return;

    setCart(repeatPreviewLines);
    try {
      window.localStorage.setItem(cartDraftStorageKey, JSON.stringify(repeatDraft));
    } catch {
      // The in-memory draft is enough if storage is unavailable.
    }
    setRepeatMessage("Pedido repetido y anadido al carrito.");
    setRepeatOpen(false);
    setCartOpen(true);
  };

  const addPromoLine = (promo) => {
    const promoId = Number(promo?.id);
    const totalPrice = roundMoney(num(promo?.totalPrice));
    if (!promoId || totalPrice <= 0) return;

    const promoItems = Array.isArray(promo.items)
      ? promo.items.map((item, index) => ({
          pizzaId: item?.pizzaId ?? null,
          name: item?.name || `Producto ${index + 1}`,
          size: item?.size || "",
          quantity: getCartLineQty(item),
        }))
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
    try {
      window.localStorage.removeItem(cartDraftStorageKey);
    } catch {
      // Ignore storage cleanup failures.
    }
    setCartOpen(true);
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
      name: "Emergency Boost",
      category: "Boost",
      size: `#${bootsPositionLabel} -> #${selectedBootsOption.targetPosition}`,
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
    try {
      window.localStorage.removeItem(cartDraftStorageKey);
    } catch {
      // Ignore storage cleanup failures.
    }
    setBootsMessage("Boost anadido al carrito. Se cobrara al finalizar la compra.");
    setBootsOpen(false);
    setCartOpen(true);
  };

  const renderProductCard = (item) => {
    const flipped = flippedId === item.pizzaId;
    const image = item.image || "";
    const sizes = Object.keys(item.priceBySize || {}).filter(
      (size) => item.priceBySize?.[size] !== "" && item.priceBySize?.[size] != null
    );
    const basePrice = priceForSize(item.priceBySize, sizes[0] || "M");
    const { line, closer } = buildPizzaLine(item);

    return (
      <div
        key={item.pizzaId}
        className={`lsf-card lsf-flip ${flipped ? "is-flipped" : ""}`}
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
                  <span>Pizza</span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="lsf-card__addbtn"
              onClick={(event) => {
                event.stopPropagation();
                openProductModal(item);
              }}
              aria-label={`Comprar ${item.name}`}
            >
              Comprar
            </button>

            <div className="lsf-card__overlay">
              <div className="lsf-card__ticker">
                <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                  {item.name}
                </div>
              </div>
              <div className={`lsf-card__price ${tick ? "is-ticking" : ""}`}>
                EUR {basePrice.toFixed(2)}
              </div>
            </div>
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

  if (error) {
    return (
      <div className="sf-error">
        <div className="sf-errorCard">{error}</div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="sf-loading">
        <div className="sf-loadingCard">Loading store...</div>
      </div>
    );
  }

  return (
    <div className="sf-shell" style={themeStyle}>
      <div className="sf-wrap sf-menu">
        <section className="sf-storeHeader">
          <div className="sf-storeHeaderTitle">Selecciona productos</div>

          <div className="lsf-top__actions">
            <span className="sf-engineUtilityPill sf-lsfStoreTicker" aria-label={`${partner?.name || store.storeName}, ${store?.city || "Ciudad"}, ${store.storeName}`}>
              <span className="sf-engineUtilityPillTicker">
                <span className="sf-engineUtilityPillTrack">
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
                </span>
              </span>
            </span>
            <button
              type="button"
              className="lsf-cartbtn__count lsf-schedulebtn"
              onClick={() => setScheduleOpen(true)}
            >
              Programar
            </button>

            <button
              type="button"
              className={`lsf-cartbtn ${cartCount > 0 ? "is-active" : ""}`}
              onClick={() => setCartOpen(true)}
              aria-label="Abrir carrito"
            >
              <span aria-hidden="true">🛒</span>
              <span className="lsf-cartbtn__count">{cartCount}</span>
              <span className="lsf-cartbtn__total">€{cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </section>

        <section className="sf-lsfSurface lsf-wrapper lsf-mobile">
          <div className="sf-lsfActionSearchLine">
            <button
              type="button"
              className={`sf-offersBtn sf-lsfOfferBtn ${offerVariant.className}`}
              onClick={() => navigate(`/${partnerSlug}/coupons`)}
            >
              <span className="sf-offersBtnLabel">{offerVariant.label}</span>
            </button>

            <button
              type="button"
              className={`lsf-buildmode ${halfModalOpen ? "is-active" : ""}`}
              onClick={openHalfModal}
            >
              Mitad / Mitad
            </button>
            <button
              type="button"
              className={`lsf-buildmode ${customModalOpen ? "is-active" : ""}`}
              onClick={openCustomModal}
            >
              Arma tu pizza
            </button>

            <div className="sf-lsfSearchCluster">
              <div className="sf-engineSearchRow sf-engineSearchRow--lsf">
                <div className="sf-engineSearchWrap">
                  {!search && (
                    <span className="sf-engineSearchTicker" aria-hidden="true">
                      <span className="sf-engineSearchTickerTrack">
                        <span>Buscar pizza o ingrediente, extras o sabores</span>
                      </span>
                    </span>
                  )}
                  <input
                    className="sf-engineSearch"
                    type="search"
                    placeholder=""
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
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
                  <button type="button" className="sf-engineSearchBtn" aria-label="Buscar">
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
                <span>Repetir pedido</span>
              </button>
            </div>
          </div>

          <div
            className={`sf-incentiveBanner sf-incentiveBanner--lsf ${
              incentiveUnlocked ? "is-complete" : ""
            } ${activeIncentive ? "is-active" : nextIncentive ? "is-waiting" : "is-idle"}`}
          >
            <div className="sf-incentiveHead">
              <div className="sf-incentiveCopy">
                <span className="sf-incentiveEyebrow">
                  {incentiveEyebrow}
                </span>
                <strong>{incentiveMessage}</strong>
              </div>
              {!incentiveUnlocked && (
                <div className="sf-incentiveSignal" aria-label="Estado del incentivo">
                  <span className="sf-incentiveTimer">{incentiveCounterLabel}</span>
                </div>
              )}
            </div>

            {incentiveUnlocked ? (
              <div className="sf-incentiveRewardStage" aria-label="Incentivo desbloqueado">
                <span>Felicidades</span>
                <strong>{incentiveRewardLabel} listo para este pedido</strong>
                <span>Volta reward</span>
              </div>
            ) : activeIncentive ? (
              <div className="sf-incentiveProgress" aria-label="Progreso del incentivo">
                <div className="sf-incentiveProgressTrack">
                  <span
                    className="sf-incentiveProgressFill"
                    style={{ width: `${Math.round(incentiveProgress * 100)}%` }}
                  />
                  <span
                    className="sf-incentiveProgressStripes"
                    style={{ width: `${Math.round(incentiveProgress * 100)}%` }}
                  />
                  <span className="sf-incentiveProgressGlow" />
                  <span
                    className="sf-incentiveProgressMarker"
                    style={{ left: `${Math.min(96, Math.max(4, incentivePercent))}%` }}
                  >
                    {activeIncentive ? `${incentivePercent}%` : "--"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="lsf-tabs" role="tablist" aria-label="Categorias del menu">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`lsf-tab ${activeTab === tab.id ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

       

        <section className="sf-engineCard sf-engineCard--lsf">
          <div className="sf-engineGridStage sf-engineGridStage--lsf">
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

                              <button
                                type="button"
                                className="lsf-card__addbtn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addPromoLine(promo);
                                }}
                                aria-label={`Elegir promo ${promo.title}`}
                              >
                                Elegir
                              </button>

                              <div className="lsf-card__overlay">
                                <div className="lsf-card__ticker">
                                  <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                                    {promo.title}
                                  </div>
                                </div>
                                <div className={`lsf-card__price ${tick ? "is-ticking" : ""}`}>
                                  EUR {Number(promo.totalPrice || 0).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            <div className="lsf-flip__back">
                              <div className="lsf-flip-desc lsf-promoFlipDesc">
                                <div className="lsf-flip-title">Contenido</div>
                                <div className="lsf-promoFlipList">
                                  {promoItems.length ? (
                                    promoItems.map((item, index) => (
                                      <span key={`${promo.id}-${item.pizzaId || item.name || index}`}>
                                        {item.quantity || 1}x {item.name}
                                        {item.size ? ` ${item.size}` : ""}
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
                    {filteredTrending.map((item) => {
                      const flipped = flippedId === item.pizzaId;
                      const image = item.image || "";
                      const sizes = Object.keys(item.priceBySize || {}).filter(
                        (size) => item.priceBySize?.[size] !== "" && item.priceBySize?.[size] != null
                      );
                      const basePrice = priceForSize(item.priceBySize, sizes[0] || "M");
                      const { line, closer } = buildPizzaLine(item);
                      const trend = item.trend || {};
                      const soldWeek = Number(trend.soldLast7Days || 0);
                      const soldAllTime = Number(trend.soldAllTime || 0);
                      const rank = Number(trend.rank || 0) || 1;
                      const trendPercent = Number(trend.trendPercent || 0);
                      const trendBasisLabel =
                        trend.rankingBasis === "last7Days"
                          ? "Ultimos 7 dias"
                          : trend.rankingBasis === "historicalFallback"
                          ? "Historico tienda"
                          : "Esperando ventas";

                      return (
                        <div
                          key={item.pizzaId}
                          className="lsf-trendingItem"
                          role="listitem"
                        >
                          <div
                            className={`lsf-card lsf-card--trending lsf-flip ${flipped ? "is-flipped" : ""}`}
                            onClick={() =>
                              setFlippedId((current) =>
                                current === item.pizzaId ? null : item.pizzaId
                              )
                            }
                          >
                            <div className="lsf-flip__inner">
                              <div className="lsf-flip__front">
                                <div className="lsf-card__image">
                                  {image ? (
                                    <img src={image} alt={item.name} />
                                  ) : (
                                    <div className="lsf-card__img is-placeholder">
                                      <span>Pizza</span>
                                    </div>
                                  )}
                                </div>

                                <div className="lsf-trendingRank">
                                  <span>#{rank}</span>
                                  <strong>Trending</strong>
                                </div>

                                <button
                                  type="button"
                                  className="lsf-card__addbtn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openProductModal(item);
                                  }}
                                  aria-label={`Comprar ${item.name}`}
                                >
                                  Comprar
                                </button>

                                <div className="lsf-card__overlay">
                                  <div className="lsf-card__ticker">
                                    <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                                      {item.name}
                                    </div>
                                  </div>
                                  <div className={`lsf-card__price ${tick ? "is-ticking" : ""}`}>
                                    EUR {basePrice.toFixed(2)}
                                  </div>
                                </div>
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

                          <div className="lsf-trendingPanel">
                            <div className="lsf-trendingMainKpi">
                              <span>{trendBasisLabel}</span>
                              <strong>{soldWeek}</strong>
                              <small>vendidas esta semana</small>
                            </div>

                            <div className="lsf-trendingKpiRow">
                              <span className={trendPercent >= 0 ? "is-up" : "is-down"}>
                                {formatTrendPercent(trendPercent)} vs semana ant.
                              </span>
                              <span>{soldAllTime} historicas</span>
                              <span>{trend.lastOrderedLabel || "Sin pedidos recientes"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                      const sizes = Object.keys(item.priceBySize || {}).filter(
                        (size) =>
                          item.priceBySize?.[size] !== "" &&
                          item.priceBySize?.[size] != null
                      );
                      const basePrice = priceForSize(item.priceBySize, sizes[0] || "M");
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
                              <span className="lsf-upcomingCountdown">
                                {formatLaunchCountdown(item.launchAt, now)}
                              </span>

                              <button
                                type="button"
                                className="lsf-card__addbtn lsf-card__addbtn--disabled"
                                onClick={(event) => event.stopPropagation()}
                                disabled
                                aria-label={`${item.name} aun no disponible`}
                              >
                                Soon
                              </button>

                              <div className="lsf-card__overlay">
                                <div className="lsf-card__ticker">
                                  <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                                    {item.name}
                                  </div>
                                </div>
                                <div className={`lsf-card__price ${tick ? "is-ticking" : ""}`}>
                                  EUR {basePrice.toFixed(2)}
                                </div>
                              </div>
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
                    const sizes = Object.keys(item.priceBySize || {}).filter(
                      (size) => item.priceBySize?.[size] !== "" && item.priceBySize?.[size] != null
                    );
                    const basePrice = priceForSize(item.priceBySize, sizes[0] || "M");
                    const { line, closer } = buildPizzaLine(item);

                    return (
                      <div
                        key={item.pizzaId}
                        className={`lsf-card lsf-flip ${flipped ? "is-flipped" : ""}`}
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

                            <button
                              type="button"
                              className="lsf-card__addbtn"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProductModal(item);
                              }}
                              aria-label={`Comprar ${item.name}`}
                            >
                              Comprar
                            </button>

                            <div className="lsf-card__overlay">
                              <div className="lsf-card__ticker">
                                <div className={`lsf-card__name ${tick ? "is-ticking" : ""}`}>
                                  {item.name}
                                </div>
                              </div>
                              <div className={`lsf-card__price ${tick ? "is-ticking" : ""}`}>
                                EUR {basePrice.toFixed(2)}
                              </div>
                            </div>
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
          <div className="sf-bottomActionGroup">
            <button
              type="button"
              className="sf-engineBottomBtn"
              onClick={() => {
                if (phoneHref) window.location.href = phoneHref;
              }}
              disabled={!phoneHref}
            >
              Llamar
            </button>

            {reservationEnabled && (
              <button
                type="button"
                className="sf-engineBottomBtn sf-engineBottomBtn--ghost"
                onClick={() => setReservationOpen(true)}
              >
                Reservas
              </button>
            )}
          </div>

          <label className="sf-couponDock">
            <span className="sf-couponDockIcon">%</span>
            <input
              type="text"
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
              placeholder="Tienes un cupon?"
            />
          </label>

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
                <span>Go Faster</span>
                <span>Get It Now!</span>
              </span>
            </span>
          </button>
        </div>
      </div>

      {productModalOpen && (
        <div className="sf-modalOverlay" onClick={() => setProductModalOpen(false)}>
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
                onClick={() => setProductModalOpen(false)}
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

                {renderAllergenNotice(selectedPurchaseAllergens)}

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
                    <button type="button" onClick={incProductQty}>+</button>
                  </div>
                </div>

                <div className="sf-productPickerRow sf-productPickerRow--stack">
                  <span>Size</span>
                  <div className="sf-sizeOptions">
                    {selectedProductSizes.map((size) => {
                      const active = productSelection.size === size;
                      const price = priceForSize(selectedProduct.priceBySize, size);

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
                    onClick={() => setProductModalOpen(false)}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    className="sf-primaryBtn"
                    disabled={!productModalReady}
                    onClick={addProductLine}
                  >
                    {productModalReady
                      ? `Add to cart - EUR ${selectedLineTotal.toFixed(2)}`
                      : "Selecciona size"}
                  </button>
                </div>
              </div>
            )}
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
                <span>Carrito</span>
                <h3>EUR {cartTotal.toFixed(2)}</h3>
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

            {cart.length === 0 ? (
              <div className="sf-cartEmpty">Carrito vacio.</div>
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
                            {line.boost?.positionsToJump || 0} salto
                            {Number(line.boost?.positionsToJump || 0) === 1 ? "" : "s"} de cola
                          </small>
                        )}
                        {line.extras?.length > 0 && (
                          <small>
                            + {line.extras.map((extra) =>
                              extra.side ? `${extra.name} (${extra.side})` : extra.name
                            ).join(", ")}
                          </small>
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
                    <strong>EUR {cartTotal.toFixed(2)}</strong>
                  </div>
                  <div className="sf-cartFootLine sf-cartFootLine--total">
                    <span>Total</span>
                    <strong>EUR {cartTotal.toFixed(2)}</strong>
                  </div>
                  <button
                    type="button"
                    className="sf-primaryBtn"
                    onClick={() => setCartOpen(false)}
                  >
                    Confirmar carrito
                  </button>
                </div>
              </>
            )}
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
                    <div key={side} className="sf-halfSlot">
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
                          priceForSize(halfA.priceBySize, size),
                          priceForSize(halfB.priceBySize, size)
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
                    <span>Total mitad/mitad</span>
                    <strong>EUR {halfGrandTotal.toFixed(2)}</strong>
                  </div>
                  <button
                    type="button"
                    className="sf-secondaryBtn"
                    onClick={() => setHalfModalOpen(false)}
                  >
                    Continue
                  </button>
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
        <div className="sf-modalOverlay" onClick={() => setCustomModalOpen(false)}>
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
              <div className="sf-customBuilder">
                <div className="sf-customHero">
                  {customCategoryOptions.length === 0 ? (
                    <div className="sf-mutedLine">
                      No hay categorias personalizables en esta tienda.
                    </div>
                  ) : (
                    <div className="sf-customCategoryRail">
                      <button
                        type="button"
                        className="sf-customCategoryNav"
                        onClick={() => scrollCustomCategoryCarousel(-1)}
                        aria-label="Ver categorias anteriores"
                      >
                        {"<"}
                      </button>
                      <div
                        ref={customCategoryCarouselRef}
                        className="sf-customCategoryCarousel"
                        aria-label="Categorias personalizables"
                      >
                      {customCategoryOptions.map((category) => {
                        const active = customCategoryKey === category.key;
                        const fromPrice = priceForSize(
                          category.priceBySize,
                          category.selectSize[0]
                        );

                        return (
                          <button
                            key={category.key}
                            type="button"
                            className={`sf-customCategorySlide ${active ? "is-active" : ""}`}
                            onClick={() => {
                              const sizes = getAvailableSizes(category);
                              setCustomCategoryKey(category.key);
                              setCustomSize(sizes.length === 1 ? sizes[0] : "");
                              setCustomIngredients({});
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
                      <button
                        type="button"
                        className="sf-customCategoryNav"
                        onClick={() => scrollCustomCategoryCarousel(1)}
                        aria-label="Ver mas categorias"
                      >
                        {">"}
                      </button>
                    </div>
                  )}
                </div>

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
                                  setCustomOpenSection(
                                    customOrderedCategories[0] || "BASE"
                                  );
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

                            return (
                              <div key={ingredient.id} className="sf-customIngredient">
                                <div className="sf-customIngredientHead">
                                  <strong>{ingredient.name}</strong>
                                  <span>
                                    {customUsesLoading
                                      ? "..."
                                      : `EUR ${getCustomIngredientUnitPrice(ingredient).toFixed(2)}`}
                                  </span>
                                </div>

                                <div className="sf-customPlacement">
                                  {["FULL", "LEFT", "RIGHT"].map((placement) => (
                                    <button
                                      key={placement}
                                      type="button"
                                      className={`sf-sizeChip ${
                                        selected?.placement === placement ? "is-active" : ""
                                      }`}
                                      onClick={() =>
                                        updateCustomIngredient(ingredient, {
                                          placement,
                                          quantity: selected?.quantity || "SIMPLE",
                                        })
                                      }
                                    >
                                      <span>{placement}</span>
                                    </button>
                                  ))}
                                </div>

                                {selected?.placement && (
                                  <div className="sf-customIngredientExpanded">
                                    <div className="sf-customToggle">
                                      {["SIMPLE", "DOUBLE"].map((quantity) => (
                                        <button
                                          key={quantity}
                                          type="button"
                                          className={`sf-sizeChip ${
                                            selected.quantity === quantity ? "is-active" : ""
                                          }`}
                                          onClick={() => {
                                            updateCustomIngredient(ingredient, { quantity });
                                            setCustomOpenSection(
                                              getNextCustomSection(categoryName)
                                            );
                                          }}
                                        >
                                          <span>{quantity}</span>
                                        </button>
                                      ))}
                                    </div>
                                    <strong>
                                      EUR {getCustomIngredientPrice(selected).toFixed(2)}
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
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}

                <div className="sf-productPickerNotice">
                  {customMissingSteps.length > 0
                    ? `Para avanzar necesitas ${customMissingSteps.join(", ")}.`
                    : "Puedes anadirlo al carrito o seguir personalizando."}
                </div>

                {renderAllergenNotice(customSelectedAllergens)}

                <div className="sf-productPickerActions sf-builderStickyActions">
                  <div className="sf-builderTotal">
                    <span>Total armado</span>
                    <strong>EUR {customGrandTotal.toFixed(2)}</strong>
                  </div>
                  <button
                    type="button"
                    className="sf-secondaryBtn"
                    onClick={() => setCustomModalOpen(false)}
                  >
                    Continue
                  </button>
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
                    setRepeatMessage("");
                  }}
                  placeholder="600000000"
                  inputMode="numeric"
                  maxLength={9}
                />
              </label>
              <button type="submit" className="sf-primaryBtn" disabled={repeatLoading}>
                {repeatLoading ? "Buscando..." : "Buscar ultimo pedido"}
              </button>
            </form>

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
          <div className="sf-modalCard" onClick={(event) => event.stopPropagation()}>
            <h3>Programar pedido</h3>
            <p>
              Aqui conectaremos el reloj, fecha y horario para programar el pedido
              desde movil o desktop sin salir del motor.
            </p>
            <button
              type="button"
              className="sf-secondaryBtn"
              onClick={() => setScheduleOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {reservationOpen && (
        <div className="sf-modalOverlay" onClick={() => setReservationOpen(false)}>
          <div className="sf-modalCard" onClick={(event) => event.stopPropagation()}>
            <h3>Reservas</h3>
            <p>
              Este modal servira para las reservas. Luego decidimos si se queda aqui
              o si vive en otra pieza del motor.
            </p>
            <button
              type="button"
              className="sf-secondaryBtn"
              onClick={() => setReservationOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {bootsOpen && (
        <div className="sf-modalOverlay" onClick={() => setBootsOpen(false)}>
          <div className="sf-modalCard sf-bootsModal" onClick={(event) => event.stopPropagation()}>
            <div className="sf-bootsPulse" aria-hidden="true">!!</div>
            <h3>Boost de emergencia</h3>
            <p>
              Ahora estas en la posicion #{bootsPositionLabel}. Elige hasta
              donde quieres avanzar en la cola.
            </p>

            <div className="sf-bootsCurrent">
              <span>Tu posicion actual</span>
              <strong>#{bootsPositionLabel}</strong>
              <small>
                {bootsQueueLoading
                  ? "Actualizando cola..."
                  : bootsCurrentPosition == null
                  ? "No pudimos leer la cola de esta tienda."
                  : `Hay ${bootsCurrentPosition} personas delante de ti.`}
              </small>
            </div>

            <div className="sf-bootsOptionGroup" role="radiogroup" aria-label="Elige tu nueva posicion">
              <span>Elige tu nueva posicion</span>
              {bootsOptions.length === 0 ? (
                <div className="sf-bootsEmpty">
                  No hay cola suficiente para activar Boost ahora mismo.
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
                      {option.jumps} salto{option.jumps === 1 ? "" : "s"} de cola
                    </span>
                    <em>{formatMoney(option.amount, boostCurrency)}</em>
                  </button>
                );
              })}
            </div>

            {selectedBootsOption && (
              <div className="sf-bootsQuote">
                <div>
                  <span>Ahora</span>
                  <strong>#{bootsPositionLabel}</strong>
                </div>
                <div>
                  <span>Destino</span>
                  <strong>#{selectedBootsOption.targetPosition}</strong>
                </div>
                <div>
                  <span>Salto</span>
                  <strong>{selectedBootsOption.jumps}</strong>
                </div>
                <div>
                  <span>Precio</span>
                  <strong>{formatMoney(selectedBootsOption.amount, boostCurrency)}</strong>
                </div>
              </div>
            )}

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
    </div>
  );
}
