import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/InventoryModule.css";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const getIngredientSearchText = (ing) =>
  normalizeSearchText(
    [
      ing?.searchText,
      ing?.displayName,
      ing?.name,
      ing?.displayCategory,
      ing?.category,
      ing?.description,
      ...(Array.isArray(ing?.aliases) ? ing.aliases : []),
      ...(Array.isArray(ing?.allergens) ? ing.allergens : []),
    ]
      .filter(Boolean)
      .join(" ")
  );

export default function InventoryModule({ partner, language = "es" }) {
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("search"); // 🔥 clave
  const [search, setSearch] = useState("");
  const [categorySearches, setCategorySearches] = useState({});
  const [openCat, setOpenCat] = useState("");
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientCategory, setNewIngredientCategory] = useState("");
  const [createFeedback, setCreateFeedback] = useState("");
  const [detailIngredient, setDetailIngredient] = useState(null);
  const [detailDraft, setDetailDraft] = useState({
    costPrice: "",
    description: "",
    imageFile: null,
    imagePreview: "",
  });
  const [savingOnboardingId, setSavingOnboardingId] = useState(null);

  const storeId = partner?.storeId;
  const activeLocale = String(language || "es").trim().toLowerCase();

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/ingredients`, {
        params: { locale: activeLocale },
      });
      const data = Array.isArray(res.data) ? res.data : [];

      setIngredients(data);

      const uniqueCategories = [
        ...new Set(
          data
            .map((i) => (i.category || "").toUpperCase().trim())
            .filter(Boolean)
        ),
      ].sort((left, right) => {
        const leftLabel =
          data.find((item) => (item.category || "").toUpperCase().trim() === left)
            ?.displayCategory || left;
        const rightLabel =
          data.find((item) => (item.category || "").toUpperCase().trim() === right)
            ?.displayCategory || right;

        return leftLabel.localeCompare(rightLabel, activeLocale, {
          sensitivity: "base",
        });
      });

      setCategories(uniqueCategories);
    } catch (err) {
      console.error(err);
    }
  }, [storeId, activeLocale]);

  useEffect(() => {
    if (!storeId) return;
    fetchIngredients();
  }, [storeId, fetchIngredients]);

  const grouped = useMemo(() => {
    const map = {};
    for (const cat of categories) map[cat] = [];

    for (const ing of ingredients) {
      const cat = (ing.category || "").toUpperCase().trim();
      if (!map[cat]) map[cat] = [];
      map[cat].push(ing);
    }

    return map;
  }, [ingredients, categories]);

  const categoryDisplayNames = useMemo(() => {
    const names = {};

    ingredients.forEach((ing) => {
      const category = (ing.category || "").toUpperCase().trim();
      const displayCategory = String(ing.displayCategory || "").trim();
      if (category && displayCategory && !names[category]) {
        names[category] = displayCategory;
      }
    });

    return names;
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return [];
    const q = normalizeSearchText(search);

    return ingredients.filter((ing) => getIngredientSearchText(ing).includes(q));
  }, [search, ingredients]);

  const normalizePriceInput = (value) =>
    String(value ?? "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .slice(0, 8);

  const openIngredientDetail = (ing) => {
    setDetailIngredient(ing);
    setDetailDraft({
      costPrice: ing.costPrice == null ? "" : String(ing.costPrice),
      description: ing.description || "",
      imageFile: null,
      imagePreview: ing.image || "",
    });
    setCreateFeedback("");
  };

  const closeIngredientDetail = () => {
    if (savingOnboardingId) return;
    setDetailIngredient(null);
    setDetailDraft({
      costPrice: "",
      description: "",
      imageFile: null,
      imagePreview: "",
    });
    setCreateFeedback("");
  };

  const handleDetailImageSelect = (event) => {
    const file = event.target.files?.[0] || null;
    setDetailDraft((current) => ({
      ...current,
      imageFile: file,
      imagePreview: file ? URL.createObjectURL(file) : current.imagePreview,
    }));
  };

  const saveIngredientDetail = async () => {
    if (!detailIngredient) return;

    const normalizedValue = String(detailDraft.costPrice)
      .replace(",", ".")
      .trim();
    const costPrice = Number(normalizedValue);

    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setCreateFeedback("Ingresa un precio valido para activar el ingrediente.");
      return;
    }

    try {
      const ing = detailIngredient;
      setSavingOnboardingId(ing.id);

      const payload = new FormData();
      payload.append("costPrice", String(costPrice));
      payload.append("description", detailDraft.description || "");
      if (detailDraft.imageFile) {
        payload.append("image", detailDraft.imageFile);
      }

      await api.patch(`/ingredients/${ing.id}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!ing.exists) {
        await api.post(`/stores/${storeId}/ingredients`, {
          ingredientIds: [ing.id],
        });
      } else {
        await api.patch(`/stores/${storeId}/ingredients/${ing.id}`, {
          active: true,
        });
      }

      closeIngredientDetail();
      setCreateFeedback("");
      await fetchIngredients();
    } catch (err) {
      console.error(err);
      setCreateFeedback("No se pudo activar el ingrediente con precio.");
    } finally {
      setSavingOnboardingId(null);
    }
  };

  const deactivateIngredient = async () => {
    if (!detailIngredient?.id) return;

    try {
      setSavingOnboardingId(detailIngredient.id);
      await api.patch(`/stores/${storeId}/ingredients/${detailIngredient.id}`, {
        active: false,
      });
      closeIngredientDetail();
      await fetchIngredients();
    } catch (err) {
      console.error(err);
      setCreateFeedback("No se pudo desactivar el ingrediente.");
    } finally {
      setSavingOnboardingId(null);
    }
  };

  const formatIngredientPrice = (value) => {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return "";
    return `EUR ${price.toFixed(2)}`;
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.indexOf(active.id);
    const newIndex = categories.indexOf(over.id);

    setCategories(arrayMove(categories, oldIndex, newIndex));
  };

  const getAllergenTags = (ing) => {
    const allergens = Array.isArray(ing.allergens) ? ing.allergens : [];

    if (allergens.length === 0) {
      return ["NO ALLERGENIC"];
    }

    return allergens;
  };

  const getDisplayName = (name) => (name || "").toUpperCase();
  const getIngredientDisplayName = (ingredient) =>
    ingredient?.displayName || ingredient?.name || "";
  const categoryLabels = {
    ACEITES_GRASAS_VINAGRES: "Aceites, grasas y vinagres",
    AROMAS_Y_EXTRACTOS: "Aromas y extractos",
    CARNES: "Carnes",
    CREMAS_DULCES: "Cremas dulces",
    EMBUTIDOS: "Embutidos",
    ENDULZANTES: "Endulzantes",
    EXTRAS: "Extras",
    FRUTAS: "Frutas",
    FRUTOS_SECOS_Y_SEMILLAS: "Frutos secos y semillas",
    HIERBAS_ESPECIAS: "Hierbas y especias",
    OTROS: "Otros",
    PESCADOS_Y_MARISCOS: "Pescados y mariscos",
    PROTEINA_VEGANA: "Proteina vegana",
    QUESOS: "Quesos",
    SALSAS: "Salsas",
    SETAS: "Setas",
    TOPPINGS_DULCES: "Toppings dulces",
    VERDURAS: "Verduras",
  };

  const getIngredientInitials = (name) =>
    String(name || "IN")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "IN";

  const isIngredientActiveInStore = (ingredient) =>
    Boolean(ingredient?.exists && ingredient?.active);
  const isIngredientInactiveInStore = (ingredient) =>
    Boolean(ingredient?.exists && ingredient?.active === false);

  const updateCategorySearch = (category, value) => {
    setCategorySearches((current) => ({
      ...current,
      [category]: value,
    }));
  };

  const getFilteredCategoryIngredients = (list, query) => {
    const q = normalizeSearchText(query);
    if (!q) return list;
    return list.filter((ing) => getIngredientSearchText(ing).includes(q));
  };

  const getIngredientStatusLabel = (ingredient) => {
    if (isIngredientActiveInStore(ingredient)) return "Activo";
    if (isIngredientInactiveInStore(ingredient)) return "Inactivo";
    return "Agregar";
  };

  const getKnownAliases = (ingredient) =>
    [
      ...(Array.isArray(ingredient?.aliases) ? ingredient.aliases : []),
      ...(Array.isArray(ingredient?.searchAliases)
        ? ingredient.searchAliases
        : []),
    ]
      .map((alias) => String(alias || "").trim())
      .filter(Boolean)
      .filter(
        (alias, index, aliases) =>
          aliases.findIndex(
            (candidate) =>
              normalizeSearchText(candidate) === normalizeSearchText(alias)
          ) === index
      )
      .filter(
        (alias) =>
          normalizeSearchText(alias) !==
          normalizeSearchText(getIngredientDisplayName(ingredient))
      )
      .slice(0, 8);

  const languageLabels = {
    es: "ES",
    en: "EN",
    it: "IT",
    fr: "FR",
    pt: "PT",
    ar: "AR",
    zh: "ZH",
  };

  const getSemanticTranslations = (ingredient) => {
    const seen = new Set();

    return (Array.isArray(ingredient?.semanticTranslations)
      ? ingredient.semanticTranslations
      : []
    ).reduce((result, translation) => {
      const locale = String(translation?.locale || "").trim().toLowerCase();
      const name = String(translation?.name || "").trim();

      if (!locale || !name || seen.has(locale)) return result;
      seen.add(locale);
      result.push({ locale, name });
      return result;
    }, []);
  };

  const hasSemanticIdentity = (ingredient) =>
    Boolean(
      ingredient?.canonicalKey ||
        ingredient?.semanticStatus === "REVIEWED" ||
        getKnownAliases(ingredient).length ||
        getSemanticTranslations(ingredient).length
    );

  const renderIngredientTile = (ing) => {
    const allergens = getAllergenTags(ing);
    const activePrice = formatIngredientPrice(ing.costPrice);
    const isActive = isIngredientActiveInStore(ing);
    const isInactive = isIngredientInactiveInStore(ing);

    return (
      <button
        key={ing.id}
        type="button"
        className={`inv-ingredientTile ${
          isActive ? "is-active" : isInactive ? "is-inactive" : "is-new"
        }`}
        onClick={() => openIngredientDetail(ing)}
      >
        <span className="inv-tileMedia">
          {ing.image ? (
            <img src={ing.image} alt="" />
          ) : (
            <span>{getIngredientInitials(getIngredientDisplayName(ing))}</span>
          )}
        </span>
        <span className="inv-tileStatus">{getIngredientStatusLabel(ing)}</span>
        <span className="inv-tileName">{getDisplayName(getIngredientDisplayName(ing))}</span>
        <span className="inv-tileMeta">
          <span>{allergens[0]}</span>
          {activePrice ? <strong>{activePrice.replace("EUR ", "")}</strong> : null}
        </span>
      </button>
    );
  };

  const getCategoryDisplayName = (category) =>
    categoryDisplayNames[category] ||
    categoryLabels[category] ||
    String(category || "")
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const getIngredientCategoryDisplayName = (ingredient) =>
    ingredient?.displayCategory || getCategoryDisplayName(ingredient?.category);

  const highlightMatch = (text, query) => {
    if (!query) return <span>{text}</span>;

    const normalizedText = String(text || "");
    const normalizedQuery = query.trim();

    if (!normalizedQuery) return <span>{normalizedText}</span>;

    const lowerText = normalizedText.toLowerCase();
    const lowerQuery = normalizedQuery.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) return <span>{normalizedText}</span>;

    const before = normalizedText.slice(0, matchIndex);
    const match = normalizedText.slice(
      matchIndex,
      matchIndex + normalizedQuery.length
    );
    const after = normalizedText.slice(matchIndex + normalizedQuery.length);

    return (
      <>
        <span key="before">{before}</span>
        <span key="match" className="inv-highlight">{match}</span>
        <span key="after">{after}</span>
      </>
    );
  };

  const handleCreateIngredient = async () => {
    try {
      await api.post("/ingredients/suggestions", {
        name: newIngredientName.trim(),
        category: newIngredientCategory,
      });

      setNewIngredientName("");
      setNewIngredientCategory("");
      setModalMode("search");
      setCreateFeedback("Ingredient submitted for review.");

    } catch (err) {
      console.error("CREATE INGREDIENT ERROR:", err.response?.data || err);
      setCreateFeedback("We couldn't submit the ingredient request.");
    }
  };

  return (
    <div className="inv-wrapper">

      {/* HEADR */}
      <div className="inv-header">
        <div>
          <h2 className="inv-title">Toppings Inventory</h2>
          <p className="inv-subtitle">Everything that goes on top of the dough.</p>
        </div>

        <button
          className="inv-addBtn"
          type="button"
          onClick={() => {
            setModalOpen(true);
            setModalMode("search");
          }}
        >
          <span className="inv-addIcon" aria-hidden="true" />
          Ingredient finder
        </button>
      </div>

      {detailIngredient && (
        <div
          className="inv-priceModalOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeIngredientDetail();
          }}
        >
          <div
            className="inv-detailModal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="inv-detailHero">
              <label className="inv-detailPhoto">
                {detailDraft.imagePreview ? (
                  <img src={detailDraft.imagePreview} alt="" />
                ) : (
                  <span>{getIngredientInitials(getIngredientDisplayName(detailIngredient))}</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDetailImageSelect}
                  disabled={Boolean(savingOnboardingId)}
                />
                <strong>{detailDraft.imagePreview ? "Cambiar foto" : "Subir foto"}</strong>
              </label>

              <div className="inv-detailIntro">
                <h3>{getDisplayName(getIngredientDisplayName(detailIngredient))}</h3>
                <p>{getIngredientCategoryDisplayName(detailIngredient)}</p>
                <div className="inv-detailStatus">
                  <span className={isIngredientActiveInStore(detailIngredient) ? "is-active" : "is-inactive"}>
                    {isIngredientActiveInStore(detailIngredient) ? "Activo en tienda" : "Pendiente de activar"}
                  </span>
                  {detailIngredient.semanticStatus === "REVIEWED" && (
                    <span className="is-reviewed">Identidad revisada</span>
                  )}
                  {formatIngredientPrice(detailIngredient.costPrice) && (
                    <strong>{formatIngredientPrice(detailIngredient.costPrice)}</strong>
                  )}
                </div>
              </div>
            </div>

            {createFeedback && (
              <div className="inv-priceModalError">{createFeedback}</div>
            )}

            {hasSemanticIdentity(detailIngredient) && (
              <div className="inv-semanticPanel">
                <div>
                  <span>Identidad global</span>
                  <strong>
                    {detailIngredient.canonicalKey || "Pendiente de clave canonica"}
                  </strong>
                </div>
                {normalizeSearchText(detailIngredient.name) !==
                  normalizeSearchText(getIngredientDisplayName(detailIngredient)) && (
                  <small>
                    Nombre original: {detailIngredient.name}
                  </small>
                )}
                {getKnownAliases(detailIngredient).length > 0 && (
                  <div className="inv-semanticAliases">
                    <span>Se puede buscar como</span>
                    <div className="inv-aliasList">
                      {getKnownAliases(detailIngredient).map((alias) => (
                        <span key={`${detailIngredient.id}-semantic-${alias}`}>
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {getSemanticTranslations(detailIngredient).length > 0 && (
                  <div className="inv-semanticTranslations">
                    <span>Traducciones revisadas</span>
                    <div>
                      {getSemanticTranslations(detailIngredient).map((translation) => (
                        <span
                          key={`${detailIngredient.id}-translation-${translation.locale}`}
                        >
                          <strong>
                            {languageLabels[translation.locale] ||
                              translation.locale.toUpperCase()}
                          </strong>
                          {translation.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="inv-detailSection">
              <span>Alérgenos</span>
              <div className="inv-allergenTags inv-allergenTags--detail">
                {getAllergenTags(detailIngredient).map((tag) => (
                  <span
                    key={`${detailIngredient.id}-${tag}`}
                    className="inv-allergenTag"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <small>
                Esta información aparece como referencia operativa para el producto
                y ayuda a decidir si el ingrediente puede usarse en una receta.
              </small>
            </div>

            <label className="inv-detailField">
              <span>Descripción breve</span>
              <textarea
                value={detailDraft.description}
                placeholder="Ej. Aceite aromatizado para terminar pizzas al salir del horno."
                onChange={(e) =>
                  setDetailDraft((current) => ({
                    ...current,
                    description: e.target.value.slice(0, 420),
                  }))
                }
                disabled={Boolean(savingOnboardingId)}
              />
            </label>

            <label className="inv-priceModalField">
              <span>Precio de armado</span>
              <div>
                <strong>EUR</strong>
                <input
                  type="text"
                  inputMode="decimal"
                  value={detailDraft.costPrice}
                  placeholder="0.99"
                  onChange={(e) =>
                    setDetailDraft((current) => ({
                      ...current,
                      costPrice: normalizePriceInput(e.target.value),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveIngredientDetail();
                    }
                  }}
                  disabled={Boolean(savingOnboardingId)}
                />
              </div>
              <small>
                Este precio se usa para el armado de la pizza. No es el precio de venta final al cliente.
              </small>
            </label>

            <div className="inv-priceModalActions">
              <button
                type="button"
                onClick={closeIngredientDetail}
                disabled={Boolean(savingOnboardingId)}
              >
                Cancelar
              </button>
              {isIngredientActiveInStore(detailIngredient) && (
                <button
                  type="button"
                  className="inv-detailDanger"
                  onClick={deactivateIngredient}
                  disabled={Boolean(savingOnboardingId)}
                >
                  Desactivar
                </button>
              )}
              <button
                type="button"
                onClick={saveIngredientDetail}
                disabled={Boolean(savingOnboardingId)}
              >
                {savingOnboardingId
                  ? "Guardando..."
                  : isIngredientActiveInStore(detailIngredient)
                  ? "Guardar cambios"
                  : "Guardar y activar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {ingredients.length > 0 && (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories}
            strategy={verticalListSortingStrategy}
          >
            <div className="inv-list">

              {categories.map((cat) => {
                const list = grouped[cat] || [];
                if (list.length === 0) return null;
                const activeCount = list.filter(
                  (ing) => isIngredientActiveInStore(ing)
                ).length;

                return (
                  <SortableCategory key={cat} cat={cat}>
                    {({ attributes, listeners }) => {
                      const isOpen = openCat === cat;
                      const categorySearch = categorySearches[cat] || "";
                      const visibleList = getFilteredCategoryIngredients(
                        list,
                        categorySearch
                      );

                      return (
                        <>
                          <div
                            className="inv-catTitle"
                          >
                            <div className="inv-catLeft">
                              <span
                                className="inv-drag"
                                {...attributes}
                                {...listeners}
                              >
                                â‰¡
                              </span>
                            <button
                              className="inv-catToggle"
                              type="button"
                              onClick={() =>
                                setOpenCat(isOpen ? "" : cat)
                              }
                            >
                              <span
                                className="inv-drag"
                                {...attributes}
                                {...listeners}
                              >
                                ≡
                              </span>
                              <span>{getCategoryDisplayName(cat)}</span>
                            </button>
                            </div>

                            <div className="inv-catRight">
                              {isOpen ? (
                                <label
                                  className="inv-categorySearch"
                                  onMouseDown={(event) => event.stopPropagation()}
                                >
                                  <span className="inv-addIcon" aria-hidden="true" />
                                  <input
                                    type="search"
                                    value={categorySearch}
                                    placeholder={`Buscar en ${getCategoryDisplayName(cat)}`}
                                    onChange={(event) =>
                                      updateCategorySearch(cat, event.target.value)
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                  {categorySearch && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateCategorySearch(cat, "");
                                      }}
                                      aria-label="Limpiar busqueda"
                                    >
                                      x
                                    </button>
                                  )}
                                </label>
                              ) : (
                                <span className="inv-count">
                                  <strong>{activeCount}</strong>
                                  <span>/</span>
                                  <small>{list.length}</small>
                                </span>
                              )}
                            </div>
                          </div>

                          {isOpen && (
                            <>
                              <div className="inv-itemsGrid">
                                {visibleList.map(renderIngredientTile)}
                              </div>
                              {visibleList.length === 0 && (
                                <div className="inv-categoryEmpty">
                                  <span>No hay ingredientes que coincidan en esta categoria.</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewIngredientCategory(cat);
                                      setNewIngredientName(categorySearch.trim());
                                      setCreateFeedback("");
                                      setModalMode("create");
                                      setModalOpen(true);
                                    }}
                                  >
                                    Solicitar ingrediente
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      );
                    }}
                  </SortableCategory>
                );
              })}

            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* MODAL ÚNICO */}
      {modalOpen && (
        <div
          className="inv-modalOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              setCreateFeedback("");
            }
          }}
        >
          <div
            className="inv-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="inv-modalTitle">
              {modalMode === "search"
                ? "Ingredient Finder"
                : "Request Ingredient"}
            </h3>

            {createFeedback && (
              <div className="inv-feedbackBanner">
                {createFeedback}
              </div>
            )}

            {/* SEARCH MODE */}
            {modalMode === "search" && (
              <>
                <div className="inv-searchBox">
                  <div className="inv-searchInputWrapper">
                    <span className="inv-searchIcon">🔍</span>

                    <input
                      type="text"
                      placeholder="Search toppings or ingredients..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                    />

                    {search && (
                      <button
                        className="inv-clearBtn"
                        type="button"
                        onClick={() => setSearch("")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="inv-searchResults">

                  {search.trim() && filteredIngredients.length === 0 && (
                    <div className="inv-emptySearch">
                      <div>No matching ingredient found</div>

                      <button
                        className="inv-createBtn"
                        type="button"
                        onClick={() => {
                          setCreateFeedback("");
                          setModalMode("create");
                        }}
                      >
                        Request new ingredient
                      </button>
                    </div>
                  )}

                  <div className="inv-itemsGrid inv-itemsGrid--search">
                    {filteredIngredients.map((ing) => (
                      <button
                        key={`${ing.id}-${search}`}
                        type="button"
                        className={`inv-ingredientTile ${
                          isIngredientActiveInStore(ing)
                            ? "is-active"
                            : isIngredientInactiveInStore(ing)
                            ? "is-inactive"
                            : "is-new"
                        }`}
                        onClick={() => openIngredientDetail(ing)}
                      >
                        <span className="inv-tileMedia">
                          {ing.image ? (
                            <img src={ing.image} alt="" />
                          ) : (
                            <span>{getIngredientInitials(getIngredientDisplayName(ing))}</span>
                          )}
                        </span>
                        <span className="inv-tileName">
                          {highlightMatch(getDisplayName(getIngredientDisplayName(ing)), search)}
                        </span>
                        <span className="inv-tileMeta">
                          <span>{getAllergenTags(ing)[0]}</span>
                          <strong>
                            {isIngredientActiveInStore(ing) ? "Activo" : "Agregar"}
                          </strong>
                        </span>
                      </button>
                    ))}
                  </div>

                </div>
              </>
            )}

            {/* CREATE MODE */}
            {modalMode === "create" && (
              <div className="inv-createFormWrapper">

                <div className="inv-createForm">

                  <label>Category</label>
                  <select
                    value={newIngredientCategory}
                    onChange={(e) =>
                      setNewIngredientCategory(e.target.value)
                    }
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {getCategoryDisplayName(cat)}
                      </option>
                    ))}
                  </select>

                  <label>Ingredient name</label>
                  <input
                    type="text"
                    placeholder="e.g. Pulpo"
                    value={newIngredientName}
                    onChange={(e) =>
                      setNewIngredientName(e.target.value)
                    }
                  />

                </div>

                <div className="inv-actions">
                  <button
                    className="inv-cancelBtn"
                    type="button"
                    onClick={() => {
                      setCreateFeedback("");
                      setModalMode("search");
                    }}
                  >
                    Back
                  </button>

                  <button
                    className="inv-confirmBtn"
                    type="button"
                    onClick={handleCreateIngredient}
                    disabled={
                      !newIngredientName || !newIngredientCategory
                    }
                  >
                    Submit
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

function SortableCategory({ cat, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: cat });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="inv-catBlock">
      {children({ attributes, listeners })}
    </div>
  );
}
