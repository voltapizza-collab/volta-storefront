import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const DEFAULT_FORM = {
  minimumPaymentAmount: "0",
};

const formatCurrency = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

export default function SettingsPoliciesModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    const loadPolicies = async () => {
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
        setForm({
          minimumPaymentAmount:
            currentPartner.minimumPaymentAmount == null
              ? "0"
              : String(currentPartner.minimumPaymentAmount),
        });
        setError("");
      } catch (loadError) {
        console.error("Error loading policies", loadError);
        setError("No pudimos cargar las policies.");
      } finally {
        setLoading(false);
      }
    };

    loadPolicies();
  }, [partner?.partnerId]);

  const minimumPreview = useMemo(() => {
    const minimum = Number(form.minimumPaymentAmount || 0);
    if (!Number.isFinite(minimum) || minimum <= 0) {
      return "Sin minimo comercial. Solo queda activo el minimo tecnico de Stripe.";
    }

    return `El checkout solo se abre desde ${formatCurrency(
      minimum,
      partnerData?.currency || "EUR"
    )}.`;
  }, [form.minimumPaymentAmount, partnerData?.currency]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSuccess("");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!partner?.partnerId) return;

    const minimum = Number(form.minimumPaymentAmount || 0);

    if (!Number.isFinite(minimum) || minimum < 0) {
      setError("El pago minimo debe ser 0 o mayor.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.patch(`/partners/by-id/${partner.partnerId}/policies`, {
        minimumPaymentAmount: minimum,
      });

      setPartnerData(response.data);
      setSuccess("Policies guardadas.");
    } catch (saveError) {
      console.error("Error saving policies", saveError);
      setError("No pudimos guardar las policies.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="bo-settingsShell">
        <div className="bo-settingsCard">
          <h2 className="bo-settingsTitle">Policies</h2>
          <p className="bo-settingsHint">Cargando reglas comerciales...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bo-settingsShell">
      <div className="bo-settingsCard">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings / Policies</div>
            <h2 className="bo-settingsTitle">Politicas de empresa</h2>
            <p className="bo-settingsHint">
              Este espacio concentra reglas del negocio que no son diseño libre:
              pago minimo, logo del partner y criterios operativos del checkout.
            </p>
          </div>
          <div className="bo-settingsStoreChip">
            {partnerData?.name || "Partner actual"}
          </div>
        </div>

        <div className="bo-settingsOverviewGrid">
          <form className="bo-settingsForm" onSubmit={handleSubmit}>
            <div className="bo-policyBlock">
              <div className="bo-settingsEyebrow">Cobro</div>
              <div className="bo-settingsGrid bo-settingsGrid--single">
                <label className="bo-field">
                  <span>Pago minimo</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minimumPaymentAmount}
                    onChange={(event) =>
                      handleChange("minimumPaymentAmount", event.target.value)
                    }
                    placeholder="10.00"
                  />
                </label>
              </div>
            </div>

            <div className="bo-settingsPreview">
              <div className="bo-settingsPreviewLabel">Politica activa</div>
              <strong>{minimumPreview}</strong>
              <span>
                Si el carrito queda por debajo, el storefront mostrara el aviso
                y no enviara al cliente a Stripe.
              </span>
            </div>

            {error && <div className="bo-settingsError">{error}</div>}
            {success && <div className="bo-settingsSuccess">{success}</div>}

            <div className="bo-settingsActions">
              <button type="submit" className="bo-settingsSave" disabled={saving}>
                {saving ? "Guardando..." : "Guardar policies"}
              </button>
            </div>
          </form>

          <aside className="bo-settingsSummaryCard">
            <div className="bo-settingsEyebrow">Identidad base</div>
            <h3 className="bo-settingsSectionTitle">Logo del partner</h3>
            <div className="bo-brandingPreviewLogo">
              {partnerData?.brandLogoUrl ? (
                <img src={partnerData.brandLogoUrl} alt={partnerData?.name || "Partner"} />
              ) : (
                <span>Sin logo</span>
              )}
            </div>
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
                El look completo se controla desde modos de personalizacion, no
                con colores libres por boton.
              </span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
