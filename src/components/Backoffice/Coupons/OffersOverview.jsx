import { useEffect, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";
import { couponSegmentLabel } from "../../../constants/coupons";

function KpiCard({ label, value }) {
  return (
    <article className="cp-kpiCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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
        setError("No se pudo cargar el overview de cupones.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [partnerId]);

  if (loading) return <div className="cp-stateCard">Cargando overview...</div>;
  if (error) return <div className="cp-stateCard cp-stateCard-error">{error}</div>;

  return (
    <div className="cp-grid">
      <section className="cp-card">
        <div className="cp-kicker">Resumen</div>
        <h3>Rendimiento del modulo</h3>
        <div className="cp-kpiGrid">
          <KpiCard label="Emitidos" value={metrics?.issued || 0} />
          <KpiCard label="Redimidos" value={metrics?.redeemed || 0} />
          <KpiCard
            label="Rate"
            value={metrics?.redemptionRate == null ? "-" : `${(metrics.redemptionRate * 100).toFixed(1)}%`}
          />
          <KpiCard
            label="Descuento"
            value={`€ ${(Number(metrics?.discountTotal || 0)).toFixed(2)}`}
          />
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
              <b>{card.remaining == null ? "∞" : card.remaining}</b>
            </div>
          ))}
          {!gallery.length && <div className="cp-empty">No hay cupones publicos aun.</div>}
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Uso</div>
        <h3>Top codigos</h3>
        <div className="cp-list">
          {(metrics?.byCodeTop || []).map((item) => (
            <div key={item.code} className="cp-listRow">
              <div>
                <strong>{item.code}</strong>
                <span>Redenciones</span>
              </div>
              <b>{item.count}</b>
            </div>
          ))}
          {!metrics?.byCodeTop?.length && <div className="cp-empty">Sin redenciones registradas.</div>}
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Segmentos</div>
        <h3>Penetracion</h3>
        <div className="cp-list">
          {(metrics?.bySegment || []).map((item) => (
            <div key={item.segment} className="cp-listRow">
              <div>
                <strong>{couponSegmentLabel(item.segment)}</strong>
                <span>{item.segment}</span>
              </div>
              <b>{Math.round((item.penetration || 0) * 100)}%</b>
            </div>
          ))}
          {!metrics?.bySegment?.length && <div className="cp-empty">Todavia no hay datos por segmento.</div>}
        </div>
      </section>
    </div>
  );
}
