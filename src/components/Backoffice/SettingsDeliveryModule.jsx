import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const DEFAULT_FORM = {
  deliveryRadiusKm: "",
  deliveryPricingMode: "FIXED",
  deliveryFeeBlockSize: "5",
  deliveryMaxPizzasPerOrder: "",
  deliveryFeeFixed: "",
  deliveryFeeBase: "2",
  deliveryBaseKm: "5",
  deliveryExtraPerKm: "1",
};

export default function SettingsDeliveryModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    const loadPartnerPolicy = async () => {
      if (!partner?.partnerId) {
        setLoading(false);
        setError("No hay un partner asociado a esta sesion.");
        return;
      }

      try {
        setLoading(true);
        const res = await api.get(`/partners/by-id/${partner.partnerId}`);
        const currentPartner = res.data;

        setPartnerData(currentPartner);
        setForm({
          deliveryRadiusKm:
            currentPartner.deliveryRadiusKm == null ? "" : String(currentPartner.deliveryRadiusKm),
          deliveryPricingMode: currentPartner.deliveryPricingMode || "FIXED",
          deliveryFeeBlockSize:
            currentPartner.deliveryFeeBlockSize == null
              ? "5"
              : String(currentPartner.deliveryFeeBlockSize),
          deliveryMaxPizzasPerOrder:
            currentPartner.deliveryMaxPizzasPerOrder == null
              ? ""
              : String(currentPartner.deliveryMaxPizzasPerOrder),
          deliveryFeeFixed:
            currentPartner.deliveryFeeFixed == null ? "" : String(currentPartner.deliveryFeeFixed),
          deliveryFeeBase:
            currentPartner.deliveryFeeBase == null ? "2" : String(currentPartner.deliveryFeeBase),
          deliveryBaseKm:
            currentPartner.deliveryBaseKm == null ? "5" : String(currentPartner.deliveryBaseKm),
          deliveryExtraPerKm:
            currentPartner.deliveryExtraPerKm == null
              ? "1"
              : String(currentPartner.deliveryExtraPerKm),
        });
        setError("");
      } catch (err) {
        console.error("Error loading delivery settings", err);
        setError("No pudimos cargar la politica de delivery.");
      } finally {
        setLoading(false);
      }
    };

    loadPartnerPolicy();
  }, [partner?.partnerId]);

  const pricingPreview = useMemo(() => {
    if (form.deliveryPricingMode === "FIXED") {
      return form.deliveryFeeFixed
        ? `Precio fijo: EUR ${Number(form.deliveryFeeFixed).toFixed(2)} cada ${Number(
            form.deliveryFeeBlockSize || 5
          )} pizzas`
        : "Precio fijo pendiente de definir";
    }

    const base = Number(form.deliveryFeeBase || 0);
    const baseKm = Number(form.deliveryBaseKm || 0);
    const extra = Number(form.deliveryExtraPerKm || 0);

    return `Variable: EUR ${base.toFixed(2)} hasta ${baseKm.toFixed(
      0
    )} km y EUR ${extra.toFixed(2)} por km extra`;
  }, [
    form.deliveryPricingMode,
    form.deliveryFeeFixed,
    form.deliveryFeeBlockSize,
    form.deliveryFeeBase,
    form.deliveryBaseKm,
    form.deliveryExtraPerKm,
  ]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
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

      const res = await api.patch(`/partners/by-id/${partner.partnerId}`, form);
      setPartnerData(res.data);
      setSuccess("Politica de entregas guardada.");
    } catch (err) {
      console.error("Error saving delivery settings", err);
      setError("No pudimos guardar la politica.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="bo-settingsShell">
        <div className="bo-settingsCard">
          <h2 className="bo-settingsTitle">Entregas</h2>
          <p className="bo-settingsHint">Cargando politica de delivery...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bo-settingsShell">
      <div className="bo-settingsCard">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings / Entregas</div>
            <h2 className="bo-settingsTitle">Politica general de delivery</h2>
            <p className="bo-settingsHint">
              Este hijo define radio maximo, regla de precio y limite de pizzas por
              pedido para el partner. La activacion de delivery por tienda la dejamos
              para el modulo de stores.
            </p>
          </div>
          <div className="bo-settingsStoreChip">
            {partnerData?.name || "Partner actual"}
          </div>
        </div>

        <form className="bo-settingsForm" onSubmit={handleSubmit}>
          <div className="bo-settingsGrid">
            <label className="bo-field">
              <span>Km maximos de entrega</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.deliveryRadiusKm}
                onChange={(e) => handleChange("deliveryRadiusKm", e.target.value)}
                placeholder="5"
              />
            </label>

            <label className="bo-field">
              <span>Maximo de pizzas por pedido</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.deliveryMaxPizzasPerOrder}
                onChange={(e) =>
                  handleChange("deliveryMaxPizzasPerOrder", e.target.value)
                }
                placeholder="20"
              />
            </label>
          </div>

          <div className="bo-pricingModeRow">
            <button
              type="button"
              className={`bo-pillBtn ${
                form.deliveryPricingMode === "FIXED" ? "is-active" : ""
              }`}
              onClick={() => handleChange("deliveryPricingMode", "FIXED")}
            >
              Precio fijo
            </button>
            <button
              type="button"
              className={`bo-pillBtn ${
                form.deliveryPricingMode === "VARIABLE" ? "is-active" : ""
              }`}
              onClick={() => handleChange("deliveryPricingMode", "VARIABLE")}
            >
              Precio variable
            </button>
          </div>

          {form.deliveryPricingMode === "FIXED" ? (
            <div className="bo-settingsGrid">
              <label className="bo-field">
                <span>Pizzas por bloque de envio</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.deliveryFeeBlockSize}
                  onChange={(e) => handleChange("deliveryFeeBlockSize", e.target.value)}
                  placeholder="5"
                />
              </label>

              <label className="bo-field">
                <span>Precio por bloque</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deliveryFeeFixed}
                  onChange={(e) => handleChange("deliveryFeeFixed", e.target.value)}
                  placeholder="2.50"
                />
              </label>
            </div>
          ) : (
            <div className="bo-settingsGrid bo-settingsGrid--triple">
              <label className="bo-field">
                <span>Base inicial (EUR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deliveryFeeBase}
                  onChange={(e) => handleChange("deliveryFeeBase", e.target.value)}
                />
              </label>

              <label className="bo-field">
                <span>Km cubiertos por la base</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.deliveryBaseKm}
                  onChange={(e) => handleChange("deliveryBaseKm", e.target.value)}
                />
              </label>

              <label className="bo-field">
                <span>EUR por km adicional</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deliveryExtraPerKm}
                  onChange={(e) => handleChange("deliveryExtraPerKm", e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="bo-settingsPreview">
            <div className="bo-settingsPreviewLabel">Regla activa</div>
            <strong>{pricingPreview}</strong>
            <span>
              Pedido maximo configurado:{" "}
              {form.deliveryMaxPizzasPerOrder || "sin limite"} pizzas.
            </span>
          </div>

          {error && <div className="bo-settingsError">{error}</div>}
          {success && <div className="bo-settingsSuccess">{success}</div>}

          <div className="bo-settingsActions">
            <button type="submit" className="bo-settingsSave" disabled={saving}>
              {saving ? "Guardando..." : "Guardar politica"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
