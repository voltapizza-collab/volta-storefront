import { useMemo, useState } from "react";
import OffersOverview from "./OffersOverview";
import OfferCreatePanel from "./OfferCreatePanel";
import OfferRedemptions from "./OfferRedemptions";
import "../../../styles/CouponsModule.css";

const creatorTabs = [
  { key: "create", label: "Crear ofertas" },
  { key: "redemptions", label: "Redenciones" },
];

export default function CouponsModule({ partner, initialView = "overview" }) {
  const [activeTab, setActiveTab] = useState(initialView);
  const partnerId = partner?.partnerId;

  const activeView = useMemo(() => activeTab, [activeTab]);

  return (
    <section className="cp-shell">
      <div className="cp-panel">
        <div className="cp-head">
          <div>
            <div className="cp-kicker">Coupons</div>
            <h2>Gestion de ofertas y cupones</h2>
            <p>Desde aqui se crean ofertas publicas para CouponGallery y envios privados para clientes o grupos.</p>
          </div>

          {activeView !== "overview" && (
            <div className="cp-tabRow">
              {creatorTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`cp-tabBtn ${activeView === tab.key ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeView === "overview" && <OffersOverview partnerId={partnerId} />}
        {activeView === "create" && <OfferCreatePanel partnerId={partnerId} />}
        {activeView === "redemptions" && <OfferRedemptions partnerId={partnerId} />}
      </div>
    </section>
  );
}
