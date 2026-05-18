import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import OrderPortalTransition from "../components/Storefront/OrderPortalTransition";
import api from "../services/api";
import "../styles/Storefront.css";

const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_KEY || "";
const GOOGLE_PLACES_SCRIPT_ID = "volta-google-places-script";

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatCityName = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const loadGooglePlaces = (apiKey) =>
  new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("Google key missing"));
      return;
    }

    if (window.google?.maps?.places) {
      resolve(window.google);
      return;
    }

    const existingScript = document.getElementById(GOOGLE_PLACES_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_PLACES_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });

export default function PartnerOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { partnerSlug } = useParams();

  const [partner, setPartner] = useState(null);
  const [error, setError] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [serviceMode, setServiceMode] = useState("");
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupCityFilter, setPickupCityFilter] = useState("");
  const [recentStoreSlugs, setRecentStoreSlugs] = useState([]);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAddressLine2, setDeliveryAddressLine2] = useState("");
  const [selectedStoreSlug, setSelectedStoreSlug] = useState("");
  const [deliveryResolution, setDeliveryResolution] = useState(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [isResolvingDelivery, setIsResolvingDelivery] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesMessage, setPlacesMessage] = useState("");
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    setPortalReady(false);
    const timer = window.setTimeout(() => setPortalReady(true), 900);
    return () => window.clearTimeout(timer);
  }, [partnerSlug]);

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

  const pickupHistoryKey = useMemo(
    () => `volta-pickup-stores:${partnerSlug || "partner"}`,
    [partnerSlug]
  );

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(pickupHistoryKey) || "[]");
      setRecentStoreSlugs(Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 3) : []);
    } catch {
      setRecentStoreSlugs([]);
    }
  }, [pickupHistoryKey]);

  const recentPickupStores = useMemo(
    () =>
      recentStoreSlugs
        .map((slug) => stores.find((store) => store.slug === slug))
        .filter(Boolean),
    [recentStoreSlugs, stores]
  );

  const pickupCities = useMemo(() => {
    const seen = new Set();
    return stores
      .map((store) => String(store.city || "").trim())
      .filter(Boolean)
      .filter((city) => {
        const key = normalizeSearchText(city);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => left.localeCompare(right, "es"));
  }, [stores]);

  useEffect(() => {
    if (!pickupModalOpen || !pickupCities.length) return;

    const currentCityStillExists = pickupCities.some(
      (city) => normalizeSearchText(city) === normalizeSearchText(pickupCityFilter)
    );

    if (currentCityStillExists) return;

    const recentCity = recentPickupStores.find((store) => store.city)?.city;
    setPickupCityFilter(recentCity || pickupCities[0]);
  }, [pickupCities, pickupCityFilter, pickupModalOpen, recentPickupStores]);

  const filteredPickupStores = useMemo(() => {
    const cityFilter = normalizeSearchText(pickupCityFilter);

    if (!cityFilter) return stores;

    return stores.filter((store) => {
      const city = normalizeSearchText(store.city);
      return city === cityFilter;
    });
  }, [pickupCityFilter, stores]);

  const pickupReady = serviceMode === "pickup" && Boolean(selectedStoreSlug);
  const deliveryReady =
    serviceMode === "delivery" &&
    Boolean(deliveryAddress.trim()) &&
    Boolean(deliveryResolution?.withinRange) &&
    Boolean(selectedStoreSlug);
  const canContinue = pickupReady || deliveryReady;

  const resetDelivery = useCallback(() => {
    setDeliveryResolution(null);
    setDeliveryError("");
    setSelectedStoreSlug("");
  }, []);

  const rememberPickupStore = useCallback(
    (storeSlug) => {
      if (!storeSlug) return;

      setRecentStoreSlugs((current) => {
        const next = [storeSlug, ...current.filter((slug) => slug !== storeSlug)].slice(0, 3);

        try {
          window.localStorage.setItem(pickupHistoryKey, JSON.stringify(next));
        } catch {
          // Current session state is enough if storage is unavailable.
        }

        return next;
      });
    },
    [pickupHistoryKey]
  );

  const goToPickupStore = useCallback(
    (store) => {
      if (!store?.slug || !partner) return;

      rememberPickupStore(store.slug);
      setSelectedStoreSlug(store.slug);
      setPickupModalOpen(false);

      navigate(`/${partnerSlug}/${store.slug}`, {
        state: {
          orderTrail: "store",
          partnerName: partner.name,
          storeName: store.storeName || store.slug,
          serviceMode: "pickup",
          deliveryAddress: "",
          deliveryAddressLine2: "",
          deliveryResolution: null,
        },
      });
    },
    [navigate, partner, partnerSlug, rememberPickupStore]
  );

  useEffect(() => {
    if (!deliveryModalOpen || serviceMode !== "delivery") return undefined;

    let cancelled = false;
    let listener = null;

    loadGooglePlaces(GOOGLE_KEY)
      .then((google) => {
        if (cancelled || !addressInputRef.current || !google?.maps?.places) return;

        const country = String(partner?.country || "").trim().toLowerCase();
        const options = {
          fields: ["formatted_address", "geometry", "name"],
          types: ["address"],
          ...(country.length === 2 ? { componentRestrictions: { country } } : {}),
        };

        autocompleteRef.current = new google.maps.places.Autocomplete(
          addressInputRef.current,
          options
        );
        listener = autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          const nextAddress =
            place?.formatted_address ||
            addressInputRef.current?.value ||
            "";

          setDeliveryAddress(nextAddress);
          resetDelivery();
        });

        setPlacesReady(true);
        setPlacesMessage("Google Places activo");
      })
      .catch((err) => {
        console.warn("[delivery places] unavailable", err?.message || err);
        setPlacesReady(false);
        setPlacesMessage("Busqueda manual");
      });

    return () => {
      cancelled = true;
      if (listener?.remove) listener.remove();
    };
  }, [deliveryModalOpen, partner?.country, resetDelivery, serviceMode]);

  const resolveDeliveryAddress = async (event) => {
    event?.preventDefault();

    const trimmedAddress = deliveryAddress.trim();
    if (!trimmedAddress) {
      setDeliveryError("Escribe una direccion para revisar cobertura.");
      return;
    }

    if (!deliveryAddressLine2.trim()) {
      setDeliveryError("Indica piso, puerta o casa para completar el envio.");
      return;
    }

    try {
      setIsResolvingDelivery(true);
      setDeliveryError("");

      const resolution = await api.post(
        `/partners/${partnerSlug}/delivery/resolve`,
        { address: trimmedAddress }
      );

      setDeliveryResolution(resolution);

      if (resolution?.withinRange && resolution?.nearestStore?.slug) {
        setSelectedStoreSlug(resolution.nearestStore.slug);
        setDeliveryModalOpen(false);
        navigate(`/${partnerSlug}/${resolution.nearestStore.slug}`, {
          state: {
            orderTrail: "store",
            partnerName: partner?.name,
            storeName: resolution.nearestStore.storeName || resolution.nearestStore.slug,
            serviceMode: "delivery",
            deliveryAddress: trimmedAddress,
            deliveryAddressLine2: deliveryAddressLine2.trim(),
            deliveryResolution: resolution,
          },
        });
      } else {
        setSelectedStoreSlug("");
        setDeliveryError("Esta direccion esta fuera del area de cobertura.");
      }
    } catch (err) {
      console.error(err);
      setDeliveryResolution(null);
      setSelectedStoreSlug("");
      setDeliveryError(
        err?.message || "No pudimos revisar la cobertura en este momento."
      );
    } finally {
      setIsResolvingDelivery(false);
    }
  };

  const continueToMenu = () => {
    if (!canContinue) return;

    navigate(`/${partnerSlug}/${selectedStoreSlug}`, {
      state: {
        orderTrail: "store",
        partnerName: partner.name,
        storeName: selectedStore?.storeName || selectedStoreSlug,
        serviceMode,
        deliveryAddress: deliveryAddress.trim(),
        deliveryAddressLine2: deliveryAddressLine2.trim(),
        deliveryResolution,
      },
    });
  };

  if (error) {
    return (
      <div className="sf-error">
        <div className="sf-errorCard">{error}</div>
      </div>
    );
  }

  if (!partner || !portalReady) {
    return (
      <OrderPortalTransition
        title="Welcome"
        eyebrow="Order here"
        mode="brand"
        partnerName={location.state?.partnerName || partner?.name || partnerSlug}
      />
    );
  }

  return (
    <div className="sf-shell">
      <div className="sf-wrap sf-entry">
        <section className="sf-entryCard sf-entryCard--lean">
          <div className="sf-entryTopbar">
            <button
              type="button"
              className="sf-textBack"
              onClick={() => navigate(`/${partnerSlug}`)}
            >
              {"<- volver"}
            </button>
          </div>

          <div className="sf-entryHeader sf-entryHeader--orderStart">
            <div className="sf-kicker">Pedido online</div>
            <span className="sf-orderBrand">{partner.name}</span>
            <h1 className="sf-entryTitle">Elige como recibirlo</h1>
            <p className="sf-entryLead">
              Resolvemos este paso antes de mostrar el menu para que el pedido
              llegue con la tienda correcta desde el principio.
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
                resetDelivery();
                setPickupModalOpen(true);
              }}
            >
              <span className="sf-serviceMark" aria-hidden="true">01</span>
              <span className="sf-serviceEyebrow">Recoger</span>
              <strong className="sf-serviceTitle">En tienda</strong>
              <span className="sf-serviceBody">
                Elige sucursal y pasa directo al menu.
              </span>
            </button>

            <button
              type="button"
              className={`sf-serviceCard ${
                serviceMode === "delivery" ? "is-active" : ""
              }`}
              onClick={() => {
                setServiceMode("delivery");
                setDeliveryModalOpen(true);
              }}
            >
              <span className="sf-serviceMark" aria-hidden="true">02</span>
              <span className="sf-serviceEyebrow">Domicilio</span>
              <strong className="sf-serviceTitle">Enviar a casa</strong>
              <span className="sf-serviceBody">
                Busca tu direccion con Google y confirma cobertura.
              </span>
            </button>
          </div>

          {serviceMode === "delivery" && (
            <div
              className={`sf-deliveryStatus ${
                deliveryReady ? "is-ready" : deliveryError ? "is-error" : ""
              }`}
            >
              <div>
                <span>{deliveryReady ? "Domicilio listo" : "Domicilio"}</span>
                <strong>
                  {deliveryReady
                    ? deliveryResolution?.formattedAddress || deliveryAddress
                    : deliveryError || "Falta confirmar cobertura"}
                </strong>
                {deliveryReady && deliveryAddressLine2.trim() && (
                  <small>{deliveryAddressLine2.trim()}</small>
                )}
              </div>
              <button
                type="button"
                className="sf-secondaryBtn"
                onClick={() => setDeliveryModalOpen(true)}
              >
                {deliveryReady ? "Cambiar" : "Completar"}
              </button>
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
              onClick={continueToMenu}
            >
                  {canContinue ? "Entrar al menu" : "Elige una opcion"}
            </button>
          </div>
        </section>
      </div>

      {pickupModalOpen && (
        <div className="sf-modalOverlay" onClick={() => setPickupModalOpen(false)}>
          <div
            className="sf-modalCard sf-pickupModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>Recoger</span>
                <h3>Elige una tienda</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={() => setPickupModalOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            {pickupCities.length > 0 && (
              <div className="sf-pickupCityPanel">
                <span>Ciudades disponibles</span>
                <div className="sf-pickupCityRow" aria-label="Ciudades disponibles">
                  {pickupCities.map((city) => {
                    const cityCount = stores.filter(
                      (store) => normalizeSearchText(store.city) === normalizeSearchText(city)
                    ).length;

                    return (
                      <button
                        key={city}
                        type="button"
                        className={
                          normalizeSearchText(pickupCityFilter) === normalizeSearchText(city)
                            ? "is-active"
                            : ""
                        }
                        onClick={() => setPickupCityFilter(city)}
                      >
                        <strong>{formatCityName(city)}</strong>
                        <small>
                          {cityCount} tienda{cityCount === 1 ? "" : "s"} activa
                          {cityCount === 1 ? "" : "s"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="sf-pickupList">
              {filteredPickupStores.length ? (
                filteredPickupStores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    className="sf-pickupStoreOption"
                    onClick={() => goToPickupStore(store)}
                  >
                    <span>
                      {recentStoreSlugs.includes(store.slug) ? "Reciente" : "Disponible"}
                    </span>
                    <strong>{store.storeName}</strong>
                    <small>
                      {store.city ? `${formatCityName(store.city)} - tienda activa` : "Tienda activa"}
                    </small>
                  </button>
                ))
              ) : (
                <div className="sf-pickupEmpty">
                  <strong>No tenemos tiendas en esa ciudad</strong>
                  <span>Prueba con otra ciudad disponible de la lista.</span>
                </div>
              )}
            </div>

            {pickupCities.length > 1 && (
              <p className="sf-pickupHint">
                Elige la ciudad y luego toca la tienda activa donde quieres recoger.
              </p>
            )}
          </div>
        </div>
      )}

      {deliveryModalOpen && (
        <div
          className="sf-modalOverlay"
          onClick={() => !isResolvingDelivery && setDeliveryModalOpen(false)}
        >
          <div
            className="sf-modalCard sf-deliveryModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-cartModalHead">
              <div>
                <span>Domicilio</span>
                <h3>Direccion de entrega</h3>
              </div>
              <button
                type="button"
                className="sf-modalCloseBtn"
                onClick={() => setDeliveryModalOpen(false)}
                disabled={isResolvingDelivery}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <form className="sf-deliveryForm" onSubmit={resolveDeliveryAddress}>
              <label>
                <span>Calle y numero</span>
                <em className={`sf-googlePlaceHint ${placesReady ? "is-ready" : ""}`}>
                  {placesMessage || "Preparando Google Places"}
                </em>
                <input
                  ref={addressInputRef}
                  type="text"
                  value={deliveryAddress}
                  onChange={(event) => {
                    setDeliveryAddress(event.target.value);
                    resetDelivery();
                  }}
                  placeholder="Busca tu direccion"
                  autoComplete="street-address"
                  disabled={isResolvingDelivery}
                />
              </label>

              <label>
                <span>Piso, puerta o casa</span>
                <input
                  type="text"
                  value={deliveryAddressLine2}
                  onChange={(event) => setDeliveryAddressLine2(event.target.value)}
                  placeholder="1B, bajo, casa azul..."
                  autoComplete="address-line2"
                  required
                  disabled={isResolvingDelivery}
                />
              </label>

              {deliveryError && (
                <div className="sf-deliveryCoverage is-error">
                  <strong>{deliveryError}</strong>
                  <span>Puedes cambiar la direccion o elegir recogida.</span>
                </div>
              )}

              {deliveryResolution?.withinRange && !deliveryError && (
                <div className="sf-deliveryCoverage is-ready">
                  <strong>Cobertura disponible</strong>
                  <span>
                    {deliveryResolution.deliveryFee != null
                      ? `Envio EUR ${Number(deliveryResolution.deliveryFee).toFixed(2)}`
                      : "Direccion dentro del area de reparto."}
                  </span>
                </div>
              )}

              <div className="sf-deliveryModalActions">
                <button
                  type="button"
                  className="sf-secondaryBtn"
                  onClick={() => {
                    setServiceMode("pickup");
                    setDeliveryModalOpen(false);
                    resetDelivery();
                  }}
                  disabled={isResolvingDelivery}
                >
                  Recoger
                </button>
                <button
                  type="submit"
                  className="sf-primaryBtn"
                  disabled={isResolvingDelivery}
                >
                  {isResolvingDelivery ? "Revisando..." : "Confirmar direccion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
