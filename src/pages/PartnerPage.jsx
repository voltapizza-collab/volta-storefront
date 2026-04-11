import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/Storefront.css";

export default function PartnerPage() {
  const navigate = useNavigate();
  const { partnerSlug } = useParams();
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!partnerSlug) return;

    const loadPartner = async () => {
      try {
        const data = await api.get(`/partners/${partnerSlug}`);
        setPartner(data);
      } catch (err) {
        console.error(err);
        setError("Partner not found");
      }
    };

    loadPartner();
  }, [partnerSlug]);

  if (error) {
    return (
      <div className="sf-error">
        <div className="sf-errorCard">{error}</div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="sf-loading">
        <div className="sf-loadingCard">Loading brand...</div>
      </div>
    );
  }

  return (
    <div className="sf-shell">
      <div className="sf-wrap sf-gate">
        <div className="sf-gateCard">
          <div className="sf-kicker">Partner Landing</div>
          <h1 className="sf-gateTitle">{partner.name}</h1>

          <p className="sf-gateMeta">
            {partner.country || ""} · {partner.stores?.length || 0} tiendas activas
          </p>

          <button
            className="sf-gateButton"
            onClick={() => navigate(`/${partner.slug}/order`)}
          >
            Order Here
          </button>
        </div>
      </div>
    </div>
  );
}
