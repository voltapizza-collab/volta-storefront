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
      if (!ing.exists) {
        await api.post(`/stores/${storeId}/ingredients`, {
          ingredientIds: [ing.id],
        });
      } else {
        await api.patch(`/stores/${storeId}/ingredients/${ing.id}`, {
          active: !ing.active,
        });
      }

      await fetchIngredients();
    } catch (err) {
      console.error(err);
    }
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
        <h2 className="inv-title">Inventory</h2>

        <button
          className="inv-addBtn"
          type="button"
          onClick={() => {
            setModalOpen(true);
            setModalMode("search");
          }}
        >
          Manage ingredients
        </button>
      </div>

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

                return (
                  <SortableCategory key={cat} cat={cat}>
                    {({ attributes, listeners }) => {
                      const isOpen = openCat === cat;

                      return (
                        <>
                          <button
                            className="inv-catTitle"
                            type="button"
                            onClick={() =>
                              setOpenCat(isOpen ? "" : cat)
                            }
                          >
                            <div className="inv-catLeft">
                              <span
                                className="inv-drag"
                                {...attributes}
                                {...listeners}
                              >
                                ≡
                              </span>
                              <span>{cat}</span>
                            </div>

                            <div className="inv-catRight">
                              <span className="inv-count">
                                {list.length}
                              </span>
                            </div>
                          </button>

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
                                    >
                                      {!ing.exists
                                        ? "AGREGAR"
                                        : ing.active
                                        ? "ONBOARDING"
                                        : "AGREGAR"}
                                    </button>
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
                ? "Manage Ingredients"
                : "Create Ingredient"}
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
                      placeholder="Search ingredients..."
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
                      <div>No ingredients found</div>

                      <button
                        className="inv-createBtn"
                        type="button"
                        onClick={() => {
                          setCreateFeedback("");
                          setModalMode("create");
                        }}
                      >
                        Create new ingredient
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
                        >
                          {!ing.exists
                            ? "AGREGAR"
                            : ing.active
                            ? "ONBOARDING"
                            : "AGREGAR"}
                        </button>

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
                        {cat}
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
