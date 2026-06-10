import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../setupAxios";
import "../../styles/CouponGallery.css";

const normalizeZipCode = (value = "") => {
  const match = String(value || "").match(/\b(\d{5})\b/);
  return match ? match[1] : "";
};

const normalizeZipInput = (value = "") => String(value || "").replace(/\D/g, "").slice(0, 5);
const COUPON_GALLERY_LEGAL_VERSION = "2026-05-coupon-games-legal-v1";
const COUPON_GALLERY_LEGAL_KEY = `volta_coupon_gallery_legal_${COUPON_GALLERY_LEGAL_VERSION}`;
const COUPON_GALLERY_BUILD_MARK = "coupon-gallery-delivery-template-v6";

const withCouponQuery = (path, code) => {
  const basePath = String(path || "/");
  const [pathname, rawSearch = ""] = basePath.split("?");
  const params = new URLSearchParams(rawSearch);
  params.set("coupon", String(code || "").trim().toUpperCase());
  params.set("couponSource", "gallery");
  params.set("openCoupon", "1");
  return `${pathname || "/"}?${params.toString()}`;
};

const localizeRedeemUrl = (url, fallbackPath, code) => {
  const fallback = withCouponQuery(fallbackPath, code);
  if (!url) return fallback;

  try {
    const parsed = new URL(url);
    return withCouponQuery(`${parsed.pathname}${parsed.search}`, code);
  } catch {
    return String(url).startsWith("/") ? withCouponQuery(url, code) : fallback;
  }
};

const buildStorageKey = (partner) => {
  const partnerKey = partner?.id || partner?.slug || partner?.name || "default";
  return `volta_coupon_gallery_zip_${partnerKey}`;
};

const getVisitorId = () => {
  const visitorKey = "volta_storefront_visitor_id";

  try {
    let visitorId = window.localStorage.getItem(visitorKey) || "";
    if (!visitorId) {
      visitorId = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(visitorKey, visitorId);
    }
    return visitorId;
  } catch {
    return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const getDisplayType = (type = "") => {
  switch (String(type || "").toUpperCase()) {
    case "FIXED_PERCENT":
      return "DISCOUNT";
    case "RANDOM_PERCENT":
      return "MYSTERY DISCOUNT";
    case "FIXED_AMOUNT":
      return "CASH DISCOUNT";
    case "SURPRISE_AMOUNT":
      return "SURPRISE REWARD";
    case "DELIVERY_FREE":
      return "DELIVERY FREE";
    default:
      return String(type || "REWARD").replaceAll("_", " ");
  }
};

const getCardTheme = (type = "") => {
  switch (String(type || "").toLowerCase()) {
    case "fixed_percent":
      return "cg-card-theme-fixed";
    case "random_percent":
      return "cg-card-theme-random";
    case "fixed_amount":
    case "surprise_amount":
    case "delivery_free":
      return "cg-card-theme-cash";
    default:
      return "cg-card-theme-default";
  }
};

const isGameCoupon = (card) =>
  String(card?.acquisition || "").toUpperCase() === "GAME" ||
  String(card?.channel || "").toUpperCase() === "GAME" ||
  Boolean(card?.gameId || card?.game);

const parseCouponCardAmount = (value) => {
  if (value == null || value === "") return null;
  const cleaned = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".")
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const isZeroFixedAmountCard = (card) => {
  if (String(card?.type || "").trim().toUpperCase() !== "FIXED_AMOUNT") return false;
  return [card?.amount, card?.key, card?.title].some((value) => parseCouponCardAmount(value) === 0);
};

const isDeliveryFreeCard = (card) =>
  String(card?.type || "").trim().toUpperCase() === "DELIVERY_FREE" ||
  String(card?.campaign || "").trim().toUpperCase() === "DELIVERY_FREE" ||
  String(card?.key || "").trim().toUpperCase() === "DELIVERY_FREE" ||
  Boolean(card?.meta?.deliveryFree) ||
  String(card?.title || "").trim().toUpperCase() === "DELIVERY FREE" ||
  isZeroFixedAmountCard(card);

const normalizeRandomPercentCard = (card) => {
  if (String(card?.type || "").trim().toUpperCase() !== "RANDOM_PERCENT") return card;
  const key = String(card?.key || "").trim();
  const rangeMatch = key.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
  if (!rangeMatch) return card;

  return {
    ...card,
    title: `${rangeMatch[1].replace(",", ".")}-${rangeMatch[2].replace(",", ".")}%`,
    subtitle: "Descuento aleatorio",
  };
};

const normalizeGalleryCard = (card) => {
  if (isDeliveryFreeCard(card)) {
    return {
      ...card,
      type: "DELIVERY_FREE",
      key: "DELIVERY_FREE",
      title: "Delivery Free",
      subtitle: "Envio Gratis",
      campaign: "DELIVERY_FREE",
      meta: { ...(card?.meta || {}), deliveryFree: true },
    };
  }

  return normalizeRandomPercentCard(card);
};

const getDisplaySubtitle = (card) => {
  const subtitle = String(card?.subtitle || "").trim();
  if (subtitle) return subtitle;

  const title = String(card?.title || "").trim();
  if (title.includes("%")) return `${title} de descuento en tu pedido`;
  return `${title || "Cupon"} para canjear en tu siguiente pedido`;
};

function ZoneModal({
  open,
  partnerName,
  initialZipCode,
  saving,
  error,
  availableZipCodes,
  onSubmit,
  onResolveLocation,
}) {
  const [zipCode, setZipCode] = useState(initialZipCode || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const options = useMemo(() => {
    const normalized = normalizeZipInput(zipCode);
    if (!normalized) return availableZipCodes.slice(0, 6);
    return availableZipCodes.filter((option) => option.startsWith(normalized)).slice(0, 6);
  }, [availableZipCodes, zipCode]);

  useEffect(() => {
    if (!open) return;
    setZipCode(initialZipCode || "");
    setShowSuggestions(false);
    setLocationError("");
  }, [initialZipCode, open]);

  if (!open) return null;

  return (
    <div className="cg-modalBack cg-modalBack-zone">
      <div className="cg-modalCard cg-zoneCard" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cg-kicker">Coupon Gallery</div>
        <h2 className="cg-zoneTitle">Cupones disponibles donde estas</h2>
        <p className="cg-zoneText">
          Necesitamos saber tu codigo postal para mostrarte solo los cupones disponibles en tu zona
          para {partnerName || "esta tienda"}.
        </p>

        <form
          className="cg-zoneForm"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(normalizeZipCode(zipCode));
          }}
        >
          <label className="cg-field">
            <span>Codigo postal</span>
            <div className="cg-zipField">
              <input
                value={zipCode}
                onChange={(event) => {
                  setZipCode(normalizeZipInput(event.target.value));
                  setShowSuggestions(Boolean(normalizeZipInput(event.target.value)));
                }}
                onFocus={() => setShowSuggestions(Boolean(zipCode))}
                onBlur={() => {
                  window.setTimeout(() => setShowSuggestions(false), 120);
                }}
                placeholder="Ej: 32002"
                inputMode="numeric"
                maxLength={5}
              />

              {!!options.length && showSuggestions && (
                <div className="cg-zipSuggest" role="listbox">
                  {options.map((option) => (
                    <button
                      key={option}
                      className="cg-zipSuggestBtn"
                      onClick={() => {
                        setZipCode(option);
                        setShowSuggestions(false);
                      }}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>

          <div className="cg-zoneMetaRow">
            <div className="cg-zoneDivider">o ubica tu codigo postal automaticamente</div>
            <button
              className="cg-ghostBtn cg-locationBtn"
              type="button"
              disabled={saving || searchingLocation}
              onClick={async () => {
                if (!navigator.geolocation) {
                  setLocationError("Tu navegador no permite geolocalizacion.");
                  return;
                }

                setSearchingLocation(true);
                setLocationError("");

                try {
                  const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      enableHighAccuracy: true,
                      timeout: 10000,
                      maximumAge: 300000,
                    });
                  });

                  const { latitude, longitude } = position.coords;
                  const resolvedZipCode = await onResolveLocation({ latitude, longitude });
                  if (!resolvedZipCode) {
                    setLocationError("No encontramos una zona valida cerca de tu ubicacion.");
                    return;
                  }
                  onSubmit(resolvedZipCode);
                } catch (requestError) {
                  console.error(requestError);
                  setLocationError("No pudimos detectar tu zona automaticamente.");
                } finally {
                  setSearchingLocation(false);
                }
              }}
            >
              <span className="cg-locationIcon" aria-hidden="true">
                <svg viewBox="0 0 64 64" role="presentation">
                  <path d="M32 54c7-9.6 15-18 15-28.3C47 16.5 40.3 10 32 10s-15 6.5-15 15.7C17 36 25 44.4 32 54Z" />
                  <circle cx="32" cy="26" r="7.5" />
                  <path d="M45.5 12.5c5.6 1.4 10 5.8 11.4 11.4" />
                  <path d="M43.5 18.5c3 .8 5.4 3.2 6.2 6.2" />
                  <ellipse cx="32" cy="57" rx="15" ry="3.5" />
                </svg>
              </span>
              {searchingLocation ? "Buscando tu ubicacion..." : "Usar mi ubicacion"}
            </button>
          </div>

          {error && <div className="cg-error">{error}</div>}
          {locationError && <div className="cg-error">{locationError}</div>}

          <button className="cg-primaryBtn" type="submit" disabled={saving}>
            {saving ? "Consultando..." : "Ver cupones"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CouponGalleryLegalGate({ open, partnerName, onAccept }) {
  if (!open) return null;

  return (
    <div className="cg-modalBack cg-legalGateBack">
      <div className="cg-modalCard cg-legalGateCard" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cg-modalHead">
          <div>
            <div className="cg-kicker">{partnerName || "Coupon Gallery"}</div>
            <h3>Condiciones legales de cupones y juegos</h3>
          </div>
        </div>

        <div className="cg-legalContent">
          <p>
            Antes de ver o reclamar cupones, acepta las condiciones de promociones,
            juegos, azar, privacidad, cookies necesarias y uso responsable del portal.
          </p>

          <h4>Cupones y promociones</h4>
          <ul>
            <li>Los cupones son promocionales, personales cuando proceda, no acumulables salvo indicacion expresa y no canjeables por efectivo.</li>
            <li>Cada cupon puede estar limitado por uso, telefono, cliente, zona, tienda, fecha, horario, stock o producto elegible.</li>
            <li>La obtencion de un cupon no garantiza disponibilidad de producto ni derecho a combinarlo con Promos, Top Deals, Boost u otros descuentos.</li>
            <li>Los cupones pueden caducar automaticamente y se validan de nuevo antes de aplicarse en el carrito.</li>
          </ul>

          <h4>Juegos, azar y mayores de edad</h4>
          <ul>
            <li>Ruletas, sorteos, retos o dinamicas aleatorias son acciones promocionales sin valor monetario directo.</li>
            <li>Para participar, reclamar o canjear premios promocionales debes ser <b>mayor de 18 anos</b>.</li>
            <li>No se permite automatizar participaciones, manipular resultados, crear duplicados, revender cupones o usar datos falsos.</li>
            <li>Ante fraude, abuso, error tecnico o participacion no elegible, el cupon, premio o pedido asociado puede ser anulado.</li>
          </ul>

          <h4>Privacidad y cookies</h4>
          <ul>
            <li>Tratamos datos necesarios para zona, reclamo, validacion, seguridad, soporte y prevencion de fraude.</li>
            <li>Podemos solicitar nombre, telefono, codigo postal y datos tecnicos imprescindibles para operar la galeria.</li>
            <li>Usamos almacenamiento/cookies necesarias para recordar zona, consentimiento, seguridad y funcionamiento del portal.</li>
            <li>Las cookies analiticas o publicitarias solo se habilitaran si se activan expresamente.</li>
          </ul>

          <p className="cg-legalNote">
            Al pulsar "Acepto y continuar" confirmas que has leido y aceptas estas
            condiciones, eres mayor de 18 anos si participas en juegos/promociones y
            autorizas el uso de cookies necesarias.
          </p>
        </div>

        <button className="cg-primaryBtn cg-legalAccept" type="button" onClick={onAccept}>
          Acepto y continuar
        </button>
      </div>
    </div>
  );
}

function CouponCard({ card, onClaim }) {
  const normalizedCard = normalizeGalleryCard(card);
  const isUnlimited = card.remaining == null;
  const remaining = isUnlimited ? null : Number(card.remaining || 0);
  const isSoldOut = !isUnlimited && remaining <= 0;
  const isLowStock = !isUnlimited && remaining > 0 && remaining <= 3;
  const isSegmented = Boolean(normalizedCard.isSegmented);
  const gameCoupon = isGameCoupon(normalizedCard);
  const deliveryFree = isDeliveryFreeCard(normalizedCard);
  const ctaWords = [
    isSoldOut ? "AGOTADO" : gameCoupon ? "JUGAR" : isSegmented ? "VER SI APLICA" : "CLAIM",
    isSoldOut ? "SOLD OUT" : gameCoupon ? "PLAY" : isSegmented ? "COMPROBAR" : "RECLAMAR",
    isSoldOut ? "AGOTADO" : gameCoupon ? "WIN" : isSegmented ? "DESBLOQUEAR" : "CANJEAR",
    isSoldOut ? "SOLD OUT" : gameCoupon ? "JUGAR" : isSegmented ? "VER SI APLICA" : "CLAIM",
  ];

  return (
    <article
      className={`cg-card ${getCardTheme(normalizedCard.type)} ${gameCoupon ? "cg-card-game" : ""} ${
        deliveryFree ? "cg-card-deliveryFree" : ""
      } ${
        isSoldOut ? "is-soldout" : ""
      }`}
    >
      <header className="cg-cardTop">
        <span className={`cg-cardBadge ${deliveryFree ? "cg-dfBadge" : ""}`}>
          {deliveryFree && <span className="cg-dfBadgeMoto" aria-hidden="true" />}
          {deliveryFree ? "Delivery Free" : gameCoupon ? "Play & Win" : isSegmented ? "Personalizado" : "Reward"}
        </span>
        <span className="cg-cardType">{deliveryFree ? "Cupon especial" : getDisplayType(normalizedCard.type)}</span>
      </header>

      {deliveryFree ? (
        <div className="cg-cardBody cg-dfBody">
          <p className="cg-cardEyebrow">Delivery Free</p>
          <h2 className="cg-cardTitle">
            <span>Envio</span>
            <span>gratis</span>
          </h2>
          <p className="cg-cardSubtitle">Envio Gratis</p>

          <div className="cg-dfActionScene" aria-hidden="true">
            <span className="cg-dfFlare cg-dfFlare-1" />
            <span className="cg-dfFlare cg-dfFlare-2" />
            <span className="cg-dfTrail cg-dfTrail-1" />
            <span className="cg-dfTrail cg-dfTrail-2" />
            <span className="cg-dfTrail cg-dfTrail-3" />
            <span className="cg-dfOrbit" />
            <span className="cg-dfOrbit cg-dfOrbit-2" />
            <div className="cg-dfMotoWrap">
              <svg className="cg-dfMoto" viewBox="0 0 220 150" role="presentation">
                <g className="cg-dfMotoPizzaBox">
                  <path d="M108 42h56l14 28-12 18h-58z" />
                  <path d="M117 51h39l7 13h-48z" />
                  <path d="M126 60l10 10 18-16" />
                </g>
                <g className="cg-dfMotoRider">
                  <circle cx="78" cy="36" r="13" />
                  <path d="M66 51h32l18 29H83l-24-16z" />
                  <path d="M94 58l25 13 20 2" />
                  <path d="M77 72l-20 20" />
                </g>
                <g className="cg-dfMotoBody">
                  <path d="M42 94h63c13 0 24-8 31-21l21 2c19 2 34 14 39 31h-36c-7-13-20-21-36-21s-29 8-36 21H74c-5-11-15-18-29-18-14 0-25 7-31 18H8c4-22 17-35 34-35z" />
                  <path d="M43 80h50l13 14H39z" />
                  <path d="M134 75l16-21h32l-9 25" />
                  <path d="M36 62h26l14 18H41z" />
                </g>
                <g className="cg-dfMotoLines">
                  <path d="M18 54h37" />
                  <path d="M7 70h50" />
                  <path d="M21 86h28" />
                </g>
                <g className="cg-dfMotoWheels">
                  <circle cx="45" cy="109" r="24" />
                  <circle cx="45" cy="109" r="10" />
                  <circle cx="126" cy="109" r="24" />
                  <circle cx="126" cy="109" r="10" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div className="cg-cardBody">
          <p className="cg-cardEyebrow">{String(normalizedCard.type || "").replaceAll("_", " ")}</p>
          <h2 className="cg-cardTitle">{normalizedCard.title}</h2>
          {gameCoupon && (
            <p className="cg-cardGameLine">{normalizedCard.game?.name || "Premio dorado"}</p>
          )}
          <p className="cg-cardSubtitle">{getDisplaySubtitle(normalizedCard)}</p>
          {isSegmented && (
            <p className="cg-cardHint">Disponible segun tu perfil de cliente.</p>
          )}
        </div>
      )}

      <footer className="cg-cardFooter">
        <div className="cg-cardStockBlock">
          <span className="cg-cardStockLabel">{isSoldOut ? "STATUS" : "IN STOCK"}</span>
          <span className={`cg-cardStockValue ${isLowStock ? "is-low" : ""}`}>
            {isSoldOut ? "Sold out" : isUnlimited ? "∞" : remaining}
          </span>
        </div>

        <button
          className="cg-claimBtn"
          onClick={onClaim}
          type="button"
          disabled={isSoldOut}
        >
          <span className="cg-ctaViewport" aria-hidden="true">
            <span className="cg-ctaSlider">
              {ctaWords.map((word, index) => (
                <span className="cg-ctaWord" key={`${word}-${index}`}>
                  {word}
                </span>
              ))}
            </span>
          </span>
        </button>
      </footer>
    </article>
  );
}

function ClaimModal({ card, partnerId, zipCode, redeemBasePath, onClose, onClaimed, onGoToRedeem }) {
  const normalizedCard = normalizeGalleryCard(card);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const couponCode = result?.coupon?.code || "";
  const redeemPath = result?.coupon
    ? localizeRedeemUrl(result.delivery?.redeemUrl, redeemBasePath, couponCode)
    : "";

  const copyCouponCode = async ({ goToRedeem = false } = {}) => {
    if (!couponCode) return;

    try {
      await navigator.clipboard.writeText(couponCode);
      setCopiedCoupon(true);
      window.setTimeout(() => setCopiedCoupon(false), 1400);
      if (goToRedeem) {
        window.setTimeout(() => onGoToRedeem(redeemPath), 180);
      }
    } catch {
      setError("No pudimos copiar el cupon. Manten pulsado el codigo para copiarlo.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const { data } = await api.post("/api/coupons/direct-claim", {
        partnerId,
        type: normalizedCard.type,
        key: normalizedCard.key,
        name: form.name,
        phone: form.phone,
        zipCode,
      });

      setResult({
        coupon: data.coupon || null,
        delivery: data.delivery || null,
      });
      onClaimed();
    } catch (requestError) {
      console.error(requestError);
      const nextError = requestError.response?.data?.error || "No se pudo reclamar el cupon.";
      setError(
        nextError === "unavailable_in_area"
          ? "Este cupon no esta disponible para tu codigo postal."
          : nextError === "segment_not_eligible"
            ? "Este cupon no aplica a tu perfil de cliente en este momento."
            : nextError
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cg-modalBack cg-modalBack-claim" onMouseDown={onClose}>
      <div className="cg-modalCard cg-claimModalCard" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cg-modalHead">
          <div>
            <div className="cg-kicker">Volta Coupon Gallery</div>
            <h3>{normalizedCard.title}</h3>
          </div>
          <button className="cg-ghostBtn" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        {result?.coupon ? (
          <div className="cg-claimSuccess">
            <div className="cg-successHero">
              <span>Listo para pedir</span>
              <div className="cg-couponCodeRow">
                <strong>{result.coupon.code}</strong>
              </div>
              <button
                type="button"
                className={`cg-copyCouponBtn ${copiedCoupon ? "is-copied" : ""}`}
                onClick={() => copyCouponCode({ goToRedeem: true })}
                aria-label="Copiar cupon e ir al pedido"
                title="Copiar cupon e ir al pedido"
              >
                <span className="cg-copyCouponIcon" aria-hidden="true" />
                <small>{copiedCoupon ? "Copiado" : "Copiar e ir"}</small>
              </button>
            </div>
            <p className="cg-successCopy">
              Copiamos el codigo y abrimos la tienda con el cupon listo para validarse.
            </p>
            <p className="cg-successMeta">
              Vence:{" "}
              <b>{result.coupon.expiresAt ? new Date(result.coupon.expiresAt).toLocaleString("es-ES") : "sin fecha"}</b>
            </p>
            <div className="cg-claimActions cg-claimActions--single">
              <button className="cg-ghostBtn" onClick={onClose} type="button">
                Seguir viendo cupones
              </button>
            </div>
          </div>
        ) : (
          <form className="cg-claimForm" onSubmit={submit}>
            <label className="cg-field">
              <span>Nombre</span>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Tu nombre"
              />
            </label>

            <label className="cg-field">
              <span>Telefono</span>
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="600111222"
              />
            </label>

            <div className="cg-helperBox">
              Reclamas este cupon para el codigo postal <strong>{zipCode}</strong>. Al reservarlo podras copiar el codigo e ir al pedido con el cupon listo.
            </div>

            {error && <div className="cg-error">{error}</div>}

            <button className="cg-primaryBtn" type="submit" disabled={saving}>
              {saving ? "Reservando..." : "Canjear"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CouponGallery({ partner }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState([]);
  const [availableZipCodes, setAvailableZipCodes] = useState([]);
  const [claimingCard, setClaimingCard] = useState(null);
  const [zipCode, setZipCode] = useState("");
  const [zipReady, setZipReady] = useState(false);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneError, setZoneError] = useState("");
  const [resolvingZone, setResolvingZone] = useState(false);
  const [fallbackStorePath, setFallbackStorePath] = useState("");
  const [fallbackStoreId, setFallbackStoreId] = useState(null);
  const [legalAccepted, setLegalAccepted] = useState(false);

  const partnerId = partner?.id;
  const storageKey = useMemo(() => buildStorageKey(partner), [partner]);
  const returnToStorePath = useMemo(() => {
    const statePath = location.state?.returnToStorePath;
    if (typeof statePath === "string" && statePath.startsWith("/")) return statePath;
    if (fallbackStorePath) return fallbackStorePath;
    return partner?.slug ? `/${partner.slug}` : "/";
  }, [fallbackStorePath, location.state, partner?.slug]);

  useEffect(() => {
    try {
      setLegalAccepted(window.localStorage.getItem(COUPON_GALLERY_LEGAL_KEY) === "accepted");
    } catch {
      setLegalAccepted(false);
    }
  }, []);

  const acceptLegalGate = useCallback(() => {
    try {
      window.localStorage.setItem(COUPON_GALLERY_LEGAL_KEY, "accepted");
    } catch {
      // Continue current session even when storage is unavailable.
    }
    setLegalAccepted(true);
  }, []);

  const loadContext = useCallback(async () => {
    if (!partnerId) return;

    try {
      const { data } = await api.get(`/api/coupons/gallery-context?partnerId=${partnerId}`);
      setAvailableZipCodes(Array.isArray(data?.zipCodes) ? data.zipCodes : []);
    } catch (requestError) {
      console.error(requestError);
      setAvailableZipCodes([]);
    }
  }, [partnerId]);

  const loadCards = useCallback(async () => {
    if (!partnerId || !zipCode) return;
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(`/api/coupons/gallery?partnerId=${partnerId}&zipCode=${zipCode}`);
      const normalizedCards = Array.isArray(data?.cards) ? data.cards.map(normalizeGalleryCard) : [];
      console.info("[CouponGallery]", COUPON_GALLERY_BUILD_MARK, {
        partnerId,
        zipCode,
        cards: normalizedCards.map((card) => ({
          type: card.type,
          key: card.key,
          title: card.title,
          remaining: card.remaining,
          campaign: card.campaign,
        })),
      });
      setCards(normalizedCards);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar la galeria de cupones.");
    } finally {
      setLoading(false);
    }
  }, [partnerId, zipCode]);

  useEffect(() => {
    if (!partnerId) return;
    loadContext();
    const storedZip = normalizeZipCode(window.localStorage.getItem(storageKey));

    if (storedZip) {
      setZipCode(storedZip);
      setZipReady(true);
      setZoneModalOpen(false);
      return;
    }

    setZipCode("");
    setZipReady(false);
    setZoneModalOpen(true);
  }, [loadContext, partnerId, storageKey]);

  useEffect(() => {
    if (!partnerId || !partner?.slug) return undefined;

    let cancelled = false;

    api
      .get(`/stores?partnerId=${partnerId}`)
      .then((response) => {
        if (cancelled) return;
        const stores = response?.data;
        const safeStores = Array.isArray(stores) ? stores : [];
        const returnPath = String(location.state?.returnToStorePath || "");
        const returnStoreSlug = returnPath.split("/").filter(Boolean).at(-1);
        const selectedStore =
          safeStores.find((store) => store?.slug && store.slug === returnStoreSlug) ||
          safeStores.find((store) => store?.slug) ||
          null;
        setFallbackStorePath(selectedStore ? `/${partner.slug}/${selectedStore.slug}` : "");
        setFallbackStoreId(selectedStore?.id || null);
      })
      .catch((requestError) => {
        console.error(requestError);
        if (!cancelled) {
          setFallbackStorePath("");
          setFallbackStoreId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.state, partner?.slug, partnerId]);

  useEffect(() => {
    if (!partnerId || !fallbackStoreId) return undefined;

    const visitorId = getVisitorId();
    const sendPresence = () => {
      if (document.visibilityState === "hidden") return;

      api
        .post("/api/presence/heartbeat", {
          partnerId: Number(partnerId),
          storeId: Number(fallbackStoreId),
          visitorId,
          state: "browsing",
          path: window.location.pathname,
        })
        .catch((requestError) => {
          console.warn("[presence] coupon gallery heartbeat failed", requestError);
        });
    };

    sendPresence();
    const intervalId = window.setInterval(sendPresence, 15000);
    document.addEventListener("visibilitychange", sendPresence);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", sendPresence);
    };
  }, [fallbackStoreId, partnerId]);

  useEffect(() => {
    if (!zipReady || !zipCode) return;
    loadCards();
  }, [loadCards, zipCode, zipReady]);

  const activeCards = useMemo(
    () => cards.filter((card) => card.remaining == null || card.remaining > 0),
    [cards]
  );

  const submitZone = async (nextZipCode) => {
    if (!nextZipCode) {
      setZoneError("Introduce un codigo postal valido de 5 digitos.");
      return;
    }

    setResolvingZone(true);
    setZoneError("");

    try {
      window.localStorage.setItem(storageKey, nextZipCode);
      setZipCode(nextZipCode);
      setZipReady(true);
      setZoneModalOpen(false);
    } finally {
      setResolvingZone(false);
    }
  };

  const resolveLocation = async ({ latitude, longitude }) => {
    if (!partnerId) return "";
    const { data } = await api.get(
      `/api/coupons/gallery-context?partnerId=${partnerId}&lat=${latitude}&lng=${longitude}`
    );
    return normalizeZipCode(data?.resolvedZipCode);
  };

  const resetZone = () => {
    window.localStorage.removeItem(storageKey);
    setCards([]);
    setZipCode("");
    setZipReady(false);
    setZoneError("");
    setZoneModalOpen(true);
  };

  return (
    <div className="cg-shell" data-build={COUPON_GALLERY_BUILD_MARK}>
      <div className="cg-wrap">
        <header className="cg-hero">
          <div className="cg-kicker">Coupon Gallery</div>
          <h1>{partner?.name || "Coupon Gallery"}</h1>
          <p>Explora cupones publicos y reclama solo los disponibles en tu zona.</p>

          {zipReady && zipCode && (
            <div className="cg-zoneBar">
              <button
                className="cg-storeBackBtn"
                onClick={() => navigate(returnToStorePath)}
                type="button"
              >
                Volver a tienda
              </button>
              <div className="cg-zoneBadge">
                Codigo postal activo: <strong>{zipCode}</strong>
              </div>
              {!loading && !error && (
                <div className="cg-zoneBadge cg-zoneBadge-soft">
                  Cupones activos: <strong>{activeCards.length}</strong>
                </div>
              )}
              <button className="cg-ghostBtn" onClick={resetZone} type="button">
                Cambiar ubicacion
              </button>
            </div>
          )}
        </header>

        {!zipReady && !zoneModalOpen && <div className="cg-stateCard">Preparando galeria...</div>}

        {zipReady && loading && <div className="cg-stateCard">Cargando cupones...</div>}

        {zipReady && error && !loading && <div className="cg-stateCard">{error}</div>}

        {zipReady && !loading && !error && (
          <section className="cg-galleryRail" aria-label="Cupones disponibles">
            <div className="cg-grid">
              {cards.map((card) => {
                const normalizedCard = normalizeGalleryCard(card);
                return (
                  <CouponCard
                    key={`${normalizedCard.type}-${normalizedCard.key}`}
                    card={normalizedCard}
                    partner={partner}
                    onClaim={() => {
                      if (!legalAccepted) return;
                      if (isGameCoupon(normalizedCard)) {
                        navigate(`/${partner?.slug}/games/${normalizedCard.game?.slug || "winning-number"}`, {
                          state: {
                            couponTrail: "game",
                            gameName: normalizedCard.game?.name || "Premio dorado",
                            partnerName: partner?.name || "Partner",
                            returnToStorePath,
                          },
                        });
                        return;
                      }
                      setClaimingCard(normalizedCard);
                    }}
                  />
                );
              })}
            </div>

            {!cards.length && (
              <div className="cg-empty">
                No hay cupones publicos disponibles para el codigo postal <strong>{zipCode}</strong>.
              </div>
            )}
          </section>
        )}
      </div>

      <ZoneModal
        open={legalAccepted && zoneModalOpen}
        partnerName={partner?.name}
        initialZipCode={zipCode}
        saving={resolvingZone}
        error={zoneError}
        availableZipCodes={availableZipCodes}
        onSubmit={submitZone}
        onResolveLocation={resolveLocation}
      />

      {claimingCard && (
        <ClaimModal
          card={claimingCard}
          partnerId={partnerId}
          zipCode={zipCode}
          redeemBasePath={returnToStorePath}
          onClose={() => setClaimingCard(null)}
          onClaimed={loadCards}
          onGoToRedeem={(path) => navigate(path || returnToStorePath)}
        />
      )}

      <CouponGalleryLegalGate
        open={!legalAccepted}
        partnerName={partner?.name}
        onAccept={acceptLegalGate}
      />
    </div>
  );
}
