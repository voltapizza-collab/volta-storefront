import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

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
              <h2>Buen lugar para Boost</h2>
              <p>
                Esta pantalla es el sitio correcto para ofrecer subir posiciones
                despues del pago, manteniendo al cliente dentro del seguimiento.
              </p>
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

        <div className="ot-banner">
          <img
            src="https://res.cloudinary.com/djtswalha/image/upload/v1770542789/myCrushPizzaBannerCampa%C3%B1a1_s1qxmk.png"
            alt="MyCrushPizza"
            loading="lazy"
          />
        </div>

        <Link to={storePath} className="ot-btn">
          Volver a la tienda
        </Link>
      </section>
    </main>
  );
}
