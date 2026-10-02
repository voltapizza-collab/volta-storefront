import { useNavigate } from "react-router-dom";
import PartnerLogo from "./PartnerLogo";
import "../styles/Storefront.css";

export default function StoreGate({ partner: suppliedPartner, store, loading = false, error = "" }) {
  const navigate = useNavigate();
  const partner = suppliedPartner || store?.partner;
  const name = partner?.name || store?.storeName || partner?.slug || "Pizzería";
  const canOrder = Boolean(partner?.slug && !loading && !error);

  const handleOrder = () => {
    if (!canOrder) return;
    navigate(store ? `/${partner.slug}/${store.slug}/menu` : `/${partner.slug}/order`, {
      state: {
        orderTrail: store ? "menu" : "landing",
        partnerName: name,
        ...(store ? { storeName: store.storeName } : {}),
      },
    });
  };

  return (
    <main className="mcp-landing" aria-label={name} aria-busy={loading}>
      <section className="mcp-landing__stage">
        <div className="mcp-logoStage">
          {loading ? (
            <p className="sf-storeGateStatus" role="status">Cargando pizzería…</p>
          ) : error ? (
            <p className="sf-storeGateStatus" role="alert">{error}</p>
          ) : (
            <PartnerLogo
              src={partner?.brandLogoUrl}
              name={name}
              className="mcp-logo mcp-logo--base"
              fallback={<h1 className="sf-storeGateName">{name}</h1>}
            />
          )}
        </div>
        <button type="button" className="mcp-orderButton" onClick={handleOrder}
          disabled={!canOrder} aria-label={`Pedir en línea - ${name}`}>
          Pedir en línea
        </button>
      </section>
    </main>
  );
}
