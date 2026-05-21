import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import api from "../setupAxios";
import "../styles/OrderTracking.css";

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const steps = [
  { key: "AWAITING_PAYMENT", label: "Pago" },
  { key: "PREPARING", label: "En preparacion" },
  { key: "READY", label: "Listo" },
];

const stageIndex = (stage) => {
  if (stage === "CANCELED") return -1;
  const index = steps.findIndex((step) => step.key === stage);
  return index === -1 ? 0 : index;
};

export default function OrderTracking() {
  const { code } = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [boostQuote, setBoostQuote] = useState(null);
  const [boostTarget, setBoostTarget] = useState("1");
  const [boostLoading, setBoostLoading] = useState(false);
  const [boostMessage, setBoostMessage] = useState("");

  const fetchStatus = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await api.get(`/api/sales/seguimiento/${code}`);
      setData(res.data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "No se pudo obtener el estado del pedido");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [code]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!["AWAITING_PAYMENT", "PREPARING"].includes(data?.stage)) return undefined;

    const interval = setInterval(() => {
      fetchStatus({ quiet: true });
    }, 15000);

    return () => clearInterval(interval);
  }, [data?.stage, fetchStatus]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session_id");
    const boostPayment = params.get("boost_payment");

    if (!sessionId || boostPayment !== "success") return;

    let cancelled = false;
    api
      .post("/api/checkout/session/confirm", { sessionId })
      .then(() => {
        if (!cancelled) {
          setBoostMessage("Boost pagado y aplicado.");
          fetchStatus({ quiet: true });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setBoostMessage(e.response?.data?.error || "No pudimos confirmar el pago de Boost.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchStatus, location.search]);

  const loadBoostQuote = useCallback(async (targetPosition = boostTarget) => {
    if (!code) return null;

    try {
      setBoostLoading(true);
      setBoostMessage("");
      const { data: response } = await api.get("/api/myorders/boosts/quote", {
        params: {
          orderCode: code,
          targetPosition,
        },
      });
      const quote = response?.quote || null;
      setBoostQuote(quote);
      if (quote?.targetPosition) setBoostTarget(String(quote.targetPosition));
      return quote;
    } catch (e) {
      const message = e.response?.data?.error || "No se pudo calcular Boost para este pedido.";
      setBoostMessage(message);
      setBoostQuote(null);
      return null;
    } finally {
      setBoostLoading(false);
    }
  }, [boostTarget, code]);

  const openBoostModal = async () => {
    setBoostOpen(true);
    await loadBoostQuote("1");
  };

  const activateBoost = async () => {
    if (!boostQuote || boostQuote.positionsToJump <= 0) return;

    try {
      setBoostLoading(true);
      setBoostMessage("");
      const { data: response } = await api.post("/api/myorders/boosts/activate", {
        orderCode: code,
        targetPosition: boostTarget,
        source: "tracking",
        frontendOrigin: window.location.origin,
        returnPath: `/seguimiento/${code}`,
      });

      if (response?.url) {
        window.location.href = response.url;
        return;
      }

      setBoostMessage("No pudimos abrir el pago de Boost.");
    } catch (e) {
      const errorCode = e.response?.data?.error;
      setBoostMessage(
        errorCode === "boost_amount_too_low"
          ? "Boost no alcanza el minimo de pago. Revisa el precio de Boost."
          : errorCode || "No se pudo abrir el pago de Boost."
      );
    } finally {
      setBoostLoading(false);
    }
  };

  const boostOptions = useMemo(() => {
    const current = Number(boostQuote?.currentPosition || data?.queuePosition || 0);
    if (!Number.isFinite(current) || current <= 1) return [];

    return Array.from({ length: Math.min(current - 1, 4) }, (_, index) => index + 1);
  }, [boostQuote?.currentPosition, data?.queuePosition]);

  if (loading) {
    return (
      <main className="ot-page">
        <section className="ot-card">Consultando estado del pedido...</section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ot-page">
        <section className="ot-card ot-error">
          <span>Seguimiento</span>
          <h1>No pudimos cargar el pedido</h1>
          <p>{error}</p>
          <Link to="/" className="ot-btn">Volver</Link>
        </section>
      </main>
    );
  }

  const currentIndex = stageIndex(data?.stage);
  const storePath =
    data?.partnerSlug && data?.storeSlug ? `/${data.partnerSlug}/${data.storeSlug}` : "/";

  return (
    <main className="ot-page">
      <section className="ot-card">
        <div className="ot-head">
          <span>{data?.storeName || "Pedido"}</span>
          <h1>Seguimiento de pedido</h1>
          <p>
            Pedido <b>{data?.code}</b>
          </p>
        </div>

        <div className="ot-summary">
          <strong>{formatMoney(data?.total, data?.currency)}</strong>
          {data?.queuePosition && <span>Posicion actual #{data.queuePosition}</span>}
        </div>

        <div className="ot-steps" aria-label="Estado del pedido">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={`ot-step ${index <= currentIndex ? "active" : ""}`}
            >
              <div className="ot-dot" />
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        <p className="ot-message">{data?.message}</p>

        <section className={`ot-boost ${data?.boost?.active ? "active" : ""}`}>
          <span>Boost</span>
          {data?.boost?.active ? (
            <>
              <h2>Prioridad activa</h2>
              <p>
                Subiste {data.boost.queueCredit || 0} posicion
                {Number(data.boost.queueCredit || 0) === 1 ? "" : "es"} en la cola.
              </p>
            </>
          ) : data?.boost?.available ? (
            <>
              <h2>Sube tu pedido en la cola</h2>
              <p>
                Puedes activar prioridad despues del pago mientras el pedido sigue en preparacion.
              </p>
              <button type="button" className="ot-boostBtn" onClick={openBoostModal}>
                Ver opciones Boost
              </button>
            </>
          ) : (
            <>
              <h2>Sin Boost activo</h2>
              <p>La prioridad se mostrara aqui si el pedido la tiene activada.</p>
            </>
          )}
        </section>

        <button
          type="button"
          className="ot-btn ot-btn-secondary"
          onClick={() => fetchStatus({ quiet: true })}
          disabled={refreshing}
        >
          {refreshing ? "Actualizando..." : "Actualizar estado"}
        </button>

        <section className="ot-nextStep">
          <span>Siguiente paso</span>
          <h2>
            {data?.stage === "READY"
              ? "Tu pedido ya esta listo"
              : data?.delivery === "COURIER"
              ? "La tienda prepara la salida"
              : "Ten a mano tu codigo"}
          </h2>
          <p>
            {data?.stage === "READY"
              ? "Puedes volver a la tienda para repetir, guardar favoritos o ver nuevas ofertas."
              : data?.delivery === "COURIER"
              ? "Cuando este listo, la tienda gestionara la entrega. Revisa este seguimiento si necesitas confirmar el estado."
              : `Muestra ${data?.code || "tu codigo"} al recoger. Si quieres pedir algo mas, vuelve a la tienda sin perder este seguimiento.`}
          </p>
        </section>

        <Link to={storePath} className="ot-btn">
          Volver a la tienda
        </Link>
      </section>

      {boostOpen && (
        <div className="ot-modalOverlay" onClick={() => setBoostOpen(false)}>
          <section className="ot-boostModal" onClick={(event) => event.stopPropagation()}>
            <div className="ot-modalHead">
              <div>
                <span>Boost de seguimiento</span>
                <h2>Subir posicion</h2>
              </div>
              <button type="button" onClick={() => setBoostOpen(false)} aria-label="Cerrar">
                x
              </button>
            </div>

            <div className="ot-boostCurrent">
              <span>Posicion actual</span>
              <strong>#{boostQuote?.currentPosition || data?.queuePosition || "--"}</strong>
              <small>Pedido {data?.code}</small>
            </div>

            <div className="ot-boostOptions" role="radiogroup" aria-label="Nueva posicion">
              {boostOptions.length === 0 ? (
                <div className="ot-boostEmpty">
                  Este pedido ya esta en la mejor posicion disponible.
                </div>
              ) : (
                boostOptions.map((target) => (
                  <button
                    key={target}
                    type="button"
                    className={String(boostTarget) === String(target) ? "active" : ""}
                    onClick={() => {
                      setBoostTarget(String(target));
                      loadBoostQuote(String(target));
                    }}
                  >
                    <span>Ir a #{target}</span>
                    <small>
                      {target === 1 ? "Maxima prioridad" : `Subir hasta posicion ${target}`}
                    </small>
                  </button>
                ))
              )}
            </div>

            {boostQuote && (
              <div className="ot-boostQuote">
                <span>Saltos</span>
                <strong>{boostQuote.positionsToJump}</strong>
                <span>Total</span>
                <strong>{formatMoney(boostQuote.amount, boostQuote.currency)}</strong>
              </div>
            )}

            {boostMessage && <div className="ot-boostMessage">{boostMessage}</div>}

            <div className="ot-modalActions">
              <button type="button" className="ot-btn ot-btn-secondary" onClick={() => setBoostOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="ot-btn"
                onClick={activateBoost}
                disabled={boostLoading || !boostQuote || boostQuote.positionsToJump <= 0}
              >
                {boostLoading
                  ? "Procesando..."
                  : boostQuote
                  ? `Activar - ${formatMoney(boostQuote.amount, boostQuote.currency)}`
                  : "Activar Boost"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
