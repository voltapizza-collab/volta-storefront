import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import {
  BRANDING_DEFAULTS,
  BRAND_FONT_OPTIONS,
  OFFER_BUTTON_VARIANTS,
  buildBrandThemeVars,
  getOfferButtonVariant,
} from "../../constants/branding";

export default function SettingsBrandingModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [form, setForm] = useState(BRANDING_DEFAULTS);
  const [offerModalOpen, setOfferModalOpen] = useState(false);

  useEffect(() => {
    const loadBranding = async () => {
      if (!partner?.partnerId) {
        setLoading(false);
        setError("No hay un partner asociado a esta sesion.");
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/partners/by-id/${partner.partnerId}`);
        const currentPartner = response.data;

        setPartnerData(currentPartner);
        setForm({
          brandPrimary: BRANDING_DEFAULTS.brandPrimary,
          brandSecondary: BRANDING_DEFAULTS.brandSecondary,
          brandAccent: BRANDING_DEFAULTS.brandAccent,
          brandSurface: currentPartner.brandSurface || BRANDING_DEFAULTS.brandSurface,
          brandTextColor:
            currentPartner.brandTextColor || BRANDING_DEFAULTS.brandTextColor,
          brandFontFamily:
            currentPartner.brandFontFamily || BRANDING_DEFAULTS.brandFontFamily,
          brandOfferButtonStyle:
            currentPartner.brandOfferButtonStyle ||
            BRANDING_DEFAULTS.brandOfferButtonStyle,
        });
        setError("");
      } catch (loadError) {
        console.error("Error loading branding settings", loadError);
        setError("No pudimos cargar la personalizacion.");
      } finally {
        setLoading(false);
      }
    };

    loadBranding();
  }, [partner?.partnerId]);

  const selectedOfferVariant = useMemo(
    () => getOfferButtonVariant(form.brandOfferButtonStyle),
    [form.brandOfferButtonStyle]
  );

  const previewStyle = useMemo(() => {
    const theme = buildBrandThemeVars({
      brandPrimary: BRANDING_DEFAULTS.brandPrimary,
      brandSecondary: BRANDING_DEFAULTS.brandSecondary,
      brandAccent: BRANDING_DEFAULTS.brandAccent,
      brandSurface: form.brandSurface,
      brandTextColor: form.brandTextColor,
      brandFontFamily: form.brandFontFamily,
    });

    return {
      "--preview-primary": theme.primary,
      "--preview-secondary": theme.secondary,
      "--preview-accent": theme.accent,
      "--preview-surface": theme.surface,
      "--preview-text": theme.text,
      "--preview-text-soft": theme.textSoft,
      "--preview-text-muted": theme.textMuted,
      "--preview-on-primary": theme.onPrimary,
      "--preview-on-secondary": theme.onSecondary,
      "--preview-on-accent": theme.onAccent,
      "--preview-on-surface": theme.onSurface,
      "--preview-font-family": theme.fontFamily,
    };
  }, [
      form.brandSurface,
      form.brandTextColor,
      form.brandFontFamily,
    ]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value.startsWith("#") ? value.toUpperCase() : value,
    }));
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!partner?.partnerId) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.patch(
        `/partners/by-id/${partner.partnerId}/branding`,
        {
          ...form,
          brandPrimary: BRANDING_DEFAULTS.brandPrimary,
          brandSecondary: BRANDING_DEFAULTS.brandSecondary,
          brandAccent: BRANDING_DEFAULTS.brandAccent,
        }
      );
      setPartnerData(response.data);
      setSuccess("Personalizacion guardada.");
    } catch (saveError) {
      console.error("Error saving branding settings", saveError);
      setError("No pudimos guardar la personalizacion.");
    } finally {
      setSaving(false);
    }
  };

  const handleOfferVariantSelect = (variantId) => {
    const nextVariant = getOfferButtonVariant(variantId);
    setForm((current) => ({
      ...current,
      brandOfferButtonStyle: nextVariant.id,
      brandAccent: BRANDING_DEFAULTS.brandAccent,
    }));
    setSuccess("");
    setOfferModalOpen(false);
  };

  const partnerName = partnerData?.name || "Partner";
  const storeLine = "Nombre de la tienda";

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !partner?.partnerId) return;

    try {
      setUploadingLogo(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("logo", file);

      const response = await api.post(
        `/partners/by-id/${partner.partnerId}/logo`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setPartnerData(response.data);
      setSuccess("Logo actualizado.");
    } catch (uploadError) {
      console.error("Error uploading logo", uploadError);
      setError("No pudimos subir el logo.");
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <section className="bo-settingsShell">
        <div className="bo-settingsCard">
          <h2 className="bo-settingsTitle">Personalizacion</h2>
          <p className="bo-settingsHint">Cargando capa visual...</p>
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
            <h2 className="bo-settingsTitle">Logo y branding del motor</h2>
            <p className="bo-settingsHint">
              Este hijo prepara la identidad base del storefront: logo visible y
              colores principales para despues entrar a la construccion grafica.
            </p>
          </div>
          <div className="bo-settingsStoreChip">
            {partnerData?.name || "Partner actual"}
          </div>
        </div>

        <div className="bo-settingsOverviewGrid bo-settingsOverviewGrid--branding">
          <form className="bo-settingsForm" onSubmit={handleSubmit}>
            <div className="bo-settingsGrid bo-settingsGrid--doubleTight">
              <div className="bo-field bo-brandLock">
                <span>Paleta Volta fija</span>
                <div className="bo-brandLockSwatches" aria-label="Paleta Volta fija">
                  <i style={{ background: BRANDING_DEFAULTS.brandPrimary }} />
                  <i style={{ background: BRANDING_DEFAULTS.brandSecondary }} />
                  <i style={{ background: BRANDING_DEFAULTS.brandAccent }} />
                </div>
                <small>
                  {BRANDING_DEFAULTS.brandPrimary} - {BRANDING_DEFAULTS.brandSecondary} - {BRANDING_DEFAULTS.brandAccent}
                </small>
              </div>

              <label className="bo-field">
                <span>Boton de ofertas</span>
                <button
                  type="button"
                  className="bo-offerPicker"
                  onClick={() => setOfferModalOpen(true)}
                >
                  <span
                    className={`sf-offersBtn bo-offerPickerPreview ${selectedOfferVariant.className}`}
                  >
                    <span className="sf-offersBtnLabel">{selectedOfferVariant.label}</span>
                  </span>
                  <strong>{selectedOfferVariant.name}</strong>
                  <small>Seleccionar variante</small>
                </button>
              </label>

              <label className="bo-field bo-fieldColor">
                <span>Color superficie</span>
                <input
                  type="color"
                  value={form.brandSurface}
                  onChange={(e) => handleChange("brandSurface", e.target.value)}
                />
                <small>{form.brandSurface}</small>
              </label>

              <label className="bo-field bo-fieldColor">
                <span>Color de letra</span>
                <input
                  type="color"
                  value={form.brandTextColor}
                  onChange={(e) => handleChange("brandTextColor", e.target.value)}
                />
                <small>{form.brandTextColor}</small>
              </label>

              <label className="bo-field">
                <span>Tipografia</span>
                <select
                  value={form.brandFontFamily}
                  onChange={(e) => handleChange("brandFontFamily", e.target.value)}
                >
                  {BRAND_FONT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} - {option.preview}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="bo-settingsPreview">
              <div className="bo-settingsPreviewLabel">Logo del partner</div>
              <div className="bo-logoUploadRow">
                <label className="bo-settingsMiniCta bo-settingsMiniCta--file">
                  {uploadingLogo ? "Subiendo..." : "Subir logo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    hidden
                  />
                </label>
                <span className="bo-logoUploadHint">
                  Recomendado: PNG transparente o JPG cuadrado.
                </span>
              </div>
            </div>

            {error && <div className="bo-settingsError">{error}</div>}
            {success && <div className="bo-settingsSuccess">{success}</div>}

            <div className="bo-settingsActions">
              <button type="submit" className="bo-settingsSave" disabled={saving}>
                {saving ? "Guardando..." : "Guardar branding"}
              </button>
            </div>
          </form>

          <aside className="bo-brandingStage" style={previewStyle}>
            <div className="bo-brandingStageSurface">
              <div className="bo-brandingStageTop">
                <div className="bo-brandingStageBrandLockup">
                  <div className="bo-brandingStageLogo">
                    {partnerData?.brandLogoUrl ? (
                      <img src={partnerData.brandLogoUrl} alt={partnerData?.name || "Partner"} />
                    ) : (
                      <span>{partnerData?.name || "Tu logo"}</span>
                    )}
                  </div>

                  <div className="bo-brandingStageBrandMeta">
                    <strong>{partnerName}</strong>
                    <span>{storeLine}</span>
                  </div>
                </div>

                <div className="bo-brandingStageSearch" />
              </div>

              <div className="bo-brandingStageChips">
                <span className={`sf-offersBtn ${selectedOfferVariant.className}`}>
                  <span className="sf-offersBtnLabel">{selectedOfferVariant.label}</span>
                </span>
                <span>Mitad / Mitad</span>
                <span>Arma tu pizza</span>
              </div>

              <div className="bo-brandingStageHero">
                <strong>{partnerData?.name || "Tu motor"}</strong>
                <p>Preview rapido del look general para el storefront.</p>
              </div>

              <div className="bo-brandingStageFooter">
                <button type="button">PROGRAMAR</button>
                <button type="button">Cupon</button>
                <button type="button">Reservas</button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {offerModalOpen && (
        <div className="bo-brandingModalBackdrop" onClick={() => setOfferModalOpen(false)}>
          <div className="bo-brandingModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="bo-brandingModalHead">
              <div>
                <div className="bo-settingsEyebrow">Boton de ofertas</div>
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
                    form.brandOfferButtonStyle === variant.id ? "is-active" : ""
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
