import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import myCrushLogo from "../assets/logo/mycrushpizza-say-no-more-transparent.png";
import api from "../services/api";
import "../styles/Storefront.css";
import { buildPartnerSeo, usePublicSeo } from "../utils/seo";

const MY_CRUSH_SLUG = "mycrushpizza";

export default function PartnerPage() {
  const navigate = useNavigate();
  const { partnerSlug } = useParams();
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const normalizedPartnerSlug = String(partnerSlug || "").toLowerCase();
  const isMyCrushLanding = normalizedPartnerSlug === MY_CRUSH_SLUG;
  const partnerSeo = useMemo(() => {
    const seoPartner = isMyCrushLanding
      ? { name: "MyCrushPizza", slug: MY_CRUSH_SLUG }
      : partner;

    return buildPartnerSeo({ partner: seoPartner, partnerSlug });
  }, [isMyCrushLanding, partner, partnerSlug]);

  usePublicSeo(partnerSeo);

  useEffect(() => {
    if (!partnerSlug || isMyCrushLanding) return;

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
  }, [isMyCrushLanding, partnerSlug]);

  if (isMyCrushLanding) {
    return (
      <main className="mcp-landing" aria-label="MyCrushPizza">
        <section className="mcp-landing__stage">
          <div className="mcp-logoStage" aria-label="MyCrushPizza Say No More">
            <img
              className="mcp-logo mcp-logo--base"
              src={myCrushLogo}
              alt="My Crush Pizza - Say No More"
            />
          </div>

          <button
            type="button"
            className="mcp-orderButton"
            onClick={() =>
              navigate(`/${MY_CRUSH_SLUG}/order`, {
                state: { orderTrail: "landing", partnerName: "MyCrushPizza" },
              })
            }
            aria-label="Pedir en linea - MyCrushPizza"
          >
            Pedir en linea
          </button>
        </section>
      </main>
    );
  }

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
