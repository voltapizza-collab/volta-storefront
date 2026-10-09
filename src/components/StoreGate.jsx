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
    const availableStores = (partner.stores || []).filter(
      (candidate) => candidate.active !== false && candidate.acceptingOrders !== false &&
        (candidate.pickupEnabled !== false || candidate.deliveryEnabled !== false)
    );
    const targetStore = store || (availableStores.length === 1 ? availableStores[0] : null);
    const deliveryOnly = targetStore?.pickupEnabled === false && targetStore?.deliveryEnabled !== false;
    const directPickup = targetStore?.slug && !deliveryOnly;
    if (directPickup) {
      try { window.sessionStorage.removeItem("volta_storefront_delivery_selection"); } catch {}
    }
    navigate(directPickup ? `/${partner.slug}/${targetStore.slug}` : `/${partner.slug}/order`, {
      state: {
        orderTrail: directPickup ? "store" : "landing",
        partnerName: name,
        ...(directPickup ? {
          storeName: targetStore.storeName, serviceMode: "pickup",
          deliveryAddress: "", deliveryAddressLine2: "", deliveryResolution: null,
        } : {}),
        ...(deliveryOnly ? { startServiceMode: "delivery" } : {}),
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
