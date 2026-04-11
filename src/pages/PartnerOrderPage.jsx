import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/Storefront.css";

export default function PartnerOrderPage() {
  const navigate = useNavigate();
  const { partnerSlug } = useParams();

  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [serviceMode, setServiceMode] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedStoreSlug, setSelectedStoreSlug] = useState("");

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

  const stores = useMemo(() => {
    return Array.isArray(partner?.stores)
      ? partner.stores.filter((store) => store?.active !== false)
      : [];
  }, [partner]);

  const selectedStore = useMemo(() => {
    return stores.find((store) => store.slug === selectedStoreSlug) || null;
  }, [stores, selectedStoreSlug]);

  const storeStepReady = !!selectedStoreSlug;
  const addressStepReady =
    serviceMode !== "delivery" || !!deliveryAddress.trim();

  const canContinue =
    !!serviceMode &&
    storeStepReady &&
    (serviceMode !== "delivery" || addressStepReady);

  useEffect(() => {
    if (!stores.length) return;

    if (serviceMode === "delivery") {
      setSelectedStoreSlug((current) => current || stores[0].slug);
    }
  }, [serviceMode, stores]);

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
        <div className="sf-loadingCard">Loading order flow...</div>
      </div>
    );
  }

  return (
    <div className="sf-shell">
      <div className="sf-wrap sf-entry">
        <section className="sf-entryCard">
          <div className="sf-entryTopbar">
            <button
              type="button"
              className="sf-textBack"
              onClick={() => navigate(`/${partnerSlug}`)}
            >
              {"<- volver"}
            </button>
          </div>

          <div className="sf-entryHeader">
            <div className="sf-kicker">Inicio de compra</div>
            <h1 className="sf-entryTitle">{partner.name}</h1>
            <p className="sf-entryLead">
              Primero definimos como quieres recibir el pedido y que tienda va a
              atenderlo. Despues si entramos al menu de esa sucursal.
            </p>
          </div>

          <div className="sf-serviceSplit">
            <button
              type="button"
              className={`sf-serviceCard ${
                serviceMode === "pickup" ? "is-active" : ""
              }`}
              onClick={() => setServiceMode("pickup")}
            >
              <span className="sf-serviceEyebrow">Recoger</span>
              <strong className="sf-serviceTitle">Voy por mi pedido</strong>
              <span className="sf-serviceBody">
                Elige una tienda activa y entra directo al menu de esa sucursal.
              </span>
            </button>

            <button
              type="button"
              className={`sf-serviceCard ${
                serviceMode === "delivery" ? "is-active" : ""
              }`}
              onClick={() => setServiceMode("delivery")}
            >
              <span className="sf-serviceEyebrow">Domicilio</span>
              <strong className="sf-serviceTitle">Quiero envio</strong>
              <span className="sf-serviceBody">
                Capturamos una direccion base y fijamos la tienda antes de
                comprar.
              </span>
            </button>
          </div>

          {serviceMode === "delivery" && (
            <div
              className={`sf-modePanel sf-stepPanel ${
                addressStepReady ? "is-complete" : "is-pending"
              }`}
            >
              <div className="sf-stepHead">
                <div>
                  <div className="sf-stepTag">Paso 1</div>
                  <div className="sf-fieldLabel">Direccion de referencia</div>
                </div>
                <span className={`sf-stepState ${addressStepReady ? "is-on" : ""}`}>
                  {addressStepReady ? "Lista" : "Pendiente"}
                </span>
              </div>

              <label className="sf-fieldLabel" htmlFor="partner-delivery-address">
                Escribela como punto de partida
              </label>
              <input
                id="partner-delivery-address"
                className="sf-input"
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Calle, numero, portal..."
              />

              {!addressStepReady ? (
                <p className="sf-inlineText">
                  Completa esta direccion para desbloquear claramente el
                  siguiente paso.
                </p>
              ) : (
                <div className="sf-inlineStat sf-inlineStat--success">
                  <span className="sf-inlineLabel">Direccion capturada</span>
                  <strong className="sf-inlineValue">{deliveryAddress}</strong>
                  <span className="sf-inlineText">
                    Aqui luego conectaremos Google Places para autocompletado y
                    validacion real de zona.
                  </span>
                </div>
              )}
            </div>
          )}

          {!!stores.length && serviceMode === "pickup" && (
            <div
              className={`sf-modePanel sf-stepPanel ${
                storeStepReady ? "is-complete" : "is-pending"
              }`}
            >
              <div className="sf-stepHead">
                <div>
                  <div className="sf-stepTag">
                    {serviceMode === "delivery" ? "Paso 2" : "Paso 1"}
                  </div>
                  <div className="sf-fieldLabel">Selecciona tienda</div>
                </div>
                <span className={`sf-stepState ${storeStepReady ? "is-on" : ""}`}>
                  {storeStepReady ? "Elegida" : "Pendiente"}
                </span>
              </div>

              <div className="sf-storeGrid">
                {stores.map((store) => {
                  const isSelected = store.slug === selectedStoreSlug;

                  return (
                    <button
                      key={store.id}
                      type="button"
                      className={`sf-storeCard ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedStoreSlug(store.slug)}
                    >
                      <span className="sf-storeCardKicker">Tienda activa</span>
                      <strong className="sf-storeCardTitle">{store.storeName}</strong>
                      <span className="sf-storeCardMeta">
                        {store.city || "Sin ciudad"}
                        {partner.country ? `, ${partner.country}` : ""}
                      </span>
                      <span className="sf-storeCardState">
                        {isSelected
                          ? "Esta es la tienda elegida"
                          : "Tocar para elegir"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedStore && (
                <div className="sf-inlineStat">
                  <span className="sf-inlineLabel">Tienda elegida</span>
                  <strong className="sf-inlineValue">{selectedStore.storeName}</strong>
                  <span className="sf-inlineText">
                    {selectedStore.city || ""}
                    {selectedStore.city ? "," : ""}
                    {" "}
                    {partner.country || ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {!!stores.length && serviceMode === "delivery" && (
            <div
              className={`sf-modePanel sf-stepPanel ${
                canContinue ? "is-complete" : "is-pending"
              }`}
            >
              <div className="sf-stepHead">
                <div>
                  <div className="sf-stepTag">Tienda automatica</div>
                  <div className="sf-fieldLabel">Sucursal asignada</div>
                </div>
                <span className={`sf-stepState ${selectedStore ? "is-on" : ""}`}>
                  {selectedStore ? "Resuelta" : "Buscando"}
                </span>
              </div>

              {selectedStore ? (
                <div className="sf-inlineStat sf-inlineStat--success">
                  <span className="sf-inlineLabel">Tienda asignada</span>
                  <strong className="sf-inlineValue">{selectedStore.storeName}</strong>
                  <span className="sf-inlineText">
                    {selectedStore.city || ""}
                    {selectedStore.city ? "," : ""}
                    {" "}
                    {partner.country || ""}
                  </span>
                  <span className="sf-inlineText">
                    En esta fase la tienda se asigna automaticamente para evitar
                    conflicto entre delivery y seleccion manual. El siguiente
                    paso sera resolver la mas cercana habilitada para domicilio.
                  </span>
                </div>
              ) : (
                <p className="sf-inlineText">
                  Esperando una tienda disponible para asignar el delivery.
                </p>
              )}
            </div>
          )}

          <div className="sf-entryActions">
            <button
              type="button"
              className="sf-secondaryBtn"
              onClick={() => navigate(`/${partnerSlug}`)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="sf-primaryBtn"
              disabled={!canContinue}
              onClick={() => navigate(`/${partnerSlug}/${selectedStoreSlug}`)}
            >
              {canContinue
                ? "Entrar al menu de esta tienda"
                : "Completa los pasos para continuar"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
