import { useNavigate } from "react-router-dom";
import "../styles/Storefront.css";

export default function StoreGate({ store }) {
  const navigate = useNavigate();

  const handleOrder = () => {
    navigate(`/${store.partner.slug}/${store.slug}/menu`, {
      state: {
        orderTrail: "menu",
        partnerName: store.partner?.name || store.partner?.slug,
        storeName: store.storeName,
      },
    });
  };

  return (
    <div className="sf-shell">
      <div className="sf-wrap sf-gate">
        <div className="sf-gateCard">
          <h1 className="sf-gateTitle">{store.storeName}</h1>

          <p className="sf-gateMeta">
            {store.city || ""} {store.city ? "," : ""} {store.partner?.country || ""}
          </p>

          <button className="sf-gateButton" onClick={handleOrder}>
            Order Here
          </button>
        </div>
      </div>
    </div>
  );
}
