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
  const [deliveryResolution, setDeliveryResolution] = useState(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [isResolvingDelivery, setIsResolvingDelivery] = useState(false);

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
    (serviceMode !== "delivery" ||
      (addressStepReady && deliveryResolution?.withinRange));

  useEffect(() => {
    if (serviceMode !== "delivery") {
      setDeliveryResolution(null);
      setDeliveryError("");
      setIsResolvingDelivery(false);
      return;
    }

    const trimmedAddress = deliveryAddress.trim();

    if (!trimmedAddress) {
      setSelectedStoreSlug("");
      setDeliveryResolution(null);
      setDeliveryError("");
      setIsResolvingDelivery(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsResolvingDelivery(true);
        setDeliveryError("");

        const resolution = await api.post(
          `/partners/${partnerSlug}/delivery/resolve`,
          { address: trimmedAddress }
        );

        setDeliveryResolution(resolution);
        setSelectedStoreSlug(resolution?.nearestStore?.slug || "");
      } catch (err) {
        console.error(err);
        setDeliveryResolution(null);
        setSelectedStoreSlug("");
        setDeliveryError(
          err?.message || "No pudimos validar la direccion en este momento."
        );
      } finally {
        setIsResolvingDelivery(false);
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [deliveryAddress, partnerSlug, serviceMode]);

  const deliverySummary = useMemo(() => {
    if (!partner) return "";

    if (partner.deliveryPricingMode === "VARIABLE") {
      const base = Number(partner.deliveryFeeBase || 2);
      const baseKm = Number(partner.deliveryBaseKm || 5);
      const extra = Number(partner.deliveryExtraPerKm || 1);

      return `Base EUR ${base.toFixed(2)} hasta ${baseKm.toFixed(
        0
      )} km y EUR ${extra.toFixed(2)} por km extra`;
    }

    if (partner.deliveryFeeFixed != null) {
      return `Precio fijo EUR ${Number(partner.deliveryFeeFixed).toFixed(
        2
      )} cada ${Number(partner.deliveryFeeBlockSize || 5)} pizzas`;
    }

    return "Precio delivery pendiente de configurar";
  }, [partner]);

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
              onClick={() => {
                setServiceMode("pickup");
                setDeliveryResolution(null);
                setDeliveryError("");
              }}
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
              onClick={() => {
                setServiceMode("delivery");
                setSelectedStoreSlug("");
              }}
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
              ) : isResolvingDelivery ? (
                <p className="sf-inlineText">
                  Validando direccion y calculando la tienda mas cercana...
                </p>
              ) : deliveryError ? (
                <div className="sf-inlineStat">
                  <span className="sf-inlineLabel">Direccion no validada</span>
                  <strong className="sf-inlineValue">{deliveryAddress}</strong>
                  <span className="sf-inlineText">{deliveryError}</span>
                </div>
              ) : (
                <div className="sf-inlineStat sf-inlineStat--success">
                  <span className="sf-inlineLabel">Direccion capturada</span>
                  <strong className="sf-inlineValue">
                    {deliveryResolution?.formattedAddress || deliveryAddress}
                  </strong>
                  <span className="sf-inlineText">
                    {deliveryResolution?.coords
                      ? `Coordenadas detectadas: ${deliveryResolution.coords.lat.toFixed(
                          5
                        )}, ${deliveryResolution.coords.lng.toFixed(5)}`
                      : "Direccion pendiente de geocodificacion."}
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

            </div>
          )}

          {!!stores.length &&
            serviceMode === "delivery" &&
            addressStepReady &&
            !isResolvingDelivery && (
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

              {selectedStore && deliveryResolution ? (
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
                    {partner.deliveryRadiusKm != null
                      ? `Km maximos ${Number(partner.deliveryRadiusKm).toFixed(1)} km.`
                      : "Km maximos pendientes."}
                  </span>
                  <span className="sf-inlineText">
                    Distancia estimada {deliveryResolution.nearestStore.distanceKm.toFixed(
                      2
                    )} km. {deliverySummary}.
                  </span>
                </div>
              ) : deliveryResolution && !deliveryResolution.withinRange ? (
                <div className="sf-inlineStat">
                  <span className="sf-inlineLabel">Fuera de zona</span>
                  <strong className="sf-inlineValue">
                    {deliveryResolution.nearestStore?.storeName || "Sin tienda"}
                  </strong>
                  <span className="sf-inlineText">
                    La direccion supera el radio maximo de entrega.
                  </span>
                </div>
              ) : (
                <p className="sf-inlineText">
                  No hay una tienda disponible para asignar este pedido a domicilio.
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
