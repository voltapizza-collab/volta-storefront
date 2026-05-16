import { useEffect, useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";
import { couponSegmentLabel } from "../../../constants/coupons";

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));
const formatMoney = (value) => `EUR ${Number(value || 0).toFixed(2)}`;

function KpiCard({ label, value, note }) {
  return (
    <article className="cp-kpiCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function InteractionChart({ items = [] }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return (
    <div className="cp-chartRows">
      {items.map((item) => {
        const value = Number(item.value || 0);
        return (
          <div key={item.key || item.label} className="cp-chartRow">
            <div className="cp-chartRowHead">
              <span>{item.label}</span>
              <strong>{formatNumber(value)}</strong>
            </div>
            <div className="cp-chartTrack">
              <div
                className={`cp-chartBar cp-chartBar--${item.key || "default"}`}
                style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OffersOverview({ partnerId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    if (!partnerId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [metricsResponse, galleryResponse] = await Promise.all([
          api.get(`/api/coupons/metrics?partnerId=${partnerId}`),
          api.get(`/api/coupons/gallery?partnerId=${partnerId}`),
        ]);

        setMetrics(metricsResponse.data?.kpi || null);
        setGallery(Array.isArray(galleryResponse.data?.cards) ? galleryResponse.data.cards : []);
      } catch (requestError) {
        console.error(requestError);
        setError("No se pudo cargar el overview de ofertas.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [partnerId]);

  const operationalRows = useMemo(() => {
    const operational = metrics?.operational || {};
    return [
      { label: "Cupones activos", value: operational.coupons || 0 },
      { label: "Promos activas", value: operational.promos || 0 },
      { label: "Top Deals activos", value: operational.topDeals || 0 },
      { label: "Incentivos activos", value: operational.incentives || 0 },
    ];
  }, [metrics]);

  if (loading) return <div className="cp-stateCard">Cargando overview...</div>;
  if (error) return <div className="cp-stateCard cp-stateCard-error">{error}</div>;

  const interactions = metrics?.interactions || {};
  const trendingProducts = metrics?.trending?.topProducts || [];
  const activeOperational = metrics?.activeOperational || 0;
  const redemptionRate =
    metrics?.redemptionRate == null ? "-" : `${(metrics.redemptionRate * 100).toFixed(1)}%`;

  return (
    <div className="cp-grid cp-grid--overview">
      <section className="cp-card cp-card--wide">
        <div className="cp-kicker">Panel operativo</div>
        <h3>Ofertas activas e interacciones</h3>
        <div className="cp-kpiGrid">
          <KpiCard
            label="Ofertas operativas"
            value={formatNumber(activeOperational)}
            note="Cupones, promos, Top Deals e incentivos en ventana"
          />
          <KpiCard
            label="Cupones usados"
            value={formatNumber(interactions.couponsUsed)}
            note={`${formatNumber(metrics?.issued)} emitidos - ${redemptionRate}`}
          />
          <KpiCard
            label="Incentivos usados"
            value={formatNumber(interactions.incentivesUsed)}
            note="Recompensas detectadas en ventas"
          />
          <KpiCard
            label="Descuento entregado"
            value={formatMoney(metrics?.discountTotal)}
            note="Solo cupones redimidos"
          />
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Interacciones</div>
        <h3>Mix de uso</h3>
        <InteractionChart items={interactions.mix || []} />
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Operativas ahora</div>
        <h3>Inventario vivo</h3>
        <div className="cp-list">
          {operationalRows.map((item) => (
            <div key={item.label} className="cp-listRow">
              <div>
                <strong>{item.label}</strong>
                <span>Disponibles en este momento</span>
              </div>
              <b>{formatNumber(item.value)}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Trending</div>
        <h3>Productos con mas traccion</h3>
        <div className="cp-list">
          {trendingProducts.map((item) => (
            <div key={item.name} className="cp-listRow">
              <div>
                <strong>{item.name}</strong>
                <span>Unidades vendidas en el periodo</span>
              </div>
              <b>{formatNumber(item.units)}</b>
            </div>
          ))}
          {!trendingProducts.length && <div className="cp-empty">Todavia no hay ventas para calcular trending.</div>}
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Uso de cupones</div>
        <h3>Top codigos</h3>
        <div className="cp-list">
          {(metrics?.byCodeTop || []).map((item) => (
            <div key={item.code} className="cp-listRow">
              <div>
                <strong>{item.code}</strong>
                <span>Redenciones</span>
              </div>
              <b>{formatNumber(item.count)}</b>
            </div>
          ))}
          {!metrics?.byCodeTop?.length && <div className="cp-empty">Sin redenciones registradas.</div>}
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Gallery</div>
        <h3>Pools publicados</h3>
        <div className="cp-list">
          {gallery.slice(0, 6).map((card) => (
            <div key={`${card.type}-${card.key}`} className="cp-listRow">
              <div>
                <strong>{card.title}</strong>
                <span>{card.type}</span>
              </div>
              <b>{card.remaining == null ? "Sin limite" : formatNumber(card.remaining)}</b>
            </div>
          ))}
          {!gallery.length && <div className="cp-empty">No hay cupones publicos aun.</div>}
        </div>
      </section>

      <section className="cp-card cp-card--wide">
        <div className="cp-kicker">Segmentos</div>
        <h3>Penetracion de cupones</h3>
        <div className="cp-kpiGrid">
          {(metrics?.bySegment || []).map((item) => (
            <KpiCard
              key={item.segment}
              label={couponSegmentLabel(item.segment)}
              value={`${Math.round((item.penetration || 0) * 100)}%`}
              note={`${formatNumber(item.count)} usos - ${item.segment}`}
            />
          ))}
          {!metrics?.bySegment?.length && <div className="cp-empty">Todavia no hay datos por segmento.</div>}
        </div>
      </section>
    </div>
  );
}
