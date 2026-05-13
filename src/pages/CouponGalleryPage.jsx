import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import CouponGallery from "../components/CouponGallery/CouponGallery";
import "../styles/CouponGallery.css";

function CouponPortalTransition({ partnerSlug }) {
  const lanes = [-22, -17, -12, -7, 7, 12, 17, 22];

  return (
    <main className="cg-transitionShell" aria-live="polite">
      <div className="cg-transitionSparkle" />
      <section className="cg-transitionStage" aria-label="Entrando al salon de cupones">
        <div className="cg-transitionTunnel" aria-hidden="true">
          {lanes.map((angle, index) => (
            <span
              key={angle}
              className="cg-transitionLane"
              style={{
                "--cg-lane-angle": `${angle}deg`,
                "--cg-lane-delay": `${index * 0.08}s`,
              }}
            />
          ))}
        </div>

        <div className="cg-transitionGate">
          <div className="cg-transitionGateCore">
            <span className="cg-transitionGateRing" />
            <span className="cg-transitionGateRing cg-transitionGateRing-2" />
            <span className="cg-transitionGateRing cg-transitionGateRing-3" />
            <div className="cg-transitionBadge">VOLTA COUPONS</div>
          </div>
        </div>

        <div className="cg-transitionPanel">
          <p>Activando cupones</p>
          <h1>Preparando tu pase</h1>
          <div className="cg-transitionSteps">
            <span>Zona</span>
            <span>Premios</span>
            <span>{partnerSlug || "Partner"}</span>
          </div>
          <div className="cg-transitionProgress" aria-hidden="true">
            <span />
          </div>
        </div>
      </section>
    </main>
  );
}

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
    return <CouponPortalTransition partnerSlug={partnerSlug} />;
  }

  return <CouponGallery partner={partner} />;
}
