import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import OrderPortalTransition from "../components/Storefront/OrderPortalTransition";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import api from "../services/api";
import "../styles/Storefront.css";
import { buildPartnerSeo, usePublicSeo } from "../utils/seo";

const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_KEY || "";
const GOOGLE_PLACES_SCRIPT_ID = "volta-google-places-script";
const DELIVERY_SELECTION_KEY = "volta_storefront_delivery_selection";

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

const rememberDeliverySelection = (selection) => {
  try {
    window.sessionStorage.setItem(DELIVERY_SELECTION_KEY, JSON.stringify(selection));
  } catch {
    // The navigation state still carries the same payload during normal SPA flow.
  }
};

const storeAllowsPickup = (store) => store?.pickupEnabled !== false;
const storeAllowsDelivery = (store) => store?.deliveryEnabled !== false;

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
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [deliveryFormattedAddress, setDeliveryFormattedAddress] = useState("");
  const [selectedStoreSlug, setSelectedStoreSlug] = useState("");
  const [deliveryResolution, setDeliveryResolution] = useState(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [deliveryLine2Invalid, setDeliveryLine2Invalid] = useState(false);
  const [isResolvingDelivery, setIsResolvingDelivery] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesMessage, setPlacesMessage] = useState("");
  const addressInputRef = useRef(null);
  const addressLine2InputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const partnerSeo = useMemo(
    () => buildPartnerSeo({ partner, partnerSlug }),
    [partner, partnerSlug]
  );

  usePublicSeo(partnerSeo);

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

  const activeStores = useMemo(() => {
    return Array.isArray(partner?.stores)
      ? partner.stores.filter((store) => store?.active !== false)
      : [];
  }, [partner]);

  const stores = useMemo(() => {
    return activeStores;
  }, [activeStores]);

  const pickupStores = useMemo(
    () => stores.filter(storeAllowsPickup),
    [stores]
  );
  const deliveryStores = useMemo(
    () => stores.filter(storeAllowsDelivery),
    [stores]
  );
  const pickupAvailable = pickupStores.length > 0;
  const deliveryAvailable = deliveryStores.length > 0;
  const isStorefrontClosed = !pickupAvailable && !deliveryAvailable;
  const singleServiceMode =
    !isStorefrontClosed && pickupAvailable !== deliveryAvailable
      ? deliveryAvailable
        ? "delivery"
        : "pickup"
      : "";

  const selectedStore = useMemo(() => {
    return stores.find((store) => store.slug === selectedStoreSlug) || null;
  }, [stores, selectedStoreSlug]);

  const singlePickupStore = pickupStores.length === 1 ? pickupStores[0] : null;

  useEffect(() => {
    if (!isStorefrontClosed) return;

    setPickupModalOpen(false);
    setDeliveryModalOpen(false);
    setSelectedStoreSlug("");
    setServiceMode("");
  }, [isStorefrontClosed]);

  useEffect(() => {
    if (!selectedStoreSlug) return;
    if (stores.some((store) => store.slug === selectedStoreSlug)) return;

    setSelectedStoreSlug("");
  }, [selectedStoreSlug, stores]);

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
        .filter(storeAllowsPickup)
        .filter(Boolean),
    [recentStoreSlugs, stores]
  );

  const pickupCities = useMemo(() => {
    const seen = new Set();
    return pickupStores
      .map((store) => String(store.city || "").trim())
      .filter(Boolean)
      .filter((city) => {
        const key = normalizeSearchText(city);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => left.localeCompare(right, "es"));
  }, [pickupStores]);

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

    if (!cityFilter) return pickupStores;

    return pickupStores.filter((store) => {
      const city = normalizeSearchText(store.city);
      return city === cityFilter;
    });
  }, [pickupCityFilter, pickupStores]);

  const closedCopy = useMemo(() => {
    if (activeStores.length === 0) {
      return {
        title: "Cerrado",
        body: "No hay tiendas activas para recibir pedidos ahora.",
      };
    }

    return {
      title: "Cerrado",
      body: "No hay tiendas disponibles para recibir pedidos ahora.",
    };
  }, [activeStores]);

  const singleServiceCopy = useMemo(() => {
    if (singleServiceMode === "delivery") {
      return {
        eyebrow: "Solo delivery",
        title: "Esta pizzeria solo hace delivery",
        body: "Confirma tu direccion para revisar cobertura y entrar al menu.",
        action: "Continuar",
      };
    }

    if (singleServiceMode === "pickup") {
      return {
        eyebrow: "Solo recogida",
        title: "Esta pizzeria solo trabaja con recogida",
        body: "Elige la tienda donde quieres recoger tu pedido.",
        action: "Continuar",
      };
    }

    return null;
  }, [singleServiceMode]);

  useEffect(() => {
    if (location.state?.startServiceMode !== "delivery") return;
    if (singleServiceMode !== "delivery" || serviceMode) return;

    setServiceMode("delivery");
    setDeliveryModalOpen(true);
  }, [location.state, serviceMode, singleServiceMode]);

  const pickupReady = pickupAvailable && serviceMode === "pickup" && Boolean(selectedStoreSlug);
  const deliveryReady =
    deliveryAvailable &&
    serviceMode === "delivery" &&
    Boolean(deliveryAddress.trim()) &&
    Boolean(deliveryResolution?.withinRange) &&
    Boolean(selectedStoreSlug);
  const canContinue = pickupReady || deliveryReady;

  const resetDelivery = useCallback(() => {
    setDeliveryResolution(null);
    setDeliveryError("");
    setDeliveryLine2Invalid(false);
    setDeliveryCoords(null);
    setDeliveryFormattedAddress("");
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
      try {
        window.sessionStorage.removeItem(DELIVERY_SELECTION_KEY);
      } catch {
        // Pickup should never reuse a previous delivery selection.
      }

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

  const continueSingleService = useCallback(() => {
    if (singleServiceMode === "delivery") {
      setServiceMode("delivery");
      setDeliveryModalOpen(true);
      return;
    }

    if (singleServiceMode === "pickup") {
      setServiceMode("pickup");
      resetDelivery();
      if (singlePickupStore) {
        goToPickupStore(singlePickupStore);
        return;
      }
      setPickupModalOpen(true);
    }
  }, [goToPickupStore, resetDelivery, singlePickupStore, singleServiceMode]);

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
          const location = place?.geometry?.location;
          const nextCoords =
            typeof location?.lat === "function" && typeof location?.lng === "function"
              ? { lat: location.lat(), lng: location.lng() }
              : null;

          setDeliveryAddress(nextAddress);
          resetDelivery();
          setDeliveryCoords(nextCoords);
          setDeliveryFormattedAddress(nextAddress);
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
      setDeliveryLine2Invalid(false);
      window.requestAnimationFrame(() => {
        setDeliveryLine2Invalid(true);
        addressLine2InputRef.current?.focus();
      });
      return;
    }

    try {
      setIsResolvingDelivery(true);
      setDeliveryError("");

      const resolution = await api.post(
        `/partners/${partnerSlug}/delivery/resolve`,
        {
          address: trimmedAddress,
          coords: deliveryCoords,
          formattedAddress: deliveryFormattedAddress || trimmedAddress,
        }
      );

      setDeliveryResolution(resolution);

      if (resolution?.withinRange && resolution?.nearestStore?.slug) {
        const selection = {
          partnerSlug,
          storeSlug: resolution.nearestStore.slug,
          serviceMode: "delivery",
          deliveryAddress: trimmedAddress,
          deliveryAddressLine2: deliveryAddressLine2.trim(),
          deliveryResolution: resolution,
        };

        setSelectedStoreSlug(resolution.nearestStore.slug);
        setDeliveryModalOpen(false);
        rememberDeliverySelection(selection);
        navigate(`/${partnerSlug}/${resolution.nearestStore.slug}`, {
          state: {
            orderTrail: "store",
            partnerName: partner?.name,
            storeName: resolution.nearestStore.storeName || resolution.nearestStore.slug,
            ...selection,
          },
        });
      } else {
        setSelectedStoreSlug("");
        setDeliveryError(
          resolution?.coverageDistanceAvailable === false
            ? "No pudimos confirmar la ruta de reparto para esta direccion."
            : "Esta direccion esta fuera del area de cobertura."
        );
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

    const selection = {
      partnerSlug,
      storeSlug: selectedStoreSlug,
      serviceMode,
      deliveryAddress: serviceMode === "delivery" ? deliveryAddress.trim() : "",
      deliveryAddressLine2: serviceMode === "delivery" ? deliveryAddressLine2.trim() : "",
      deliveryResolution: serviceMode === "delivery" ? deliveryResolution : null,
    };

    if (serviceMode === "delivery") {
      rememberDeliverySelection(selection);
    } else {
      try {
        window.sessionStorage.removeItem(DELIVERY_SELECTION_KEY);
      } catch {
        // Pickup does not need persisted delivery state.
      }
    }

    navigate(`/${partnerSlug}/${selectedStoreSlug}`, {
      state: {
        orderTrail: "store",
        partnerName: partner.name,
        storeName: selectedStore?.storeName || selectedStoreSlug,
        ...selection,
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
        <section className={`sf-entryCard sf-entryCard--lean ${isStorefrontClosed ? "is-closedOnly" : ""}`}>
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
            {!isStorefrontClosed && (
              <h1 className="sf-entryTitle">
                {singleServiceMode ? "Metodo disponible" : "Elige como recibirlo"}
              </h1>
            )}
          </div>

          {isStorefrontClosed ? (
            <div className="sf-closedNotice" role="status">
              <div className="sf-closedNotice__pizzaWrap" aria-hidden="true">
                <PizzaBg className="sf-closedNotice__pizza" />
              </div>
              <div className="sf-closedNotice__copy">
                <strong>{closedCopy.title}</strong>
                <small>{closedCopy.body}</small>
              </div>
              <button
                type="button"
                className="sf-closedNotice__action"
                onClick={() => navigate(`/${partnerSlug}`)}
              >
                Volver al inicio
              </button>
            </div>
          ) : (
            <>
              <div className={`sf-serviceSplit ${pickupAvailable !== deliveryAvailable ? "sf-serviceSplit--single" : ""}`}>
                {pickupAvailable && (
                  <button
                    type="button"
                    className={`sf-serviceCard ${
                      serviceMode === "pickup" ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setServiceMode("pickup");
                      resetDelivery();
                      if (singlePickupStore) {
                        goToPickupStore(singlePickupStore);
                        return;
                      }
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
                )}

                {deliveryAvailable && (
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
                    <span className="sf-serviceMark" aria-hidden="true">
                      {pickupAvailable ? "02" : "01"}
                    </span>
                    <span className="sf-serviceEyebrow">Domicilio</span>
                    <strong className="sf-serviceTitle">Enviar a casa</strong>
                    <span className="sf-serviceBody">
                      Busca tu direccion con Google y confirma cobertura.
                    </span>
                  </button>
                )}
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
            </>
          )}
        </section>
      </div>

      {singleServiceCopy && !serviceMode && (
        <div className="sf-modalOverlay sf-serviceGateOverlay">
          <div className="sf-modalCard sf-serviceGateModal">
            <span>{singleServiceCopy.eyebrow}</span>
            <h3>{singleServiceCopy.title}</h3>
            <p>{singleServiceCopy.body}</p>
            <div className="sf-serviceGateActions">
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
                onClick={continueSingleService}
              >
                {singleServiceCopy.action}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    const cityCount = pickupStores.filter(
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

            <form className="sf-deliveryForm" onSubmit={resolveDeliveryAddress} noValidate>
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

              <label className={deliveryLine2Invalid ? "is-requiredMissing" : ""}>
                <span>Piso, puerta o casa</span>
                <input
                  ref={addressLine2InputRef}
                  type="text"
                  value={deliveryAddressLine2}
                  onChange={(event) => {
                    setDeliveryAddressLine2(event.target.value);
                    if (event.target.value.trim()) {
                      setDeliveryLine2Invalid(false);
                    }
                  }}
                  placeholder="1B, bajo, casa azul..."
                  autoComplete="address-line2"
                  aria-invalid={deliveryLine2Invalid}
                  disabled={isResolvingDelivery}
                />
                {deliveryLine2Invalid && (
                  <small className="sf-fieldError">Completa este campo</small>
                )}
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
                {pickupAvailable && (
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
                )}
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
