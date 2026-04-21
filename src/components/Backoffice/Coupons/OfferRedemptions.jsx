import { useEffect, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";
import { couponSegmentLabel } from "../../../constants/coupons";

export default function OfferRedemptions({ partnerId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!partnerId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get(`/api/coupons/redemptions?partnerId=${partnerId}`);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (requestError) {
        console.error(requestError);
        setError("No se pudieron cargar las redenciones.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [partnerId]);

  if (loading) return <div className="cp-stateCard">Cargando redenciones...</div>;
  if (error) return <div className="cp-stateCard cp-stateCard-error">{error}</div>;

  return (
    <section className="cp-card">
      <div className="cp-kicker">Redemptions</div>
      <h3>Ultimas redenciones</h3>

      <div className="cp-tableWrap">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Cliente</th>
              <th>Segmento</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.couponCode}</td>
                <td>{item.customer?.name || item.customer?.phone || "-"}</td>
                <td>{item.customer?.segment ? couponSegmentLabel(item.customer.segment) : "-"}</td>
                <td>{item.redeemedAt ? new Date(item.redeemedAt).toLocaleString("es-ES") : "-"}</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan="4">
                  <div className="cp-empty">Todavia no hay redenciones.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
