import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../setupAxios";
import "../../styles/CouponGallery.css";

const normalizeZipCode = (value = "") => {
  const match = String(value || "").match(/\b(\d{5})\b/);
  return match ? match[1] : "";
};

const normalizeZipInput = (value = "") => String(value || "").replace(/\D/g, "").slice(0, 5);

const buildStorageKey = (partner) => {
  const partnerKey = partner?.id || partner?.slug || partner?.name || "default";
  return `volta_coupon_gallery_zip_${partnerKey}`;
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
      return "cg-card-theme-cash";
    default:
      return "cg-card-theme-default";
  }
};

const isGameCoupon = (card) =>
  String(card?.acquisition || "").toUpperCase() === "GAME" ||
  String(card?.channel || "").toUpperCase() === "GAME" ||
  Boolean(card?.gameId || card?.game);

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

function CouponCard({ card, partner, onClaim }) {
  const isUnlimited = card.remaining == null;
  const remaining = isUnlimited ? null : Number(card.remaining || 0);
  const isSoldOut = !isUnlimited && remaining <= 0;
  const isLowStock = !isUnlimited && remaining > 0 && remaining <= 3;
  const isSegmented = Boolean(card.isSegmented);
  const gameCoupon = isGameCoupon(card);
  const partnerLogo = partner?.brandLogoUrl || "";
  const cardStyle = partnerLogo
    ? { "--cg-card-logo": `url("${partnerLogo}")` }
    : undefined;

  return (
    <article
      className={`cg-card ${getCardTheme(card.type)} ${gameCoupon ? "cg-card-game" : ""} ${
        isSoldOut ? "is-soldout" : ""
      }`}
      style={cardStyle}
    >
      <header className="cg-cardTop">
        <span className="cg-cardBadge">
          {gameCoupon ? "Play & Win" : isSegmented ? "Personalizado" : "Reward"}
        </span>
        <span className="cg-cardType">{getDisplayType(card.type)}</span>
      </header>

      <div className="cg-cardBody">
        <p className="cg-cardEyebrow">{String(card.type || "").replaceAll("_", " ")}</p>
        <h2 className="cg-cardTitle">{card.title}</h2>
        {gameCoupon && (
          <p className="cg-cardGameLine">{card.game?.name || "Premio dorado"}</p>
        )}
        <p className="cg-cardSubtitle">{getDisplaySubtitle(card)}</p>
        {isSegmented && (
          <p className="cg-cardHint">Disponible segun tu perfil de cliente.</p>
        )}
      </div>

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
              <span className="cg-ctaWord">
                {isSoldOut ? "AGOTADO" : gameCoupon ? "JUGAR" : isSegmented ? "VER SI APLICA" : "CLAIM"}
              </span>
              <span className="cg-ctaWord">
                {isSoldOut ? "SOLD OUT" : gameCoupon ? "PLAY" : isSegmented ? "COMPROBAR" : "RECLAMAR"}
              </span>
              <span className="cg-ctaWord">
                {isSoldOut ? "AGOTADO" : gameCoupon ? "WIN" : isSegmented ? "DESBLOQUEAR" : "CANXEAR"}
              </span>
              <span className="cg-ctaWord">
                {isSoldOut ? "SOLD OUT" : gameCoupon ? "JUGAR" : isSegmented ? "VER SI APLICA" : "CLAIM"}
              </span>
            </span>
          </span>
        </button>
      </footer>
    </article>
  );
}

function ClaimModal({ card, partnerId, zipCode, onClose, onClaimed }) {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const { data } = await api.post("/api/coupons/direct-claim", {
        partnerId,
        type: card.type,
        key: card.key,
        name: form.name,
        phone: form.phone,
        zipCode,
      });

      setResult(data.coupon || null);
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
    <div className="cg-modalBack" onMouseDown={onClose}>
      <div className="cg-modalCard" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cg-modalHead">
          <div>
            <div className="cg-kicker">Coupon Gallery</div>
            <h3>{card.title}</h3>
          </div>
          <button className="cg-ghostBtn" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        {result ? (
          <div className="cg-claimSuccess">
            <strong>Cupon reservado</strong>
            <p>
              Codigo: <b>{result.code}</b>
            </p>
            <p>
              Vence:{" "}
              {result.expiresAt ? new Date(result.expiresAt).toLocaleString("es-ES") : "sin fecha"}
            </p>
            <button className="cg-primaryBtn" onClick={onClose} type="button">
              Entendido
            </button>
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
              Reclamas este cupon para el codigo postal <strong>{zipCode}</strong>.
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

  const partnerId = partner?.id;
  const storageKey = useMemo(() => buildStorageKey(partner), [partner]);

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
      setCards(Array.isArray(data?.cards) ? data.cards : []);
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
    <div className="cg-shell">
      <div className="cg-wrap">
        <header className="cg-hero">
          <div className="cg-kicker">Coupon Gallery</div>
          <h1>{partner?.name || "Coupon Gallery"}</h1>
          <p>Explora cupones publicos y reclama solo los disponibles en tu zona.</p>

          {zipReady && zipCode && (
            <div className="cg-zoneBar">
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
              {cards.map((card) => (
                <CouponCard
                  key={`${card.type}-${card.key}`}
                  card={card}
                  partner={partner}
                  onClaim={() => {
                    if (isGameCoupon(card)) {
                      navigate(`/${partner?.slug}/games/${card.game?.slug || "winning-number"}`);
                      return;
                    }
                    setClaimingCard(card);
                  }}
                />
              ))}
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
        open={zoneModalOpen}
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
          onClose={() => setClaimingCard(null)}
          onClaimed={loadCards}
        />
      )}
    </div>
  );
}
