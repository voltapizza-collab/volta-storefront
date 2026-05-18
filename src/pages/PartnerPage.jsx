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
        <div className="sf-loadingCard">Cargando partner...</div>
      </div>
    );
  }

  return (
    <div className="sf-shell sf-shell--partnerGate">
      <div className="sf-wrap sf-gate sf-gate--buttonOnly">
        <button
          type="button"
          className="sf-partnerOrderButton"
          onClick={() =>
            navigate(`/${partner.slug}/order`, {
              state: { orderTrail: "landing", partnerName: partner.name },
            })
          }
          aria-label={`Order Here - ${partner.name}`}
        >
          <span className="sf-partnerOrderButton__label">Order Here</span>
          <span className="sf-partnerOrderButton__pulse" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
