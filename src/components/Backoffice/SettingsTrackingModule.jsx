import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const SMS_SERVICES = [
  {
    id: "customerPaymentSuccess",
    group: "Cliente",
    title: "Pago exitoso",
    description: "El cliente recibe confirmacion del pago y link de seguimiento.",
    trigger: "Checkout pagado",
  },
  {
    id: "customerOrderReady",
    group: "Cliente",
    title: "Pedido listo o en camino",
    description: "Avisa cuando MyOrders marca el pedido listo o enviado.",
    trigger: "Estado operativo del pedido",
  },
  {
    id: "customerOrderChatMessage",
    group: "Cliente",
    title: "Mensaje manual de MyOrders",
    description: "Permite enviar una respuesta corta al cliente desde el pedido.",
    trigger: "Mensaje manual",
  },
  {
    id: "customerReviewRequest",
    group: "Cliente",
    title: "Solicitud de resena",
    description: "Pide valoracion despues del pedido cuando corresponda.",
    trigger: "Review request pendiente",
  },
  {
    id: "customerReservationConfirmation",
    group: "Reservas",
    title: "Reserva confirmada",
    description: "Confirma por SMS la reserva creada por el cliente.",
    trigger: "Reserva creada",
  },
  {
    id: "customerScheduledOrderConfirmation",
    group: "Pedidos programados",
    title: "Pedido programado confirmado",
    description: "Confirma fecha, hora y total del pedido programado.",
    trigger: "Pedido programado confirmado",
  },
  {
    id: "privateCouponDelivery",
    group: "Promociones",
    title: "Cupon privado enviado",
    description: "Envia cupones privados a clientes seleccionados.",
    trigger: "Cupon privado creado",
  },
  {
    id: "gameCouponDelivery",
    group: "Promociones",
    title: "Premio de juego",
    description: "Envia por SMS el cupon ganado en un juego.",
    trigger: "Juego ganado",
  },
  {
    id: "smsCampaignDelivery",
    group: "Campanas",
    title: "Campanas SMS",
    description: "Permite enviar campanas manuales a segmentos de clientes.",
    trigger: "Envio manual",
  },
  {
    id: "pendingOrderUnaccepted",
    group: "Reportes internos",
    title: "Pedido pagado sin aceptar",
    description: "Avisa al responsable cuando un pedido queda pendiente.",
    trigger: "Sale PAID + processed=false",
    internal: true,
  },
  {
    id: "couponRedeemed",
    group: "Reportes internos",
    title: "Cupon canjeado",
    description: "Avisa al responsable cuando hay un canje real.",
    trigger: "CouponRedemption creado",
    internal: true,
  },
  {
    id: "highAverageTicketSale",
    group: "Reportes internos",
    title: "Venta mayor al ticket promedio",
    description: "Avisa cuando una venta supera el promedio de la tienda.",
    trigger: "Sale total > promedio tienda",
    internal: true,
  },
  {
    id: "storeOpenClosed",
    group: "Reportes internos",
    title: "Tienda abierta o cerrada",
    description: "Avisa cambios de estado de cada tienda.",
    trigger: "Store active / acceptingOrders",
    internal: true,
  },
  {
    id: "ingredientDisabled",
    group: "Reportes internos",
    title: "Ingrediente desactivado",
    description: "Avisa cuando se apaga un ingrediente en una tienda.",
    trigger: "StoreIngredientStock active=false",
    internal: true,
  },
  {
    id: "reservationCanceled",
    group: "Reportes internos",
    title: "Reserva cancelada",
    description: "Avisa al responsable cuando se cancela una reserva.",
    trigger: "Reservation status=CANCELED",
    internal: true,
  },
  {
    id: "boostPurchased",
    group: "Reportes internos",
    title: "Boost comprado",
    description: "Avisa cuando un cliente compra prioridad Boost.",
    trigger: "Boost pagado",
    internal: true,
  },
];

const DEFAULT_SERVICES = SMS_SERVICES.reduce((result, service) => {
  result[service.id] = false;
  return result;
}, {});

const DEFAULT_SETTINGS = {
  schemaVersion: 2,
  enabled: false,
  channel: "SMS",
  recipientPhone: "",
  extraRecipientPhones: [],
  contactPhoneConfirmed: false,
  contactPhoneConfirmedAt: null,
  delayedOrderThresholdMinutes: 3,
  storeIds: [],
  perStoreServices: {},
  services: DEFAULT_SERVICES,
};

const parseMaybeJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizePhone = (value) =>
  String(value || "")
    .replace(/[^\d+]/g, "")
    .slice(0, 24);

const getBlankServices = () => ({ ...DEFAULT_SERVICES });

const normalizeStoreServices = (value) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.entries(source).reduce((result, [storeId, services]) => {
    const id = Number(storeId);
    if (!Number.isInteger(id) || id <= 0) return result;
    const sourceServices = services && typeof services === "object" && !Array.isArray(services) ? services : {};
    result[String(id)] = {
      ...DEFAULT_SERVICES,
      ...SMS_SERVICES.reduce((serviceResult, service) => {
        if (sourceServices[service.id] != null) serviceResult[service.id] = Boolean(sourceServices[service.id]);
        return serviceResult;
      }, {}),
    };
    return result;
  }, {});
};

const deriveGlobalServices = (perStoreServices) =>
  Object.values(perStoreServices || {}).reduce((result, services) => {
    SMS_SERVICES.forEach((service) => {
      result[service.id] = Boolean(result[service.id] || services?.[service.id]);
    });
    return result;
  }, getBlankServices());

const getStoreServices = (settings, storeId) =>
  settings.perStoreServices?.[String(storeId)] || getBlankServices();

const countActiveServices = (services) =>
  Object.values(services || {}).filter(Boolean).length;

const getStoreName = (store) => store?.storeName || store?.name || `Tienda ${store?.id || ""}`;

const normalizeSettings = (value) => {
  const parsed = parseMaybeJson(parseMaybeJson(value, {}), {});
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const threshold = Number(source.delayedOrderThresholdMinutes);
  const schemaVersion = Number(source.schemaVersion || 0);
  const canReadSavedServices = schemaVersion >= 2;
  const perStoreServices = canReadSavedServices ? normalizeStoreServices(source.perStoreServices) : {};
  const services = deriveGlobalServices(perStoreServices);

  return {
    ...DEFAULT_SETTINGS,
    enabled: canReadSavedServices && Object.values(services).some(Boolean),
    recipientPhone: normalizePhone(source.recipientPhone),
    extraRecipientPhones: Array.isArray(source.extraRecipientPhones)
      ? source.extraRecipientPhones.map(normalizePhone).filter(Boolean).slice(0, 8)
      : [],
    contactPhoneConfirmed: Boolean(source.contactPhoneConfirmed),
    contactPhoneConfirmedAt: source.contactPhoneConfirmedAt || null,
    delayedOrderThresholdMinutes:
      Number.isInteger(threshold) && threshold >= 1 && threshold <= 180
        ? threshold
        : DEFAULT_SETTINGS.delayedOrderThresholdMinutes,
    storeIds: Object.keys(perStoreServices).map(Number),
    perStoreServices,
    services,
  };
};

export default function SettingsTrackingModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [newPhone, setNewPhone] = useState("");

  const selectedStore = useMemo(
    () => stores.find((store) => Number(store.id) === Number(selectedStoreId)) || null,
    [stores, selectedStoreId]
  );
  const selectedStoreServices = useMemo(
    () => (selectedStore ? getStoreServices(settings, selectedStore.id) : getBlankServices()),
    [settings, selectedStore]
  );
  const groupedServices = useMemo(
    () =>
      SMS_SERVICES.reduce((groups, service) => {
        if (!groups[service.group]) groups[service.group] = [];
        groups[service.group].push(service);
        return groups;
      }, {}),
    []
  );
  const internalActive = useMemo(
    () =>
      Object.values(settings.perStoreServices || {}).some((services) =>
        SMS_SERVICES.some((service) => service.internal && services?.[service.id])
      ),
    [settings.perStoreServices]
  );

  useEffect(() => {
    const loadTrackingSettings = async () => {
      if (!partner?.partnerId) {
        setLoading(false);
        setError("No hay un partner asociado a esta sesion.");
        return;
      }

      try {
        setLoading(true);
        const [partnerResponse, storesResponse] = await Promise.all([
          api.get(`/partners/by-id/${partner.partnerId}`),
          api.get(`/stores?partnerId=${partner.partnerId}`),
        ]);

        setSettings(normalizeSettings(partnerResponse.data?.trackingNotificationSettings));
        setStores(Array.isArray(storesResponse.data) ? storesResponse.data : []);
        setError("");
      } catch (loadError) {
        console.error("Error loading SMS settings", loadError);
        setError("No pudimos cargar la administracion SMS.");
      } finally {
        setLoading(false);
      }
    };

    loadTrackingSettings();
  }, [partner?.partnerId]);

  const setStoreService = (storeId, serviceId, value) => {
    setSettings((current) => {
      const key = String(storeId);
      const nextStoreServices = {
        ...getBlankServices(),
        ...(current.perStoreServices?.[key] || {}),
        [serviceId]: value,
      };
      const nextPerStoreServices = {
        ...current.perStoreServices,
        [key]: nextStoreServices,
      };
      const nextServices = deriveGlobalServices(nextPerStoreServices);
      const nextStoreIds = Object.entries(nextPerStoreServices)
        .filter(([, services]) => countActiveServices(services) > 0)
        .map(([id]) => Number(id));

      return {
        ...current,
        enabled: Object.values(nextServices).some(Boolean),
        storeIds: nextStoreIds,
        perStoreServices: nextPerStoreServices,
        services: nextServices,
      };
    });
    setSuccess("");
  };

  const requestServiceToggle = (service) => {
    if (!selectedStore) return;
    const currentValue = Boolean(selectedStoreServices[service.id]);
    setStoreService(selectedStore.id, service.id, !currentValue);
  };

  const handleChange = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
      ...(field === "recipientPhone"
        ? { contactPhoneConfirmed: false, contactPhoneConfirmedAt: null }
        : {}),
    }));
    setSuccess("");
  };

  const handleConfirmPhone = (checked) => {
    setSettings((current) => ({
      ...current,
      contactPhoneConfirmed: checked,
      contactPhoneConfirmedAt: checked ? new Date().toISOString() : null,
    }));
    setSuccess("");
  };

  const addPhone = () => {
    const phone = normalizePhone(newPhone);
    if (!phone) return;
    setSettings((current) => ({
      ...current,
      extraRecipientPhones: Array.from(new Set([...current.extraRecipientPhones, phone])).slice(0, 8),
    }));
    setNewPhone("");
    setSuccess("");
  };

  const removePhone = (phone) => {
    setSettings((current) => ({
      ...current,
      extraRecipientPhones: current.extraRecipientPhones.filter((item) => item !== phone),
    }));
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!partner?.partnerId) return;

    if (internalActive && !String(settings.recipientPhone || "").trim()) {
      setError("Indica el telefono del responsable para activar reportes internos por SMS.");
      return;
    }

    if (internalActive && !settings.contactPhoneConfirmed) {
      setError("Confirma el numero del responsable para recibir reportes internos.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const cleanPerStoreServices = Object.entries(settings.perStoreServices || {}).reduce((result, [storeId, services]) => {
        if (countActiveServices(services) <= 0) return result;
        result[storeId] = {
          ...getBlankServices(),
          ...SMS_SERVICES.reduce((serviceResult, service) => {
            serviceResult[service.id] = Boolean(services?.[service.id]);
            return serviceResult;
          }, {}),
        };
        return result;
      }, {});
      const cleanServices = deriveGlobalServices(cleanPerStoreServices);
      const anyServiceActive = Object.values(cleanServices).some(Boolean);

      const response = await api.patch(
        `/partners/by-id/${partner.partnerId}/tracking-notifications`,
        {
          trackingNotificationSettings: {
            schemaVersion: 2,
            enabled: anyServiceActive,
            channel: "SMS",
            recipientPhone: normalizePhone(settings.recipientPhone),
            extraRecipientPhones: settings.extraRecipientPhones.map(normalizePhone).filter(Boolean),
            contactPhoneConfirmed: Boolean(settings.contactPhoneConfirmed),
            contactPhoneConfirmedAt: settings.contactPhoneConfirmedAt,
            delayedOrderThresholdMinutes: Number(settings.delayedOrderThresholdMinutes || 3),
            storeIds: Object.keys(cleanPerStoreServices).map(Number),
            perStoreServices: cleanPerStoreServices,
            services: cleanServices,
          },
        }
      );

      setSettings(normalizeSettings(response.data?.trackingNotificationSettings));
      setSuccess("Administracion SMS guardada.");
    } catch (saveError) {
      console.error("Error saving SMS settings", saveError);
      setError("No pudimos guardar la administracion SMS.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="bo-settingsShell bo-settingsShell--sms">
        <div className="bo-settingsCard bo-settingsCard--wide">
          <h2 className="bo-settingsTitle">SMS</h2>
          <p className="bo-settingsHint">Cargando administracion SMS...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bo-settingsShell bo-settingsShell--sms">
      <div className="bo-settingsCard bo-settingsCard--wide">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings / SMS</div>
            <h2 className="bo-settingsTitle">Administracion de SMS</h2>
            <p className="bo-settingsHint">
              Primero selecciona la tienda. Dentro puedes activar los SMS que esa tienda puede enviar.
            </p>
          </div>
          <button
            type="submit"
            form="tracking-settings-form"
            className="bo-settingsSave"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar SMS"}
          </button>
        </div>

        <form id="tracking-settings-form" className="bo-settingsForm" onSubmit={handleSubmit}>
          <section className="bo-smsPhonePanel">
            <div className="bo-smsPhoneTitleRow">
              <div>
                <div className="bo-settingsEyebrow">Telefonos de reportes</div>
                <h3 className="bo-settingsSectionTitle">Contactos internos</h3>
              </div>
              <label className="bo-smsConfirmInline">
                <input
                  type="checkbox"
                  checked={settings.contactPhoneConfirmed}
                  disabled={!String(settings.recipientPhone || "").trim()}
                  onChange={(event) => handleConfirmPhone(event.target.checked)}
                />
                <span>Responsable confirmado</span>
              </label>
            </div>

            <div className="bo-smsPhoneFields">
              <label className="bo-field">
                <span>Telefono responsable</span>
                <input
                  type="tel"
                  value={settings.recipientPhone}
                  onChange={(event) => handleChange("recipientPhone", event.target.value)}
                  placeholder="+34 600 000 000"
                />
              </label>

              <label className="bo-field">
                <span>Nuevo telefono adicional</span>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addPhone();
                    }
                  }}
                  placeholder="+34 611 111 111"
                />
              </label>
              <button type="button" className="bo-settingsSave" onClick={addPhone} disabled={!normalizePhone(newPhone)}>
                Agregar
              </button>
            </div>

            <div className="bo-smsPhoneList">
              {settings.extraRecipientPhones.length > 0 ? (
                settings.extraRecipientPhones.map((phone) => (
                  <span key={phone}>
                    {phone}
                    <button type="button" onClick={() => removePhone(phone)}>Quitar</button>
                  </span>
                ))
              ) : (
                <em>Sin telefonos adicionales.</em>
              )}
            </div>
          </section>

          <div className="bo-settingsGrid bo-settingsGrid--single">
            <label className="bo-field">
              <span>Minutos para considerar retraso</span>
              <input
                type="number"
                min="1"
                max="180"
                step="1"
                value={settings.delayedOrderThresholdMinutes}
                onChange={(event) => handleChange("delayedOrderThresholdMinutes", event.target.value)}
              />
            </label>
          </div>

          <div className="bo-settingsEyebrow">Tiendas</div>
          <div className="bo-smsStoreGrid">
            {stores.map((store) => {
              const services = getStoreServices(settings, store.id);
              const activeCount = countActiveServices(services);
              return (
                <article key={store.id} className={`bo-smsStoreCard ${activeCount ? "is-active" : ""}`}>
                  <div>
                    <span>{activeCount ? `${activeCount} SMS activos` : "Sin SMS activos"}</span>
                    <strong>{getStoreName(store)}</strong>
                    <small>{store.city || store.address || "Tienda del partner"}</small>
                  </div>
                  <button type="button" onClick={() => setSelectedStoreId(Number(store.id))}>
                    Configurar SMS
                  </button>
                </article>
              );
            })}
            {!stores.length && <div className="bo-trackingEmpty">No hay tiendas para configurar.</div>}
          </div>

          {error && <div className="bo-settingsError">{error}</div>}
          {success && <div className="bo-settingsSuccess">{success}</div>}
        </form>
      </div>

      {selectedStore && (
        <div className="bo-brandingModalBackdrop" role="presentation">
          <div className="bo-brandingModalCard bo-smsStoreModal" role="dialog" aria-modal="true">
            <div className="bo-brandingModalHead">
              <div>
                <div className="bo-settingsEyebrow">SMS por tienda</div>
                <h3 className="bo-settingsSectionTitle">{getStoreName(selectedStore)}</h3>
                <p className="bo-settingsHint">Activa solo los SMS que esta tienda puede enviar.</p>
              </div>
              <button type="button" className="bo-brandingModalClose" onClick={() => setSelectedStoreId(null)}>
                Cerrar
              </button>
            </div>

            <div className="bo-smsModalList">
              {Object.entries(groupedServices).map(([groupName, services]) => (
                <section key={groupName}>
                  <div className="bo-settingsEyebrow">{groupName}</div>
                  <div className="bo-smsSwitchList">
                    {services.map((service) => {
                      const checked = Boolean(selectedStoreServices[service.id]);
                      return (
                        <article key={service.id} className={`bo-smsSwitchRow ${checked ? "is-active" : ""}`}>
                          <div>
                            <span>{service.internal ? "Reporte interno" : "SMS cliente"}</span>
                            <strong>{service.title}</strong>
                            <p>{service.description}</p>
                          </div>
                          <label className="bo-toggleControl">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => requestServiceToggle(service)}
                            />
                            <i />
                          </label>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
