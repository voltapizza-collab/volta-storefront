import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import {
  BRANDING_DEFAULTS,
  OFFER_BUTTON_VARIANTS,
  getOfferButtonVariant,
} from "../../constants/branding";
import {
  STOREFRONT_BUTTON_ITEMS,
  STOREFRONT_MODE_ITEMS,
  DEFAULT_STOREFRONT_BUTTON_CONFIG,
  DEFAULT_STOREFRONT_MODE,
  normalizeStorefrontMode,
} from "../../constants/storefrontButtons";

export default function SettingsBrandingModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [offerStyle, setOfferStyle] = useState(
    BRANDING_DEFAULTS.brandOfferButtonStyle
  );
  const [storefrontMode, setStorefrontMode] = useState(DEFAULT_STOREFRONT_MODE);
  const [offerModalOpen, setOfferModalOpen] = useState(false);

  useEffect(() => {
    const loadButtonGallery = async () => {
      if (!partner?.partnerId) {
        setLoading(false);
        setError("No hay un partner asociado a esta sesion.");
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/partners/by-id/${partner.partnerId}`);
        const currentPartner = response.data || {};

        setPartnerData(currentPartner);
        setOfferStyle(
          currentPartner.brandOfferButtonStyle ||
            BRANDING_DEFAULTS.brandOfferButtonStyle
        );
        setStorefrontMode(normalizeStorefrontMode(currentPartner.storefrontMode));
        setError("");
      } catch (loadError) {
        console.error("Error loading button personalization", loadError);
        setError("No pudimos cargar la personalizacion.");
      } finally {
        setLoading(false);
      }
    };

    loadButtonGallery();
  }, [partner?.partnerId]);

  const selectedOfferVariant = useMemo(
    () => getOfferButtonVariant(offerStyle),
    [offerStyle]
  );

  const handleOfferVariantSelect = (variantId) => {
    const nextVariant = getOfferButtonVariant(variantId);
    setOfferStyle(nextVariant.id);
    setSuccess("");
    setOfferModalOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!partner?.partnerId) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const [buttonsResponse, brandingResponse] = await Promise.all([
        api.patch(`/partners/by-id/${partner.partnerId}/storefront-buttons`, {
          storefrontButtonConfig: DEFAULT_STOREFRONT_BUTTON_CONFIG,
        }),
        api.patch(`/partners/by-id/${partner.partnerId}/branding`, {
          brandPrimary: partnerData?.brandPrimary || BRANDING_DEFAULTS.brandPrimary,
          brandSecondary:
            partnerData?.brandSecondary || BRANDING_DEFAULTS.brandSecondary,
          brandAccent: partnerData?.brandAccent || BRANDING_DEFAULTS.brandAccent,
          brandSurface: partnerData?.brandSurface || BRANDING_DEFAULTS.brandSurface,
          brandTextColor:
            partnerData?.brandTextColor || BRANDING_DEFAULTS.brandTextColor,
          brandFontFamily:
            partnerData?.brandFontFamily || BRANDING_DEFAULTS.brandFontFamily,
          brandOfferButtonStyle: offerStyle,
          storefrontMode,
        }),
      ]);

      setPartnerData({
        ...(buttonsResponse.data || {}),
        ...(brandingResponse.data || {}),
      });
      setSuccess("Personalizacion guardada.");
    } catch (saveError) {
      console.error("Error saving button personalization", saveError);
      setError("No pudimos guardar la personalizacion.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="bo-settingsShell">
        <div className="bo-settingsCard">
          <h2 className="bo-settingsTitle">Personalizacion</h2>
          <p className="bo-settingsHint">Cargando galeria de botones...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bo-settingsShell">
      <div className="bo-settingsCard">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings / Personalizacion</div>
            <h2 className="bo-settingsTitle">Galeria de botones del storefront</h2>
            <p className="bo-settingsHint">
              Estos son los botones fijos del storefront. El cliente no los
              apaga; solo puede elegir variantes visuales cuando existan,
              como el estilo del boton de cupones.
            </p>
          </div>
          <div className="bo-settingsStoreChip">
            {STOREFRONT_BUTTON_ITEMS.length} botones fijos
          </div>
        </div>

        <form className="bo-settingsForm" onSubmit={handleSubmit}>
          <div className="bo-buttonGallery">
            {STOREFRONT_BUTTON_ITEMS.map((item) => {
              const isCouponButton = item.id === "coupons";

              return (
                <article
                  key={item.id}
                  className="bo-buttonCard is-enabled"
                >
                  <div className="bo-buttonCardTop">
                    <div>
                      <span>{item.area}</span>
                      <strong>{item.label}</strong>
                    </div>
                    <span className="bo-fixedButtonBadge">Fijo</span>
                  </div>

                  <div className="bo-buttonPreviewRail">
                    {isCouponButton ? (
                      <button
                        type="button"
                        className={`sf-offersBtn bo-buttonPreviewCoupon ${selectedOfferVariant.className}`}
                        onClick={() => setOfferModalOpen(true)}
                      >
                        <span className="sf-offersBtnLabel">
                          {selectedOfferVariant.label}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`bo-storefrontButtonPreview bo-storefrontButtonPreview--${item.id}`}
                      >
                        {item.id === "couponCode" && <span>%</span>}
                        {item.id === "boost" && <span>POS 1</span>}
                        <strong>{item.preview}</strong>
                      </button>
                    )}
                  </div>

                  <small>Siempre visible en el storefront</small>

                  {isCouponButton && (
                    <button
                      type="button"
                      className="bo-buttonVariantLink"
                      onClick={() => setOfferModalOpen(true)}
                    >
                      Cambiar variante de cupones
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <section className="bo-modeSection">
            <div className="bo-modeSectionHead">
              <div>
                <div className="bo-settingsEyebrow">Modos</div>
                <h3 className="bo-settingsSectionTitle">Aspecto general controlado</h3>
              </div>
              <span>{STOREFRONT_MODE_ITEMS.filter((mode) => mode.status === "available").length} disponibles</span>
            </div>

            <div className="bo-modeGallery">
              {STOREFRONT_MODE_ITEMS.map((mode) => {
                const isAvailable = mode.status === "available";
                const isActive = storefrontMode === mode.id;
                return (
                  <article
                    key={mode.id}
                    className={`bo-modeCard ${isActive ? "is-active" : ""} ${
                      isAvailable ? "is-available" : "is-coming"
                    }`}
                  >
                    <div className={`bo-modePreview bo-modePreview--${mode.id}`}>
                      <span />
                      <i />
                      <strong />
                    </div>
                    <div className="bo-modeCardCopy">
                      <span>{mode.label}</span>
                      <strong>{mode.name}</strong>
                      <p>{mode.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        setStorefrontMode(mode.id);
                        setSuccess("");
                      }}
                    >
                      {isActive ? "Activo" : isAvailable ? "Usar modo" : "En desarrollo"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {error && <div className="bo-settingsError">{error}</div>}
          {success && <div className="bo-settingsSuccess">{success}</div>}

          <div className="bo-settingsActions">
            <button type="submit" className="bo-settingsSave" disabled={saving}>
              {saving ? "Guardando..." : "Guardar personalizacion"}
            </button>
          </div>
        </form>
      </div>

      {offerModalOpen && (
        <div className="bo-brandingModalBackdrop" onClick={() => setOfferModalOpen(false)}>
          <div className="bo-brandingModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="bo-brandingModalHead">
              <div>
                <div className="bo-settingsEyebrow">Boton de cupones</div>
                <h3 className="bo-settingsSectionTitle">Elige una variante</h3>
              </div>
              <button
                type="button"
                className="bo-brandingModalClose"
                onClick={() => setOfferModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="bo-offerVariantGrid">
              {OFFER_BUTTON_VARIANTS.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={`bo-offerVariantCard ${
                    offerStyle === variant.id ? "is-active" : ""
                  }`}
                  onClick={() => handleOfferVariantSelect(variant.id)}
                >
                  <span className={`sf-offersBtn bo-offerVariantPreview ${variant.className}`}>
                    <span className="sf-offersBtnLabel">{variant.label}</span>
                  </span>
                  <strong>{variant.name}</strong>
                  <small>{variant.accent}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
