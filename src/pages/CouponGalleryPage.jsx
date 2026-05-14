import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import CouponGallery from "../components/CouponGallery/CouponGallery";
import CouponPortalTransition from "../components/CouponGallery/CouponPortalTransition";
import "../styles/CouponGallery.css";

export default function CouponGalleryPage() {
  const { partnerSlug } = useParams();
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(false);
    const timer = window.setTimeout(() => setPortalReady(true), 1250);
    return () => window.clearTimeout(timer);
  }, [partnerSlug]);

  useEffect(() => {
    if (!partnerSlug) return;

    const loadPartner = async () => {
      try {
        const data = await api.get(`/partners/${partnerSlug}`);
        setPartner(data);
      } catch (requestError) {
        console.error(requestError);
        setError("No se pudo cargar la galeria.");
      }
    };

    loadPartner();
  }, [partnerSlug]);

  if (error && portalReady) {
    return (
      <div className="cg-stateShell">
        <div className="cg-stateCard">{error}</div>
      </div>
    );
  }

  if (!partner || !portalReady) {
    return <CouponPortalTransition steps={["Zona", "Premios", partnerSlug || "Partner"]} />;
  }

  return <CouponGallery partner={partner} />;
}
