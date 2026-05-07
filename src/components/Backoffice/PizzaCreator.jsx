import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import api from "../../setupAxios";
import "../../styles/PizzaCreator.css";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const sizeList = ["S", "M", "L", "XL", "XXL", "ST"];

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className="pc-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="pc-modal__panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pc-modal__head">
          <div className="pc-modal__title">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="pc-modal__close"
          >
            x
          </button>
        </div>
        <div className="pc-modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function SortablePizza({ id, children }) {
  const {
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
}

function SortableCategory({ id, children }) {
  const {
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
}

const createInitialForm = () => ({
  name: "",
  categoryId: "",
  category: "",
  sizes: [],
  priceBySize: { S: "", M: "", L: "", XL: "", XXL: "", ST: "" },
  launchAt: "",
  imageFile: null,
  ingredients: [],
});

const getAllergenSummary = (allergens) => {
  if (!Array.isArray(allergens) || allergens.length === 0) {
    return "NO-DATA";
  }

  if (allergens.length === 1) {
    return String(allergens[0]).slice(0, 3).toUpperCase();
  }

  return `${String(allergens[0]).slice(0, 3).toUpperCase()}+${allergens.length - 1}`;
};

const toDateTimeLocalValue = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export default function PizzaCreator({ partner }) {
  const partnerId = partner?.partnerId;
  const storeId = partner?.storeId;
  const [categories, setCategories] = useState([]);
  const [pizzaOrderByCat, setPizzaOrderByCat] = useState({});
  const [form, setForm] = useState(createInitialForm);
  const [inventory, setInventory] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [openCat, setOpenCat] = useState(null);
  const [editingPizzaId, setEditingPizzaId] = useState(null);
  const [existingImage, setExistingImage] = useState(null);
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingPizzas, setLoadingPizzas] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryLoadError, setInventoryLoadError] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [originalIngredientIds, setOriginalIngredientIds] = useState([]);

  const loadCategories = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoadingCategories(true);
      const r = await api.get(`/api/partners/${partnerId}/categories`);
      setCategories(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      console.error(err);
      try {
        const fallback = await api.get("/api/categories");
        const rows = Array.isArray(fallback.data) ? fallback.data : [];
        setCategories(
          rows.map((category, index) => ({
            ...category,
            enabled: true,
            position: category.position ?? index,
          }))
        );
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setCategories([]);
      }
    } finally {
      setLoadingCategories(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let alive = true;

    setLoadingInventory(true);
    setInventoryLoadError("");

    api
      .get(storeId ? `/stores/${storeId}/ingredients` : "/ingredients")
      .then((r) => {
        if (!alive) return;
        const source = Array.isArray(r.data) ? r.data : [];
        setInventory(
          storeId
            ? source.filter((item) => item.exists && item.active)
            : source
        );
      })
      .catch((err) => {
        console.error(err);
        if (!alive) return;
        setInventory([]);
        setInventoryLoadError(
          "No se pudieron cargar los ingredientes de esta tienda."
        );
      })
      .finally(() => {
        if (alive) setLoadingInventory(false);
      });

    return () => {
      alive = false;
    };
  }, [storeId]);

  const fetchPizzas = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoadingPizzas(true);
      const r = await api.get(`/api/pizzas?partnerId=${partnerId}`);
      setPizzas(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPizzas(false);
    }
  }, [partnerId]);

  useEffect(() => {
    fetchPizzas();
  }, [fetchPizzas]);

  useEffect(() => {
    if (!categories.length) return;
    setCategoryOrder(categories.map((c) => c.id));
  }, [categories]);

  const persistCategoryOrder = async (order) => {
    if (!partnerId) return;
    setCategoryOrder(order);
    await api.patch(`/api/partners/${partnerId}/categories/order`, {
      orderedIds: order,
    });
  };

  const onCategoryDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categoryOrder.indexOf(active.id);
    const newIndex = categoryOrder.indexOf(over.id);
    const next = arrayMove(categoryOrder, oldIndex, newIndex);
    persistCategoryOrder(next);
  };

  const loadPizzaForEdit = (pizza) => {
    setEditingPizzaId(pizza.id);
    setExistingImage(pizza.image || null);
    setOriginalIngredientIds(
      (pizza.ingredients || [])
        .map((ingredient) => Number(ingredient.id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );

    setForm({
      name: pizza.name || "",
      categoryId: pizza.categoryId ? String(pizza.categoryId) : "",
      category: pizza.categoryName || pizza.category || "",
      sizes: pizza.selectSize || [],
      priceBySize: pizza.priceBySize || {
        S: "",
        M: "",
        L: "",
        XL: "",
        XXL: "",
        ST: "",
      },
      launchAt: toDateTimeLocalValue(pizza.launchAt),
      imageFile: null,
      ingredients: (pizza.ingredients || []).map((i) => ({
        id: i.id,
        name: i.name,
        qtyBySize: i.qtyBySize || {},
      })),
    });

    setOpenCat(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pizzasByCategory = useMemo(() => {
    const map = Object.fromEntries(categories.map((c) => [c.name, []]));

    for (const p of pizzas) {
      const cat = p?.categoryName || p?.category || "";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }

    for (const cat of Object.keys(map)) {
      map[cat] = (map[cat] || [])
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "es", {
            sensitivity: "base",
          })
        );
    }

    return map;
  }, [categories, pizzas]);

  useEffect(() => {
    if (!openCat) return;

    setPizzaOrderByCat((prev) => {
      if (prev[openCat]) return prev;

      return {
        ...prev,
        [openCat]: (pizzasByCategory[openCat] || []).map((p) => p.id),
      };
    });
  }, [openCat, pizzasByCategory]);

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onCategoryChange = (e) => {
    const selectedId = e.target.value;
    const selectedCategory = categories.find(
      (category) => String(category.id) === selectedId
    );

    setForm((p) => ({
      ...p,
      categoryId: selectedId,
      category: selectedCategory?.name || "",
    }));
  };

  const onSizeToggle = (e) => {
    const { value, checked } = e.target;

    setForm((p) => {
      const nextSizes = checked
        ? [...p.sizes, value]
        : p.sizes.filter((s) => s !== value);

      const nextPriceBySize = { ...p.priceBySize };
      if (!checked) {
        nextPriceBySize[value] = "";
      }

      const nextIngredients = p.ingredients.map((row) => {
        const qtyBySize = { ...(row.qtyBySize || {}) };
        if (!checked) delete qtyBySize[value];
        return { ...row, qtyBySize };
      });

      return {
        ...p,
        sizes: nextSizes,
        priceBySize: nextPriceBySize,
        ingredients: nextIngredients,
      };
    });
  };

  const onPriceChange = (e, sz) =>
    setForm((p) => ({
      ...p,
      priceBySize: { ...p.priceBySize, [sz]: e.target.value },
    }));

  const onImageSelect = (e) => {
    setForm((p) => ({
      ...p,
      imageFile: e.target.files?.[0] || null,
    }));
    setExistingImage(null);
  };

  const addIngredient = () => {
    if (inventoryLoadError) {
      alert("Espera a que carguen los ingredientes antes de modificar la receta.");
      return;
    }

    const qty = {};
    sizeList.forEach((s) => {
      qty[s] = 0;
    });

    setForm((p) => ({
      ...p,
      ingredients: [...p.ingredients, { id: "", name: "", qtyBySize: qty }],
    }));
  };

  const removeIngredient = (i) =>
    setForm((p) => ({
      ...p,
      ingredients: p.ingredients.filter((_, idx) => idx !== i),
    }));

  const onIngredientSelect = (i, id) => {
    if (!id) {
      setForm((p) => {
        const ing = [...p.ingredients];
        ing[i] = { ...ing[i], id: "", name: "" };
        return { ...p, ingredients: ing };
      });
      return;
    }

    const row = inventory.find((r) => r.id === Number(id));
    if (!row) return;

    setForm((p) => {
      const ing = [...p.ingredients];
      ing[i] = { ...ing[i], id: row.id, name: row.name };
      return { ...p, ingredients: ing };
    });
  };

  const onQtyChange = (i, sz, val) =>
    setForm((p) => {
      const normalizedValue = String(val ?? "")
        .replace(/[^\d]/g, "")
        .slice(0, 3);
      const ing = [...p.ingredients];
      ing[i] = {
        ...ing[i],
        qtyBySize: { ...(ing[i].qtyBySize || {}), [sz]: normalizedValue },
      };
      return { ...p, ingredients: ing };
    });

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!partnerId) {
      alert("Missing partner context.");
      return;
    }

    if (!form.categoryId) {
      alert("Select a category.");
      return;
    }

    if (inventoryLoadError) {
      alert(
        "No se puede guardar el producto porque los ingredientes no cargaron correctamente. Recarga el modulo e intenta de nuevo."
      );
      return;
    }

    const ingredientsPayload = form.ingredients
      .filter((row) => Number(row.id))
      .map((row) => ({
        ...row,
        id: Number(row.id),
      }));

    if (
      editingPizzaId &&
      originalIngredientIds.length > 0 &&
      ingredientsPayload.length === 0
    ) {
      alert(
        "Este producto ya tenia ingredientes y ahora la receta esta vacia. No se guardo para evitar borrar informacion importante."
      );
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name.trim());
    payload.append("partnerId", String(partnerId));
    payload.append("categoryId", String(Number(form.categoryId)));
    if (storeId) {
      payload.append("storeId", String(storeId));
    }
    payload.append("sizes", JSON.stringify(form.sizes));
    payload.append("priceBySize", JSON.stringify(form.priceBySize));
    payload.append("ingredients", JSON.stringify(ingredientsPayload));
    payload.append("launchAt", form.launchAt || "");
    payload.append("cookingMethod", "");
    if (form.imageFile) {
      payload.append("image", form.imageFile);
    }

    try {
      setSavingProduct(true);

      if (editingPizzaId) {
        await api.put(`/api/pizzas/${editingPizzaId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Producto actualizado");
      } else {
        await api.post("/api/pizzas", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Producto creado");
      }

      setEditingPizzaId(null);
      setExistingImage(null);
      setOriginalIngredientIds([]);
      setForm(createInitialForm());
      fetchPizzas();
    } catch (err) {
      console.error(err);
      const backendError = err.response?.data?.error || "";
      const databaseUnavailable =
        err.response?.status === 503 ||
        backendError.includes("Can't reach database server");

      alert(
        databaseUnavailable
          ? "No se pudo conectar con la base de datos. Revisa que el servidor de Railway/Postgres este activo e intenta de nuevo."
          : backendError || "Error al guardar"
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const deletePizza = async (id) => {
    if (!window.confirm("Eliminar producto?")) return;

    try {
      await api.delete(`/api/pizzas/${id}`);
      setPizzas((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar");
    }
  };

  const onPizzaDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPizzaOrderByCat((prev) => {
      const list = prev[openCat] || [];
      const oldIndex = list.indexOf(active.id);
      const newIndex = list.indexOf(over.id);

      return {
        ...prev,
        [openCat]: arrayMove(list, oldIndex, newIndex),
      };
    });
  };

  const selectedSizes = form.sizes;

  const selectableCategories = useMemo(
    () => categories.filter((category) => category.enabled !== false),
    [categories]
  );

  const inventoryById = useMemo(
    () => new Map(inventory.map((item) => [item.id, item])),
    [inventory]
  );

  const sortedInventory = useMemo(
    () =>
      [...inventory].sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      ),
    [inventory]
  );

  const ingredientOptions = useMemo(() => {
    const missingSelected = form.ingredients
      .map((row) => ({
        id: Number(row.id),
        name: row.name || `Ingrediente #${row.id}`,
      }))
      .filter(
        (row) =>
          Number.isInteger(row.id) &&
          row.id > 0 &&
          !inventoryById.has(row.id)
      );

    return [...sortedInventory, ...missingSelected].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  }, [form.ingredients, inventoryById, sortedInventory]);

  return (
    <>
      <div className="pc-layout">
        <h2 className="pc-title-creator">
          {editingPizzaId ? "Editando producto" : "Crear producto"}
        </h2>

        <form className="pizza-form" onSubmit={onSubmit}>
          <div className="pc-grid">
            <section className="pc-section">
              <div className="pc-sectionTitle">Datos del producto</div>

              <label>
                Nombre
                <input name="name" value={form.name} onChange={onChange} required />
              </label>

              <label>
                Categoria
                <select
                  name="categoryId"
                  value={form.categoryId}
                  onChange={onCategoryChange}
                  required
                >
                  <option value="">- elegir -</option>
                  {selectableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Fecha de lanzamiento
                <input
                  type="datetime-local"
                  name="launchAt"
                  value={form.launchAt}
                  onChange={onChange}
                />
              </label>

              <div className="pc-note">
                Si eliges una fecha futura, el producto aparecera en Proximos y no se vendera hasta ese momento.
              </div>

              <div className="pc-block">
                <div className="pc-sectionTitle">Tamanos y precios</div>

                <div className="pc-sizesRow">
                  {sizeList.map((sz) => {
                    const checked = form.sizes.includes(sz);
                    return (
                      <div key={sz} className="pc-sizeItem">
                        <label className="pc-sizeCheck">
                          <input
                            type="checkbox"
                            value={sz}
                            checked={checked}
                            onChange={onSizeToggle}
                          />
                          <strong>{sz}</strong>
                        </label>

                        <input
                          type="number"
                          placeholder="EUR"
                          value={form.priceBySize[sz]}
                          onChange={(e) => onPriceChange(e, sz)}
                          disabled={!checked}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="pc-section">
              <h3 className="pc-subtitle">Arma tu pizza</h3>

              {!selectedSizes.length && (
                <div className="pc-hint">
                  Selecciona al menos un tamano para poder poner cantidades.
                </div>
              )}

              <div className="pc-hint">
                Solo aparecen ingredientes activos del inventario/onboarding de esta tienda.
              </div>
              {loadingInventory && (
                <div className="pc-hint">Cargando ingredientes...</div>
              )}
              {inventoryLoadError && (
                <div className="pc-hint pc-hint--error">
                  {inventoryLoadError} No guardes el producto hasta recargar el modulo.
                </div>
              )}

              <fieldset className="ingredients-fieldset">
                {form.ingredients.map((row, i) => {
                  const ingredientMeta = inventoryById.get(row.id);
                  const allergenSummary = getAllergenSummary(
                    ingredientMeta?.allergens
                  );
                  const hasAllergens =
                    Array.isArray(ingredientMeta?.allergens) &&
                    ingredientMeta.allergens.length > 0;

                  return (
                  <div key={i} className="ing-row">
                    <div className="pc-ingredientCell">
                      <select
                        value={row.id}
                        onChange={(e) => onIngredientSelect(i, e.target.value)}
                      >
                        <option value="">- ingrediente -</option>
                        {ingredientOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                          ))}
                      </select>
                    </div>

                    <div className="pc-sizeQtyScroller">
                    <div className="pc-sizeQtyGrid pc-sizeQtyGrid--compact">
                      {selectedSizes.map((sz) => (
                        <div key={`${i}-${sz}`} className="pc-sizeQtyItem">
                          <span className="pc-sizeQtyLabel">{sz}</span>
                          <input
                            type="text"
                            className="pc-sizeQtyInput"
                            inputMode="numeric"
                            maxLength={3}
                            value={(row.qtyBySize || {})[sz] ?? 0}
                            onChange={(e) => onQtyChange(i, sz, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    </div>

                    <div className="pc-rowAside">
                      <div
                        className={`pc-allergenBadge ${
                          hasAllergens ? "" : "no-data"
                        }`}
                        title={
                          hasAllergens
                            ? ingredientMeta.allergens.join(", ")
                            : "Sin alergeno declarado"
                        }
                      >
                        <span className="pc-allergenBadgeLabel">ALG</span>
                        <span className="pc-allergenBadgeValue">
                          {allergenSummary}
                        </span>
                      </div>

                      <button type="button" onClick={() => removeIngredient(i)}>
                        x
                      </button>
                    </div>
                  </div>
                )})}

                <button type="button" onClick={addIngredient}>
                  + Anadir ingrediente
                </button>
              </fieldset>
            </section>

            <section className="pc-section">
              {existingImage && !form.imageFile && (
                <div className="pc-imagePreview">
                  <div className="pc-imageLabel">Imagen actual</div>
                  <img src={existingImage} alt="actual" className="pc-imageThumb" />
                </div>
              )}

              <label className="pc-file-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageSelect}
                  hidden
                />
                <span className="pc-file-btn">
                  {form.imageFile || existingImage
                    ? "Cambiar imagen"
                    : "Agrega la imagen del producto"}
                </span>
              </label>

              <div className="pc-note">
                La imagen se subira al catalogo visual del producto.
              </div>

              {form.imageFile && (
                <div className="pc-fileMeta">
                  Seleccionado: {form.imageFile.name}
                </div>
              )}
            </section>

            <button className="save-btn" type="submit" disabled={savingProduct}>
              {savingProduct ? "Guardando..." : "Guardar producto"}
            </button>

            {editingPizzaId && (
              <button
                type="button"
                className="pc-cancelBtn"
                onClick={() => {
                  setEditingPizzaId(null);
                  setExistingImage(null);
                  setOriginalIngredientIds([]);
                  setForm(createInitialForm());
                }}
              >
                Cancelar edicion
              </button>
            )}
          </div>
        </form>

        <aside className="pc-right">
          <div className="pc-right__title">Categorias</div>
          <div className="pc-right__hint">
            Orden del feed del negocio. Este orden lo define cada partner desde
            su Backoffice.
          </div>

          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={onCategoryDragEnd}
          >
            <SortableContext
              items={categoryOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="pc-catsGrid">
                {categoryOrder.map((id) => {
                  const c = categories.find((x) => x.id === id);
                  if (!c) return null;

                  const name = c.name;
                  const count = (pizzasByCategory[name] || []).length;

                  return (
                    <SortableCategory key={c.id} id={c.id}>
                      {(listeners) => (
                        <button
                          onClick={() => setOpenCat(name)}
                          className="pc-catCard"
                          type="button"
                        >
                          <div className="pc-catTop">
                            <span {...listeners} className="pc-catDrag">
                              |||
                            </span>
                            <span className="pc-catName">{name}</span>
                          </div>

                          <div className="pc-catCount">{count} productos</div>
                        </button>
                      )}
                    </SortableCategory>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {(loadingCategories || loadingPizzas) && (
            <div className="pc-sideInfo">Cargando datos...</div>
          )}
        </aside>
      </div>

      <Modal
        open={!!openCat}
        title={
          openCat
            ? `${openCat} - ${(pizzasByCategory[openCat] || []).length}`
            : ""
        }
        onClose={() => setOpenCat(null)}
      >
        <div className="pc-modalListWrap">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={onPizzaDragEnd}
          >
            <SortableContext
              items={pizzaOrderByCat[openCat] || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="pc-modalList">
                {(pizzaOrderByCat[openCat] || []).map((pizzaId) => {
                  const p = (pizzasByCategory[openCat] || []).find(
                    (x) => x.id === pizzaId
                  );
                  if (!p) return null;

                  const st = p.status;
                  const badgeBg =
                    st === "INACTIVE"
                      ? "rgba(255, 59, 48, 0.08)"
                      : "rgba(34, 197, 94, 0.10)";
                  const badgeBorder =
                    st === "INACTIVE"
                      ? "rgba(255, 59, 48, 0.25)"
                      : "rgba(34, 197, 94, 0.25)";

                  return (
                    <SortablePizza key={p.id} id={p.id}>
                      {(listeners) => (
                        <div className="pc-modalCard">
                          <span {...listeners} className="pc-modalDrag" title="Arrastrar">
                            |||
                          </span>

                          <div className="pc-modalInfo">
                            <div className="pc-modalName">{p.name}</div>

                            <div className="pc-modalMeta">
                              <span
                                className="pc-statusBadge"
                                style={{
                                  border: `1px solid ${badgeBorder}`,
                                  background: badgeBg,
                                }}
                              >
                                {st}
                              </span>

                              {p.priceBySize &&
                                Object.entries(p.priceBySize)
                                  .filter(([_, v]) => v)
                                  .map(([sz, price]) => (
                                    <span key={sz} className="pc-priceBadge">
                                      {sz}: EUR{price}
                                    </span>
                                  ))}

                              {p.ingredients?.map((ing) => (
                                <span
                                  key={ing.id}
                                  title={ing.name}
                                  className={`pc-ingredientBadge ${
                                    ing.status === "INACTIVE" ? "inactive" : ""
                                  }`}
                                >
                                  #{ing.id}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pc-modalActions">
                            <button type="button" onClick={() => loadPizzaForEdit(p)}>
                              Editar
                            </button>

                            <button type="button" onClick={() => deletePizza(p.id)}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </SortablePizza>
                  );
                })}

                {openCat && (pizzaOrderByCat[openCat]?.length ?? 0) === 0 && (
                  <div className="pc-emptyState">
                    No hay productos en esta categoria.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </Modal>
    </>
  );
}
