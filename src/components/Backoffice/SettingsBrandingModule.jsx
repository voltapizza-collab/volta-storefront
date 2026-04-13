import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const DEFAULT_FORM = {
  brandPrimary: "#3513A4",
  brandSecondary: "#FFBF2D",
  brandAccent: "#F7A600",
  brandSurface: "#FFF7E8",
};

export default function SettingsBrandingModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

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
          brandPrimary: currentPartner.brandPrimary || DEFAULT_FORM.brandPrimary,
          brandSecondary: currentPartner.brandSecondary || DEFAULT_FORM.brandSecondary,
          brandAccent: currentPartner.brandAccent || DEFAULT_FORM.brandAccent,
          brandSurface: currentPartner.brandSurface || DEFAULT_FORM.brandSurface,
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

  const previewStyle = useMemo(
    () => ({
      "--preview-primary": form.brandPrimary,
      "--preview-secondary": form.brandSecondary,
      "--preview-accent": form.brandAccent,
      "--preview-surface": form.brandSurface,
    }),
    [form.brandAccent, form.brandPrimary, form.brandSecondary, form.brandSurface]
  );

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value.toUpperCase(),
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
        form
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
              <label className="bo-field bo-fieldColor">
                <span>Color primario</span>
                <input
                  type="color"
                  value={form.brandPrimary}
                  onChange={(e) => handleChange("brandPrimary", e.target.value)}
                />
                <small>{form.brandPrimary}</small>
              </label>

              <label className="bo-field bo-fieldColor">
                <span>Color secundario</span>
                <input
                  type="color"
                  value={form.brandSecondary}
                  onChange={(e) => handleChange("brandSecondary", e.target.value)}
                />
                <small>{form.brandSecondary}</small>
              </label>

              <label className="bo-field bo-fieldColor">
                <span>Color acento</span>
                <input
                  type="color"
                  value={form.brandAccent}
                  onChange={(e) => handleChange("brandAccent", e.target.value)}
                />
                <small>{form.brandAccent}</small>
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
                <div className="bo-brandingStageLogo">
                  {partnerData?.brandLogoUrl ? (
                    <img src={partnerData.brandLogoUrl} alt={partnerData?.name || "Partner"} />
                  ) : (
                    <span>{partnerData?.name || "Tu logo"}</span>
                  )}
                </div>

                <div className="bo-brandingStageSearch" />
              </div>

              <div className="bo-brandingStageChips">
                <span>Oferta</span>
                <span>Mitad / Mitad</span>
                <span>Arma tu pizza</span>
              </div>

              <div className="bo-brandingStageHero">
                <strong>{partnerData?.name || "Tu motor"}</strong>
                <p>Preview rapido del look general para el storefront.</p>
              </div>

              <div className="bo-brandingStageFooter">
                <button type="button">Programar</button>
                <button type="button">Cupon</button>
                <button type="button">Reservas</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
