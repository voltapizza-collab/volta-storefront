import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/Storefront.css";
import {
  BRANDING_DEFAULTS,
  buildBrandThemeVars,
  getOfferButtonVariant,
} from "../constants/branding";

const TRENDING_TAB = "__TRENDING__";
const PROMOS_TAB = "__PROMOS__";

export default function StorePage() {
  const { partnerSlug, storeSlug } = useParams();

  const [menu, setMenu] = useState([]);
  const [store, setStore] = useState(null);
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [activeTab, setActiveTab] = useState(TRENDING_TAB);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);

  useEffect(() => {
    if (!partnerSlug || !storeSlug) return;

    const loadStorefront = async () => {
      try {
        const [menuData, partnerData] = await Promise.all([
          api.get(`/stores/${partnerSlug}/${storeSlug}/menu`),
          api.get(`/partners/${partnerSlug}`),
        ]);

        const nextMenu = Array.isArray(menuData?.menu) ? menuData.menu : [];

        setMenu(nextMenu);
        setStore(menuData?.store || null);
        setPartner(partnerData || null);

        const firstCategory =
          nextMenu.find((item) => item.category)?.category || TRENDING_TAB;
        setActiveTab(firstCategory || TRENDING_TAB);
      } catch (err) {
        console.error(err);
        setError("Error loading menu");
      }
    };

    loadStorefront();
  }, [partnerSlug, storeSlug]);

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
      ...categories.map((category) => ({ id: category, label: category })),
    ],
    [categories]
  );

  const baseFilteredMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return menu;

    return menu.filter((item) => {
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
  }, [menu, search]);

  const visibleMenu = useMemo(() => {
    if (activeTab === PROMOS_TAB) return [];

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
  const activeProductsCount = visibleMenu.length;
  const incentiveMessage =
    activeTab === PROMOS_TAB
      ? "Promos activas para empujar el ticket medio"
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
              <div className="sf-engineLogoBlock">
                <div className="sf-engineBrandMeta">
                  <h1 className="sf-engineBrandName">
                    <span className="sf-engineBrandPartner">
                      {partner?.name || store.storeName}
                    </span>
                    {store?.storeName && (
                      <span className="sf-engineBrandStore">{store.storeName}</span>
                    )}
                  </h1>

                  <div className="sf-engineUtilityRow">
                    <span className="sf-engineUtilityPill">
                      {store?.city || "Pizza Engine"}
                    </span>
                    <span className="sf-engineUtilityPill">
                      {deliveryLabel}
                    </span>
                    {reservationEnabled && (
                      <span className="sf-engineUtilityPill sf-engineUtilityPill--reservations">
                        Reservas activas
                      </span>
                    )}
                    <span className="sf-engineUtilityPill">
                      {reservationEnabled ? "Servicio en sala" : "Pedidos rapidos"}
                    </span>
                    <span className="sf-engineUtilityPill">
                      {Math.max(tabs.length - 2, 0)} categorias
                    </span>
                  </div>
                </div>
              </div>

              <div className="sf-engineAside">
                <div className="sf-engineQuickRow" aria-label="Acciones rapidas">
                  <div
                    className="sf-engineQuickCard sf-engineQuickCard--logo"
                    aria-label="Logo del partner"
                  >
                    <div className="sf-engineQuickLogo">
                      {partner?.brandLogoUrl ? (
                        <img src={partner.brandLogoUrl} alt={partner?.name || "Partner"} />
                      ) : (
                        <span>{(partner?.name || store.storeName || "SF").slice(0, 2)}</span>
                      )}
                    </div>
                  </div>

                  {phoneHref ? (
                    <a
                      className="sf-engineQuickCard sf-engineQuickCard--call"
                      href={phoneHref}
                      aria-label={`Llamar a ${storePhone}`}
                      title={storePhone}
                    >
                      <span className="sf-engineQuickCallSpine" aria-hidden="true" />
                      <span className="sf-engineQuickCallPhone" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path
                            d="M6.7 3.8h3l1.3 3.5-1.8 1.6c.9 1.8 2.4 3.3 4.2 4.2l1.6-1.8 3.5 1.3v3c0 .6-.4 1-1 1C10 16.6 7.4 14 6.7 6.8c0-.6.4-1 1-1Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M15.4 6.8c1.2.2 2.4 1 3.2 2.1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                          <path
                            d="M15.1 4.1c2.2.3 4.2 1.8 5.4 3.8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="sf-engineQuickCallPlate">
                        <span className="sf-engineQuickCallLabel">Llamar</span>
                      </span>
                    </a>
                  ) : (
                    <div
                      className="sf-engineQuickCard sf-engineQuickCard--call sf-engineQuickCard--disabled"
                      aria-label="Llamada directa no disponible"
                    >
                      <span className="sf-engineQuickCallSpine" aria-hidden="true" />
                      <span className="sf-engineQuickCallPhone" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path
                            d="M6.7 3.8h3l1.3 3.5-1.8 1.6c.9 1.8 2.4 3.3 4.2 4.2l1.6-1.8 3.5 1.3v3c0 .6-.4 1-1 1C10 16.6 7.4 14 6.7 6.8c0-.6.4-1 1-1Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M15.4 6.8c1.2.2 2.4 1 3.2 2.1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                          <path
                            d="M15.1 4.1c2.2.3 4.2 1.8 5.4 3.8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="sf-engineQuickCallPlate">
                        <span className="sf-engineQuickCallLabel">Llamar</span>
                      </span>
                    </div>
                  )}

                  <button type="button" className="sf-engineQuickCard sf-engineQuickCard--cart" aria-label="Carrito">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
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
                  </button>
                </div>

                <div className="sf-engineSearchRow">
                  <div className="sf-engineSearchWrap">
                    <input
                      className="sf-engineSearch"
                      type="search"
                      placeholder="Buscar pizza o ingrediente"
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
            <button type="button" className={`sf-offersBtn ${offerVariant.className}`}>
              <span className="sf-offersBtnLabel">{offerVariant.label}</span>
            </button>
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
              {activeTab === PROMOS_TAB ? "Promos destacadas" : "Disponible hoy"}
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
              <div className="sf-engineEmptyState">
                <strong>Promos</strong>
                <p>
                  Aqui iran las ofertas creadas desde el hijo de promociones dentro
                  del modulo de ofertas.
                </p>
              </div>
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
