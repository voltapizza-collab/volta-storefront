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

export default function InventoryModule({ partner }) {
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("search"); // 🔥 clave
  const [search, setSearch] = useState("");
  const [openCat, setOpenCat] = useState("");
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientCategory, setNewIngredientCategory] = useState("");
  const [createFeedback, setCreateFeedback] = useState("");
  const [onboardingPriceIngredient, setOnboardingPriceIngredient] =
    useState(null);
  const [onboardingPriceDraft, setOnboardingPriceDraft] = useState("");
  const [savingOnboardingId, setSavingOnboardingId] = useState(null);
  const [savingCategory, setSavingCategory] = useState("");

  const storeId = partner?.storeId;

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/ingredients`);
      const data = Array.isArray(res.data) ? res.data : [];

      setIngredients(data);

      const uniqueCategories = [
        ...new Set(
          data
            .map((i) => (i.category || "").toUpperCase().trim())
            .filter(Boolean)
        ),
      ].sort((left, right) =>
        left.localeCompare(right, "es", { sensitivity: "base" })
      );

      setCategories(uniqueCategories);
    } catch (err) {
      console.error(err);
    }
  }, [storeId]);

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

  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();

    return ingredients.filter((ing) =>
      ing.name.toLowerCase().includes(q)
    );
  }, [search, ingredients]);

  const toggleIngredient = async (ing) => {
    try {
      if (ing.exists && ing.active) {
        await api.patch(`/stores/${storeId}/ingredients/${ing.id}`, {
          active: false,
        });
        await fetchIngredients();
        return;
      }

      setOnboardingPriceIngredient(ing);
      setOnboardingPriceDraft(
        ing.costPrice == null ? "" : String(ing.costPrice)
      );
      setCreateFeedback("");
    } catch (err) {
      console.error(err);
    }
  };

  const normalizePriceInput = (value) =>
    String(value ?? "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .slice(0, 8);

  const confirmIngredientOnboarding = async () => {
    if (!onboardingPriceIngredient) return;

    const normalizedValue = String(onboardingPriceDraft)
      .replace(",", ".")
      .trim();
    const costPrice = Number(normalizedValue);

    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setCreateFeedback("Ingresa un precio valido para activar el ingrediente.");
      return;
    }

    try {
      const ing = onboardingPriceIngredient;
      setSavingOnboardingId(ing.id);
      await api.patch(`/ingredients/${ing.id}`, {
        costPrice,
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

      setOnboardingPriceIngredient(null);
      setOnboardingPriceDraft("");
      setCreateFeedback("");
      await fetchIngredients();
    } catch (err) {
      console.error(err);
      setCreateFeedback("No se pudo activar el ingrediente con precio.");
    } finally {
      setSavingOnboardingId(null);
    }
  };

  const formatIngredientPrice = (value) => {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return "";
    return `EUR ${price.toFixed(2)}`;
  };

  const renderOnboardingAction = (ing) => {
    const isSaving = savingOnboardingId === ing.id;
    const activePrice = ing.exists && ing.active
      ? formatIngredientPrice(ing.costPrice)
      : "";

    return (
      <div className="inv-onboardingAction">
        <button
          className={`inv-toggle ${
            !ing.exists
              ? "not-added"
              : ing.active
              ? "in"
              : "out"
          }`}
          type="button"
          onClick={() => toggleIngredient(ing)}
          disabled={isSaving}
        >
          {!ing.exists
            ? "AGREGAR"
            : ing.active
            ? "ONBOARDING"
            : "AGREGAR"}
        </button>

        {activePrice && (
          <button
            type="button"
            className="inv-priceBubble"
            onClick={() => {
              setOnboardingPriceIngredient(ing);
              setOnboardingPriceDraft(String(ing.costPrice ?? ""));
              setCreateFeedback("");
            }}
            disabled={isSaving}
          >
            {activePrice}
          </button>
        )}
      </div>
    );
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

  const getCategoryDisplayName = (category) =>
    categoryLabels[category] ||
    String(category || "")
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

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

  const handleSelectAllCategory = async (cat, list) => {
    const targetIds = list
      .filter((ing) => !(ing.exists && ing.active))
      .map((ing) => ing.id);

    if (!targetIds.length) return;

    try {
      setSavingCategory(cat);
      await api.post(`/stores/${storeId}/ingredients`, {
        ingredientIds: targetIds,
      });
      await fetchIngredients();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCategory("");
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

      {onboardingPriceIngredient && (
        <div
          className="inv-priceModalOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingOnboardingId) {
              setOnboardingPriceIngredient(null);
              setOnboardingPriceDraft("");
              setCreateFeedback("");
            }
          }}
        >
          <div
            className="inv-priceModal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>Precio del ingrediente</h3>
            <p>{getDisplayName(onboardingPriceIngredient.name)}</p>

            {createFeedback && (
              <div className="inv-priceModalError">{createFeedback}</div>
            )}

            <label className="inv-priceModalField">
              <span>Ingresa precio</span>
              <div>
                <strong>EUR</strong>
                <input
                  type="text"
                  inputMode="decimal"
                  value={onboardingPriceDraft}
                  placeholder="0.99"
                  onChange={(e) =>
                    setOnboardingPriceDraft(
                      normalizePriceInput(e.target.value)
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmIngredientOnboarding();
                    }
                  }}
                  disabled={Boolean(savingOnboardingId)}
                  autoFocus
                />
              </div>
            </label>

            <div className="inv-priceModalActions">
              <button
                type="button"
                onClick={() => {
                  setOnboardingPriceIngredient(null);
                  setOnboardingPriceDraft("");
                  setCreateFeedback("");
                }}
                disabled={Boolean(savingOnboardingId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmIngredientOnboarding}
                disabled={Boolean(savingOnboardingId)}
              >
                {savingOnboardingId ? "Guardando..." : "Guardar"}
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
                  (ing) => ing.exists && ing.active
                ).length;

                return (
                  <SortableCategory key={cat} cat={cat}>
                    {({ attributes, listeners }) => {
                      const isOpen = openCat === cat;

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
                              <span className="inv-count">
                                <strong>{activeCount}</strong>
                                <span>/</span>
                                <small>{list.length}</small>
                              </span>
                              <button
                                className="inv-selectAllBtn"
                                type="button"
                                onClick={() => handleSelectAllCategory(cat, list)}
                                disabled={
                                  savingCategory === cat ||
                                  activeCount === list.length
                                }
                              >
                                {savingCategory === cat ? "Saving..." : "Select all"}
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="inv-items">
                              {list.map((ing) => (
                                <div
                                  key={ing.id}
                                  className={`inv-itemRow ${
                                    ing.exists && ing.active
                                      ? "is-onboarding"
                                      : ""
                                  }`}
                                >
                                  <div className="inv-itemLeft">
                                    <div className="inv-itemName">
                                      {getDisplayName(ing.name)}
                                    </div>
                                  </div>

                                  <div className="inv-itemRight">
                                    <div className="inv-allergenTags">
                                      {getAllergenTags(ing).map((tag) => (
                                        <span
                                          key={`${ing.id}-${tag}`}
                                          className="inv-allergenTag"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                    {renderOnboardingAction(ing)}
                                  </div>
                                </div>
                              ))}
                            </div>
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

                  {filteredIngredients.map((ing) => (
                    <div
                      key={`${ing.id}-${search}`}
                      className="inv-itemRow"
                    >

                      <div className="inv-itemLeft">
                        <div className="inv-itemName">
                          {highlightMatch(getDisplayName(ing.name), search)}
                        </div>
                      </div>

                      <div className="inv-itemRight">
                        <div className="inv-allergenTags">
                          {getAllergenTags(ing).map((tag) => (
                            <span
                              key={`${ing.id}-${tag}`}
                              className="inv-allergenTag"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {ing.exists && !ing.active && (
                          <span className="inv-tag off">
                            inactive
                          </span>
                        )}

                        {renderOnboardingAction(ing)}

                      </div>
                    </div>
                  ))}

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
