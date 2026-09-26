import { resolveIngredientTaxonomy, getIngredientTaxonomyKey, getTaxonomyCategoryLabel } from '../../utils/ingredientTaxonomy';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../setupAxios";
import InventoryIngredientDialog from "./InventoryIngredientDialog";
import { ingredientAllergens, formatIngredientMoney } from "./ingredientDetails";
import { inventoryDetailTranslator, inventoryAllergenLabel } from "../../constants/inventoryDetailTranslations";
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

const LEGACY_COST_GROUP_ALIASES = {
  AROMAS_Y_EXTRACTOS: "HIERBAS_ESPECIAS",
  CHEESE: "QUESOS",
  SAUCE: "SALSAS",
  VEGETABLE: "VERDURAS",
  PROTEIN: "CARNES",
};

const getIngredientCategoryGroupKey = getIngredientTaxonomyKey;
// Keep existing cost suggestion cohorts stable during the display reorganization.
const getIngredientCostGroupKey = (ingredient) => {
  const rawCategory = String(ingredient?.category || "").toUpperCase().trim();
  if (!rawCategory) return "";
  if (LEGACY_COST_GROUP_ALIASES[rawCategory]) {
    return LEGACY_COST_GROUP_ALIASES[rawCategory];
  }

  return rawCategory;
};

const getIngredientSearchText = (ing, locale = "es") =>
  normalizeSearchText(
    [
      resolveIngredientTaxonomy(ing, locale).label,
      ing?.searchText,
      ing?.semanticMapping?.globalIngredient?.searchText,
      ing?.displayName,
      ing?.name,
      ing?.semanticMapping?.globalIngredient?.displayName,
      ing?.semanticMapping?.globalIngredient?.name,
      ing?.semanticMapping?.globalIngredient?.canonicalKey,
      ing?.displayCategory,
      ing?.category,
      ing?.semanticMapping?.globalIngredient?.displayCategory,
      ing?.description,
      ...(Array.isArray(ing?.aliases) ? ing.aliases : []),
      ...(Array.isArray(ing?.semanticMapping?.globalIngredient?.searchAliases)
        ? ing.semanticMapping.globalIngredient.searchAliases
        : []),
      ...(Array.isArray(ing?.allergens) ? ing.allergens : []),
      ...(Array.isArray(ing?.semanticMapping?.globalIngredient?.allergens)
        ? ing.semanticMapping.globalIngredient.allergens
        : []),
    ]
      .filter(Boolean)
      .join(" ")
  );

export default function InventoryModule({ partner, language = "es" }) {
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadState, setLoadState] = useState("idle");
  const loadRequest = useRef(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("search"); // 🔥 clave
  const [search, setSearch] = useState("");
  const [categorySearches, setCategorySearches] = useState({});
  const [openCat, setOpenCat] = useState("");
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientCategory, setNewIngredientCategory] = useState("");
  const [createFeedback, setCreateFeedback] = useState("");
  const [detailIngredient, setDetailIngredient] = useState(null);
  const storeId = partner?.storeId;
  const currency = partner?.currency || "EUR";
  const detailText = inventoryDetailTranslator(language);
  const activeLocale = String(language || "es").trim().toLowerCase();

  const fetchIngredients = useCallback(async () => {
    if (!storeId) return;
    const request = ++loadRequest.current;
    setLoadState("loading");
    try {
      const res = await api.get(`/stores/${storeId}/ingredients`, {
        params: { locale: activeLocale },
      });
      if (!Array.isArray(res.data)) throw new Error("Invalid inventory response");
      const data = res.data;

      const uniqueCategories = [
        ...new Set(
          data
            .map((i) => getIngredientCategoryGroupKey(i))
            .filter(Boolean)
        ),
      ].sort((left, right) => {
        const leftLabel = getTaxonomyCategoryLabel(left, activeLocale);
        const rightLabel = getTaxonomyCategoryLabel(right, activeLocale);

        return leftLabel.localeCompare(rightLabel, activeLocale, {
          sensitivity: "base",
        });
      });

      if (request !== loadRequest.current) return;
      setIngredients(data);
      setCategories(uniqueCategories);
      setLoadState("ready");
    } catch (err) {
      if (request !== loadRequest.current) return;
      console.error(err);
      setLoadState("error");
    }
  }, [storeId, activeLocale]);

  useEffect(() => {
    setIngredients([]);
    setCategories([]);
    setDetailIngredient(null);
    setLoadState("idle");
    if (storeId) fetchIngredients();
    return () => { loadRequest.current += 1; };
  }, [storeId, fetchIngredients]);

  const grouped = useMemo(() => {
    const map = {};
    for (const cat of categories) map[cat] = [];

    for (const ing of ingredients) {
      const cat = getIngredientCategoryGroupKey(ing);
      if (!map[cat]) map[cat] = [];
      map[cat].push(ing);
    }

    return map;
  }, [ingredients, categories]);

  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return [];
    const q = normalizeSearchText(search);

    return ingredients.filter((ing) => getIngredientSearchText(ing, activeLocale).includes(q));
  }, [search, ingredients, activeLocale]);

  const getCategoryPriceSuggestion = (ingredient) => {
    if (!ingredient) return null;

    const category = getIngredientCostGroupKey(ingredient);
    const prices = ingredients
      .filter(
        (candidate) =>
          candidate.id !== ingredient.id && candidate.exists && candidate.active &&
          getIngredientCostGroupKey(candidate) === category
      )
      .map((candidate) => Number(candidate.costPrice))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (!prices.length) return null;

    const average =
      prices.reduce((total, price) => total + price, 0) / prices.length;
    return Math.round(average * 100) / 100;
  };

  const openIngredientDetail = (ingredient) => setDetailIngredient(ingredient);
  const closeIngredientDetail = () => setDetailIngredient(null);
  const saveIngredientDetail = async (draft) => {
    const payload = new FormData();
    payload.append("costPrice", String(draft.costPrice));
    payload.append("description", draft.description);
    if (draft.imageFile) payload.append("image", draft.imageFile);
    await api.patch(`/stores/${storeId}/ingredients/${detailIngredient.id}/details`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await fetchIngredients();
  };
  const deactivateIngredient = async () => {
    await api.patch(`/stores/${storeId}/ingredients/${detailIngredient.id}`, { active: false });
    await fetchIngredients();
  };
  const formatIngredientPrice = (value) => formatIngredientMoney(value, activeLocale, currency);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.indexOf(active.id);
    const newIndex = categories.indexOf(over.id);

    setCategories(arrayMove(categories, oldIndex, newIndex));
  };

  const getAllergenTags = (ingredient) => {
    const tags = ingredientAllergens(ingredient);
    return tags.length ? tags.map((tag) => inventoryAllergenLabel(tag, language)) : [detailText("unknown")];
  };

  const getDisplayName = (name) => (name || "").toUpperCase();
  const getIngredientDisplayName = (ingredient) =>
    ingredient?.displayName || ingredient?.name || "";
  const getMappedGlobalIngredient = (ingredient) =>
    ingredient?.semanticMapping?.globalIngredient || null;
  const getIngredientImage = (ingredient) =>
    ingredient?.image || getMappedGlobalIngredient(ingredient)?.image || "";
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
    return list.filter((ing) => getIngredientSearchText(ing, activeLocale).includes(q));
  };

  const getIngredientStatusLabel = (ingredient) => {
    if (isIngredientActiveInStore(ingredient)) return "Activo";
    if (isIngredientInactiveInStore(ingredient)) return "Inactivo";
    return "Agregar";
  };

  const renderIngredientTile = (ing) => {
    const allergens = getAllergenTags(ing);
    const activePrice = formatIngredientPrice(ing.costPrice);
    const isActive = isIngredientActiveInStore(ing);
    const isInactive = isIngredientInactiveInStore(ing);
    const tileImage = getIngredientImage(ing);

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
          {tileImage ? (
            <img src={tileImage} alt="" />
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

  const getCategoryDisplayName = (category) => getTaxonomyCategoryLabel(category, activeLocale);
  const getIngredientCategoryDisplayName = (ingredient) =>
    getCategoryDisplayName(getIngredientCategoryGroupKey(ingredient));
  const getCategorySubmissionKey = (category) =>
    category;

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
        category: getCategorySubmissionKey(newIngredientCategory),
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
          disabled={loadState !== "ready"}
          onClick={() => {
            setModalOpen(true);
            setModalMode("search");
          }}
        >
          <span className="inv-addIcon" aria-hidden="true" />
          Ingredient finder
        </button>
      </div>

      {!storeId ? (
        <div className="inv-loadStatus" role="alert">{detailText("inventoryMissingStore")}</div>
      ) : loadState === "error" ? (
        <div className="inv-loadStatus inv-loadStatus--error" role="alert">
          <span>{detailText("inventoryLoadError")}</span>
          <button type="button" onClick={fetchIngredients}>{detailText("inventoryRetry")}</button>
        </div>
      ) : loadState === "loading" ? (
        <div className="inv-loadStatus" role="status">{detailText("inventoryLoading")}</div>
      ) : loadState === "ready" && ingredients.length === 0 ? (
        <div className="inv-loadStatus" role="status">{detailText("inventoryEmpty")}</div>
      ) : null}

      {detailIngredient && <InventoryIngredientDialog key={detailIngredient.id}
        ingredient={detailIngredient} category={getIngredientCategoryDisplayName(detailIngredient)}
        language={language} currency={currency} suggestedPrice={getCategoryPriceSuggestion(detailIngredient)}
        onSave={saveIngredientDetail} onDeactivate={deactivateIngredient} onClose={closeIngredientDetail} />}

      {/* LIST */}
      {loadState === "ready" && ingredients.length > 0 && (
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
                          {getIngredientImage(ing) ? (
                            <img src={getIngredientImage(ing)} alt="" />
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
                            {getIngredientStatusLabel(ing)}
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
