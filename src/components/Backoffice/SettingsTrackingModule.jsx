import { useEffect, useState } from "react";
import api from "../../setupAxios";

const TRACKING_SERVICES = [
  {
    id: "pendingOrderUnaccepted",
    area: "Pedidos",
    title: "Pedido sin aceptar",
    description:
      "Avisa cuando un pedido pagado lleva 3 minutos sin ser aceptado en MyOrders.",
    trigger: "Sale PAID + processed=false",
  },
  {
    id: "couponRedeemed",
    area: "Cupones",
    title: "Cupon canjeado",
    description:
      "Muestra canjes reales de Coupon Gallery y cupones usados en pedidos.",
    trigger: "CouponRedemption creado",
  },
  {
    id: "highAverageTicketSale",
    area: "Ventas",
    title: "Venta mayor al ticket promedio",
    description:
      "Detecta ventas cuyo total supera el ticket promedio de esa tienda.",
    trigger: "Sale total > promedio tienda",
  },
  {
    id: "storeOpenClosed",
    area: "Tiendas",
    title: "Tienda abierta o cerrada",
    description:
      "Lee el estado real de cada tienda: activa y aceptando pedidos o cerrada.",
    trigger: "Store active / acceptingOrders",
  },
  {
    id: "ingredientDisabled",
    area: "Inventario",
    title: "Ingrediente desactivado",
    description:
      "Avisa cuando un ingrediente esta apagado para una tienda.",
    trigger: "StoreIngredientStock active=false",
  },
  {
    id: "reservationCanceled",
    area: "Reservas",
    title: "Reserva cancelada",
    description:
      "Avisa cuando una reserva cambia a cancelada.",
    trigger: "Reservation status=CANCELED",
  },
  {
    id: "boostPurchased",
    area: "Boost",
    title: "Boost comprado",
    description:
      "Avisa cuando un cliente compra prioridad Boost para su pedido.",
    trigger: "Sale boostActive=true + boostPaidAt",
  },
];

const DEFAULT_SETTINGS = {
  enabled: false,
  channel: "SMS",
  recipientPhone: "",
  contactPhoneConfirmed: false,
  contactPhoneConfirmedAt: null,
  delayedOrderThresholdMinutes: 3,
  services: {
    pendingOrderUnaccepted: true,
    couponRedeemed: true,
    highAverageTicketSale: true,
    storeOpenClosed: true,
    ingredientDisabled: true,
    reservationCanceled: true,
    boostPurchased: true,
  },
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

const normalizeSettings = (value) => {
  const parsed = parseMaybeJson(parseMaybeJson(value, {}), {});
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const services =
    source.services && typeof source.services === "object" && !Array.isArray(source.services)
      ? source.services
      : {};
  const threshold = Number(source.delayedOrderThresholdMinutes);

  return {
    ...DEFAULT_SETTINGS,
    enabled: Boolean(source.enabled),
    channel: "SMS",
    recipientPhone: String(source.recipientPhone || ""),
    contactPhoneConfirmed: Boolean(source.contactPhoneConfirmed),
    contactPhoneConfirmedAt: source.contactPhoneConfirmedAt || null,
    delayedOrderThresholdMinutes:
      Number.isInteger(threshold) && threshold >= 1 && threshold <= 180
        ? threshold
        : DEFAULT_SETTINGS.delayedOrderThresholdMinutes,
    services: {
      ...DEFAULT_SETTINGS.services,
      ...TRACKING_SERVICES.reduce((result, service) => {
        const rawValue =
          service.id === "randomCouponObtained" && services[service.id] == null
            ? services.couponClaimed
            : services[service.id];
        if (rawValue != null) {
          result[service.id] = Boolean(rawValue);
        }
        return result;
      }, {}),
    },
  };
};

export default function SettingsTrackingModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadTrackingSettings = async () => {
      if (!partner?.partnerId) {
        setLoading(false);
        setError("No hay un partner asociado a esta sesion.");
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/partners/by-id/${partner.partnerId}`);
        const currentPartner = response.data || {};

        setSettings(normalizeSettings(currentPartner.trackingNotificationSettings));
        setError("");
      } catch (loadError) {
        console.error("Error loading tracking settings", loadError);
        setError("No pudimos cargar el seguimiento.");
      } finally {
        setLoading(false);
      }
    };

    loadTrackingSettings();
  }, [partner?.partnerId]);

  const handleServiceToggle = (serviceId) => {
    setSettings((current) => ({
      ...current,
      services: {
        ...current.services,
        [serviceId]: !current.services[serviceId],
      },
    }));
    setSuccess("");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!partner?.partnerId) return;

    if (!String(settings.recipientPhone || "").trim()) {
      setError("Indica el telefono del responsable para activar SMS.");
      return;
    }

    if (!settings.contactPhoneConfirmed) {
      setError("Confirma el numero donde vamos a contactar al responsable.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.patch(
        `/partners/by-id/${partner.partnerId}/tracking-notifications`,
        {
          trackingNotificationSettings: {
            ...settings,
            enabled: true,
            delayedOrderThresholdMinutes: Number(settings.delayedOrderThresholdMinutes || 15),
          },
        }
      );

      setSettings(normalizeSettings(response.data?.trackingNotificationSettings));
      setSuccess("Seguimiento guardado.");
    } catch (saveError) {
      console.error("Error saving tracking settings", saveError);
      setError("No pudimos guardar el seguimiento.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="bo-settingsShell">
        <div className="bo-settingsCard">
          <h2 className="bo-settingsTitle">Seguimiento</h2>
          <p className="bo-settingsHint">Cargando notificaciones del partner...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bo-settingsShell">
      <div className="bo-settingsCard">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings / Seguimiento</div>
            <h2 className="bo-settingsTitle">Alertas por SMS</h2>
          </div>
          <button
            type="submit"
            form="tracking-settings-form"
            className="bo-settingsSave"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar seguimiento"}
          </button>
        </div>

        <form
          id="tracking-settings-form"
          className="bo-settingsForm"
          onSubmit={handleSubmit}
        >
          <div className="bo-settingsGrid">
            <label className="bo-field">
              <span>Telefono del responsable</span>
              <input
                type="tel"
                value={settings.recipientPhone}
                onChange={(event) => handleChange("recipientPhone", event.target.value)}
                placeholder="+34 600 000 000"
              />
            </label>

            <div className="bo-confirmContactBox">
              <div>
                <span>Confirmacion de contacto</span>
                <strong>
                  Te vamos a contactar a este numero:{" "}
                  {settings.recipientPhone || "sin numero definido"}.
                </strong>
                <small>Confirmame que este es el numero correcto para recibir avisos.</small>
              </div>
              <label className="bo-toggleControl">
                <input
                  type="checkbox"
                  checked={settings.contactPhoneConfirmed}
                  disabled={!String(settings.recipientPhone || "").trim()}
                  onChange={(event) => handleConfirmPhone(event.target.checked)}
                />
                <i />
              </label>
            </div>
          </div>

          <div className="bo-settingsGrid bo-settingsGrid--single">
            <label className="bo-field">
              <span>Minutos para considerar retraso</span>
              <input
                type="number"
                min="1"
                max="180"
                step="1"
                value={settings.delayedOrderThresholdMinutes}
                onChange={(event) =>
                  handleChange("delayedOrderThresholdMinutes", event.target.value)
                }
              />
            </label>
          </div>

          <div className="bo-trackingServiceGrid">
            {TRACKING_SERVICES.map((service) => {
              const isChecked = Boolean(settings.services[service.id]);
              return (
                <article
                  key={service.id}
                  className={`bo-trackingServiceCard ${isChecked ? "is-active" : ""}`}
                >
                  <div className="bo-trackingServiceTop">
                    <div>
                      <span>{service.area}</span>
                      <strong>{service.title}</strong>
                    </div>
                    <label className="bo-toggleControl">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleServiceToggle(service.id)}
                      />
                      <i />
                    </label>
                  </div>
                  <p>{service.description}</p>
                  <small>{service.trigger}</small>
                </article>
              );
            })}
          </div>

          {error && <div className="bo-settingsError">{error}</div>}
          {success && <div className="bo-settingsSuccess">{success}</div>}
        </form>
      </div>
    </section>
  );
}
