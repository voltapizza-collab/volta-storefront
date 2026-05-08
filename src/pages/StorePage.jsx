import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
  LACTOSE: "lactosa",
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

const getCartLineQty = (line) => {
  const qty = Number(line?.qty ?? line?.quantity ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const normalizeCartLine = (line, index = 0) => {
  const qty = getCartLineQty(line);
  const price = num(line?.price ?? line?.unitPrice ?? line?.amount);
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
    image: line?.image || "",
    source: line?.source || "",
  };
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

  const [menu, setMenu] = useState([]);
  const [trending, setTrending] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [promos, setPromos] = useState([]);
  const [store, setStore] = useState(null);
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [activeTab, setActiveTab] = useState(TRENDING_TAB);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatPhone, setRepeatPhone] = useState("");
  const [repeatDraft, setRepeatDraft] = useState(null);
  const [repeatMessage, setRepeatMessage] = useState("");
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [cartDraft, setCartDraft] = useState(null);
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
  const [bootsOpen, setBootsOpen] = useState(false);
  const [bootsCode, setBootsCode] = useState("");
  const [bootsTargetPosition, setBootsTargetPosition] = useState("1");
  const [bootsQuote, setBootsQuote] = useState(null);
  const [bootsMessage, setBootsMessage] = useState("");
  const [bootsLoading, setBootsLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [flippedId, setFlippedId] = useState(null);
  const [tick, setTick] = useState(false);

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

        setActiveTab(TRENDING_TAB);
      } catch (err) {
        console.error(err);
        setError("Error loading menu");
      }
    };

    loadStorefront();
  }, [partnerSlug, storeSlug]);

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
      setTick(true);
      window.setTimeout(() => setTick(false), 600);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const cartDraftStorageKey = useMemo(
    () => `volta-repeat-cart-draft:${partnerSlug || "partner"}:${storeSlug || "store"}`,
    [partnerSlug, storeSlug]
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartDraftStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      setCartDraft(parsed);
      if (Array.isArray(parsed?.items) && parsed.items.length) {
        setCart((current) =>
          current.length ? current : parsed.items.map((item, index) => normalizeCartLine(item, index))
        );
      }
    } catch {
      setCartDraft(null);
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
        uniques.set(key, item.category);
      }
    });

    return [...uniques.values()];
  }, [menu]);

  const tabs = useMemo(
    () => [
      { id: TRENDING_TAB, label: "Trending" },
      { id: PROMOS_TAB, label: "Promos" },
      ...(upcoming.length ? [{ id: UPCOMING_TAB, label: "Proximos" }] : []),
      ...categories.map((category) => ({ id: category, label: category })),
    ],
    [categories, upcoming.length]
  );

  const baseFilteredMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterMenuItems(menu, query);
  }, [menu, search]);

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

    return baseFilteredMenu.filter((item) => item.category === activeTab);
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
  const sortedExtras = useMemo(
    () => [...extrasAvail].sort((left, right) => num(right.price) - num(left.price)),
    [extrasAvail]
  );
  const visibleExtras = showAllExtras ? sortedExtras : sortedExtras.slice(0, 3);

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
      subtotal: selectedLineTotal,
      image: selectedProduct.image || "",
    };

    setCart((current) => [...current, line]);
    setCartDraft(null);
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

  const activeProductsCount =
    activeTab === TRENDING_TAB ? filteredTrending.length : visibleMenu.length;
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + getCartLineQty(item), 0),
    [cart]
  );
  const cartTotal = cart.reduce((sum, item) => sum + num(item.subtotal), 0);
  const bootsPreviewPosition = 11;
  const quoteCurrency = bootsQuote?.currency || partner?.currency || "EUR";
  const incentiveMessage =
    activeTab === PROMOS_TAB
      ? `${filteredPromos.length} promo${filteredPromos.length === 1 ? "" : "s"} activa${filteredPromos.length === 1 ? "" : "s"}`
      : activeTab === UPCOMING_TAB
      ? `${filteredUpcoming.length} lanzamiento${filteredUpcoming.length === 1 ? "" : "s"} en camino`
      : activeTab === TRENDING_TAB
      ? filteredTrending.length
        ? `Top ${filteredTrending.length} pizzas con mas senales de venta en esta tienda`
        : "Trending se activa cuando la tienda acumule ventas"
      : activeProductsCount > 0
      ? `Tu siguiente incentivo puede activarse con ${Math.min(
          activeProductsCount,
          3
        )} elecciones mas en ${activeTabLabel.toLowerCase()}`
      : "Activa una categoria para descubrir ofertas y combinaciones";

  const loadRepeatOrder = async (event) => {
    event?.preventDefault();

    const phone = repeatPhone.trim();
    if (!phone) {
      setRepeatMessage("Escribe el telefono usado en el pedido anterior.");
      return;
    }

    try {
      setRepeatLoading(true);
      setRepeatMessage("");
      const params = new URLSearchParams({
        partnerId: String(partner?.id || ""),
        storeId: String(store?.id || ""),
        phone,
      });
      const data = await api.get(`/api/myorders/repeat/latest?${params.toString()}`);
      const draft = data?.cartDraft || null;

      setRepeatDraft(draft);
      setCartDraft(draft);
      setCart(
        Array.isArray(draft?.items)
          ? draft.items.map((item, index) => normalizeCartLine(item, index))
          : []
      );

      try {
        if (draft) {
          window.localStorage.setItem(cartDraftStorageKey, JSON.stringify(draft));
        }
      } catch {
        // The in-memory draft is enough if storage is unavailable.
      }

      setRepeatMessage(
        draft?.sourceOrderCode
          ? `Pedido ${draft.sourceOrderCode} listo para el carrito.`
          : "Pedido anterior listo para el carrito."
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

  const loadBootsQuote = async (event) => {
    event?.preventDefault();

    const orderCode = bootsCode.trim().toUpperCase();
    if (!orderCode) {
      setBootsMessage("Escribe el codigo del pedido para calcular el Boots.");
      return;
    }

    try {
      setBootsLoading(true);
      setBootsMessage("");
      const params = new URLSearchParams({
        orderCode,
        targetPosition: bootsTargetPosition,
      });
      const data = await api.get(`/api/myorders/boosts/quote?${params.toString()}`);
      setBootsQuote(data?.quote || null);
    } catch (err) {
      console.error(err);
      setBootsQuote(null);
      setBootsMessage(getApiErrorMessage(err, "No se pudo calcular el Boots."));
    } finally {
      setBootsLoading(false);
    }
  };

  const activateBoots = async () => {
    const orderCode = bootsCode.trim().toUpperCase();
    if (!orderCode) return;

    try {
      setBootsLoading(true);
      setBootsMessage("");
      const data = await api.post("/api/myorders/boosts/activate", {
        orderCode,
        targetPosition: Number(bootsTargetPosition),
        paymentMode: "manual_mvp",
      });
      setBootsQuote(data?.quote || null);
      setBootsMessage("Boots activado. El pedido sube en la cola pendiente.");
    } catch (err) {
      console.error(err);
      setBootsMessage(getApiErrorMessage(err, "No se pudo activar el Boots."));
    } finally {
      setBootsLoading(false);
    }
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
            <button type="button" className={`sf-offersBtn sf-lsfOfferBtn ${offerVariant.className}`}>
              <span className="sf-offersBtnLabel">{offerVariant.label}</span>
            </button>

            <button type="button" className="lsf-buildmode">
              Mitad / Mitad
            </button>
            <button type="button" className="lsf-buildmode">
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

          <div className="sf-incentiveBanner sf-incentiveBanner--lsf">
            <div className="sf-incentiveCopy">
              <span className="sf-incentiveEyebrow">Proximo incentivo en camino</span>
              <strong>{incentiveMessage}</strong>
            </div>
            <span className="sf-incentiveTimer">
              {activeTab === PROMOS_TAB
                ? "Promos destacadas"
                : activeTab === UPCOMING_TAB
                ? "Coming soon"
                : activeTab === TRENDING_TAB
                ? "Top 3"
                : "Disponible hoy"}
            </span>
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
            {activeTab === PROMOS_TAB ? (
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
                <div className="sf-engineGrid sf-engineGrid--upcoming">
                  {filteredUpcoming.map((item) => (
                    <article key={item.pizzaId} className="sf-engineMenuCard sf-engineMenuCard--upcoming">
                      <div
                        className={`sf-menuCardVisual sf-menuCardVisual--upcoming ${
                          item.image ? "has-image" : ""
                        }`}
                        style={
                          item.image
                            ? { "--sf-launch-image": `url(${item.image})` }
                            : undefined
                        }
                      >
                        <span className="sf-menuCardVisualBadge">Coming soon</span>
                        <div className="sf-comingSoonWordmark">COMING SOON</div>
                        <div className="sf-launchCountdown">
                          <span>Sale en</span>
                          <strong>{formatLaunchCountdown(item.launchAt, now)}</strong>
                        </div>
                      </div>

                      <div className="sf-menuCardHead">
                        <div>
                          <h3 className="sf-menuCardTitle">{item.name}</h3>
                          <div className="sf-menuCardMeta">
                            {item.category || "Sin categoria"} - {formatLaunchDate(item.launchAt)}
                          </div>
                        </div>
                        <span className="sf-badge sf-badge--upcoming">Soon</span>
                      </div>

                      <div>
                        <div className="sf-sectionLabel">Tamanos y precios</div>
                        <div className="sf-priceRow">
                          {Object.entries(item.priceBySize || {})
                            .filter(([_, value]) => value !== "" && value != null)
                            .map(([size, value]) => (
                              <span key={size} className="sf-priceTag">
                                {size}: EUR{value}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div>
                        <div className="sf-sectionLabel">Ingredientes activos</div>
                        <div className="sf-chipRow">
                          {(item.ingredients || []).map((ingredient) => (
                            <span key={ingredient.id} className="sf-chip">
                              {ingredient.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="sf-menuCardFooter">
                        <span className="sf-menuCardSignal">Lanzamiento programado</span>
                        <button type="button" className="sf-menuCardCta sf-menuCardCta--disabled" disabled>
                          Pronto
                        </button>
                      </div>
                    </article>
                  ))}
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
          >
            <span className="sf-bootsCounter" aria-label={`Posicion ${bootsPreviewPosition} en espera`}>
              <span>POS</span>
              <strong>{bootsPreviewPosition}</strong>
            </span>
            <span className="sf-bootsTicker" aria-label="Boots para subir posicion en la cola">
              <span className="sf-bootsTickerTrack">
                <span>Boost</span>
                <span>Speedy</span>
                <span>Turbo</span>
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

                <div className="sf-productPickerNotice">
                  {selectedProductAllergens.length
                    ? `Alergenos: ${selectedProductAllergens.join(", ")}.`
                    : "Sin alergenos declarados en los ingredientes de esta pizza."}
                </div>

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
                        <strong>{line.name}</strong>
                        <span>
                          {line.size} x {line.qty}
                        </span>
                        {line.extras?.length > 0 && (
                          <small>
                            + {line.extras.map((extra) => extra.name).join(", ")}
                          </small>
                        )}
                      </div>
                      <div className="sf-cartRowSide">
                        <strong>EUR {num(line.subtotal).toFixed(2)}</strong>
                        <button
                          type="button"
                          className="sf-modalCloseBtn sf-cartRemoveBtn"
                          onClick={() =>
                            setCart((current) =>
                              current.filter((_, lineIndex) => lineIndex !== index)
                            )
                          }
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

      {repeatOpen && (
        <div className="sf-modalOverlay" onClick={() => setRepeatOpen(false)}>
          <div className="sf-modalCard sf-repeatModal" onClick={(event) => event.stopPropagation()}>
            <h3>Repetir pedido</h3>
            <p>
              Buscamos el ultimo pedido con tu telefono y lo dejamos preparado
              como borrador para el carrito.
            </p>

            <form className="sf-repeatForm" onSubmit={loadRepeatOrder}>
              <label>
                <span>Telefono</span>
                <input
                  type="tel"
                  value={repeatPhone}
                  onChange={(event) => {
                    setRepeatPhone(event.target.value);
                    setRepeatMessage("");
                  }}
                  placeholder="+34 600 000 000"
                />
              </label>
              <button type="submit" className="sf-primaryBtn" disabled={repeatLoading}>
                {repeatLoading ? "Buscando..." : "Repetir"}
              </button>
            </form>

            {repeatDraft && (
              <div className="sf-repeatSummary">
                <span>{repeatDraft.sourceOrderCode}</span>
                <strong>
                  {cartCount} producto{cartCount === 1 ? "" : "s"} - {formatMoney(cartTotal, repeatDraft.currency)}
                </strong>
              </div>
            )}

            {repeatMessage && <div className="sf-bootsMessage">{repeatMessage}</div>}

            <div className="sf-bootsActions">
              <button type="button" className="sf-secondaryBtn" onClick={() => setRepeatOpen(false)}>
                Cerrar
              </button>
              {cartDraft && (
                <button
                  type="button"
                  className="sf-secondaryBtn"
                  onClick={() => {
                    setCartDraft(null);
                    setCart([]);
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
            <h3>Boots de emergencia</h3>
            <p>
              Activa prioridad sobre un pedido pendiente y empujalo hacia los
              primeros puestos de la cola de esta tienda.
            </p>

            <form className="sf-bootsForm" onSubmit={loadBootsQuote}>
              <label>
                <span>Codigo de pedido</span>
                <input
                  type="text"
                  value={bootsCode}
                  onChange={(event) => {
                    setBootsCode(event.target.value.toUpperCase());
                    setBootsQuote(null);
                  }}
                  placeholder="VOLTA-1234"
                />
              </label>

              <label>
                <span>Posicion destino</span>
                <select
                  value={bootsTargetPosition}
                  onChange={(event) => {
                    setBootsTargetPosition(event.target.value);
                    setBootsQuote(null);
                  }}
                >
                  <option value="1">Numero 1</option>
                  <option value="2">Numero 2</option>
                  <option value="3">Numero 3</option>
                </select>
              </label>

              <button type="submit" className="sf-primaryBtn" disabled={bootsLoading}>
                {bootsLoading ? "Calculando..." : "Calcular Boots"}
              </button>
            </form>

            {bootsQuote && (
              <div className="sf-bootsQuote">
                <div>
                  <span>Ahora</span>
                  <strong>#{bootsQuote.currentPosition}</strong>
                </div>
                <div>
                  <span>Destino</span>
                  <strong>#{bootsQuote.targetPosition}</strong>
                </div>
                <div>
                  <span>Salto</span>
                  <strong>{bootsQuote.positionsToJump}</strong>
                </div>
                <div>
                  <span>Precio</span>
                  <strong>{formatMoney(bootsQuote.amount, quoteCurrency)}</strong>
                </div>
              </div>
            )}

            {bootsMessage && <div className="sf-bootsMessage">{bootsMessage}</div>}

            <div className="sf-bootsActions">
              <button type="button" className="sf-secondaryBtn" onClick={() => setBootsOpen(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="sf-primaryBtn sf-bootsActivate"
                onClick={activateBoots}
                disabled={!bootsQuote || bootsQuote.positionsToJump <= 0 || bootsLoading}
              >
                {bootsQuote
                  ? `Activar ${formatMoney(bootsQuote.amount, quoteCurrency)}`
                  : "Activar Boots"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
