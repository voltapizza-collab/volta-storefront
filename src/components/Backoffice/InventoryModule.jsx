import React, { useEffect, useMemo, useState } from "react";
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

  const storeId = partner?.storeId;

  useEffect(() => {
    if (!storeId) return;
    fetchIngredients();
  }, [storeId]);

  const fetchIngredients = async () => {
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
      ];

      setCategories(uniqueCategories);
    } catch (err) {
      console.error(err);
    }
  };

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

  const highlightMatch = (text, query) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));

    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="inv-highlight">
          {part}
        </span>
      ) : (
        part
      )
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

    } catch (err) {
      console.error("CREATE INGREDIENT ERROR:", err.response?.data || err);
    }
  };
  return (
    <div className="inv-wrapper">

      {/* HEADER */}
      <div className="inv-header">
        <h2 className="inv-title">Inventory</h2>

        <button
          className="inv-addBtn"
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
                                <div key={ing.id} className="inv-itemRow">
                                  <div className="inv-itemName">
                                    {ing.name}
                                  </div>

                                  <div className="inv-itemRight">
                                    {!ing.exists && (
                                      <span className="inv-badge new">
                                        not added
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
                                      onClick={() => toggleIngredient(ing)}
                                    >
                                      {!ing.exists
                                        ? "ADD"
                                        : ing.active
                                        ? "IN"
                                        : "OUT"}
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
                        onClick={() => setModalMode("create")}
                      >
                        Create new ingredient
                      </button>
                    </div>
                  )}

                  {filteredIngredients.map((ing) => (
                    <div key={ing.id} className="inv-itemRow">

                      <div className="inv-itemName">
                        {highlightMatch(ing.name, search)}
                      </div>

                      <div className="inv-itemRight">

                        {!ing.exists && (
                          <span className="inv-badge new">
                            not added
                          </span>
                        )}

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
                          onClick={() => toggleIngredient(ing)}
                        >
                          {!ing.exists
                            ? "ADD"
                            : ing.active
                            ? "IN"
                            : "OUT"}
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
                    onClick={() => setModalMode("search")}
                  >
                    Back
                  </button>

                  <button
                    className="inv-confirmBtn"
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