import React, { useEffect, useMemo, useState } from "react";
import "../../styles/IngredientsModule.css";
import { Tree } from "react-arborist";
import api from "../../setupAxios";

const SEMANTIC_LOCALES = ["es", "en", "it", "fr", "pt", "ar", "zh"];
const CORE_REVIEW_LOCALES = ["es", "en", "it"];
const SEMANTIC_STATUSES = ["UNREVIEWED", "NEEDS_REVIEW", "REVIEWED", "REJECTED"];
const IMAGE_REVIEW_STATUSES = ["REVIEWED", "REJECTED", "DEPRECATED"];

const SEMANTIC_AUDIT_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "REVIEWED", label: "Reviewed" },
  { key: "NEEDS_REVIEW", label: "Needs review" },
  { key: "UNREVIEWED", label: "Unreviewed" },
  { key: "MISSING_KEY", label: "Missing key" },
  { key: "MISSING_CATEGORY", label: "Missing category" },
  { key: "MISSING_TRANSLATIONS", label: "Missing i18n" },
  { key: "REJECTED", label: "Rejected" },
];

const LOCAL_SEMANTIC_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "UNMAPPED", label: "Unmapped" },
  { key: "MAPPED", label: "Mapped" },
  { key: "AMBIGUOUS", label: "Ambiguous" },
  { key: "SUGGESTED", label: "Suggested" },
];

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
const getIngredientDisplayName = (ingredient = {}) =>
  ingredient.displayName || ingredient.name || "";

const buildEmptyTranslations = () =>
  SEMANTIC_LOCALES.map((locale) => ({
    locale,
    name: "",
    description: "",
    isReviewed: false,
  }));

const buildSemanticDraft = (ingredient = {}) => ({
  canonicalKey: ingredient.canonicalKey || "",
  semanticStatus: ingredient.semanticStatus || "UNREVIEWED",
  semanticCategoryId: ingredient.semanticCategoryId || "",
  translations: buildEmptyTranslations(),
  aliasesText: "",
});

const mergeSemanticTranslations = (translations = []) => {
  const byLocale = new Map(
    translations.map((translation) => [translation.locale, translation])
  );

  return buildEmptyTranslations().map((empty) => ({
    ...empty,
    ...(byLocale.get(empty.locale) || {}),
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

const getSemanticStatusClass = (status) =>
  `status-${String(status || "UNREVIEWED").toLowerCase().replace(/_/g, "-")}`;

const formatSemanticStatus = (status) =>
  String(status || "UNREVIEWED").toLowerCase().replace(/_/g, " ");

const getImageStatusClass = (status) =>
  `image-${String(status || "MISSING").toLowerCase().replace(/_/g, "-")}`;

const formatImageStatus = (status) =>
  String(status || "MISSING").toLowerCase().replace(/_/g, " ");

const getReviewedTranslationLocales = (translations = []) =>
  new Set(
    translations
      .filter(
        (translation) =>
          translation.isReviewed === true &&
          String(translation.name || "").trim()
      )
      .map((translation) => translation.locale)
  );

const getIngredientSemanticStatus = (ingredient = {}) =>
  ingredient.semanticStatus || "UNREVIEWED";

const getIngredientMissingLocales = (ingredient = {}) => {
  if (getIngredientSemanticStatus(ingredient) === "REJECTED") return [];

  const translations = Array.isArray(ingredient.semanticTranslations)
    ? ingredient.semanticTranslations
    : [];

  return SEMANTIC_LOCALES.filter(
    (locale) =>
      !translations.some(
        (translation) =>
          translation.locale === locale &&
          translation.isReviewed === true &&
          String(translation.name || "").trim()
      )
  );
};

const getIngredientSemanticGaps = (ingredient = {}) => {
  if (getIngredientSemanticStatus(ingredient) === "REJECTED") return [];

  const gaps = [];
  const missingLocales = getIngredientMissingLocales(ingredient);

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
      title: `Missing reviewed translations: ${missingLocales
        .map((locale) => locale.toUpperCase())
        .join(", ")}`,
    });
  }

  return gaps;
};

const getIngredientSemanticPriority = (ingredient = {}) => {
  if (getIngredientSemanticStatus(ingredient) === "REJECTED") return 100;
  if (!String(ingredient.canonicalKey || "").trim()) return 10;
  if (!ingredient.semanticCategoryId) return 20;
  if (getIngredientMissingLocales(ingredient).length > 0) return 30;
  if (getIngredientSemanticStatus(ingredient) === "NEEDS_REVIEW") return 40;
  if (getIngredientSemanticStatus(ingredient) === "UNREVIEWED") return 50;
  return 100;
};

const getSemanticDraftValidation = (draft = {}) => {
  const reviewedLocales = getReviewedTranslationLocales(draft.translations || []);
  const missingCoreLocales = CORE_REVIEW_LOCALES.filter(
    (locale) => !reviewedLocales.has(locale)
  );
  const missingLocales = SEMANTIC_LOCALES.filter(
    (locale) => !reviewedLocales.has(locale)
  );
  const warnings = [];
  const criticalIssues = [];

  if (!String(draft.canonicalKey || "").trim()) warnings.push("Missing global identity key");
  if (!draft.semanticCategoryId) warnings.push("Missing semantic category");
  if (missingCoreLocales.length > 0) {
    warnings.push(
      `Missing reviewed core names: ${missingCoreLocales
        .map((locale) => locale.toUpperCase())
        .join(", ")}`
    );
  }
  if (missingLocales.length > CORE_REVIEW_LOCALES.length) {
    warnings.push(
      `Incomplete language coverage: ${missingLocales
        .map((locale) => locale.toUpperCase())
        .join(", ")}`
    );
  }
  if (String(draft.aliasesText || "").trim() === "") warnings.push("No searchable aliases yet");

  if (draft.semanticStatus === "REVIEWED") {
    if (!String(draft.canonicalKey || "").trim()) {
      criticalIssues.push("REVIEWED requires a global identity key");
    }
    if (!draft.semanticCategoryId) {
      criticalIssues.push("REVIEWED requires a semantic category");
    }
    if (missingCoreLocales.length > 0) {
      criticalIssues.push(
        `REVIEWED requires reviewed names in ${missingCoreLocales
          .map((locale) => locale.toUpperCase())
          .join(" and ")}`
      );
    }
  }

  return { criticalIssues, warnings, missingCoreLocales, missingLocales };
};

export default function IngredientsModule() {
  const [ingredients, setIngredients] = useState([]);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientCategory, setNewIngredientCategory] = useState("OTROS");
  const [newIngredientAllergens, setNewIngredientAllergens] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [semanticCategories, setSemanticCategories] = useState([]);
  const [semanticAvailable, setSemanticAvailable] = useState(null);
  const [semanticError, setSemanticError] = useState("");
  const [semanticIngredient, setSemanticIngredient] = useState(null);
  const [semanticDraft, setSemanticDraft] = useState(buildSemanticDraft());
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticSaving, setSemanticSaving] = useState(false);
  const [semanticAuditFilter, setSemanticAuditFilter] = useState("ALL");
  const [localSemanticMappings, setLocalSemanticMappings] = useState([]);
  const [localSemanticOptions, setLocalSemanticOptions] = useState([]);
  const [localSemanticDrafts, setLocalSemanticDrafts] = useState({});
  const [localSemanticLoading, setLocalSemanticLoading] = useState(false);
  const [localSemanticSavingId, setLocalSemanticSavingId] = useState(null);
  const [localSemanticFilter, setLocalSemanticFilter] = useState("ALL");
  const [imageReviewSavingId, setImageReviewSavingId] = useState(null);
  const [imageUploadSavingId, setImageUploadSavingId] = useState(null);

  const semanticCatalogIngredients = useMemo(
    () => ingredients.filter((ingredient) => ingredient.isSystem !== false),
    [ingredients]
  );

  const loadIngredients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ingredients");
      setIngredients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
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

  const buildLocalSemanticDrafts = (items = []) => {
    const drafts = {};
    items.forEach((ingredient) => {
      drafts[ingredient.id] = {
        globalIngredientId:
          ingredient.semanticMapping?.globalIngredientId ||
          ingredient.semanticMapping?.globalIngredient?.id ||
          ingredient.suggestedMapping?.globalIngredientId ||
          "",
        status: ingredient.semanticMapping?.status || "MAPPED",
        notes: ingredient.semanticMapping?.notes || "",
      };
    });
    return drafts;
  };

  const loadLocalSemanticMappings = async () => {
    try {
      setLocalSemanticLoading(true);
      const res = await api.get("/ingredients/local-semantic-mappings");
      const localIngredients = Array.isArray(res.data?.ingredients)
        ? res.data.ingredients
        : [];
      setLocalSemanticMappings(localIngredients);
      setLocalSemanticOptions(
        Array.isArray(res.data?.globalOptions) ? res.data.globalOptions : []
      );
      setLocalSemanticDrafts(buildLocalSemanticDrafts(localIngredients));
    } catch (err) {
      console.error(err);
    } finally {
      setLocalSemanticLoading(false);
    }
  };

  useEffect(() => {
    loadIngredients();
    loadSuggestions();
    loadSemanticCategories();
    loadLocalSemanticMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const name = String(newIngredientName || "").trim();
    const category = getCanonicalCategory(newIngredientCategory);
    const allergens = String(newIngredientAllergens || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    if (!name || !category) return;

    try {
      await api.post("/ingredients", { name, category, allergens });
      setNewIngredientName("");
      setNewIngredientAllergens("");
      await loadIngredients();
    } catch (err) {
      console.error(err);
    }
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
    const confirmed = window.confirm(
      `Delete ${getDisplayName(name)} from the ingredients table?`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/ingredients/${id}`);
      await loadIngredients();
    } catch (err) {
      console.error(err);
    }
  };

  const openSemanticEditor = async (ingredient) => {
    const ingredientId = ingredient?.idValue || ingredient?.ingredientId || ingredient?.id;
    if (!ingredientId) return;

    setSemanticIngredient(ingredient);
    setSemanticDraft(buildSemanticDraft(ingredient));
    setSemanticLoading(true);
    setSemanticError("");

    try {
      const res = await api.get(`/ingredients/${ingredientId}/semantics`);
      const data = res.data || {};
      setSemanticAvailable(true);
      setSemanticDraft({
        canonicalKey: data.canonicalKey || "",
        semanticStatus: data.semanticStatus || "UNREVIEWED",
        semanticCategoryId: data.semanticCategoryId || "",
        translations: mergeSemanticTranslations(data.translations || []),
        aliasesText: formatAliasLines(data.aliases || []),
      });
    } catch (err) {
      if (err?.response?.status === 409) {
        setSemanticAvailable(false);
        setSemanticError("Semantic migration pending");
        return;
      }
      console.error(err);
      setSemanticError("Could not load semantic data");
    } finally {
      setSemanticLoading(false);
    }
  };

  const closeSemanticEditor = () => {
    setSemanticIngredient(null);
    setSemanticDraft(buildSemanticDraft());
    setSemanticLoading(false);
    setSemanticSaving(false);
  };

  const updateTranslationDraft = (locale, field, value) => {
    setSemanticDraft((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === locale
          ? { ...translation, [field]: value }
          : translation
      ),
    }));
  };

  const saveSemanticEditor = async () => {
    if (!semanticIngredient || !semanticAvailable) return;

    const ingredientId =
      semanticIngredient.idValue ||
      semanticIngredient.ingredientId ||
      semanticIngredient.id;
    if (!ingredientId) return;

    const translations = semanticDraft.translations
      .map((translation) => ({
        ...translation,
        name: String(translation.name || "").trim(),
        description: String(translation.description || "").trim(),
      }))
      .filter((translation) => translation.name);

    try {
      setSemanticSaving(true);
      await api.patch(`/ingredients/${ingredientId}/semantics`, {
        canonicalKey: semanticDraft.canonicalKey,
        semanticStatus: semanticDraft.semanticStatus,
        semanticCategoryId: semanticDraft.semanticCategoryId || null,
        translations,
        aliases: parseAliasLines(semanticDraft.aliasesText),
      });
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

  const updateLocalSemanticDraft = (ingredientId, field, value) => {
    setLocalSemanticDrafts((current) => ({
      ...current,
      [ingredientId]: {
        ...(current[ingredientId] || { status: "MAPPED" }),
        [field]: value,
      },
    }));
  };

  const saveLocalSemanticMapping = async (ingredientId) => {
    const draft = localSemanticDrafts[ingredientId] || {};
    if (!draft.globalIngredientId) return;

    try {
      setLocalSemanticSavingId(ingredientId);
      await api.patch(`/ingredients/local-semantic-mappings/${ingredientId}`, {
        globalIngredientId: draft.globalIngredientId,
        status: draft.status || "MAPPED",
        notes: draft.notes || "",
      });
      await Promise.all([loadIngredients(), loadLocalSemanticMappings()]);
    } catch (err) {
      console.error(err);
    } finally {
      setLocalSemanticSavingId(null);
    }
  };

  const applyLocalSemanticSuggestion = async (ingredient, suggestion) => {
    if (!ingredient?.id || !suggestion?.globalIngredientId || suggestion?.isAmbiguous) {
      return;
    }

    updateLocalSemanticDraft(
      ingredient.id,
      "globalIngredientId",
      suggestion.globalIngredientId
    );
    updateLocalSemanticDraft(ingredient.id, "status", "SUGGESTED_ACCEPTED");
    await saveLocalSemanticMapping(ingredient.id);
  };

  const deleteLocalSemanticMapping = async (ingredientId) => {
    try {
      setLocalSemanticSavingId(ingredientId);
      await api.delete(`/ingredients/local-semantic-mappings/${ingredientId}`);
      await Promise.all([loadIngredients(), loadLocalSemanticMappings()]);
    } catch (err) {
      console.error(err);
    } finally {
      setLocalSemanticSavingId(null);
    }
  };

  const updateIngredientImageReview = async (ingredient, imageStatus) => {
    const ingredientId = ingredient?.ingredientId || ingredient?.id;
    if (!ingredientId) return;

    try {
      setImageReviewSavingId(ingredientId);
      await api.patch(`/ingredients/${ingredientId}/image-review`, {
        imageStatus,
        reviewedBy: "global-manager",
        imagePolicyVersion: "v1",
      });
      await loadIngredients();
    } catch (err) {
      console.error(err);
      setSemanticError(
        err?.response?.data?.error || "Could not update ingredient image review"
      );
    } finally {
      setImageReviewSavingId(null);
    }
  };

  const uploadIngredientImageDraft = async (ingredient, file, options = {}) => {
    const ingredientId = ingredient?.ingredientId || ingredient?.id;
    if (!ingredientId || !file) return;

    try {
      setImageUploadSavingId(ingredientId);
      const payload = new FormData();
      payload.append("image", file);
      payload.append("imageSource", options.imageSource || "MANUAL_UPLOAD");
      payload.append(
        "imagePrompt",
        options.imagePrompt ||
          `White background ingredient identity image for ${getIngredientDisplayName(
            ingredient
          )}`
      );

      await api.patch(`/ingredients/${ingredientId}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadIngredients();
    } catch (err) {
      console.error(err);
      setSemanticError(
        err?.response?.data?.error || "Could not upload ingredient image"
      );
    } finally {
      setImageUploadSavingId(null);
    }
  };

  const semanticAudit = semanticCatalogIngredients.reduce(
    (acc, ingredient) => {
      const status = getIngredientSemanticStatus(ingredient);
      acc.total += 1;
      acc.statuses[status] = (acc.statuses[status] || 0) + 1;
      acc.translationCount += Number(ingredient.translationCount || 0);
      acc.aliasCount += Number(ingredient.aliasCount || 0);
      if (!String(ingredient.canonicalKey || "").trim() && status !== "REJECTED") {
        acc.missingKey += 1;
      }
      if (!ingredient.semanticCategoryId && status !== "REJECTED") {
        acc.missingCategory += 1;
      }
      if (getIngredientMissingLocales(ingredient).length > 0) {
        acc.missingTranslations += 1;
      }
      SEMANTIC_LOCALES.forEach((locale) => {
        const reviewed = (ingredient.semanticTranslations || []).some(
          (translation) =>
            translation.locale === locale &&
            translation.isReviewed === true &&
            String(translation.name || "").trim()
        );
        if (reviewed) acc.localeCoverage[locale] += 1;
      });
      return acc;
    },
    {
      total: 0,
      statuses: {},
      missingKey: 0,
      missingCategory: 0,
      missingTranslations: 0,
      translationCount: 0,
      aliasCount: 0,
      localeCoverage: Object.fromEntries(SEMANTIC_LOCALES.map((locale) => [locale, 0])),
    }
  );

  const semanticReviewedPercent = semanticAudit.total
    ? Math.round(((semanticAudit.statuses.REVIEWED || 0) / semanticAudit.total) * 100)
    : 0;

  const ingredientMatchesAuditFilter = (ingredient) => {
    const status = getIngredientSemanticStatus(ingredient);
    if (semanticAuditFilter === "ALL") return true;
    if (semanticAuditFilter === "MISSING_KEY") {
      return status !== "REJECTED" && !String(ingredient.canonicalKey || "").trim();
    }
    if (semanticAuditFilter === "MISSING_CATEGORY") {
      return status !== "REJECTED" && !ingredient.semanticCategoryId;
    }
    if (semanticAuditFilter === "MISSING_TRANSLATIONS") {
      return status !== "REJECTED" && getIngredientMissingLocales(ingredient).length > 0;
    }
    return status === semanticAuditFilter;
  };

  const filteredIngredients = semanticCatalogIngredients.filter(ingredientMatchesAuditFilter);
  const semanticWorkQueue = filteredIngredients
    .filter((ingredient) => getIngredientSemanticPriority(ingredient) < 100)
    .sort((a, b) => {
      const priorityDiff =
        getIngredientSemanticPriority(a) - getIngredientSemanticPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return String(getIngredientDisplayName(a)).localeCompare(
        String(getIngredientDisplayName(b)),
        "es",
        { sensitivity: "base" }
      );
    });
  const nextSemanticIssue = semanticWorkQueue[0] || null;
  const semanticDraftValidation = getSemanticDraftValidation(semanticDraft);
  const semanticSaveBlocked = semanticDraftValidation.criticalIssues.length > 0;

  const localMappedCount = localSemanticMappings.filter(
    (ingredient) => ingredient.semanticMapping?.globalIngredientId
  ).length;
  const localUnmappedCount = localSemanticMappings.length - localMappedCount;
  const localAmbiguousCount = localSemanticMappings.filter(
    (ingredient) => ingredient.suggestedMapping?.isAmbiguous
  ).length;

  const filteredLocalSemanticMappings = localSemanticMappings.filter((ingredient) => {
    const mapped = Boolean(ingredient.semanticMapping?.globalIngredientId);
    const suggested = Boolean(ingredient.suggestedMapping?.globalIngredientId);
    const ambiguous = Boolean(ingredient.suggestedMapping?.isAmbiguous);
    if (localSemanticFilter === "UNMAPPED") return !mapped;
    if (localSemanticFilter === "MAPPED") return mapped;
    if (localSemanticFilter === "AMBIGUOUS") return ambiguous;
    if (localSemanticFilter === "SUGGESTED") return suggested;
    return true;
  });

  const getLocalSemanticFilterCount = (filterKey) => {
    if (filterKey === "UNMAPPED") return localUnmappedCount;
    if (filterKey === "MAPPED") return localMappedCount;
    if (filterKey === "AMBIGUOUS") return localAmbiguousCount;
    if (filterKey === "SUGGESTED") {
      return localSemanticMappings.filter(
        (ingredient) => ingredient.suggestedMapping?.globalIngredientId
      ).length;
    }
    return localSemanticMappings.length;
  };

  const treeCategories = filteredIngredients.reduce((acc, ingredient) => {
    const canonicalCategory = getCanonicalCategory(ingredient.category);
    if (!acc[canonicalCategory]) acc[canonicalCategory] = [];
    acc[canonicalCategory].push(ingredient);
    return acc;
  }, {});

  const treeData = Object.entries(treeCategories)
    .sort(([a], [b]) => getCategoryLabel(a).localeCompare(getCategoryLabel(b), "es"))
    .map(([category, items]) => ({
      id: `cat-${category}`,
      name: getCategoryLabel(category),
      children: items
        .sort((a, b) =>
          getIngredientDisplayName(a).localeCompare(getIngredientDisplayName(b), "es", {
            sensitivity: "base",
          })
        )
        .map((ingredient) => ({
          id: `ing-${ingredient.id}`,
          idValue: ingredient.id,
          ingredientId: ingredient.id,
          name: ingredient.name,
          displayName: ingredient.displayName || ingredient.name,
          category: ingredient.category,
          canonicalKey: ingredient.canonicalKey || "",
          semanticStatus: ingredient.semanticStatus || "UNREVIEWED",
          semanticCategoryId: ingredient.semanticCategoryId || "",
          translationCount: ingredient.translationCount || 0,
          aliasCount: ingredient.aliasCount || 0,
          semanticTranslations: ingredient.semanticTranslations || [],
          semanticAliases: ingredient.semanticAliases || [],
          semanticGaps: getIngredientSemanticGaps(ingredient),
          allergens: ingredient.allergens || [],
          image: ingredient.image || "",
          imageStatus: ingredient.imageStatus || "MISSING",
          imageSource: ingredient.imageSource || "",
          imageReviewedAt: ingredient.imageReviewedAt || "",
          imageReviewedBy: ingredient.imageReviewedBy || "",
          imageVersion: ingredient.imageVersion || 0,
          imagePolicyVersion: ingredient.imagePolicyVersion || "",
        })),
    }));

  const categoriesForCreate = [
    ...new Set([
      ...Object.keys(CATEGORY_LABELS),
      ...ingredients.map((ingredient) => getCanonicalCategory(ingredient.category)),
    ]),
  ].sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b), "es"));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <input
          value={newIngredientName}
          onChange={(event) => setNewIngredientName(event.target.value)}
          placeholder="Ingredient name"
        />
        <select
          value={newIngredientCategory}
          onChange={(event) => setNewIngredientCategory(event.target.value)}
        >
          {categoriesForCreate.map((category) => (
            <option key={category} value={category}>
              {getCategoryLabel(category)}
            </option>
          ))}
        </select>
        <input
          value={newIngredientAllergens}
          onChange={(event) => setNewIngredientAllergens(event.target.value)}
          placeholder="Allergens, comma separated"
        />
        <button type="button" onClick={handleCreate}>
          Add ingredient
        </button>
      </div>

      <section className="gm-semanticAudit" aria-label="Semantic audit">
        <div className="gm-auditHeader">
          <div>
            <span>Semantic audit</span>
            <strong>
              {semanticAudit.statuses.REVIEWED || 0}/{semanticAudit.total} reviewed
            </strong>
          </div>
          <div className="gm-auditProgress" aria-hidden="true">
            <span style={{ width: `${semanticReviewedPercent}%` }} />
          </div>
        </div>

        <div className="gm-auditMetrics">
          {SEMANTIC_AUDIT_FILTERS.map((filter) => {
            const value =
              filter.key === "ALL"
                ? semanticAudit.total
                : filter.key === "MISSING_KEY"
                  ? semanticAudit.missingKey
                  : filter.key === "MISSING_CATEGORY"
                    ? semanticAudit.missingCategory
                    : filter.key === "MISSING_TRANSLATIONS"
                      ? semanticAudit.missingTranslations
                      : semanticAudit.statuses[filter.key] || 0;

            return (
              <button
                key={filter.key}
                type="button"
                className={`gm-auditCard ${
                  semanticAuditFilter === filter.key ? "is-active" : ""
                }`}
                onClick={() => setSemanticAuditFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <strong>{value}</strong>
              </button>
            );
          })}
        </div>

        <div className="gm-auditSecondary">
          <span>
            {filteredIngredients.length}/{semanticAudit.total} showing
          </span>
          <span>{semanticWorkQueue.length} actionable</span>
          <span>{semanticAudit.translationCount} translations</span>
          <span>{semanticAudit.aliasCount} aliases</span>
          {semanticAvailable === false && (
            <span className="gm-auditWarning">{semanticError}</span>
          )}
        </div>

        <div className="gm-auditWorkQueue">
          <button
            type="button"
            className="gm-auditAction"
            disabled={!nextSemanticIssue || semanticAvailable === false}
            onClick={() => openSemanticEditor(nextSemanticIssue)}
          >
            Open next issue
          </button>
          <span>
            {nextSemanticIssue
              ? `${getDisplayName(
                  getIngredientDisplayName(nextSemanticIssue)
                )} - ${getIngredientSemanticGaps(nextSemanticIssue)
                  .map((gap) => gap.label)
                  .join(", ")}`
              : "No actionable semantic issues in this view"}
          </span>
        </div>

        <div className="gm-localeCoverage">
          {SEMANTIC_LOCALES.map((locale) => (
            <span key={locale}>
              <strong>{locale.toUpperCase()}</strong>
              {semanticAudit.localeCoverage[locale]}/{semanticAudit.total}
            </span>
          ))}
        </div>
      </section>

      <section className="gm-localSemantic" aria-label="Local ingredient mapping">
        <div className="gm-auditHeader">
          <div>
            <span>Local ingredient mapping</span>
            <strong>
              {localMappedCount}/{localSemanticMappings.length} mapped
            </strong>
          </div>
          <div className="gm-auditProgress" aria-hidden="true">
            <span
              style={{
                width: localSemanticMappings.length
                  ? `${Math.round((localMappedCount / localSemanticMappings.length) * 100)}%`
                  : "0%",
              }}
            />
          </div>
        </div>

        <div className="gm-auditSecondary">
          <span>{localSemanticOptions.length} reviewed global options</span>
          <span>
            {filteredLocalSemanticMappings.length}/{localSemanticMappings.length} showing
          </span>
          <span>{localUnmappedCount} unmapped local</span>
          <span>{localAmbiguousCount} ambiguous</span>
          {localSemanticLoading && <span>Loading local mappings</span>}
        </div>

        <div className="gm-auditMetrics gm-localSemanticMetrics">
          {LOCAL_SEMANTIC_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`gm-auditCard ${
                localSemanticFilter === filter.key ? "is-active" : ""
              }`}
              onClick={() => setLocalSemanticFilter(filter.key)}
            >
              <span>{filter.label}</span>
              <strong>{getLocalSemanticFilterCount(filter.key)}</strong>
            </button>
          ))}
        </div>

        <div className="gm-localSemanticList">
          {localSemanticMappings.length === 0 && (
            <p>No local ingredients outside the global catalog.</p>
          )}
          {localSemanticMappings.length > 0 &&
            filteredLocalSemanticMappings.length === 0 && (
              <p>No local ingredients match this filter.</p>
            )}

          {filteredLocalSemanticMappings.map((ingredient) => {
            const draft = localSemanticDrafts[ingredient.id] || {};
            const mappedName =
              ingredient.semanticMapping?.globalIngredient?.displayName ||
              ingredient.semanticMapping?.globalIngredient?.name ||
              "";
            const suggestedName =
              ingredient.suggestedMapping?.globalIngredient?.displayName ||
              ingredient.suggestedMapping?.globalIngredient?.name ||
              "";
            const suggestionAlternatives = Array.isArray(
              ingredient.suggestionAlternatives
            )
              ? ingredient.suggestionAlternatives
              : [];
            const saving = Number(localSemanticSavingId) === Number(ingredient.id);

            return (
              <div className="gm-localSemanticRow" key={ingredient.id}>
                <div className="gm-localSemanticInfo">
                  <strong>{getIngredientDisplayName(ingredient)}</strong>
                  <span>{ingredient.category || "No category"}</span>
                  <small>
                    {mappedName
                      ? `Mapped to ${mappedName}`
                      : suggestedName
                        ? `Suggested ${suggestedName}`
                        : "No global identity yet"}
                  </small>
                  {suggestionAlternatives.length > 0 && (
                    <div className="gm-localSemanticAlternatives">
                      <span>Smart alternatives</span>
                      {suggestionAlternatives.slice(0, 4).map((suggestion) => {
                        const selected =
                          String(draft.globalIngredientId || "") ===
                          String(suggestion.globalIngredientId || "");
                        const label =
                          suggestion.globalIngredient?.displayName ||
                          suggestion.globalIngredient?.name ||
                          suggestion.globalIngredient?.canonicalKey ||
                          "Global option";

                        return (
                          <button
                            key={`${ingredient.id}-${suggestion.globalIngredientId}`}
                            type="button"
                            className={selected ? "is-selected" : ""}
                            disabled={saving || suggestion.isAmbiguous}
                            title={
                              suggestion.isAmbiguous
                                ? "Ambiguous suggestion must be reviewed manually"
                                : ""
                            }
                            onClick={() => {
                              updateLocalSemanticDraft(
                                ingredient.id,
                                "globalIngredientId",
                                suggestion.globalIngredientId
                              );
                              updateLocalSemanticDraft(
                                ingredient.id,
                                "status",
                                "SUGGESTED_ACCEPTED"
                              );
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <select
                  value={draft.globalIngredientId || ""}
                  disabled={saving}
                  onChange={(event) =>
                    updateLocalSemanticDraft(
                      ingredient.id,
                      "globalIngredientId",
                      event.target.value
                    )
                  }
                >
                  <option value="">Select global identity</option>
                  {localSemanticOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.displayName || option.name || option.canonicalKey}
                    </option>
                  ))}
                </select>

                <div className="gm-localSemanticActions">
                  <button
                    type="button"
                    disabled={!draft.globalIngredientId || saving}
                    onClick={() => saveLocalSemanticMapping(ingredient.id)}
                  >
                    {saving ? "Saving" : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      saving ||
                      !ingredient.suggestedMapping?.globalIngredientId ||
                      ingredient.suggestedMapping?.isAmbiguous
                    }
                    onClick={() =>
                      applyLocalSemanticSuggestion(
                        ingredient,
                        ingredient.suggestedMapping
                      )
                    }
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    disabled={saving || !ingredient.semanticMapping}
                    onClick={() => deleteLocalSemanticMapping(ingredient.id)}
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="gm-tree">
          <Tree data={treeData} openByDefault height={720} rowHeight={30} width="100%">
            {({ node, style }) => {
              const isCategoryNode = Array.isArray(node.data.children);
              const isIngredientNode = node.isLeaf && !isCategoryNode;

              return (
                <div
                  style={style}
                  className={`gm-node ${isIngredientNode ? "leaf" : "parent"}`}
                  onClick={() => {
                    if (isCategoryNode || !node.isLeaf) node.toggle();
                  }}
                >
                  <div className="gm-node-left">
                    {(isCategoryNode || !node.isLeaf) && (
                      <span className="gm-arrow">{node.isOpen ? "-" : "+"}</span>
                    )}
                    {node.isLeaf && <span className="gm-dot">-</span>}
                    <span className="gm-name">
                      {isIngredientNode
                        ? getDisplayName(node.data.displayName || node.data.name)
                        : node.data.name}
                    </span>
                  </div>

                  {isIngredientNode && (
                    <div className="gm-node-right">
                      {node.data.image ? (
                        <span className="gm-imageThumb">
                          <img src={node.data.image} alt="" />
                        </span>
                      ) : (
                        <span className="gm-imageThumb gm-imageThumb--empty">IMG</span>
                      )}

                      {node.data.semanticGaps?.length > 0 && (
                        <div className="gm-semanticGaps">
                          {node.data.semanticGaps.map((gap) => (
                            <span key={gap.key} title={gap.title}>
                              {gap.label}
                            </span>
                          ))}
                        </div>
                      )}

                      <span
                        className={`gm-semanticStatusBadge ${getSemanticStatusClass(
                          node.data.semanticStatus
                        )}`}
                      >
                        {formatSemanticStatus(node.data.semanticStatus)}
                      </span>

                      <span
                        className={`gm-imageStatusBadge ${getImageStatusClass(
                          node.data.imageStatus
                        )}`}
                      >
                        {formatImageStatus(node.data.imageStatus)}
                      </span>

                      <button
                        type="button"
                        className="gm-semanticBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          openSemanticEditor(node.data);
                        }}
                      >
                        Semantics
                      </button>

                      <div className="gm-imageActions">
                        <label
                          className={`gm-imageUpload ${
                            Number(imageUploadSavingId) ===
                            Number(node.data.ingredientId)
                              ? "is-saving"
                              : ""
                          }`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {Number(imageUploadSavingId) ===
                          Number(node.data.ingredientId)
                            ? "Uploading"
                            : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={
                              Number(imageUploadSavingId) ===
                                Number(node.data.ingredientId) ||
                              Number(imageReviewSavingId) ===
                                Number(node.data.ingredientId)
                            }
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              event.target.value = "";
                              uploadIngredientImageDraft(node.data, file);
                            }}
                          />
                        </label>

                        {IMAGE_REVIEW_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={
                              status === "REVIEWED" ? "gm-imageApproveBtn" : ""
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              updateIngredientImageReview(node.data, status);
                            }}
                            disabled={
                              !node.data.image ||
                              node.data.imageStatus === status ||
                              Number(imageReviewSavingId) ===
                                Number(node.data.ingredientId)
                            }
                          >
                            {status === "REVIEWED"
                              ? "Approve"
                              : status === "REJECTED"
                                ? "Reject"
                                : "Deprecate"}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="gm-deleteBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteIngredient(
                            node.data.ingredientId,
                            getIngredientDisplayName(node.data)
                          );
                        }}
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
          </Tree>
        </div>
      )}

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
              <button type="button" onClick={closeSemanticEditor}>
                x
              </button>
            </div>

            {semanticLoading ? (
              <p>Loading semantic data...</p>
            ) : (
              <>
                {semanticError && <div className="gm-semanticError">{semanticError}</div>}
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
                    Semantic status
                    <select
                      value={semanticDraft.semanticStatus}
                      disabled={!semanticAvailable}
                      onChange={(event) =>
                        setSemanticDraft((current) => ({
                          ...current,
                          semanticStatus: event.target.value,
                        }))
                      }
                    >
                      {SEMANTIC_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
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
                          {category.displayName || category.name || category.key}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="gm-semanticSection">
                  <h4>Reviewed translations</h4>
                  <div className="gm-translationGrid">
                    {semanticDraft.translations.map((translation) => (
                      <div className="gm-translationCard" key={translation.locale}>
                        <div>
                          <strong>{translation.locale.toUpperCase()}</strong>
                          <label>
                            <input
                              type="checkbox"
                              checked={translation.isReviewed === true}
                              disabled={!semanticAvailable}
                              onChange={(event) =>
                                updateTranslationDraft(
                                  translation.locale,
                                  "isReviewed",
                                  event.target.checked
                                )
                              }
                            />
                            Reviewed
                          </label>
                        </div>
                        <input
                          value={translation.name || ""}
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
                        <textarea
                          value={translation.description || ""}
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
                      </div>
                    ))}
                  </div>
                </div>

                <div className="gm-semanticSection">
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

                <div className="gm-modalActions">
                  <button type="button" onClick={closeSemanticEditor}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="gm-primaryBtn"
                    disabled={!semanticAvailable || semanticSaving || semanticSaveBlocked}
                    onClick={saveSemanticEditor}
                  >
                    {semanticSaving ? "Saving..." : "Save semantics"}
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
