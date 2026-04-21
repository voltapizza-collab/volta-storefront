import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import CouponGallery from "../components/CouponGallery/CouponGallery";

export default function CouponGalleryPage() {
  const { partnerSlug } = useParams();
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");

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

  if (error) {
    return (
      <div className="cg-stateShell">
        <div className="cg-stateCard">{error}</div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="cg-stateShell">
        <div className="cg-stateCard">Cargando partner...</div>
      </div>
    );
  }

  return <CouponGallery partner={partner} />;
}
