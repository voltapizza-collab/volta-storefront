import OffersOverview from "./OffersOverview";
import OfferCreatePanel from "./OfferCreatePanel";
import OfferRedemptions from "./OfferRedemptions";
import PromosPanel from "./PromosPanel";
import DirectDiscountsPanel from "./DirectDiscountsPanel";
import IncentivesPanel from "./IncentivesPanel";
import "../../../styles/CouponsModule.css";

export default function CouponsModule({ partner, initialView = "overview" }) {
  const partnerId = partner?.partnerId;
  const activeView = initialView;

  return (
    <section className="cp-shell">
      <div className="cp-panel">
        <div className="cp-head">
          <div>
            <div className="cp-kicker">Coupons</div>
            <h2>Gestion de ofertas y cupones</h2>
            <p>Desde aqui se crean cupones, promos, Top Deals e incentivos.</p>
          </div>
        </div>

        {activeView === "overview" && <OffersOverview partnerId={partnerId} />}
        {activeView === "create" && <OfferCreatePanel partnerId={partnerId} />}
        {activeView === "promos" && <PromosPanel partnerId={partnerId} />}
        {activeView === "directDiscounts" && <DirectDiscountsPanel partnerId={partnerId} />}
        {activeView === "incentives" && <IncentivesPanel partnerId={partnerId} />}
        {activeView === "redemptions" && <OfferRedemptions partnerId={partnerId} />}
      </div>
    </section>
  );
}
