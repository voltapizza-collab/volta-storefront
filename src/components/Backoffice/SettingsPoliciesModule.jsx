import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const DEFAULT_FORM = {
  minimumPaymentAmount: "0",
};

const DEFAULT_RULE_FORM = {
  title: "",
  value: "3",
  targetType: "ALL",
  categoryIds: [],
  storeIds: [],
  activeFrom: "",
  expiresAt: "",
  daysActive: [],
  windowStart: "",
  windowEnd: "",
  status: "ACTIVE",
};

const PERCENT_OPTIONS = Array.from({ length: 201 }, (_, index) => index - 100);

const DAY_OPTIONS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

const TARGET_OPTIONS = [
  { value: "ALL", label: "Todas las categorias con productos" },
  { value: "CATEGORY", label: "Categorias especificas" },
];

const formatCurrency = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const formatPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0%";
  return `${numeric > 0 ? "+" : ""}${numeric}%`;
};

const pad2 = (value) => String(value).padStart(2, "0");

const minutesToTime = (value) => {
  if (value == null || value === "") return "";
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return "";
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
};

const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  return String(hours * 60 + minutes);
};

const toInputDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toggleId = (list, id) => {
  const stringId = String(id);
  return list.includes(stringId)
    ? list.filter((item) => item !== stringId)
    : [...list, stringId];
};

const normalizeRuleForForm = (rule) => ({
  ...DEFAULT_RULE_FORM,
  ...rule,
  value: String(rule.value ?? ""),
  categoryIds: (rule.categoryIds || []).map(String),
  productIds: (rule.productIds || []).map(String),
  storeIds: (rule.storeIds || []).map(String),
  activeFrom: toInputDateTime(rule.activeFrom),
  expiresAt: toInputDateTime(rule.expiresAt),
  windowStart: minutesToTime(rule.windowStart),
  windowEnd: minutesToTime(rule.windowEnd),
  daysActive: (rule.daysActive || []).map(Number),
});

const buildRulePayload = (form) => ({
  ...form,
  value: Number(form.value),
  categoryIds: form.categoryIds.map(Number),
  productIds: (form.productIds || []).map(Number),
  storeIds: form.storeIds.map(Number),
  activeFrom: form.activeFrom || null,
  expiresAt: form.expiresAt || null,
  windowStart: timeToMinutes(form.windowStart),
  windowEnd: timeToMinutes(form.windowEnd),
  daysActive: form.daysActive.map(Number),
});

const filterCategoriesWithProducts = (categories, products) => {
  const usedCategoryIds = new Set(
    products
      .map((product) => Number(product.categoryId))
      .filter((categoryId) => Number.isInteger(categoryId) && categoryId > 0)
  );

  return categories.filter((category) => usedCategoryIds.has(Number(category.id)));
};

const targetLabel = (rule, categories) => {
  if (rule.targetType === "ALL") return "Todas las categorias con productos";

  if (rule.targetType === "CATEGORY") {
    const names = categories
      .filter((category) => (rule.categoryIds || []).map(String).includes(String(category.id)))
      .map((category) => category.name);
    return names.length ? names.join(", ") : "Categorias seleccionadas";
  }

  return "Categorias seleccionadas";
};

function SelectorBlock({ form, setForm, categories, includeStores, stores }) {
  const selectedCategoryIds = form.categoryIds || [];
  const selectedStoreIds = form.storeIds || [];

  return (
    <>
      {form.targetType === "CATEGORY" && (
        <div className="bo-priceSelector">
          {categories.map((category) => (
            <label key={category.id} className="bo-checkTile">
              <input
                type="checkbox"
                checked={selectedCategoryIds.includes(String(category.id))}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    categoryIds: toggleId(current.categoryIds || [], category.id),
                  }))
                }
              />
              <span>{category.name}</span>
            </label>
          ))}
          {!categories.length && (
            <span className="bo-settingsCardHint">Sin categorias con productos.</span>
          )}
        </div>
      )}

      {includeStores && (
        <div className="bo-policyBlock">
          <div className="bo-settingsEyebrow">Tiendas</div>
          <div className="bo-priceSelector">
            {stores.map((store) => (
              <label key={store.id} className="bo-checkTile">
                <input
                  type="checkbox"
                  checked={selectedStoreIds.includes(String(store.id))}
                  onChange={() =>
                    setForm((current) => ({
                      ...current,
                      storeIds: toggleId(current.storeIds || [], store.id),
                    }))
                  }
                />
                <span>{store.storeName}</span>
              </label>
            ))}
            {!stores.length && (
              <span className="bo-settingsCardHint">Sin tiendas cargadas.</span>
            )}
          </div>
          <p className="bo-settingsCardHint">
            Sin tiendas marcadas, la regla aplica a todas las tiendas del partner.
          </p>
        </div>
      )}
    </>
  );
}

export default function SettingsPoliciesModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);

  useEffect(() => {
    const loadPolicies = async () => {
      if (!partner?.partnerId) {
        setLoading(false);
        setError("No hay un partner asociado a esta sesion.");
        return;
      }

      try {
        setLoading(true);
        const [
          partnerResponse,
          rulesResponse,
          categoriesResponse,
          productsResponse,
          storesResponse,
        ] = await Promise.allSettled([
          api.get(`/partners/by-id/${partner.partnerId}`),
          api.get(`/partners/by-id/${partner.partnerId}/price-adjustments`),
          api.get(`/api/partners/${partner.partnerId}/categories`),
          api.get(`/api/pizzas?partnerId=${partner.partnerId}`),
          api.get(`/stores?partnerId=${partner.partnerId}`),
        ]);

        if (partnerResponse.status !== "fulfilled") {
          throw partnerResponse.reason;
        }

        const currentPartner = partnerResponse.value.data || {};

        setPartnerData(currentPartner);
        setForm({
          minimumPaymentAmount:
            currentPartner.minimumPaymentAmount == null
              ? "0"
              : String(currentPartner.minimumPaymentAmount),
        });
        setRules(
          rulesResponse.status === "fulfilled" &&
            Array.isArray(rulesResponse.value.data?.rules)
            ? rulesResponse.value.data.rules.map(normalizeRuleForForm)
            : []
        );
        const loadedCategories =
          categoriesResponse.status === "fulfilled" &&
          Array.isArray(categoriesResponse.value.data)
            ? categoriesResponse.value.data
            : [];
        const loadedProducts =
          productsResponse.status === "fulfilled" &&
          Array.isArray(productsResponse.value.data)
            ? productsResponse.value.data
            : [];
        setCategories(filterCategoriesWithProducts(loadedCategories, loadedProducts));
        setStores(
          storesResponse.status === "fulfilled" &&
            Array.isArray(storesResponse.value.data)
            ? storesResponse.value.data
            : []
        );
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

  const activeRulesCount = rules.filter((rule) => rule.status === "ACTIVE").length;

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

  const buildRuleFromForm = () => {
    const value = Number(ruleForm.value);
    if (!Number.isFinite(value) || value < -100 || value > 100) {
      return {
        error: "El porcentaje debe estar entre -100 y 100.",
      };
    }

    if (ruleForm.targetType === "CATEGORY" && !ruleForm.categoryIds.length) {
      return {
        error: "Selecciona al menos una categoria.",
      };
    }

    return {
      rule: {
        ...ruleForm,
        id: `price-rule-${Date.now()}`,
        title:
          ruleForm.title.trim() ||
          `${value > 0 ? "Subida" : "Bajada"} ${Math.abs(value)}%`,
      },
    };
  };

  const persistRules = async (nextRules, successMessage) => {
    if (!partner?.partnerId) return;

    try {
      setSavingRules(true);
      setError("");
      setSuccess("");

      const response = await api.put(
        `/partners/by-id/${partner.partnerId}/price-adjustments`,
        {
          rules: nextRules.map(buildRulePayload),
        }
      );

      setRules(
        Array.isArray(response.data?.rules)
          ? response.data.rules.map(normalizeRuleForForm)
          : []
      );
      setSuccess(successMessage);
    } catch (saveRulesError) {
      console.error("Error saving price adjustment rules", saveRulesError);
      setError("No pudimos guardar las reglas de precios.");
    } finally {
      setSavingRules(false);
    }
  };

  const saveRules = async () => {
    const { rule, error: ruleError } = buildRuleFromForm();
    if (ruleError) {
      setError(ruleError);
      return;
    }

    await persistRules([rule, ...rules], "Regla de precios guardada.");
    setRuleForm(DEFAULT_RULE_FORM);
  };

  const removeRule = async (id) => {
    const nextRules = rules.filter((rule) => rule.id !== id);
    await persistRules(nextRules, "Regla eliminada.");
  };

  const toggleRuleStatus = async (id) => {
    const nextRules = rules.map((rule) =>
        rule.id === id
          ? { ...rule, status: rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }
          : rule
    );
    await persistRules(nextRules, "Regla actualizada.");
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
      <div className="bo-settingsCard bo-settingsCard--wide">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings / Policies</div>
            <h2 className="bo-settingsTitle">Politicas de empresa</h2>
            <p className="bo-settingsHint">
              Este espacio concentra reglas del negocio: pago minimo, logo,
              checkout y ajustes de precio en bloque.
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
                El look completo se controla desde modos de personalizacion.
              </span>
            </div>
          </aside>
        </div>

        <section className="bo-pricePolicyPanel">
          <div className="bo-settingsSummaryTop">
            <div>
              <div className="bo-settingsEyebrow">Precios</div>
              <h3 className="bo-settingsSectionTitle">Ajustes de precio en bloque</h3>
            </div>
            <strong className="bo-priceRuleBadge">{activeRulesCount} activas</strong>
          </div>

          <div
            className={
              rules.length
                ? "bo-pricePolicyGrid"
                : "bo-pricePolicyGrid bo-pricePolicyGrid--single"
            }
          >
            <div className="bo-priceRuleEditor">
              <div className="bo-policyBlock">
                <div className="bo-settingsEyebrow">Regla programada</div>
                <div className="bo-settingsGrid">
                  <label className="bo-field">
                    <span>Porcentaje</span>
                    <select
                      value={ruleForm.value}
                      onChange={(event) =>
                        setRuleForm((current) => ({
                          ...current,
                          value: event.target.value,
                        }))
                      }
                    >
                      {PERCENT_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {formatPercent(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="bo-field">
                    <span>Bloque</span>
                    <select
                      value={ruleForm.targetType}
                      onChange={(event) =>
                        setRuleForm((current) => ({
                          ...current,
                          targetType: event.target.value,
                          categoryIds: [],
                        }))
                      }
                    >
                      {TARGET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <SelectorBlock
                  form={ruleForm}
                  setForm={setRuleForm}
                  categories={categories}
                  includeStores
                  stores={stores}
                />

                <div className="bo-settingsGrid bo-settingsGrid--single">
                  <label className="bo-field">
                    <span>Horario</span>
                    <div className="bo-timePair">
                      <input
                        type="time"
                        value={ruleForm.windowStart}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            windowStart: event.target.value,
                          }))
                        }
                      />
                      <input
                        type="time"
                        value={ruleForm.windowEnd}
                        onChange={(event) =>
                          setRuleForm((current) => ({
                            ...current,
                            windowEnd: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </label>
                </div>

                <div className="bo-dayPicker">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      className={
                        ruleForm.daysActive.includes(day.value)
                          ? "bo-dayChip is-active"
                          : "bo-dayChip"
                      }
                      onClick={() =>
                        setRuleForm((current) => ({
                          ...current,
                          daysActive: current.daysActive.includes(day.value)
                            ? current.daysActive.filter((item) => item !== day.value)
                            : [...current.daysActive, day.value],
                        }))
                      }
                    >
                      {day.label}
                    </button>
                  ))}
                  <span className="bo-settingsCardHint">
                    Sin dias marcados, aplica cualquier dia.
                  </span>
                </div>

                <div className="bo-settingsActions">
                  <button
                    type="button"
                    className="bo-settingsSave"
                    onClick={saveRules}
                    disabled={savingRules}
                  >
                    {savingRules ? "Guardando..." : "Guardar reglas"}
                  </button>
                </div>
              </div>
            </div>

            {rules.length > 0 && (
              <aside className="bo-priceRuleList">
                {rules.map((rule) => (
                  <article key={rule.id} className="bo-priceRuleCard">
                    <div className="bo-settingsSummaryTop">
                      <div>
                        <strong>{rule.title}</strong>
                        <span>{targetLabel(rule, categories)}</span>
                      </div>
                      <b>{formatPercent(rule.value)}</b>
                    </div>
                    <div className="bo-priceRuleMeta">
                      <span>{rule.status === "ACTIVE" ? "Activa" : "Pausada"}</span>
                      <span>
                        {rule.daysActive.length
                          ? rule.daysActive
                              .map((day) => DAY_OPTIONS.find((item) => item.value === day)?.label)
                              .filter(Boolean)
                              .join(" ")
                          : "Todos los dias"}
                      </span>
                      <span>
                        {rule.windowStart || rule.windowEnd
                          ? `${rule.windowStart || "00:00"}-${rule.windowEnd || "24:00"}`
                          : "Todo el dia"}
                      </span>
                    </div>
                    <div className="bo-ruleActions">
                      <button type="button" onClick={() => toggleRuleStatus(rule.id)}>
                        {rule.status === "ACTIVE" ? "Pausar" : "Activar"}
                      </button>
                      <button type="button" onClick={() => removeRule(rule.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </aside>
            )}
          </div>

        </section>

        {error && <div className="bo-settingsError">{error}</div>}
        {success && <div className="bo-settingsSuccess">{success}</div>}
      </div>
    </section>
  );
}
