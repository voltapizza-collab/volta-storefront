import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/IngredientsModule.css";
import api from "../../setupAxios";
import ingredientMasterSource from "../../data/ingredientMasterSource.json";

const SEMANTIC_LOCALES = ["es", "en", "it", "fr", "pt", "ar", "zh"];
const CORE_REVIEW_LOCALES = ["es", "en", "it"];
const SEMANTIC_STATUSES = ["UNREVIEWED", "NEEDS_REVIEW", "REVIEWED", "REJECTED"];
const IMAGE_REVIEW_STATUSES = ["REVIEWED", "REJECTED", "DEPRECATED"];
const IMAGE_BATCH_BASE = "/ingredient-image-candidates/batch-001";

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

const SEMANTIC_CATEGORY_BY_INGREDIENT_CATEGORY = {
  ACEITES_GRASAS_VINAGRES: "oils_fats_vinegars",
  AROMAS_Y_EXTRACTOS: "extras",
  CARNES: "meats",
  CREMAS_DULCES: "sweet_creams",
  EMBUTIDOS: "cured_meats",
  ENDULZANTES: "sweeteners",
  EXTRAS: "extras",
  FRUTAS: "fruits",
  HIERBAS_ESPECIAS: "herbs_spices",
  OTROS: "other",
  PESCADOS_Y_MARISCOS: "seafood",
  QUESOS: "cheeses",
  SALSAS: "sauces",
  SETAS: "mushrooms",
  VERDURAS: "vegetables",
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

const TRANSLATION_CONNECTORS = new Set(["de", "del", "la", "las", "el", "los", "y"]);

const TRANSLATION_DIRECT_DRAFTS = {
  aceite_de_albahaca: {
    en: "Basil oil",
    it: "Olio al basilico",
    fr: "Huile de basilic",
    pt: "Oleo de manjericao",
    ar: "زيت الريحان",
    zh: "罗勒油",
  },
};

const TRANSLATION_TERM_DRAFTS = {
  aceite: {
    en: "oil",
    it: "olio",
    fr: "huile",
    pt: "oleo",
    ar: "زيت",
    zh: "油",
  },
  albahaca: {
    en: "basil",
    it: "basilico",
    fr: "basilic",
    pt: "manjericao",
    ar: "ريحان",
    zh: "罗勒",
  },
  ajo: {
    en: "garlic",
    it: "aglio",
    fr: "ail",
    pt: "alho",
    ar: "ثوم",
    zh: "大蒜",
  },
  bacon: {
    en: "bacon",
    it: "bacon",
    fr: "bacon",
    pt: "bacon",
    ar: "لحم مقدد",
    zh: "培根",
  },
  champinones: {
    en: "button mushrooms",
    it: "funghi champignon",
    fr: "champignons de Paris",
    pt: "cogumelos champignon",
    ar: "فطر أبيض",
    zh: "白蘑菇",
  },
  chorizo: {
    en: "chorizo",
    it: "chorizo",
    fr: "chorizo",
    pt: "chourico",
    ar: "تشوريزو",
    zh: "西班牙辣香肠",
  },
  mozzarella: {
    en: "mozzarella",
    it: "mozzarella",
    fr: "mozzarella",
    pt: "mucarela",
    ar: "موزاريلا",
    zh: "马苏里拉奶酪",
  },
  pepperoni: {
    en: "pepperoni",
    it: "pepperoni",
    fr: "pepperoni",
    pt: "pepperoni",
    ar: "بيبروني",
    zh: "意式辣香肠",
  },
  salsa: {
    en: "sauce",
    it: "salsa",
    fr: "sauce",
    pt: "molho",
    ar: "صلصة",
    zh: "酱",
  },
  tomate: {
    en: "tomato",
    it: "pomodoro",
    fr: "tomate",
    pt: "tomate",
    ar: "طماطم",
    zh: "番茄",
  },
};

const formatDraftName = (value, locale) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (locale === "zh") return text.replace(/\s+/g, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const buildTranslationDraftName = (sourceName, locale) => {
  if (locale === "es") return "";

  const sourceKey = normalizeIngredientKey(sourceName);
  if (!sourceKey) return "";

  const directDraft = TRANSLATION_DIRECT_DRAFTS[sourceKey]?.[locale];
  if (directDraft) return directDraft;

  const tokens = sourceKey
    .split("_")
    .filter((token) => token && !TRANSLATION_CONNECTORS.has(token));
  if (tokens.length === 0) return "";

  const translatedTokens = tokens.map((token) => TRANSLATION_TERM_DRAFTS[token]?.[locale]);
  if (translatedTokens.some((token) => !token)) return "";

  return formatDraftName(translatedTokens.join(locale === "zh" ? "" : " "), locale);
};

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

const getSemanticReviewButtonClass = (ingredient = {}) => {
  const status = getIngredientSemanticStatus(ingredient);
  const hasGaps = getIngredientSemanticGaps(ingredient).length > 0;

  if (status === "REJECTED") return "gm-semanticBtn--rejected";
  if (status === "REVIEWED" && !hasGaps) return "gm-semanticBtn--reviewed";
  if (status === "NEEDS_REVIEW" || hasGaps) return "gm-semanticBtn--needsReview";
  return "gm-semanticBtn--missing";
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

const getIngredientId = (ingredient = {}) =>
  ingredient.idValue || ingredient.ingredientId || ingredient.id;

const getCandidateUrl = (candidate) => `${IMAGE_BATCH_BASE}/${candidate.file}`;

export default function IngredientsModule() {
  const [ingredients, setIngredients] = useState([]);
  const [newIngredientCategory, setNewIngredientCategory] = useState("OTROS");
  const [newIngredientCandidateName, setNewIngredientCandidateName] = useState("");
  const [creatingIngredient, setCreatingIngredient] = useState(false);
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
  const [imageReviewSavingId, setImageReviewSavingId] = useState(null);
  const [imageUploadSavingId, setImageUploadSavingId] = useState(null);
  const [imageCandidates, setImageCandidates] = useState([]);
  const [imageCandidateError, setImageCandidateError] = useState("");
  const [applyingCandidateKey, setApplyingCandidateKey] = useState("");
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const creatingIngredientRef = useRef(false);

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

  const availableMasterCandidates = useMemo(() => {
    const category = getCanonicalCategory(newIngredientCategory);
    return ingredientMasterSource
      .filter((candidate) => getCanonicalCategory(candidate.category) === category)
      .filter((candidate) => {
        const candidateKeys = [
          candidate.canonicalKey,
          candidate.defaultName,
          candidate.translations?.es,
          ...(candidate.aliases || []),
        ]
          .map(normalizeIngredientKey)
          .filter(Boolean);
        return !candidateKeys.some((key) => existingIngredientKeys.has(key));
      })
      .sort((a, b) => String(a.defaultName).localeCompare(String(b.defaultName)));
  }, [existingIngredientKeys, newIngredientCategory]);

  const groupedIngredients = useMemo(() => {
    const groups = new Map();
    semanticCatalogIngredients.forEach((ingredient) => {
      const category = getCanonicalCategory(ingredient.category);
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
  }, [semanticCatalogIngredients]);

  const candidateMatches = useMemo(() => {
    return imageCandidates
      .map((candidate) => {
        const match = semanticCatalogIngredients.find((ingredient) => {
          const ingredientKeys = [
            ingredient.canonicalKey,
            ingredient.name,
            ingredient.displayName,
            ...(ingredient.semanticAliases || []).map((alias) => alias.alias),
          ].map(normalizeIngredientKey);

          return (
            (candidate.ingredientId &&
              Number(candidate.ingredientId) === Number(getIngredientId(ingredient))) ||
            ingredientKeys.includes(normalizeIngredientKey(candidate.semanticKey))
          );
        });

        return { ...candidate, ingredient: match || null };
      })
      .filter((candidate) => candidate.ingredient);
  }, [imageCandidates, semanticCatalogIngredients]);

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

  const loadImageCandidates = async () => {
    try {
      setImageCandidateError("");
      const response = await fetch(`${IMAGE_BATCH_BASE}/manifest.json`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Image candidate manifest unavailable");
      const manifest = await response.json();
      setImageCandidates(Array.isArray(manifest.items) ? manifest.items : []);
    } catch (err) {
      console.error(err);
      setImageCandidateError("Image candidate batch is not available.");
      setImageCandidates([]);
    }
  };

  useEffect(() => {
    loadIngredients();
    loadSuggestions();
    loadSemanticCategories();
    loadImageCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!newIngredientCandidateName && availableMasterCandidates.length > 0) {
      setNewIngredientCandidateName(availableMasterCandidates[0].defaultName);
    }
  }, [availableMasterCandidates, newIngredientCandidateName]);

  const toggleCategory = (category) => {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleCreate = async () => {
    if (creatingIngredientRef.current) return;

    const selectedName = String(newIngredientCandidateName || "").trim();
    const selectedCategory = getCanonicalCategory(newIngredientCategory);
    const selectedCandidate = ingredientMasterSource.find(
      (candidate) =>
        getCanonicalCategory(candidate.category) === selectedCategory &&
        String(candidate.defaultName || "").trim().toLowerCase() ===
          selectedName.toLowerCase()
    );

    if (!selectedCandidate) return;

    let createdIngredient = null;

    try {
      creatingIngredientRef.current = true;
      setCreatingIngredient(true);
      const res = await api.post("/ingredients", {
        name: selectedCandidate.defaultName,
        category: selectedCandidate.category,
        allergens: selectedCandidate.allergens || [],
      });
      createdIngredient = res.data;
      const semanticCategoryKey =
        selectedCandidate.semanticCategoryKey ||
        SEMANTIC_CATEGORY_BY_INGREDIENT_CATEGORY[selectedCategory] ||
        "other";
      const semanticCategory = semanticCategories.find(
        (category) => category.canonicalKey === semanticCategoryKey
      );

      if (createdIngredient?.id && semanticAvailable !== false) {
        const semanticPayload = {
          canonicalKey:
            selectedCandidate.canonicalKey ||
            buildCanonicalKeySuggestion(createdIngredient.name),
          semanticStatus: selectedCandidate.semanticStatus || "NEEDS_REVIEW",
          semanticCategoryId: semanticCategory?.id || null,
          translations: [
            {
              locale: "es",
              name:
                selectedCandidate.translations?.es ||
                selectedCandidate.defaultName,
              description: "",
              isReviewed: true,
            },
          ],
          aliases: (selectedCandidate.aliases || [selectedCandidate.defaultName]).map(
            (alias) => ({
              alias,
              locale: "es",
              country: null,
              searchable: true,
              displayable: true,
              isReviewed: true,
              source: "MASTER_SOURCE",
            })
          ),
        };

        try {
          await api.patch(
            `/ingredients/${createdIngredient.id}/semantics`,
            semanticPayload
          );
        } catch (semanticErr) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          await api.patch(
            `/ingredients/${createdIngredient.id}/semantics`,
            semanticPayload
          );
        }
      }

      setNewIngredientCandidateName("");
      await loadIngredients();
    } catch (err) {
      console.error(err);
      setSemanticError(
        createdIngredient?.id
          ? `Ingredient was created but semantic setup failed for #${createdIngredient.id}.`
          : err?.response?.data?.error || "Could not create ingredient from master source"
      );
      if (createdIngredient?.id) {
        setNewIngredientCandidateName("");
        await loadIngredients();
      }
    } finally {
      creatingIngredientRef.current = false;
      setCreatingIngredient(false);
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
    const ingredientId = getIngredientId(ingredient);
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

  const applySuggestedTranslationDrafts = () => {
    setSemanticDraft((current) => {
      const sourceName =
        current.translations.find((translation) => translation.locale === "es")?.name ||
        getIngredientDisplayName(semanticIngredient);

      return {
        ...current,
        translations: current.translations.map((translation) => {
          if (
            translation.locale === "es" ||
            String(translation.name || "").trim()
          ) {
            return translation;
          }

          const suggestedName = buildTranslationDraftName(
            sourceName,
            translation.locale
          );

          return suggestedName
            ? { ...translation, name: suggestedName, isReviewed: false }
            : translation;
        }),
      };
    });
  };

  const saveSemanticEditor = async () => {
    if (!semanticIngredient || !semanticAvailable) return;

    const ingredientId = getIngredientId(semanticIngredient);
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

  const updateIngredientImageReview = async (ingredient, imageStatus) => {
    const ingredientId = getIngredientId(ingredient);
    if (!ingredientId) return;

    try {
      setImageReviewSavingId(ingredientId);
      await api.patch(`/ingredients/${ingredientId}/image-review`, {
        imageStatus,
        imagePolicyVersion: "v1",
        reviewedBy: "global-manager",
      });
      await loadIngredients();
    } catch (err) {
      console.error(err);
    } finally {
      setImageReviewSavingId(null);
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

  const applyImageCandidate = async (candidate) => {
    const ingredient = candidate.ingredient;
    const ingredientId = getIngredientId(ingredient);
    if (!ingredientId) return;

    const candidateKey = `${ingredientId}:${candidate.file}`;
    try {
      setApplyingCandidateKey(candidateKey);
      const response = await fetch(getCandidateUrl(candidate), { cache: "no-store" });
      if (!response.ok) throw new Error("Candidate image unavailable");
      const blob = await response.blob();
      const file = new File([blob], candidate.file, {
        type: blob.type || "image/png",
      });
      const formData = new FormData();
      formData.append("image", file);
      formData.append("imageSource", "AI_GENERATED");
      formData.append("imagePrompt", candidate.qaNote || candidate.semanticKey || "");
      formData.append("imagePolicyVersion", "v1");
      await api.patch(`/ingredients/${ingredientId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadIngredients();
    } catch (err) {
      console.error(err);
      setImageCandidateError("Could not apply this image candidate.");
    } finally {
      setApplyingCandidateKey("");
    }
  };

  const semanticDraftValidation = getSemanticDraftValidation(semanticDraft);
  const semanticSaveBlocked = semanticDraftValidation.criticalIssues.length > 0;
  const semanticTranslationSourceName =
    semanticDraft.translations.find((translation) => translation.locale === "es")
      ?.name || getIngredientDisplayName(semanticIngredient);
  const canSuggestTranslationDrafts = semanticDraft.translations.some(
    (translation) =>
      translation.locale !== "es" &&
      !String(translation.name || "").trim() &&
      buildTranslationDraftName(semanticTranslationSourceName, translation.locale)
  );

  return (
    <div className="gm-ingredientsModule">
      <div className="gm-addIngredientPanel">
        <select
          value={newIngredientCategory}
          onChange={(event) => {
            setNewIngredientCategory(event.target.value);
            setNewIngredientCandidateName("");
          }}
        >
          {masterCategories.map((category) => (
            <option key={category} value={category}>
              {getCategoryLabel(category)}
            </option>
          ))}
        </select>
        <select
          value={newIngredientCandidateName}
          disabled={availableMasterCandidates.length === 0}
          onChange={(event) => setNewIngredientCandidateName(event.target.value)}
        >
          {availableMasterCandidates.length === 0 ? (
            <option value="">No available master ingredients</option>
          ) : (
            availableMasterCandidates.map((candidate) => (
              <option key={candidate.canonicalKey} value={candidate.defaultName}>
                {candidate.defaultName}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={
            creatingIngredient ||
            !newIngredientCandidateName ||
            availableMasterCandidates.length === 0
          }
          onClick={handleCreate}
        >
          {creatingIngredient ? "Adding..." : "Add ingredient"}
        </button>
      </div>

      {semanticError && <div className="gm-semanticError">{semanticError}</div>}

      {candidateMatches.length > 0 && (
        <section className="gm-imageCandidatePanel">
          <div className="gm-imageCandidateHeader">
            <div>
              <span>AI image candidates</span>
              <h3>{candidateMatches.length} candidates</h3>
            </div>
            <button type="button" onClick={loadImageCandidates}>
              Refresh batch
            </button>
          </div>
          {imageCandidateError && (
            <div className="gm-semanticWarning">{imageCandidateError}</div>
          )}
          <div className="gm-imageCandidateGrid">
            {candidateMatches.map((candidate) => {
              const ingredient = candidate.ingredient;
              const candidateKey = `${getIngredientId(ingredient)}:${candidate.file}`;
              return (
                <article className="gm-imageCandidateCard" key={candidateKey}>
                  <img src={getCandidateUrl(candidate)} alt={candidate.semanticKey} />
                  <strong>{getDisplayName(getIngredientDisplayName(ingredient))}</strong>
                  <span>{candidate.candidateStatus}</span>
                  <button
                    type="button"
                    disabled={applyingCandidateKey === candidateKey}
                    onClick={() => applyImageCandidate(candidate)}
                  >
                    {applyingCandidateKey === candidateKey
                      ? "Applying..."
                      : "Apply as generated"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="gm-tree">
        {loading && <p className="gm-treeEmpty">Loading ingredients...</p>}
        {!loading &&
          groupedIngredients.map(({ category, items }) => {
            const isOpen = openCategories.has(category);
            const activeCount = items.filter((ingredient) => ingredient.status !== "INACTIVE").length;
            return (
              <section className="gm-categoryBlock" key={category}>
                <button
                  type="button"
                  className="gm-categoryHeader"
                  onClick={() => toggleCategory(category)}
                >
                  <span>{isOpen ? "▾" : "▸"}</span>
                  <strong>{getCategoryLabel(category)}</strong>
                  <em>
                    {activeCount} / {items.length}
                  </em>
                </button>
                {isOpen && (
                  <div className="gm-categoryItems">
                    {items.map((ingredient) => {
                      const ingredientId = getIngredientId(ingredient);
                      const semanticGaps = getIngredientSemanticGaps(ingredient);
                      return (
                        <div className="gm-node" key={ingredientId}>
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
                              className={`gm-semanticStatusBadge ${getSemanticStatusClass(
                                getIngredientSemanticStatus(ingredient)
                              )}`}
                            >
                              {formatSemanticStatus(getIngredientSemanticStatus(ingredient))}
                            </span>
                            <span
                              className={`gm-imageStatusBadge ${getImageStatusClass(
                                ingredient.imageStatus
                              )}`}
                            >
                              {formatImageStatus(ingredient.imageStatus)}
                            </span>
                            <button
                              type="button"
                              className={`gm-semanticBtn ${getSemanticReviewButtonClass(
                                ingredient
                              )}`}
                              title={
                                semanticGaps.length
                                  ? semanticGaps.map((gap) => gap.title).join(" | ")
                                  : "Semantic identity reviewed"
                              }
                              onClick={() => openSemanticEditor(ingredient)}
                            >
                              Semantics
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
                            <div className="gm-imageActions">
                              {IMAGE_REVIEW_STATUSES.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  className={
                                    status === "REVIEWED" ? "gm-imageApproveBtn" : ""
                                  }
                                  onClick={() => updateIngredientImageReview(ingredient, status)}
                                  disabled={
                                    !ingredient.image ||
                                    ingredient.imageStatus === status ||
                                    Number(imageReviewSavingId) === Number(ingredientId)
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

                <div className="gm-semanticQuickActions">
                  <button
                    type="button"
                    disabled={!semanticAvailable || !canSuggestTranslationDrafts}
                    onClick={applySuggestedTranslationDrafts}
                  >
                    Suggest missing translations
                  </button>
                  <span>Suggestions are drafts and stay unreviewed until approved.</span>
                </div>

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
                          {category.displayName || category.defaultName || category.name || category.key}
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
                        <div className="gm-translationHeader">
                          <strong>{translation.locale.toUpperCase()}</strong>
                          <span
                            className={`gm-translationBadge ${
                              translation.isReviewed
                                ? "is-reviewed"
                                : translation.name
                                  ? "is-draft"
                                  : "is-missing"
                            }`}
                          >
                            {translation.isReviewed
                              ? "Reviewed"
                              : translation.name
                                ? "Draft"
                                : "Missing"}
                          </span>
                          <label className="gm-reviewedToggle">
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
                        <label className="gm-translationField">
                          Name
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
                        </label>
                        <label className="gm-translationField">
                          Description
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
                        </label>
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
