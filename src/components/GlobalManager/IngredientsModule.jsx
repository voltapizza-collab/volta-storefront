import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/IngredientsModule.css";
import api from "../../setupAxios";
import ingredientMasterSource from "../../data/ingredientMasterSource.json";
import IngredientOnboardingModal, { INGREDIENT_LANGUAGES, IngredientSearchIcon, matchesIngredientSearch } from "./IngredientOnboardingModal";

const SEMANTIC_LOCALES = INGREDIENT_LANGUAGES.map(([locale]) => locale);
const CORE_REVIEW_LOCALES = ["es", "en", "it"];

const CATEGORY_LABELS = {
  ACEITES_GRASAS_VINAGRES: "Aceites, grasas y vinagres",
  AROMAS_Y_EXTRACTOS: "Aromas y extractos",
  CARNES: "Carnes",
  CREMAS_DULCES: "Cremas dulces",
  EMBUTIDOS: "Embutidos",
  ENDULZANTES: "Endulzantes",
  EXTRAS: "Extras",
  FRUTAS: "Frutas",
  HIERBAS_ESPECIAS: "Hierbas y especias",
  OTROS: "Otros",
  PESCADOS_Y_MARISCOS: "Pescados y mariscos",
  QUESOS: "Quesos",
  SALSAS: "Salsas",
  SETAS: "Setas",
  VERDURAS: "Verduras",
};

const normalizeIngredientKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeCategory = (category) =>
  String(category || "OTROS")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "OTROS";

const getCanonicalCategory = (category) => {
  const normalized = normalizeCategory(category);
  const aliases = {
    ACEITES: "ACEITES_GRASAS_VINAGRES",
    ESPECIAS: "HIERBAS_ESPECIAS",
    FIAMBRES: "EMBUTIDOS",
    MARISCOS: "PESCADOS_Y_MARISCOS",
    PESCADOS: "PESCADOS_Y_MARISCOS",
    SAUCES: "SALSAS",
    CHEESE: "QUESOS",
    VEGETABLE: "VERDURAS",
    PROTEIN: "CARNES",
  };

  return aliases[normalized] || normalized;
};

const getCategoryLabel = (category) =>
  CATEGORY_LABELS[getCanonicalCategory(category)] || getCanonicalCategory(category);

const getDisplayName = (name) => String(name || "").toUpperCase();
const getIngredientDisplayName = (ingredient = {}) => {
  const safeIngredient = ingredient || {};
  return safeIngredient.displayName || safeIngredient.name || "";
};

const buildEmptyTranslations = () =>
  SEMANTIC_LOCALES.map((locale) => ({
    locale,
    name: "",
    description: "",
    isReviewed: false,
  }));

const buildSemanticDraft = (ingredient = {}) => ({
  canonicalKey:
    ingredient.canonicalKey ||
    buildCanonicalKeySuggestion(getIngredientDisplayName(ingredient)),
  semanticStatus: ingredient.semanticStatus || "UNREVIEWED",
  semanticCategoryId: ingredient.semanticCategoryId || "",
  translations: mergeSemanticTranslations(getIngredientTranslations(ingredient)),
  aliasesText: formatAliasLines(ingredient.aliases || ingredient.semanticAliases || []),
});

const getIngredientTranslations = (ingredient = {}) => {
  const byLocale = new Map();
  [ingredient.semanticTranslations, ingredient.translations].forEach((rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => byLocale.set(row.locale, row));
  });
  return [...byLocale.values()];
};

const mergeSemanticTranslations = (translations = []) => {
  const byLocale = new Map(
    translations.map((translation) => [translation.locale, translation])
  );

  return buildEmptyTranslations().map((empty) => ({
    ...empty,
    ...(byLocale.get(empty.locale) || {}),
    savedName: byLocale.get(empty.locale)?.name || "",
    savedDescription: byLocale.get(empty.locale)?.description || "",
  }));
};

const formatAliasLines = (aliases = []) =>
  aliases
    .map((alias) =>
      [
        alias.alias,
        alias.locale || "",
        alias.country || "",
        alias.displayable ? "display" : "",
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n");

const parseAliasLines = (value) =>
  String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [alias, locale = "", country = "", mode = ""] = line
        .split("|")
        .map((part) => part.trim());

      return {
        alias,
        locale: locale || null,
        country: country || null,
        searchable: true,
        displayable: mode.toLowerCase() === "display",
        isReviewed: true,
        source: "MANUAL",
      };
    });

const buildCanonicalKeySuggestion = (name) => normalizeIngredientKey(name);

const getCompletedTranslationLocales = (translations = []) =>
  new Set(
    translations
      .filter(
        (translation) =>
          String(translation.name || "").trim() &&
          !String(translation.name).includes("\uFFFD")
      )
      .map((translation) => translation.locale)
  );

const getIngredientSemanticStatus = (ingredient = {}) =>
  ingredient.semanticStatus || "UNREVIEWED";

const OPERATIONAL_NAME_PATTERNS = [
  {
    pattern: /\b\d+(?:[.,]\d+)?\s*(kg|g|gr|gramos|l|lt|ml|uds?|unidades)\b/i,
    reason: "contains package quantity/unit",
  },
  {
    pattern: /\b(pack|bolsa|bote|lata|caja|cubo|tarrina|barra|saco)\b/i,
    reason: "contains packaging wording",
  },
  {
    pattern: /\b(relleno|bloque|rallado|rallada|rayado|rayada|lonchas|slices|mix|mezcla)\b/i,
    reason: "looks like an operational format",
  },
];

const isIngredientActive = (ingredient = {}) =>
  String(ingredient.status || "ACTIVE").toUpperCase() !== "INACTIVE";

const getIngredientUsageLabel = (ingredient = {}) => {
  const hasUsageStats =
    ingredient.usageStoreCount != null ||
    ingredient.usageStorePercent != null ||
    ingredient.usageStoreTotal != null ||
    ingredient.usageProductCount != null;

  if (!hasUsageStats) {
    return {
      className: "is-unknown",
      primary: "Uso global",
      secondary: "Sin metrica",
      title: "Usage stats unavailable until the backend serving this page is restarted.",
    };
  }

  const count = Number(ingredient.usageStoreCount || 0);
  const percent = Number(ingredient.usageStorePercent || 0);
  const total = Number(ingredient.usageStoreTotal || 0);
  const productCount = Number(ingredient.usageProductCount || 0);
  const roundedPercent = Number.isFinite(percent) ? Math.round(percent) : 0;
  const usageClass =
    roundedPercent >= 60 ? "is-high" : roundedPercent > 0 ? "is-medium" : "is-low";

  return {
    className: usageClass,
    primary: "Uso global",
    secondary: total ? `${count}/${total} tiendas - ${roundedPercent}%` : "Sin tiendas",
    title: total
      ? `${count} of ${total} active stores have this ingredient active. Used in ${productCount} active products.`
      : "No active stores available for usage calculation.",
  };
};

const getIngredientDeleteBlocker = (ingredient = {}) => {
  const storeCount = Number(ingredient.usageStoreCount || 0);
  const productCount = Number(ingredient.usageProductCount || 0);

  if (storeCount > 0 || productCount > 0) {
    return `Cannot delete: used by ${storeCount} store${
      storeCount === 1 ? "" : "s"
    } and ${productCount} active product${productCount === 1 ? "" : "s"}.`;
  }

  return "";
};

const getIngredientMissingLocales = (ingredient = {}) => {
  const locales = getCompletedTranslationLocales(getIngredientTranslations(ingredient));
  return SEMANTIC_LOCALES.filter((locale) => !locales.has(locale));
};

const getIngredientSemanticGaps = (ingredient = {}) => {
  const gaps = [];
  const status = getIngredientSemanticStatus(ingredient);
  const usageStoreCount = Number(ingredient.usageStoreCount || 0);
  const usageProductCount = Number(ingredient.usageProductCount || 0);
  const isOperationallyActive =
    isIngredientActive(ingredient) || usageStoreCount > 0 || usageProductCount > 0;

  if (status === "REJECTED") {
    if (isOperationallyActive) {
      gaps.push({
        key: "rejected",
        label: "Rejected",
        title: "Rejected semantic identity is still active or used operationally",
      });
    }
    return gaps;
  }

  const missingLocales = getIngredientMissingLocales(ingredient);
  const nameForReview = [
    getIngredientDisplayName(ingredient),
    ingredient.name,
  ]
    .filter(Boolean)
    .join(" ");

  if (!String(ingredient.canonicalKey || "").trim()) {
    gaps.push({ key: "key", label: "Key", title: "Missing global identity" });
  }

  if (!ingredient.semanticCategoryId) {
    gaps.push({ key: "category", label: "Cat", title: "Missing semantic category" });
  }

  if (missingLocales.length > 0) {
    const visibleLocales = missingLocales.slice(0, 3).map((locale) => locale.toUpperCase());
    const overflow = missingLocales.length > 3 ? ` +${missingLocales.length - 3}` : "";
    gaps.push({
      key: "i18n",
      label: `I18N ${visibleLocales.join("/")}${overflow}`,
      title: `Faltan traducciones: ${missingLocales
        .map((locale) => locale.toUpperCase())
        .join(", ")}`,
    });
  }

  const operationalPattern = OPERATIONAL_NAME_PATTERNS.find(({ pattern }) =>
    pattern.test(nameForReview)
  );
  if (operationalPattern && status !== "REVIEWED") {
    gaps.push({
      key: "nameQuality",
      label: "Name",
      title: `Operational name needs semantic review: ${operationalPattern.reason}`,
    });
  }

  return gaps;
};

const getCategorySemanticSummary = (items = []) => {
  const issueCounts = new Map();
  let ingredientCount = 0;

  items.forEach((ingredient) => {
    const gaps = getIngredientSemanticGaps(ingredient);
    if (gaps.length === 0) return;

    ingredientCount += 1;
    gaps.forEach((gap) => {
      const current = issueCounts.get(gap.key) || {
        label: gap.label,
        count: 0,
      };
      issueCounts.set(gap.key, {
        ...current,
        count: current.count + 1,
      });
    });
  });

  const detail = [...issueCounts.values()]
    .map((issue) => `${issue.label}: ${issue.count}`)
    .join(" | ");

  return {
    ingredientCount,
    title: ingredientCount
      ? `${ingredientCount} ingredient${
          ingredientCount === 1 ? "" : "s"
        } need semantic adjustment${detail ? ` - ${detail}` : ""}`
      : "No semantic issues in this category",
  };
};

const getSemanticReviewButtonClass = (ingredient = {}) => {
  const status = getIngredientSemanticStatus(ingredient);
  const hasGaps = getIngredientSemanticGaps(ingredient).length > 0;

  if (status === "REJECTED") return "gm-semanticBtn--rejected";
  return hasGaps ? "gm-semanticBtn--needsReview" : "gm-semanticBtn--reviewed";
};

const getSemanticDraftValidation = (draft = {}) => {
  const completedLocales = getCompletedTranslationLocales(draft.translations || []);
  const missingCoreLocales = CORE_REVIEW_LOCALES.filter(
    (locale) => !completedLocales.has(locale)
  );
  const missingLocales = SEMANTIC_LOCALES.filter(
    (locale) => !completedLocales.has(locale)
  );
  const warnings = [];
  const criticalIssues = [];
  if ((draft.translations || []).some((translation) => String(translation.name || "").includes("\uFFFD"))) {
    criticalIssues.push("Corrige los caracteres dañados antes de confirmar los nombres.");
  }

  if (!String(draft.canonicalKey || "").trim()) warnings.push("Missing global identity key");
  if (!draft.semanticCategoryId) warnings.push("Missing semantic category");
  if (missingCoreLocales.length > 0) {
    warnings.push(
      `Faltan nombres principales: ${missingCoreLocales
        .map((locale) => locale.toUpperCase())
        .join(", ")}`
    );
  }
  if (missingLocales.length > 0) {
    warnings.push(
      `Idiomas pendientes: ${missingLocales
        .map((locale) => locale.toUpperCase())
        .join(", ")}`
    );
  }

  if (draft.semanticStatus === "REVIEWED") {
    if (!String(draft.canonicalKey || "").trim()) {
      criticalIssues.push("REVIEWED requires a global identity key");
    }
    if (!draft.semanticCategoryId) {
      criticalIssues.push("REVIEWED requires a semantic category");
    }
    if (missingCoreLocales.length > 0) {
      criticalIssues.push(
        `Completa los nombres en ${missingCoreLocales
          .map((locale) => locale.toUpperCase())
          .join(" and ")}`
      );
    }
  }

  return { criticalIssues, warnings, missingCoreLocales, missingLocales };
};

const getIngredientId = (ingredient = {}) =>
  ingredient.idValue || ingredient.ingredientId || ingredient.id;

export default function IngredientsModule() {
  const [ingredients, setIngredients] = useState([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogSearchOpen, setCatalogSearchOpen] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [addedIngredient, setAddedIngredient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [semanticCategories, setSemanticCategories] = useState([]);
  const [semanticAvailable, setSemanticAvailable] = useState(null);
  const [semanticError, setSemanticError] = useState("");
  const [semanticIngredient, setSemanticIngredient] = useState(null);
  const [semanticDraft, setSemanticDraft] = useState(buildSemanticDraft());
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticLoaded, setSemanticLoaded] = useState(false);
  const [semanticSaving, setSemanticSaving] = useState(false);
  const [semanticTranslating, setSemanticTranslating] = useState(false);
  const semanticTranslationRef = useRef(null);
  const semanticLoadRef = useRef(null);
  const [imageUploadSavingId, setImageUploadSavingId] = useState(null);
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const treeRef = useRef(null);

  const semanticCatalogIngredients = useMemo(
    () => ingredients.filter((ingredient) => ingredient.isSystem !== false),
    [ingredients]
  );

  const existingIngredientKeys = useMemo(() => {
    const keys = new Set();
    semanticCatalogIngredients.forEach((ingredient) => {
      [
        ingredient.name,
        ingredient.displayName,
        ingredient.canonicalKey,
        ...(ingredient.semanticTranslations || []).map((translation) => translation.name),
        ...(ingredient.semanticAliases || []).map((alias) => alias.alias),
      ].forEach((value) => {
        const key = normalizeIngredientKey(value);
        if (key) keys.add(key);
      });
    });
    return keys;
  }, [semanticCatalogIngredients]);

  const masterCategories = useMemo(
    () =>
      Object.keys(CATEGORY_LABELS).filter((category) =>
        ingredientMasterSource.some(
          (candidate) => getCanonicalCategory(candidate.category) === category
        )
      ),
    []
  );

  const masterCategoryCounts = useMemo(
    () =>
      ingredientMasterSource.reduce((counts, candidate) => {
        const category = getCanonicalCategory(candidate.category);
        counts[category] = (counts[category] || 0) + 1;
        return counts;
      }, {}),
    []
  );

  const masterCandidates = useMemo(() => ingredientMasterSource.map((candidate) => ({
    ...candidate,
    category: getCanonicalCategory(candidate.category),
    categoryLabel: getCategoryLabel(candidate.category),
    isExisting: [candidate.canonicalKey, candidate.defaultName, candidate.translations?.es,
      ...(candidate.aliases || [])].map(normalizeIngredientKey)
      .some((key) => key && existingIngredientKeys.has(key)),
  })), [existingIngredientKeys]);

  const groupedIngredients = useMemo(() => {
    const groups = new Map();
    semanticCatalogIngredients.forEach((ingredient) => {
      const category = getCanonicalCategory(ingredient.category);
      if (!matchesIngredientSearch([ingredient.name, ingredient.displayName, getCategoryLabel(category),
        ...(ingredient.semanticTranslations || []).map((item) => item.name),
        ...(ingredient.semanticAliases || []).map((item) => item.alias)], catalogQuery)) return;
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(ingredient);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => getCategoryLabel(a).localeCompare(getCategoryLabel(b)))
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) =>
          getIngredientDisplayName(a).localeCompare(getIngredientDisplayName(b))
        ),
      }));
  }, [semanticCatalogIngredients, catalogQuery]);

  const loadIngredients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ingredients");
      setIngredients(Array.isArray(res.data) ? res.data : []);
      setCatalogLoaded(true);
    } catch (err) {
      console.error(err);
      setSemanticError("No se pudo actualizar el catálogo. Recarga la página para reintentar.");
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await api.get("/ingredients/suggestions?status=PENDING");
      setSuggestions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadSemanticCategories = async () => {
    try {
      const res = await api.get("/ingredients/semantic-categories");
      setSemanticCategories(Array.isArray(res.data) ? res.data : []);
      setSemanticAvailable(true);
    } catch (err) {
      if (err?.response?.status === 409) {
        setSemanticAvailable(false);
        setSemanticError("Semantic migration pending");
        return;
      }
      console.error(err);
    }
  };

  useEffect(() => {
    loadIngredients();
    loadSuggestions();
    loadSemanticCategories();
    return () => { semanticTranslationRef.current?.abort(); semanticLoadRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (addedIngredient) {
      treeRef.current?.querySelector(`[data-ingredient-id="${getIngredientId(addedIngredient)}"]`)
        ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [addedIngredient, ingredients]);

  const toggleCategory = (category) => {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleIngredientCreated = (ingredient) => {
    setIngredients((current) => [...current.filter((item) => getIngredientId(item) !== getIngredientId(ingredient)), ingredient]);
    setAddedIngredient(ingredient);
    setCatalogQuery("");
    setOpenCategories((current) => new Set([...current, getCanonicalCategory(ingredient.category)]));
    setOnboardingOpen(false);
    setSemanticError("");
    loadIngredients();
  };

  const handleApproveSuggestion = async (id) => {
    try {
      await api.patch(`/ingredients/suggestions/${id}/approve`);
      await Promise.all([loadIngredients(), loadSuggestions()]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectSuggestion = async (id) => {
    try {
      await api.patch(`/ingredients/suggestions/${id}/reject`);
      await loadSuggestions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteIngredient = async (id, name) => {
    setSemanticError("");
    const confirmed = window.confirm(
      `Delete ${getDisplayName(name)} from the ingredients table?`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/ingredients/${id}`);
      await loadIngredients();
    } catch (err) {
      console.error(err);
      setSemanticError(
        err?.response?.data?.error || "Could not delete ingredient"
      );
    }
  };

  const openSemanticEditor = async (ingredient) => {
    semanticLoadRef.current?.abort();
    const controller = new AbortController();
    semanticLoadRef.current = controller;
    semanticTranslationRef.current?.abort();
    semanticTranslationRef.current = null;
    setSemanticTranslating(false);
    const ingredientId = getIngredientId(ingredient);
    if (!ingredientId) return;

    setSemanticIngredient(ingredient);
    setSemanticDraft(buildSemanticDraft(ingredient));
    setSemanticLoading(true);
    setSemanticLoaded(false);
    setSemanticError("");

    try {
      const res = await api.get(`/ingredients/${ingredientId}/semantics`, { signal: controller.signal });
      if (semanticLoadRef.current !== controller) return;
      const data = res.data || {};
      setSemanticAvailable(true);
      setSemanticDraft(buildSemanticDraft(data));
      setSemanticLoaded(true);
    } catch (err) {
      if (semanticLoadRef.current !== controller || controller.signal.aborted) return;
      if (err?.response?.status === 409) {
        setSemanticAvailable(false);
        setSemanticError("Semantic migration pending");
        return;
      }
      console.error(err);
      setSemanticError("Could not load semantic data");
    } finally {
      if (semanticLoadRef.current === controller) setSemanticLoading(false);
    }
  };

  const closeSemanticEditor = () => {
    semanticLoadRef.current?.abort();
    semanticLoadRef.current = null;
    semanticTranslationRef.current?.abort();
    semanticTranslationRef.current = null;
    setSemanticTranslating(false);
    setSemanticIngredient(null);
    setSemanticDraft(buildSemanticDraft());
    setSemanticLoading(false);
    setSemanticLoaded(false);
    setSemanticSaving(false);
  };

  const updateTranslationDraft = (locale, field, value) => {
    semanticTranslationRef.current?.abort();
    semanticTranslationRef.current = null;
    setSemanticTranslating(false);
    setSemanticDraft((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === locale
          ? { ...translation, [field]: value }
          : translation
      ),
    }));
  };

  const applySuggestedTranslationDrafts = async () => {
    if (semanticTranslationRef.current) return;
    const controller = new AbortController();
    semanticTranslationRef.current = controller;
    setSemanticTranslating(true); setSemanticError("");
    const sourceName = semanticDraft.translations.find((item) => item.locale === "es")?.name || getIngredientDisplayName(semanticIngredient);
    try {
      const { data } = await api.post("/ingredients/translate", { name: sourceName,
        category: getCategoryLabel(semanticIngredient.category) }, { signal: controller.signal, timeout: 30000 });
      if (semanticTranslationRef.current !== controller) return;
      const names = new Map((data.translations || []).map((item) => [item.locale, item.name]));
      if (!SEMANTIC_LOCALES.every((locale) => typeof names.get(locale) === "string" && names.get(locale).trim() && !names.get(locale).includes("\uFFFD"))) {
        throw new Error("La traducción llegó incompleta. Inténtalo de nuevo.");
      }
      setSemanticDraft((current) => ({ ...current,
        semanticStatus: current.semanticStatus === "REJECTED" ? "REJECTED" : "NEEDS_REVIEW",
        translations: current.translations.map((item) => !String(item.name || "").trim() && names.has(item.locale)
          ? { ...item, name: names.get(item.locale), isReviewed: false } : item),
      }));
    } catch (err) {
      if (semanticTranslationRef.current === controller && !controller.signal.aborted) {
        setSemanticError(err.response?.data?.error || err.message || "No se pudo completar la traducción.");
      }
    } finally {
      if (semanticTranslationRef.current === controller) { semanticTranslationRef.current = null; setSemanticTranslating(false); }
    }
  };

  const saveSemanticEditor = async () => {
    if (!semanticIngredient || !semanticAvailable || !semanticLoaded || semanticSaving || semanticTranslating) return;

    const ingredientId = getIngredientId(semanticIngredient);
    if (!ingredientId) return;

    const translations = semanticDraft.translations
      .map((translation) => ({
        locale: translation.locale,
        name: String(translation.name || "").trim(),
        description: String(translation.description || "").trim(),
        isReviewed: true,
      }))
      .filter((translation) => translation.name);

    try {
      setSemanticSaving(true);
      const { data } = await api.patch(`/ingredients/${ingredientId}/semantics`, {
        canonicalKey: semanticDraft.canonicalKey,
        semanticStatus: semanticDraft.semanticStatus === "REJECTED" ? "REJECTED" : semanticReviewReady ? "REVIEWED" : "NEEDS_REVIEW",
        semanticCategoryId: semanticDraft.semanticCategoryId || null,
        translations,
        aliases: parseAliasLines(semanticDraft.aliasesText),
      });
      setIngredients((current) => current.map((ingredient) => getIngredientId(ingredient) === ingredientId
        ? { ...ingredient, ...data, semanticTranslations: getIngredientTranslations(data || {}),
            semanticAliases: data?.aliases || data?.semanticAliases || ingredient.semanticAliases }
        : ingredient));
      await loadIngredients();
      closeSemanticEditor();
    } catch (err) {
      console.error(err);
      setSemanticError(
        err?.response?.data?.error || "Could not save semantic data"
      );
    } finally {
      setSemanticSaving(false);
    }
  };

  const uploadIngredientImage = async (ingredient, file) => {
    const ingredientId = getIngredientId(ingredient);
    if (!ingredientId || !file) return;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("imageSource", "MANUAL_UPLOAD");
    formData.append("imagePolicyVersion", "v1");

    try {
      setImageUploadSavingId(ingredientId);
      await api.patch(`/ingredients/${ingredientId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadIngredients();
    } catch (err) {
      console.error(err);
    } finally {
      setImageUploadSavingId(null);
    }
  };

  const semanticDraftValidation = getSemanticDraftValidation(semanticDraft);
  const semanticReviewReady =
    String(semanticDraft.canonicalKey || "").trim() &&
    semanticDraft.semanticCategoryId &&
    semanticDraftValidation.missingCoreLocales.length === 0;
  const semanticSaveBlocked = semanticDraftValidation.criticalIssues.length > 0;
  const semanticTranslationSourceName =
    semanticDraft.translations.find((translation) => translation.locale === "es")
      ?.name || getIngredientDisplayName(semanticIngredient);
  const canSuggestTranslationDrafts = semanticDraft.translations.some(
    (translation) =>
      !String(translation.name || "").trim() &&
      SEMANTIC_LOCALES.includes(translation.locale) &&
      String(semanticTranslationSourceName || "").trim()
  );

  return (
    <div className="gm-ingredientsModule">
      <div className="gm-ingredient-toolbar">
        <div className="gm-ingredient-toolbar-title"><strong>Ingredientes</strong><span>{semanticCatalogIngredients.length} añadidos al catálogo global</span></div>
        <button type="button" className="gm-ingredient-filter-toggle" aria-expanded={catalogSearchOpen} aria-controls="gm-catalog-filter"
          onClick={() => { setCatalogSearchOpen(!catalogSearchOpen); setCatalogQuery(""); }}><IngredientSearchIcon />Buscar ya añadidos</button>
        <button type="button" disabled={loading || !catalogLoaded || semanticAvailable !== true}
          onClick={() => setOnboardingOpen(true)}>+ Añadir ingrediente</button>
      </div>
      {catalogSearchOpen && <label className="gm-ingredient-search gm-ingredient-catalog-filter" id="gm-catalog-filter"><IngredientSearchIcon />
        <input autoFocus aria-label="Buscar ingredientes del catálogo" placeholder="Buscar en los ingredientes ya añadidos…"
          value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} />
      </label>}
      {addedIngredient && <div className="gm-ingredient-added" role="status">
        <span><strong>{addedIngredient.name}</strong> añadido con sus siete idiomas.{addedIngredient.image ? " Foto guardada para revisión." : ` Puedes completar la foto en ${getCategoryLabel(addedIngredient.category)}.`}</span>
        <button type="button" onClick={() => openSemanticEditor(addedIngredient)}>Ver traducciones</button>
        <button type="button" aria-label="Cerrar confirmación" onClick={() => setAddedIngredient(null)}>×</button>
      </div>}
      {onboardingOpen && <IngredientOnboardingModal candidates={masterCandidates}
        categories={masterCategories.map((key) => ({ key, label: getCategoryLabel(key) }))}
        onClose={() => setOnboardingOpen(false)} onCreated={handleIngredientCreated} />}

      {semanticError && <div className="gm-semanticError">{semanticError}</div>}

      <div className="gm-tree" ref={treeRef}>
        {loading && <p className="gm-treeEmpty">Loading ingredients...</p>}
        {!loading && !groupedIngredients.length && <p className="gm-treeEmpty">No hay ingredientes que coincidan con la búsqueda.</p>}
        {!loading &&
          groupedIngredients.map(({ category, items }) => {
            const isOpen = Boolean(catalogQuery.trim()) || openCategories.has(category);
            const masterTotal = masterCategoryCounts[category] || items.length;
            const semanticSummary = getCategorySemanticSummary(items);
            return (
              <section className="gm-categoryBlock" key={category}>
                <button
                  type="button"
                  className="gm-categoryHeader"
                  onClick={() => toggleCategory(category)}
                >
                  <span>{isOpen ? "▾" : "▸"}</span>
                  <strong>{getCategoryLabel(category)}</strong>
                  <span className="gm-categoryCounters">
                    {semanticSummary.ingredientCount > 0 && (
                      <span
                        className="gm-categoryIssueBadge"
                        title={semanticSummary.title}
                      >
                        {semanticSummary.ingredientCount}
                      </span>
                    )}
                    <em title={catalogQuery.trim() ? "Ingredientes que coinciden con la búsqueda" : "Loaded in global catalog / master source universe"}>
                      {catalogQuery.trim() ? `${items.length} resultados` : `${items.length} / ${masterTotal}`}
                    </em>
                  </span>
                </button>
                {isOpen && (
                  <div className="gm-categoryItems">
                    {items.map((ingredient) => {
                      const ingredientId = getIngredientId(ingredient);
                      const semanticGaps = getIngredientSemanticGaps(ingredient);
                      const usage = getIngredientUsageLabel(ingredient);
                      const deleteBlocker = getIngredientDeleteBlocker(ingredient);
                      return (
                        <div className={`gm-node ${getIngredientId(addedIngredient || {}) === ingredientId ? "is-new" : ""}`} key={ingredientId} data-ingredient-id={ingredientId}>
                          <div className="gm-node-left">
                            <span className={`gm-imageThumb ${ingredient.image ? "" : "gm-imageThumb--empty"}`}>
                              {ingredient.image ? (
                                <img src={ingredient.image} alt={getIngredientDisplayName(ingredient)} />
                              ) : (
                                "IMG"
                              )}
                            </span>
                            <span>{getDisplayName(getIngredientDisplayName(ingredient))}</span>
                          </div>
                          <div className="gm-node-right">
                            <span
                              className={`gm-availabilityBadge ${
                                isIngredientActive(ingredient) ? "is-active" : "is-inactive"
                              }`}
                            >
                              {isIngredientActive(ingredient) ? "Activo" : "Inactivo"}
                            </span>
                            <span
                              className={`gm-usageBadge ${usage.className}`}
                              title={usage.title}
                            >
                              <small>{usage.primary}</small>
                              <strong>{usage.secondary}</strong>
                            </span>
                            <button
                              type="button"
                              aria-label="Semantics"
                              className={`gm-semanticBtn ${getSemanticReviewButtonClass(
                                ingredient
                              )}`}
                              title={
                                semanticGaps.length
                                  ? semanticGaps.map((gap) => gap.title).join(" | ")
                                  : "Traducciones completas y guardadas. Abrir ficha."
                              }
                              onClick={() => openSemanticEditor(ingredient)}
                            >
                              Semantics · {SEMANTIC_LOCALES.length - getIngredientMissingLocales(ingredient).length}/{SEMANTIC_LOCALES.length}
                            </button>
                            <label
                              className={`gm-imageUpload ${
                                Number(imageUploadSavingId) === Number(ingredientId)
                                  ? "is-saving"
                                  : ""
                              }`}
                            >
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  uploadIngredientImage(ingredient, file);
                                  event.target.value = "";
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="gm-deleteBtn"
                              disabled={Boolean(deleteBlocker)}
                              title={deleteBlocker || "Delete ingredient"}
                              onClick={() =>
                                handleDeleteIngredient(
                                  ingredientId,
                                  getIngredientDisplayName(ingredient)
                                )
                              }
                            >
                              x
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
      </div>

      <section className="gm-suggestions">
        <h3>Pending ingredient suggestions</h3>
        {loadingSuggestions && <p>Loading suggestions...</p>}
        {!loadingSuggestions && suggestions.length === 0 && <p>No pending suggestions.</p>}
        {suggestions.map((suggestion) => (
          <div className="gm-suggestionRow" key={suggestion.id}>
            <strong>{suggestion.name}</strong>
            <span>{suggestion.category}</span>
            <button type="button" onClick={() => handleApproveSuggestion(suggestion.id)}>
              Approve
            </button>
            <button type="button" onClick={() => handleRejectSuggestion(suggestion.id)}>
              Reject
            </button>
          </div>
        ))}
      </section>

      {semanticIngredient && (
        <div className="gm-modalBackdrop" onClick={closeSemanticEditor}>
          <div className="gm-semanticModal" onClick={(event) => event.stopPropagation()}>
            <div className="gm-modalHeader">
              <div>
                <span>Ingredient semantics</span>
                <h3>{getDisplayName(getIngredientDisplayName(semanticIngredient))}</h3>
              </div>
              <button
                type="button"
                className="gm-modalClose"
                onClick={closeSemanticEditor}
              >
                x
              </button>
            </div>

            {semanticLoading ? (
              <p className="gm-semanticNotice">Loading semantic data...</p>
            ) : (
              <>
                <div className="gm-semanticBody">
                  {semanticError && <div className="gm-semanticError">{semanticError}</div>}
                  {!semanticLoaded && <button type="button" onClick={() => openSemanticEditor(semanticIngredient)}>Reintentar carga</button>}
                  {semanticDraftValidation.criticalIssues.length > 0 && (
                    <div className="gm-semanticError">
                      {semanticDraftValidation.criticalIssues.join(". ")}
                    </div>
                  )}
                  {semanticDraftValidation.warnings.length > 0 && (
                    <div className="gm-semanticWarnings">
                      {semanticDraftValidation.warnings.map((warning) => (
                        <span key={warning}>{warning}</span>
                      ))}
                    </div>
                  )}

                  <div className="gm-semanticGrid">
                    <label>
                      Canonical key
                      <input
                        value={semanticDraft.canonicalKey}
                        disabled={!semanticAvailable}
                        placeholder={buildCanonicalKeySuggestion(
                          getIngredientDisplayName(semanticIngredient)
                        )}
                        onChange={(event) =>
                          setSemanticDraft((current) => ({
                            ...current,
                            canonicalKey: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Identidad del ingrediente
                      <select
                        value={semanticDraft.semanticStatus === "REJECTED" ? "REJECTED" : "ACTIVE"}
                        disabled={!semanticAvailable}
                        onChange={(event) =>
                          setSemanticDraft((current) => ({
                            ...current,
                            semanticStatus: event.target.value === "REJECTED" ? "REJECTED" : "NEEDS_REVIEW",
                          }))
                        }
                      >
                        <option value="ACTIVE">Válida</option>
                        <option value="REJECTED">Rechazada</option>
                      </select>
                      {!semanticReviewReady && (
                        <span className="gm-fieldHint">
                          Completa la identidad, la categoría y los nombres principales para confirmar la ficha.
                        </span>
                      )}
                    </label>

                    <label>
                      Semantic category
                      <select
                        value={semanticDraft.semanticCategoryId}
                        disabled={!semanticAvailable}
                        onChange={(event) =>
                          setSemanticDraft((current) => ({
                            ...current,
                            semanticCategoryId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select semantic category</option>
                        {semanticCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.displayName || category.defaultName || category.name || category.key}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="gm-semanticSection">
                    <div className="gm-sectionHeader">
                      <div>
                        <h4>Traducciones</h4>
                        <span>{SEMANTIC_LOCALES.length - semanticDraftValidation.missingLocales.length}/{SEMANTIC_LOCALES.length} idiomas completos: ES, EN, IT, FR, PT, AR y ZH. Guardar confirma los nombres que ves aquí.</span>
                      </div>
                      <button
                        type="button"
                        disabled={!semanticAvailable || !semanticLoaded || !canSuggestTranslationDrafts || semanticTranslating || semanticSaving}
                        onClick={applySuggestedTranslationDrafts}
                      >
                        {semanticTranslating ? "Traduciendo…" : "Traducir idiomas pendientes"}
                      </button>
                    </div>
                    <div className="gm-translationGrid">
                      {semanticDraft.translations.map((translation) => (
                        <div className="gm-translationCard" key={translation.locale}>
                          <div className="gm-translationHeader">
                            <strong>{translation.locale.toUpperCase()}</strong>
                            <span
                              className={`gm-translationBadge ${
                                !String(translation.name || "").trim() ? "is-missing"
                                  : translation.name !== translation.savedName || (translation.description || "") !== translation.savedDescription
                                    ? "is-draft" : "is-reviewed"
                              }`}
                            >
                              {!String(translation.name || "").trim() ? "Falta nombre"
                                : translation.name !== translation.savedName || (translation.description || "") !== translation.savedDescription
                                  ? "Sin guardar" : "Guardada"}
                            </span>
                          </div>
                          <label className="gm-translationField">
                            Name
                            <input
                              value={translation.name || ""}
                              aria-label={`Nombre ${translation.locale.toUpperCase()}`}
                              lang={translation.locale === "zh" ? "zh-Hans" : translation.locale}
                              dir={translation.locale === "ar" ? "rtl" : "ltr"}
                              disabled={!semanticAvailable}
                              placeholder="Name"
                              onChange={(event) =>
                                updateTranslationDraft(
                                  translation.locale,
                                  "name",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <label className="gm-translationField">
                            Description
                            <textarea
                              value={translation.description || ""}
                              lang={translation.locale === "zh" ? "zh-Hans" : translation.locale}
                              dir={translation.locale === "ar" ? "rtl" : "ltr"}
                              disabled={!semanticAvailable}
                              placeholder="Description"
                              onChange={(event) =>
                                updateTranslationDraft(
                                  translation.locale,
                                  "description",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="gm-semanticSection gm-semanticAliases">
                    <h4>Aliases</h4>
                    <textarea
                      value={semanticDraft.aliasesText}
                      disabled={!semanticAvailable}
                      placeholder="One alias per line. Example: garlic | en | US | display"
                      onChange={(event) =>
                        setSemanticDraft((current) => ({
                          ...current,
                          aliasesText: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="gm-modalActions">
                  <button type="button" onClick={closeSemanticEditor}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="gm-primaryBtn"
                    disabled={!semanticAvailable || !semanticLoaded || semanticSaving || semanticTranslating || semanticSaveBlocked}
                    onClick={saveSemanticEditor}
                  >
                    {semanticSaving ? "Guardando…" : "Guardar y confirmar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
