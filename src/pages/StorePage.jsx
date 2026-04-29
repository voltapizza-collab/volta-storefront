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

function QuickCallIcon() {
  return (
    <span className="sf-voltaDialIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 11.2 18.8a19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.9.31 1.77.58 2.6a2 2 0 0 1-.45 2.1L8 9.9a16 16 0 0 0 6.1 6.1l1.49-1.24a2 2 0 0 1 2.1-.45c.83.27 1.7.46 2.6.58A2 2 0 0 1 22 16.92Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 3a8 8 0 0 1 8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 7a4 4 0 0 1 4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function StorePage() {
  const { partnerSlug, storeSlug } = useParams();

  const [menu, setMenu] = useState([]);
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!partnerSlug || !storeSlug) return;

    const loadStorefront = async () => {
      try {
        const [menuData, partnerData] = await Promise.all([
          api.get(`/stores/${partnerSlug}/${storeSlug}/menu`),
          api.get(`/partners/${partnerSlug}`),
        ]);

        const nextMenu = Array.isArray(menuData?.menu) ? menuData.menu : [];
        const nextUpcoming = Array.isArray(menuData?.upcoming)
          ? menuData.upcoming
          : [];
        const nextPromos = Array.isArray(menuData?.promos) ? menuData.promos : [];

        setMenu(nextMenu);
        setUpcoming(nextUpcoming);
        setPromos(nextPromos);
        setStore(menuData?.store || null);
        setPartner(partnerData || null);

        const firstCategory =
          nextMenu.find((item) => item.category)?.category ||
          (nextUpcoming.length ? UPCOMING_TAB : TRENDING_TAB);
        setActiveTab(firstCategory || TRENDING_TAB);
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

  const visibleMenu = useMemo(() => {
    if (activeTab === PROMOS_TAB || activeTab === UPCOMING_TAB) return [];

    if (activeTab === TRENDING_TAB) {
      return [...baseFilteredMenu].slice(0, 12);
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
  const activeProductsCount = visibleMenu.length;
  const incentiveMessage =
    activeTab === PROMOS_TAB
      ? `${filteredPromos.length} promo${filteredPromos.length === 1 ? "" : "s"} activa${filteredPromos.length === 1 ? "" : "s"}`
      : activeTab === UPCOMING_TAB
      ? `${filteredUpcoming.length} lanzamiento${filteredUpcoming.length === 1 ? "" : "s"} en camino`
      : activeProductsCount > 0
      ? `Tu siguiente incentivo puede activarse con ${Math.min(
          activeProductsCount,
          3
        )} elecciones mas en ${activeTabLabel.toLowerCase()}`
      : "Activa una categoria para descubrir ofertas y combinaciones";

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
        <section className="sf-engineControlBar">
          <div className="sf-engineTop">
            <div className="sf-engineBrand">
              <div className="sf-engineBrandHead">
                <div className="sf-engineLogoBlock">
                  <h1 className="sf-engineBrandName">
                    <span className="sf-engineBrandPartner">
                      {partner?.name || store.storeName}
                    </span>
                    {store?.storeName && (
                      <span className="sf-engineBrandStore">{store.storeName}</span>
                    )}
                  </h1>
                </div>

                <div className="sf-engineQuickRow" aria-label="Acciones rapidas">
                  {phoneHref ? (
                    <button
                      type="button"
                      className="sf-engineQuickAction sf-engineQuickAction--call"
                      onClick={() => {
                        window.location.href = phoneHref;
                      }}
                      aria-label={`Llamar a ${storePhone}`}
                      title={storePhone}
                    >
                      <span className="sf-engineQuickActionFace">
                        <QuickCallIcon />
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sf-engineQuickAction sf-engineQuickAction--call sf-engineQuickAction--disabled"
                      aria-label="Llamada directa no disponible"
                      disabled
                    >
                      <span className="sf-engineQuickActionFace">
                        <QuickCallIcon />
                      </span>
                    </button>
                  )}

                  <button type="button" className="sf-engineQuickAction sf-engineQuickAction--cart" aria-label="Carrito">
                    <span className="sf-engineQuickActionFace">
                      <span className="sf-engineQuickCartIcon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path
                            d="M3 4h2l2.2 9.2A2 2 0 0 0 9.15 15H18a2 2 0 0 0 1.94-1.53L21 8H7.1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="10" cy="19" r="1.6" fill="currentColor" />
                          <circle cx="17" cy="19" r="1.6" fill="currentColor" />
                        </svg>
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="sf-engineBrandInfo">
                <div className="sf-engineUtilityRow">
                  <button type="button" className={`sf-offersBtn sf-engineUtilityOffer ${offerVariant.className}`}>
                    <span className="sf-offersBtnLabel">{offerVariant.label}</span>
                  </button>
                  {utilityPills.map((pill) => (
                    <span
                      key={pill.key}
                      className={`sf-engineUtilityPill sf-engineUtilityPill--${pill.tone.split(" ").join(" sf-engineUtilityPill--")}`}
                    >
                      <span className="sf-engineUtilityPillTicker">
                        <span className="sf-engineUtilityPillTrack">
                          <span className="sf-engineUtilityPillLine">{pill.primary}</span>
                          <span className="sf-engineUtilityPillLine">
                            {pill.key === "city" ? (
                              <span className="sf-engineUtilityPillInline">
                                <CountryFlag countryCode={partner?.country} />
                                <span>{pill.secondary}</span>
                              </span>
                            ) : (
                              pill.secondary
                            )}
                          </span>
                        </span>
                      </span>
                    </span>
                  ))}
                </div>

                <div className="sf-engineSearchRow">
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
              </div>
            </div>
          </div>

          <div className="sf-engineActionRow">
            <button type="button" className="sf-enginePillBtn">
              Mitad / Mitad
            </button>
            <button type="button" className="sf-enginePillBtn">
              Arma tu Pizza
            </button>
          </div>

          <div className="sf-incentiveBanner">
            <div className="sf-incentiveCopy">
              <span className="sf-incentiveEyebrow">Proximo incentivo en camino</span>
              <strong>{incentiveMessage}</strong>
            </div>
            <span className="sf-incentiveTimer">
              {activeTab === PROMOS_TAB
                ? "Promos destacadas"
                : activeTab === UPCOMING_TAB
                ? "Coming soon"
                : "Disponible hoy"}
            </span>
          </div>
        </section>

        <section className="sf-engineCategoryRail">
          <div className="sf-engineRailHeader">
            <div>
              <span className="sf-kicker">Explorar</span>
              <h2 className="sf-engineRailTitle">{activeTabLabel}</h2>
            </div>
            <span className="sf-engineRailHint">Desliza para descubrir mas</span>
          </div>

          <div className="sf-engineCategoryTrack" role="tablist" aria-label="Categorias del menu">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sf-engineTab ${activeTab === tab.id ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <section className="sf-engineCard">
          <div className="sf-engineGridStage">
            {activeTab === PROMOS_TAB ? (
              filteredPromos.length === 0 ? (
                <div className="sf-engineEmptyState">
                  <strong>Promos</strong>
                  <p>No hay promos visibles para esta busqueda.</p>
                </div>
              ) : (
                <div className="sf-engineGrid sf-engineGrid--promos">
                  {filteredPromos.map((promo) => (
                    <article key={promo.id} className="sf-engineMenuCard sf-engineMenuCard--promo">
                      <div
                        className={`sf-menuCardVisual sf-menuCardVisual--promo ${
                          promo.image ? "has-image" : ""
                        }`}
                        style={
                          promo.image
                            ? { "--sf-promo-image": `url(${promo.image})` }
                            : undefined
                        }
                      >
                        <span className="sf-menuCardVisualBadge">Promo</span>
                        <div className="sf-menuCardVisualTitle">{promo.title}</div>
                      </div>

                      <div className="sf-menuCardHead">
                        <div>
                          <h3 className="sf-menuCardTitle">{promo.title}</h3>
                          <div className="sf-menuCardMeta">
                            {[formatPromoDate(promo.activeFrom), formatPromoDate(promo.expiresAt)]
                              .filter(Boolean)
                              .join(" - ") || "Promo activa"}
                          </div>
                        </div>
                        <span className="sf-promoPrice">
                          EUR{Number(promo.totalPrice || 0).toFixed(2)}
                        </span>
                      </div>

                      {promo.description && (
                        <p className="sf-promoDescription">{promo.description}</p>
                      )}

                      <div>
                        <div className="sf-sectionLabel">Contenido</div>
                        <div className="sf-promoContentList">
                          {(promo.items || []).map((item) => (
                            <span key={`${promo.id}-${item.pizzaId}`}>
                              {item.quantity || 1}x {item.name}
                              {item.size ? ` ${item.size}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="sf-menuCardFooter">
                        <span className="sf-menuCardSignal">Oferta limitada</span>
                        <button type="button" className="sf-menuCardCta">
                          Elegir promo
                        </button>
                      </div>
                    </article>
                  ))}
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
              <div className="sf-engineGrid">
                {visibleMenu.map((item) => (
                  <article key={item.pizzaId} className="sf-engineMenuCard">
                    <div className="sf-menuCardVisual">
                      <span className="sf-menuCardVisualBadge">
                        {item.category || "Menu"}
                      </span>
                      <div className="sf-menuCardVisualTitle">{item.name}</div>
                    </div>

                    <div className="sf-menuCardHead">
                      <div>
                        <h3 className="sf-menuCardTitle">{item.name}</h3>
                        <div className="sf-menuCardMeta">
                          {item.category || "Sin categoria"}
                        </div>
                      </div>
                      <span className="sf-badge">ACTIVE</span>
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
                      <span className="sf-menuCardSignal">Lista para vender</span>
                      <button type="button" className="sf-menuCardCta">
                        Elegir
                      </button>
                    </div>
                  </article>
                ))}
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
              onClick={() => setScheduleOpen(true)}
            >
              Programar
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

          <div className="sf-footerStatus">
            <span className="sf-footerStatusLabel">Motor activo</span>
            <strong>{activeTabLabel}</strong>
          </div>
        </div>
      </div>

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
    </div>
  );
}
