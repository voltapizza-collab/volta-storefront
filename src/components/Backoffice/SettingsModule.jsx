import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import {
  BRANDING_DEFAULTS,
  getOfferButtonVariant,
} from "../../constants/branding";
import {
  STOREFRONT_BUTTON_ITEMS,
  normalizeStorefrontButtonConfig,
} from "../../constants/storefrontButtons";

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(numeric) ? numeric : 0);
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

const readTrackingSettings = (value) => {
  const parsed = parseMaybeJson(parseMaybeJson(value, {}), {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

export default function SettingsModule({
  partner,
  onOpenDelivery,
  onOpenBranding,
  onOpenPolicies,
  onOpenTracking,
}) {
  const [loading, setLoading] = useState(true);
  const [partnerData, setPartnerData] = useState(null);

  const loadPartnerData = useCallback(async () => {
    if (!partner?.partnerId) return;

    try {
      setLoading(true);
      const response = await api.get(`/partners/by-id/${partner.partnerId}`);
      setPartnerData(response.data || null);
    } catch (error) {
      console.error("Error loading settings overview", error);
    } finally {
      setLoading(false);
    }
  }, [partner?.partnerId]);

  useEffect(() => {
    loadPartnerData();
  }, [loadPartnerData]);

  const deliverySummary = useMemo(() => {
    if (!partnerData) return "Sin politica configurada todavia.";

    if (partnerData.deliveryPricingMode === "VARIABLE") {
      return `Base ${formatCurrency(partnerData.deliveryFeeBase)} hasta ${
        Number(partnerData.deliveryBaseKm || 0)
      } km y ${formatCurrency(partnerData.deliveryExtraPerKm)} por km extra.`;
    }

    return `${formatCurrency(partnerData.deliveryFeeFixed)} cada ${
      Number(partnerData.deliveryFeeBlockSize || 5)
    } pizzas.`;
  }, [partnerData]);

  const offerVariant = useMemo(
    () =>
      getOfferButtonVariant(
        partnerData?.brandOfferButtonStyle || BRANDING_DEFAULTS.brandOfferButtonStyle
      ),
    [partnerData?.brandOfferButtonStyle]
  );
  const minimumPaymentAmount = Number(partnerData?.minimumPaymentAmount || 0);
  const buttonConfig = useMemo(
    () => normalizeStorefrontButtonConfig(partnerData?.storefrontButtonConfig),
    [partnerData?.storefrontButtonConfig]
  );
  const visibleButtonCount = Object.values(buttonConfig).filter(Boolean).length;
  const trackingSettings = useMemo(
    () => readTrackingSettings(partnerData?.trackingNotificationSettings),
    [partnerData?.trackingNotificationSettings]
  );
  const trackingServices = trackingSettings?.services || {};
  const activeTrackingCount = Object.values(trackingServices).filter(Boolean).length;

  return (
    <section className="bo-settingsShell">
      <div className="bo-settingsCard">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings</div>
            <h2 className="bo-settingsTitle">Capa global del partner</h2>
            <p className="bo-settingsHint">
              Este modulo padre resume como estamos configurando el motor del partner.
              Desde aqui entramos a policies, entregas y personalizacion.
            </p>
          </div>
          <div className="bo-settingsStoreChip">
            {partnerData?.name || partner?.partnerName || "Partner actual"}
          </div>
        </div>

        <div className="bo-settingsOverviewGrid">
          <article className="bo-settingsSummaryCard">
            <div className="bo-settingsSummaryTop">
              <div>
                <div className="bo-settingsEyebrow">Policies</div>
                <h3 className="bo-settingsSectionTitle">Politicas de empresa</h3>
              </div>
              <button
                type="button"
                className="bo-settingsMiniCta"
                onClick={onOpenPolicies}
              >
                Abrir
              </button>
            </div>

            <div className="bo-settingsMetricRow">
              <span>Pago minimo</span>
              <strong>
                {minimumPaymentAmount > 0
                  ? formatCurrency(minimumPaymentAmount)
                  : "Sin minimo"}
              </strong>
            </div>
            <p className="bo-settingsCardHint">
              Centraliza el pago minimo, logo e identidad base sin abrir
              controles libres de color por boton.
            </p>
          </article>

          <article className="bo-settingsSummaryCard">
            <div className="bo-settingsSummaryTop">
              <div>
                <div className="bo-settingsEyebrow">Entregas</div>
                <h3 className="bo-settingsSectionTitle">Politica operativa</h3>
              </div>
              <button
                type="button"
                className="bo-settingsMiniCta"
                onClick={onOpenDelivery}
              >
                Abrir
              </button>
            </div>

            <div className="bo-settingsMetricRow">
              <span>Radio maximo</span>
              <strong>{partnerData?.deliveryRadiusKm ?? "Sin definir"} km</strong>
            </div>
            <div className="bo-settingsMetricRow">
              <span>Regla de precio</span>
              <strong>
                {partnerData?.deliveryPricingMode === "VARIABLE"
                  ? "Variable"
                  : "Fija por bloque"}
              </strong>
            </div>
            <div className="bo-settingsMetricRow">
              <span>Tope por pedido</span>
              <strong>
                {partnerData?.deliveryMaxPizzasPerOrder || "Sin limite"} pizzas
              </strong>
            </div>
            <p className="bo-settingsCardHint">{deliverySummary}</p>
          </article>

          <article className="bo-settingsSummaryCard">
            <div className="bo-settingsSummaryTop">
              <div>
                <div className="bo-settingsEyebrow">Personalizacion</div>
                <h3 className="bo-settingsSectionTitle">Botones y modos</h3>
              </div>
              <button
                type="button"
                className="bo-settingsMiniCta"
                onClick={onOpenBranding}
              >
                Abrir
              </button>
            </div>

            <div className="bo-settingsMetricRow">
              <span>Botones visibles</span>
              <strong>
                {visibleButtonCount}/{STOREFRONT_BUTTON_ITEMS.length}
              </strong>
            </div>
            <div className="bo-settingsMetricRow">
              <span>Boton cupones</span>
              <strong>{offerVariant.name}</strong>
            </div>

            <p className="bo-settingsCardHint">
              Activa u oculta llamadas, reservas, programar, Pay Now, cupones,
              Boost y el resto de botones. Los modos cambian el aspecto general
              desde opciones cerradas de Volta.
            </p>
          </article>

          <article className="bo-settingsSummaryCard">
            <div className="bo-settingsSummaryTop">
              <div>
                <div className="bo-settingsEyebrow">Seguimiento</div>
                <h3 className="bo-settingsSectionTitle">Avisos del partner</h3>
              </div>
              <button
                type="button"
                className="bo-settingsMiniCta"
                onClick={onOpenTracking}
              >
                Abrir
              </button>
            </div>

            <div className="bo-settingsMetricRow">
              <span>Estado</span>
              <strong>{trackingSettings.enabled ? "Activo" : "Pausado"}</strong>
            </div>
            <div className="bo-settingsMetricRow">
              <span>Avisos activos</span>
              <strong>{trackingSettings.enabled ? activeTrackingCount : 0}</strong>
            </div>
            <div className="bo-settingsMetricRow">
              <span>Canal</span>
              <strong>SMS</strong>
            </div>

            <p className="bo-settingsCardHint">
              Activa notificaciones para pedidos pendientes, pedidos retrasados
              eventos de cupones, clientes, ventas e incidencias. Cada aviso
              enviado consume un credito SMS.
            </p>
          </article>
        </div>

        {loading && (
          <div className="bo-sideInfo">Cargando resumen de settings...</div>
        )}
      </div>
    </section>
  );
}
