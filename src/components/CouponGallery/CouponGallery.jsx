import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/CouponGallery.css";

function ClaimModal({ card, partnerId, onClose, onClaimed }) {
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
      });

      setResult(data.coupon || null);
      onClaimed();
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "No se pudo reclamar el cupon.");
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cards, setCards] = useState([]);
  const [claimingCard, setClaimingCard] = useState(null);

  const partnerId = partner?.id;

  const loadCards = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(`/api/coupons/gallery?partnerId=${partnerId}`);
      setCards(Array.isArray(data?.cards) ? data.cards : []);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar la galeria de cupones.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const visibleCards = useMemo(() => cards.filter((card) => card.remaining == null || card.remaining > 0), [cards]);

  if (loading) {
    return (
      <div className="cg-stateShell">
        <div className="cg-stateCard">Cargando cupones...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cg-stateShell">
        <div className="cg-stateCard">{error}</div>
      </div>
    );
  }

  return (
    <div className="cg-shell">
      <div className="cg-wrap">
        <header className="cg-hero">
          <div className="cg-kicker">Coupon Gallery</div>
          <h1>{partner?.name || "Coupon Gallery"}</h1>
          <p>Explora las ofertas publicas, reclama tu cupón y reservalo para tu siguiente pedido.</p>
        </header>

        <section className="cg-grid">
          {visibleCards.map((card) => (
            <article key={`${card.type}-${card.key}`} className={`cg-card cg-card-${card.type.toLowerCase()}`}>
              <div className="cg-cardTop">
                <span className="cg-cardTag">{card.type.replace("_", " ")}</span>
                <span className="cg-cardStock">
                  In stock {card.remaining == null ? "∞" : card.remaining}
                </span>
              </div>

              <div className="cg-cardBody">
                <div className="cg-cardTitle">{card.title}</div>
                <div className="cg-cardSubtitle">{card.subtitle}</div>
              </div>

              <button className="cg-claimBtn" onClick={() => setClaimingCard(card)} type="button">
                {card.cta || "Canjear"}
              </button>
            </article>
          ))}

          {!visibleCards.length && <div className="cg-empty">No hay cupones publicos disponibles.</div>}
        </section>
      </div>

      {claimingCard && (
        <ClaimModal
          card={claimingCard}
          partnerId={partnerId}
          onClose={() => setClaimingCard(null)}
          onClaimed={loadCards}
        />
      )}
    </div>
  );
}
