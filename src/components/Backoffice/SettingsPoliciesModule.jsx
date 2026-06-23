import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const DEFAULT_FORM = {
  minimumPaymentAmount: "0",
  paymentPolicySettings: {
    card: true,
    cash: false,
    cashStoreIds: [],
    paypal: false,
    paypalStoreIds: [],
    paypalEmail: "",
    crypto: false,
    cryptoStoreIds: [],
    cryptoWalletAddress: "",
  },
};

const PAYMENT_METHODS = [
  {
    id: "card",
    title: "Tarjeta",
    label: "Administrado por Volta",
    description: "Stripe queda activo por defecto para tarjeta y Klarna en el checkout online.",
    locked: true,
  },
  {
    id: "cash",
    title: "Efectivo",
    label: "Cobro en tienda o entrega",
    description: "El cliente confirma el pedido sin Stripe y paga al recibir o recoger.",
  },
  {
    id: "paypal",
    title: "PayPal",
    label: "Medio externo",
    description: "Registra el correo PayPal donde la tienda recibira el pago.",
    configKey: "paypalEmail",
    configLabel: "Correo PayPal de cobro",
    configPlaceholder: "pagos@tuempresa.com",
    configType: "email",
  },
  {
    id: "crypto",
    title: "Cartera virtual",
    label: "Medio externo",
    description: "Registra la direccion o hash de la billetera donde se recibira el pago.",
    configKey: "cryptoWalletAddress",
    configLabel: "Direccion/hash de cartera",
    configPlaceholder: "Wallet, hash o direccion de cobro",
    configType: "textarea",
  },
];

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

const parseMaybeJson = (value, fallback) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizePositiveIds = (value) => {
  const list = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return [
    ...new Set(
      list
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    ),
  ];
};

const normalizePaymentPolicySettings = (value) => {
  const parsed = parseMaybeJson(parseMaybeJson(value, {}), {});
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const paypalEmail = String(source.paypalEmail || source.paypalAddress || "").trim();
  const cryptoWalletAddress = String(
    source.cryptoWalletAddress || source.cryptoAddress || source.walletAddress || ""
  ).trim();

  return {
    card: true,
    cash: Boolean(source.cash),
    cashStoreIds: normalizePositiveIds(source.cashStoreIds),
    paypal: Boolean(source.paypal) && Boolean(paypalEmail),
    paypalStoreIds: normalizePositiveIds(source.paypalStoreIds),
    paypalEmail,
    crypto: Boolean(source.crypto) && Boolean(cryptoWalletAddress),
    cryptoStoreIds: normalizePositiveIds(source.cryptoStoreIds),
    cryptoWalletAddress,
  };
};

const paymentStoreKey = (methodId) => `${methodId}StoreIds`;

const paymentMethodLabel = (methodId) =>
  PAYMENT_METHODS.find((method) => method.id === methodId)?.title || "Metodo de pago";

const paymentConfigValue = (settings, method) =>
  method?.configKey ? String(settings?.[method.configKey] || "").trim() : "";

const maskPaymentConfigValue = (value, method) => {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return "Config pendiente";
  if (method?.id === "paypal") return cleanValue;
  if (cleanValue.length <= 18) return cleanValue;
  return `${cleanValue.slice(0, 10)}...${cleanValue.slice(-6)}`;
};

const validatePaymentConfigValue = (value, method) => {
  const cleanValue = String(value || "").trim();
  if (!method?.configKey) return true;
  if (method.id === "paypal") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue);
  }
  return cleanValue.length >= 6;
};

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
  const [paymentStoreModal, setPaymentStoreModal] = useState(null);
  const [paymentStoreSelection, setPaymentStoreSelection] = useState([]);
  const [paymentConfigModal, setPaymentConfigModal] = useState(null);
  const [paymentConfigDraft, setPaymentConfigDraft] = useState("");

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
          paymentPolicySettings: normalizePaymentPolicySettings(currentPartner.paymentPolicySettings),
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
        setError("No pudimos cargar las reglas.");
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

  const handlePaymentToggle = (methodId) => {
    if (methodId === "card") return;

    const method = PAYMENT_METHODS.find((item) => item.id === methodId);
    const currentSettings = normalizePaymentPolicySettings(form.paymentPolicySettings);
    const currentlyEnabled = Boolean(currentSettings[methodId]);

    if (!currentlyEnabled) {
      if (method?.configKey) {
        setPaymentConfigDraft(paymentConfigValue(currentSettings, method));
        setPaymentConfigModal({ methodId, activateAfterSave: true });
        setError("");
        setSuccess("");
        return;
      }

      const storeKey = paymentStoreKey(methodId);
      const currentStoreIds = currentSettings[storeKey] || [];
      const fallbackStoreIds = stores.map((store) => Number(store.id)).filter(Boolean);
      setPaymentStoreSelection(currentStoreIds.length ? currentStoreIds : fallbackStoreIds);
      setPaymentStoreModal(methodId);
      setSuccess("");
      return;
    }

    setForm((current) => ({
      ...current,
      paymentPolicySettings: {
        ...normalizePaymentPolicySettings(current.paymentPolicySettings),
        [methodId]: false,
      },
    }));
    setSuccess("");
  };

  const openPaymentConfigModal = (methodId, activateAfterSave = false) => {
    const method = PAYMENT_METHODS.find((item) => item.id === methodId);
    if (!method?.configKey) return;

    const currentSettings = normalizePaymentPolicySettings(form.paymentPolicySettings);
    setPaymentConfigDraft(paymentConfigValue(currentSettings, method));
    setPaymentConfigModal({ methodId, activateAfterSave });
    setError("");
    setSuccess("");
  };

  const confirmPaymentConfig = () => {
    if (!paymentConfigModal) return;

    const method = PAYMENT_METHODS.find((item) => item.id === paymentConfigModal.methodId);
    if (!method?.configKey) return;

    const cleanValue = paymentConfigDraft.trim();
    if (!validatePaymentConfigValue(cleanValue, method)) {
      setError(
        method.id === "paypal"
          ? "Introduce un correo PayPal valido para activar este medio de pago."
          : "Introduce una direccion o hash valido para activar la cartera virtual."
      );
      return;
    }

    setForm((current) => ({
      ...current,
      paymentPolicySettings: {
        ...normalizePaymentPolicySettings(current.paymentPolicySettings),
        [method.configKey]: cleanValue,
      },
    }));

    if (paymentConfigModal.activateAfterSave) {
      const currentSettings = normalizePaymentPolicySettings(form.paymentPolicySettings);
      const storeKey = paymentStoreKey(method.id);
      const currentStoreIds = currentSettings[storeKey] || [];
      const fallbackStoreIds = stores.map((store) => Number(store.id)).filter(Boolean);
      setPaymentStoreSelection(currentStoreIds.length ? currentStoreIds : fallbackStoreIds);
      setPaymentStoreModal(method.id);
    }

    setPaymentConfigModal(null);
    setPaymentConfigDraft("");
    setError("");
    setSuccess("");
  };

  const cancelPaymentConfig = () => {
    setPaymentConfigModal(null);
    setPaymentConfigDraft("");
  };

  const confirmPaymentStores = () => {
    if (!paymentStoreModal) return;

    const selectedIds = normalizePositiveIds(paymentStoreSelection);
    if (!selectedIds.length) {
      setError("Selecciona al menos una tienda para activar este medio de pago.");
      return;
    }

    setForm((current) => {
      const currentSettings = normalizePaymentPolicySettings(current.paymentPolicySettings);
      return {
        ...current,
        paymentPolicySettings: {
          ...currentSettings,
          [paymentStoreModal]: true,
          [paymentStoreKey(paymentStoreModal)]: selectedIds,
        },
      };
    });
    setPaymentStoreModal(null);
    setPaymentStoreSelection([]);
    setError("");
    setSuccess("");
  };

  const cancelPaymentStores = () => {
    setPaymentStoreModal(null);
    setPaymentStoreSelection([]);
  };

  const togglePaymentStore = (storeId) => {
    setPaymentStoreSelection((current) => toggleId(current.map(String), storeId).map(Number));
  };

  const selectAllPaymentStores = () => {
    const allStoreIds = stores.map((store) => Number(store.id)).filter(Boolean);
    setPaymentStoreSelection((current) =>
      current.length === allStoreIds.length ? [] : allStoreIds
    );
  };

  const clearPaymentStores = () => {
    setPaymentStoreSelection([]);
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
        paymentPolicySettings: normalizePaymentPolicySettings(form.paymentPolicySettings),
      });

      setPartnerData(response.data);
      setForm((current) => ({
        ...current,
        paymentPolicySettings: normalizePaymentPolicySettings(response.data?.paymentPolicySettings),
      }));
      setSuccess("Reglas guardadas.");
    } catch (saveError) {
      console.error("Error saving rules", saveError);
      setError("No pudimos guardar las reglas.");
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
          <h2 className="bo-settingsTitle">Reglas</h2>
          <p className="bo-settingsHint">Cargando reglas comerciales...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bo-settingsShell">
      <div className="bo-settingsCard bo-settingsCard--wide bo-settingsCard--rules">
        <div className="bo-settingsHeader">
          <div>
            <div className="bo-settingsEyebrow">Settings / Reglas</div>
            <h2 className="bo-settingsTitle">Reglas de empresa</h2>
            <p className="bo-settingsHint">
              Este espacio concentra reglas del negocio: cobro, logo,
              checkout y ajustes de precio en bloque.
            </p>
          </div>
          <div className="bo-settingsStoreChip">
            {partnerData?.name || "Partner actual"}
          </div>
        </div>

        <div className="bo-settingsOverviewGrid bo-settingsOverviewGrid--rules">
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
              <div className="bo-settingsPreviewLabel">Regla activa</div>
              <strong>{minimumPreview}</strong>
              <span>
                Si el carrito queda por debajo, el storefront mostrara el aviso
                y no enviara al cliente a Stripe.
              </span>
            </div>

            <div className="bo-policyBlock">
              <div className="bo-settingsEyebrow">Medios de pago</div>
              <div className="bo-paymentMethodList">
                {PAYMENT_METHODS.map((method) => {
                  const paymentSettings = normalizePaymentPolicySettings(form.paymentPolicySettings);
                  const checked = method.locked || Boolean(paymentSettings[method.id]);
                  const selectedStoreIds = normalizePositiveIds(paymentSettings[paymentStoreKey(method.id)]);
                  const configuredValue = paymentConfigValue(paymentSettings, method);
                  const storeSummary = selectedStoreIds.length
                    ? `${selectedStoreIds.length} tienda${selectedStoreIds.length === 1 ? "" : "s"}`
                    : "Todas las tiendas";
                  return (
                    <article
                      key={method.id}
                      className={`bo-smsSwitchRow bo-paymentMethodRow ${checked ? "is-active" : ""} ${method.locked ? "is-locked" : ""}`}
                    >
                      <div>
                        <span>{method.label}</span>
                        <strong>{method.title}</strong>
                        <p>{method.description}</p>
                        {method.configKey && (
                          <small
                            className={`bo-paymentConfigSummary ${
                              configuredValue ? "is-ready" : "is-pending"
                            }`}
                          >
                            {maskPaymentConfigValue(configuredValue, method)}
                          </small>
                        )}
                        {!method.locked && checked && (
                          <small className="bo-paymentStoreSummary">{storeSummary}</small>
                        )}
                      </div>
                      <div className="bo-paymentMethodControls">
                        {method.configKey && (
                          <button
                            type="button"
                            className="bo-settingsMiniCta bo-paymentConfigButton"
                            onClick={() => openPaymentConfigModal(method.id)}
                          >
                            Datos
                          </button>
                        )}
                        {!method.locked && checked && (
                          <button
                            type="button"
                            className="bo-settingsMiniCta"
                            onClick={() => {
                              setPaymentStoreSelection(
                                selectedStoreIds.length
                                  ? selectedStoreIds
                                  : stores.map((store) => Number(store.id)).filter(Boolean)
                              );
                              setPaymentStoreModal(method.id);
                              setError("");
                            }}
                          >
                            Tiendas
                          </button>
                        )}
                        <label className="bo-toggleControl" title={method.locked ? `${method.title} siempre activo` : method.title}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={method.locked}
                            onChange={() => handlePaymentToggle(method.id)}
                          />
                          <i />
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="bo-settingsActions">
              <button type="submit" className="bo-settingsSave" disabled={saving}>
                {saving ? "Guardando..." : "Guardar reglas"}
              </button>
            </div>
          </form>

          <aside className="bo-settingsSummaryCard bo-rulesLogoCard">
            <div className="bo-settingsEyebrow">Identidad base</div>
            <h3 className="bo-settingsSectionTitle">Logo del partner</h3>
            <div className="bo-brandingPreviewLogo bo-rulesLogoPreview">
              {partnerData?.brandLogoUrl ? (
                <img src={partnerData.brandLogoUrl} alt={partnerData?.name || "Partner"} />
              ) : (
                <span>Sin logo</span>
              )}
            </div>
            <div className="bo-logoUploadRow bo-rulesLogoUpload">
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

      {paymentConfigModal && (
        <div className="bo-brandingModalBackdrop" role="presentation">
          {(() => {
            const method = PAYMENT_METHODS.find((item) => item.id === paymentConfigModal.methodId);
            if (!method) return null;
            const isValidConfig = validatePaymentConfigValue(paymentConfigDraft, method);

            return (
              <div
                className="bo-brandingModalCard bo-paymentConfigModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="payment-config-modal-title"
              >
                <div className="bo-brandingModalHead">
                  <div>
                    <div className="bo-settingsEyebrow">Medios de pago</div>
                    <h3 id="payment-config-modal-title" className="bo-settingsSectionTitle">
                      Configurar {method.title}
                    </h3>
                    <p className="bo-settingsHint">
                      Este dato se mostrara como referencia para que la tienda cobre por este medio.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="bo-brandingModalClose"
                    onClick={cancelPaymentConfig}
                  >
                    Cerrar
                  </button>
                </div>

                <label className="bo-field bo-paymentConfigField">
                  <span>{method.configLabel}</span>
                  {method.configType === "textarea" ? (
                    <textarea
                      value={paymentConfigDraft}
                      onChange={(event) => setPaymentConfigDraft(event.target.value)}
                      placeholder={method.configPlaceholder}
                      rows={4}
                    />
                  ) : (
                    <input
                      type={method.configType || "text"}
                      value={paymentConfigDraft}
                      onChange={(event) => setPaymentConfigDraft(event.target.value)}
                      placeholder={method.configPlaceholder}
                    />
                  )}
                </label>

                <div className="bo-settingsActions">
                  <button
                    type="button"
                    className="bo-settingsSave"
                    onClick={confirmPaymentConfig}
                    disabled={!isValidConfig}
                  >
                    Guardar datos
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {paymentStoreModal && (
        <div className="bo-brandingModalBackdrop" role="presentation">
          <div
            className="bo-brandingModalCard bo-paymentStoreModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-store-modal-title"
          >
            <div className="bo-brandingModalHead">
              <div>
                <div className="bo-settingsEyebrow">Medios de pago</div>
                <h3 id="payment-store-modal-title" className="bo-settingsSectionTitle">
                  Selecciona las tiendas
                </h3>
                <p className="bo-settingsHint">
                  {paymentMethodLabel(paymentStoreModal)} quedara activo solo en las tiendas marcadas.
                </p>
              </div>
              <button
                type="button"
                className="bo-brandingModalClose"
                onClick={cancelPaymentStores}
              >
                Cerrar
              </button>
            </div>

            <div className="bo-paymentStoreActions">
              <button type="button" className="bo-settingsMiniCta" onClick={selectAllPaymentStores}>
                Seleccionar todo
              </button>
              <button type="button" className="bo-settingsMiniCta" onClick={clearPaymentStores}>
                Limpiar
              </button>
            </div>

            <div className="bo-priceSelector bo-paymentStoreGrid">
              {stores.map((store) => {
                const storeId = Number(store.id);
                return (
                  <label key={store.id} className="bo-checkTile">
                    <input
                      type="checkbox"
                      checked={paymentStoreSelection.includes(storeId)}
                      onChange={() => togglePaymentStore(store.id)}
                    />
                    <span>{store.storeName}</span>
                  </label>
                );
              })}
              {!stores.length && (
                <span className="bo-settingsCardHint">Sin tiendas cargadas.</span>
              )}
            </div>

            <div className="bo-settingsActions">
              <button type="button" className="bo-settingsSave" onClick={confirmPaymentStores}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
