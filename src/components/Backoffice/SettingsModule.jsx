import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import {
  BRANDING_DEFAULTS,
  getBrandFontOption,
  getOfferButtonVariant,
} from "../../constants/branding";

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(numeric) ? numeric : 0);
};

export default function SettingsModule({ partner, onOpenDelivery, onOpenBranding }) {
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

  const brandingPalette = useMemo(
    () => [
      partnerData?.brandPrimary || "#3513A4",
      partnerData?.brandSecondary || "#FFBF2D",
      partnerData?.brandAccent || BRANDING_DEFAULTS.brandAccent,
      partnerData?.brandSurface || "#FFF7E8",
      partnerData?.brandTextColor || BRANDING_DEFAULTS.brandTextColor,
    ],
    [partnerData]
  );

  const brandFont = useMemo(
    () => getBrandFontOption(partnerData?.brandFontFamily || BRANDING_DEFAULTS.brandFontFamily),
    [partnerData?.brandFontFamily]
  );

  const offerVariant = useMemo(
    () =>
      getOfferButtonVariant(
        partnerData?.brandOfferButtonStyle || BRANDING_DEFAULTS.brandOfferButtonStyle
      ),
    [partnerData?.brandOfferButtonStyle]
  );

  return (
    <section className="bo-settingsShell">
      <div className="bo-settingsCard">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings</div>
            <h2 className="bo-settingsTitle">Capa global del partner</h2>
            <p className="bo-settingsHint">
              Este modulo padre resume como estamos configurando el motor del partner.
              Desde aqui entramos a los hijos de entregas y personalizacion.
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
                <h3 className="bo-settingsSectionTitle">Marca y look del motor</h3>
              </div>
              <button
                type="button"
                className="bo-settingsMiniCta"
                onClick={onOpenBranding}
              >
                Abrir
              </button>
            </div>

            <div className="bo-brandingPreview">
              <div className="bo-brandingPreviewLogo">
                {partnerData?.brandLogoUrl ? (
                  <img src={partnerData.brandLogoUrl} alt={partnerData?.name || "Partner"} />
                ) : (
                  <span>Sin logo</span>
                )}
              </div>

              <div className="bo-brandingPreviewMeta">
                <strong style={{ fontFamily: brandFont.family }}>{brandFont.label}</strong>
                <span className={`sf-offersBtn bo-brandingPreviewOffer ${offerVariant.className}`}>
                  <span className="sf-offersBtnLabel">{offerVariant.label}</span>
                </span>
              </div>

              <div className="bo-brandingSwatches">
                {brandingPalette.map((color) => (
                  <span
                    key={color}
                    className="bo-brandingSwatch"
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <p className="bo-settingsCardHint">
              Aqui controlaremos logo y paleta base para que cada motor tenga identidad
              propia antes de entrar a la construccion grafica.
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
