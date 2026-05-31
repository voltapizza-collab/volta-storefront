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
  const [detailIngredient, setDetailIngredient] = useState(null);
  const [detailDraft, setDetailDraft] = useState({
    costPrice: "",
    description: "",
    imageFile: null,
    imagePreview: "",
  });
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

  const isIngredientActiveInStore = (ingredient) => ingredient?.active !== false;
  const isIngredientInactiveInStore = (ingredient) => ingredient?.active === false;

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
            <span>{getIngredientInitials(ing.name)}</span>
          )}
        </span>
        <span className="inv-tileName">{getDisplayName(ing.name)}</span>
        <span className="inv-tileMeta">
          <span>{allergens[0]}</span>
          {activePrice ? <strong>{activePrice.replace("EUR ", "")}</strong> : null}
        </span>
      </button>
    );
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
      .filter((ing) => !isIngredientActiveInStore(ing))
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
                  <span>{getIngredientInitials(detailIngredient.name)}</span>
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
                <h3>{getDisplayName(detailIngredient.name)}</h3>
                <p>{getCategoryDisplayName(detailIngredient.category)}</p>
                <div className="inv-detailStatus">
                  <span className={isIngredientActiveInStore(detailIngredient) ? "is-active" : "is-inactive"}>
                    {isIngredientActiveInStore(detailIngredient) ? "Activo en tienda" : "Pendiente de activar"}
                  </span>
                  {formatIngredientPrice(detailIngredient.costPrice) && (
                    <strong>{formatIngredientPrice(detailIngredient.costPrice)}</strong>
                  )}
                </div>
              </div>
            </div>

            {createFeedback && (
              <div className="inv-priceModalError">{createFeedback}</div>
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
              <span>Ingresa precio</span>
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
                            <div className="inv-itemsGrid">
                              {list.map(renderIngredientTile)}
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
                            <span>{getIngredientInitials(ing.name)}</span>
                          )}
                        </span>
                        <span className="inv-tileName">
                          {highlightMatch(getDisplayName(ing.name), search)}
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
