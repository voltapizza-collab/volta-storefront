import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/PizzaCreatorExtras.css";

const defaultSizeList = ["S", "M", "L"];
const sizeOrder = ["S", "M", "L", "XL", "XXL", "ST"];

const normalizePriceBySize = (value, sizes = defaultSizeList, fallbackPrice = 0) => {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
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

export default function PizzaCreatorExtras({ partner }) {
  const partnerId = partner?.partnerId;
  const storeId = partner?.storeId;
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [extras, setExtras] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [modal, setModal] = useState(null);
  const [editingExtra, setEditingExtra] = useState(null);
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
    if (!editingExtra?.ingredientId) return sortedIngredients;

    const exists = sortedIngredients.some(
      (ingredient) => ingredient.id === editingExtra.ingredientId
    );

    if (exists) return sortedIngredients;

    return [
      {
        id: editingExtra.ingredientId,
        name: editingExtra.ingredientName || `Ingrediente ${editingExtra.ingredientId}`,
      },
      ...sortedIngredients,
    ];
  }, [editingExtra, sortedIngredients]);

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

      const [catRes, ingRes, extraRes, pizzaRes] = await Promise.all([
        api.get(`/api/partners/${partnerId}/categories`),
        api.get(`/stores/${storeId}/ingredients`),
        api.get(`/api/ingredient-extras/all?storeId=${storeId}`),
        api.get(`/api/pizzas?partnerId=${partnerId}`),
      ]);

      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setIngredients(
        (Array.isArray(ingRes.data) ? ingRes.data : []).filter(
          (ingredient) => ingredient.exists && ingredient.active
        )
      );
      setExtras(Array.isArray(extraRes.data) ? extraRes.data : []);
      setPizzas(Array.isArray(pizzaRes.data) ? pizzaRes.data : []);
    } catch (err) {
      console.error(err);
      setCategories([]);
      setIngredients([]);
      setExtras([]);
      setPizzas([]);
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
    setEditingExtra(null);
    setFeedback("");
    setModal("create");
  };

  const openEdit = (extra) => {
    setSelectedIngredient(String(extra.ingredientId));
    setSelectedCategories(
      extra.categories.map((category) => ({
        id: category.id,
        priceBySize: normalizePriceBySize(
          category.priceBySize,
          getCategorySizes(category.id),
          category.price
        ),
      }))
    );
    setEditingExtra(extra);
    setFeedback("");
    setModal("edit");
  };

  const openDelete = (extra) => {
    setEditingExtra(extra);
    setFeedback("");
    setModal("delete");
  };

  const toggleCategory = (id) => {
    setSelectedCategories((prev) => {
      const exists = prev.find((category) => category.id === id);
      if (exists) return prev.filter((category) => category.id !== id);
      return [
        ...prev,
        {
          id,
          priceBySize: normalizePriceBySize({}, getCategorySizes(id)),
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

  const closeModal = () => {
    setModal(null);
    setEditingExtra(null);
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

      await api.post("/api/ingredient-extras", {
        storeId,
        ingredientId: Number(selectedIngredient),
        links: selectedCategories.map((category) => ({
          categoryId: category.id,
          price: getPrimaryPrice(category.priceBySize),
          priceBySize: category.priceBySize,
        })),
      });

      closeModal();
      loadAll();
    } catch (err) {
      console.error(err);
      setFeedback("No se pudo guardar el extra.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!storeId || !editingExtra?.ingredientId) return;

    try {
      setSaving(true);
      await api.delete(
        `/api/ingredient-extras/${editingExtra.ingredientId}?storeId=${storeId}`
      );
      closeModal();
      loadAll();
    } catch (err) {
      console.error(err);
      setFeedback("No se pudo eliminar el extra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pcex-page">
      <div className="pcex-header">
        <div>
          <div className="pcex-kicker">Pizza Creator</div>
          <h2 className="pcex-title">Extras</h2>
        </div>

        <button type="button" className="pcex-addBtn" onClick={openCreate}>
          + Anadir extra
        </button>
      </div>

      <div className="pcex-list">
        {loading && <div className="pcex-empty">Cargando extras...</div>}
        {!!feedback && <div className="pcex-error">{feedback}</div>}

        {!loading && extras.length === 0 && (
          <div className="pcex-empty">No hay extras configurados.</div>
        )}

        {!loading &&
          extras.map((extra) => (
            <div key={extra.ingredientId} className="pcex-row">
              <div>
                <strong className="pcex-rowTitle">{extra.ingredientName}</strong>
              </div>

              <div className="pcex-actions">
                <button type="button" onClick={() => openEdit(extra)}>
                  Editar
                </button>
                <button type="button" onClick={() => openDelete(extra)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
      </div>

      {(modal === "create" || modal === "edit") && (
        <div className="pcex-modalBackdrop">
          <div className="pcex-modal">
            <h3>{modal === "create" ? "Anadir extra" : "Editar extra"}</h3>

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
              <label>Categorias</label>
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
              Seguro que deseas eliminar <strong>{editingExtra?.ingredientName}</strong>{" "}
              como extra?
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
