import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/PizzaCreatorExtras.css";

const defaultSizeList = ["S", "M", "L"];
const sizeOrder = ["S", "M", "L", "XL", "XXL", "ST"];

const normalizePriceBySize = (value, sizes = defaultSizeList, fallbackPrice = 0) => {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fallback = Number(fallbackPrice || 0);

  return sizes.reduce((acc, size) => {
    const rawPrice = source[size];
    acc[size] =
      rawPrice === "" || rawPrice == null
        ? fallback || ""
        : rawPrice;
    return acc;
  }, {});
};

const getPrimaryPrice = (priceBySize, fallbackPrice = 0) => {
  const firstPrice = Object.values(priceBySize || {}).find(
    (price) => price !== "" && price != null
  );
  return Number(firstPrice ?? fallbackPrice ?? 0);
};

const formatCategorySummary = (categories = []) =>
  categories
    .map((category) => category.name)
    .filter(Boolean)
    .join(", ");

export default function PizzaCreatorIngredientUses({ partner }) {
  const partnerId = partner?.partnerId;
  const storeId = partner?.storeId;
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [uses, setUses] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [modal, setModal] = useState(null);
  const [editingUse, setEditingUse] = useState(null);
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const sortedIngredients = useMemo(() => {
    return [...ingredients].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  }, [ingredients]);

  const ingredientOptions = useMemo(() => {
    if (!editingUse?.ingredientId) return sortedIngredients;

    const exists = sortedIngredients.some(
      (ingredient) => ingredient.id === editingUse.ingredientId
    );

    if (exists) return sortedIngredients;

    return [
      {
        id: editingUse.ingredientId,
        name: editingUse.ingredientName || `Ingrediente ${editingUse.ingredientId}`,
      },
      ...sortedIngredients,
    ];
  }, [editingUse, sortedIngredients]);

  const categorySizesById = useMemo(() => {
    const map = new Map();

    pizzas.forEach((pizza) => {
      const categoryId = pizza.categoryId;
      if (!categoryId) return;

      const sizes = Array.isArray(pizza.selectSize) ? pizza.selectSize : [];
      if (!map.has(categoryId)) map.set(categoryId, new Set());
      sizes.forEach((size) => {
        if (size) map.get(categoryId).add(size);
      });
    });

    return new Map(
      [...map.entries()].map(([categoryId, sizes]) => [
        categoryId,
        [...sizes].sort(
          (a, b) =>
            (sizeOrder.indexOf(a) === -1 ? 999 : sizeOrder.indexOf(a)) -
            (sizeOrder.indexOf(b) === -1 ? 999 : sizeOrder.indexOf(b))
        ),
      ])
    );
  }, [pizzas]);

  const getCategorySizes = useCallback(
    (categoryId) => categorySizesById.get(categoryId) || defaultSizeList,
    [categorySizesById]
  );

  const loadAll = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoading(true);
      setFeedback("");

      const [catRes, ingRes, useRes, pizzaRes] = await Promise.all([
        api.get(`/api/partners/${partnerId}/categories`),
        api.get(`/stores/${storeId}/ingredients`),
        api.get(`/api/ingredient-category-uses/all?storeId=${storeId}`),
        api.get(`/api/pizzas?partnerId=${partnerId}`),
      ]);

      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setIngredients(
        (Array.isArray(ingRes.data) ? ingRes.data : []).filter(
          (ingredient) => ingredient.exists && ingredient.active
        )
      );
      setUses(Array.isArray(useRes.data) ? useRes.data : []);
      setPizzas(Array.isArray(pizzaRes.data) ? pizzaRes.data : []);
    } catch (err) {
      console.error(err);
      setCategories([]);
      setIngredients([]);
      setUses([]);
      setPizzas([]);
      setFeedback("No se pudieron cargar los usos de ingredientes.");
    } finally {
      setLoading(false);
    }
  }, [partnerId, storeId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreate = () => {
    setSelectedIngredient("");
    setSelectedCategories([]);
    setEditingUse(null);
    setFeedback("");
    setModal("create");
  };

  const openEdit = (use) => {
    setSelectedIngredient(String(use.ingredientId));
    setSelectedCategories(
      use.categories.map((category) => ({
        id: category.id,
        priceBySize: normalizePriceBySize(
          category.priceBySize,
          getCategorySizes(category.id),
          category.price
        ),
        costPrice: category.costPrice ?? use.costPrice ?? "",
      }))
    );
    setEditingUse(use);
    setFeedback("");
    setModal("edit");
  };

  const openDelete = (use) => {
    setEditingUse(use);
    setFeedback("");
    setModal("delete");
  };

  const toggleCategory = (id) => {
    setSelectedCategories((prev) => {
      const exists = prev.find((category) => category.id === id);
      if (exists) return prev.filter((category) => category.id !== id);

      const ingredient = ingredients.find(
        (item) => String(item.id) === String(selectedIngredient)
      );

      return [
        ...prev,
        {
          id,
          priceBySize: normalizePriceBySize({}, getCategorySizes(id)),
          costPrice: ingredient?.costPrice ?? "",
        },
      ];
    });
  };

  const setCategorySizePrice = (id, size, price) => {
    setSelectedCategories((prev) =>
      prev.map((category) =>
        category.id === id
          ? {
              ...category,
              priceBySize: {
                ...(category.priceBySize || {}),
                [size]: price,
              },
            }
          : category
      )
    );
  };

  const setCategoryCost = (id, costPrice) => {
    setSelectedCategories((prev) =>
      prev.map((category) =>
        category.id === id ? { ...category, costPrice } : category
      )
    );
  };

  const closeModal = () => {
    setModal(null);
    setEditingUse(null);
    setSelectedIngredient("");
    setSelectedCategories([]);
    setFeedback("");
  };

  const save = async () => {
    if (!storeId) return;

    if (!selectedIngredient) {
      alert("Selecciona un ingrediente");
      return;
    }

    if (!selectedCategories.length) {
      alert("Selecciona al menos una categoria");
      return;
    }

    try {
      setSaving(true);

      await api.post("/api/ingredient-category-uses", {
        storeId,
        ingredientId: Number(selectedIngredient),
        links: selectedCategories.map((category) => ({
          categoryId: category.id,
          price: getPrimaryPrice(category.priceBySize),
          priceBySize: category.priceBySize,
          costPrice:
            category.costPrice === "" || category.costPrice == null
              ? null
              : Number(category.costPrice),
        })),
      });

      closeModal();
      loadAll();
    } catch (err) {
      console.error(err);
      setFeedback("No se pudo guardar el uso del ingrediente.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!storeId || !editingUse?.ingredientId) return;

    try {
      setSaving(true);
      await api.delete(
        `/api/ingredient-category-uses/${editingUse.ingredientId}?storeId=${storeId}`
      );
      closeModal();
      loadAll();
    } catch (err) {
      console.error(err);
      setFeedback("No se pudo eliminar el uso del ingrediente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pcex-page">
      <div className="pcex-header">
        <div>
          <div className="pcex-kicker">Pizza Creator</div>
          <h2 className="pcex-title">Uso de ingredientes</h2>
        </div>

        <button type="button" className="pcex-addBtn" onClick={openCreate}>
          + Anadir uso
        </button>
      </div>

      <div className="pcex-list">
        {loading && <div className="pcex-empty">Cargando usos...</div>}
        {!!feedback && <div className="pcex-error">{feedback}</div>}

        {!loading && uses.length === 0 && (
          <div className="pcex-empty">No hay usos de ingredientes configurados.</div>
        )}

        {!loading &&
          uses.map((use) => (
            <div key={use.ingredientId} className="pcex-row">
              <div>
                <strong className="pcex-rowTitle">{use.ingredientName}</strong>
                <span className="pcex-rowMeta">
                  {formatCategorySummary(use.categories) || "Sin categorias"}
                </span>
              </div>

              <div className="pcex-actions">
                <button type="button" onClick={() => openEdit(use)}>
                  Editar
                </button>
                <button type="button" onClick={() => openDelete(use)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
      </div>

      {(modal === "create" || modal === "edit") && (
        <div className="pcex-modalBackdrop">
          <div className="pcex-modal">
            <h3>{modal === "create" ? "Anadir uso" : "Editar uso"}</h3>

            <div className="pcex-field">
              <label>Ingrediente</label>
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
              >
                <option value="">- Selecciona -</option>
                {ingredientOptions.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pcex-field">
              <label>Categorias donde se puede usar</label>
              <div className="pcex-categoryGrid">
                {categories.map((category) => {
                  const selected = selectedCategories.find(
                    (item) => item.id === category.id
                  );
                  const categorySizes = getCategorySizes(category.id);
                  const selectedPriceBySize = selected
                    ? normalizePriceBySize(
                        selected.priceBySize,
                        categorySizes,
                        selected.price
                      )
                    : {};

                  return (
                    <div
                      key={category.id}
                      className={`pcex-catRow ${selected ? "is-active" : ""}`}
                    >
                      <div className="pcex-catHead">
                        <label className="pcex-catLeft">
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={() => toggleCategory(category.id)}
                          />
                          <span className="pcex-catName">{category.name}</span>
                        </label>
                      </div>

                      <div className="pcex-catEditor">
                        {selected ? (
                          <div className="pcex-catControls">
                            <div className="pcex-catInputList">
                              {categorySizes.map((size) => (
                                <label key={size} className="pcex-catInput">
                                  <span>{size}</span>
                                  <div className="pcex-catCurrency">EUR</div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={selectedPriceBySize[size] || ""}
                                    placeholder="0.00"
                                    onChange={(e) =>
                                      setCategorySizePrice(
                                        category.id,
                                        size,
                                        e.target.value
                                      )
                                    }
                                  />
                                </label>
                              ))}

                              <label className="pcex-catInput">
                                <span>Cost</span>
                                <div className="pcex-catCurrency">EUR</div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={selected.costPrice ?? ""}
                                  placeholder="0.00"
                                  onChange={(e) =>
                                    setCategoryCost(category.id, e.target.value)
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <div className="pcex-catInputPlaceholder" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pcex-modalActions">
              <button type="button" onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "delete" && (
        <div className="pcex-modalBackdrop">
          <div className="pcex-modal pcex-modal--small">
            <h3>Eliminar</h3>
            <p>
              Seguro que deseas eliminar los usos de{" "}
              <strong>{editingUse?.ingredientName}</strong>?
            </p>

            <div className="pcex-modalActions">
              <button type="button" onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" onClick={confirmDelete} disabled={saving}>
                {saving ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
