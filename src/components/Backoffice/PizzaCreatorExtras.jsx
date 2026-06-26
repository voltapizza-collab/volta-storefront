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

const SUPPORTED_EXTRAS_LOCALES = new Set(["en", "es", "it", "fr", "pt"]);

const normalizeExtrasLocale = (value) => {
  const locale = String(value || "").trim().toLowerCase().slice(0, 2);
  return SUPPORTED_EXTRAS_LOCALES.has(locale) ? locale : "en";
};

const EXTRAS_COPY = {
  en: {
    "title": "Extras",
    "action.addExtra": "+ Add extra",
    "state.loading": "Loading extras...",
    "state.empty": "No extras configured.",
    "action.edit": "Edit",
    "action.delete": "Delete",
    "modal.add": "Add extra",
    "modal.edit": "Edit extra",
    "field.ingredient": "Ingredient",
    "field.select": "- Select -",
    "field.categories": "Categories",
    "action.cancel": "Cancel",
    "action.save": "Save",
    "action.saving": "Saving...",
    "delete.title": "Delete",
    "delete.confirm": "Are you sure you want to remove {name} as an extra?",
    "delete.deleting": "Deleting...",
    "alert.selectIngredient": "Select an ingredient",
    "alert.selectCategory": "Select at least one category",
    "alert.selectCategoryWithProducts": "Select at least one category with products",
    "feedback.saveError": "The extra could not be saved.",
    "feedback.deleteError": "The extra could not be deleted.",
    "fallback.ingredient": "Ingredient {id}",
  },
  es: {
    "title": "Extras",
    "action.addExtra": "+ Anadir extra",
    "state.loading": "Cargando extras...",
    "state.empty": "No hay extras configurados.",
    "action.edit": "Editar",
    "action.delete": "Eliminar",
    "modal.add": "Anadir extra",
    "modal.edit": "Editar extra",
    "field.ingredient": "Ingrediente",
    "field.select": "- Selecciona -",
    "field.categories": "Categorias",
    "action.cancel": "Cancelar",
    "action.save": "Guardar",
    "action.saving": "Guardando...",
    "delete.title": "Eliminar",
    "delete.confirm": "Seguro que deseas eliminar {name} como extra?",
    "delete.deleting": "Eliminando...",
    "alert.selectIngredient": "Selecciona un ingrediente",
    "alert.selectCategory": "Selecciona al menos una categoria",
    "alert.selectCategoryWithProducts": "Selecciona al menos una categoria con productos",
    "feedback.saveError": "No se pudo guardar el extra.",
    "feedback.deleteError": "No se pudo eliminar el extra.",
    "fallback.ingredient": "Ingrediente {id}",
  },
};

const translateExtras = (locale, key, values = {}) => {
  const dictionary = EXTRAS_COPY[locale] || EXTRAS_COPY.en;
  const template = dictionary[key] || EXTRAS_COPY.en[key] || key;

  return template.replace(/\{(\w+)\}/g, (_, name) =>
    values[name] == null ? "" : String(values[name])
  );
};

const getIngredientDisplayName = (ingredient = {}) =>
  String(
    ingredient.displayName ||
      ingredient.semanticMapping?.globalIngredient?.displayName ||
      ingredient.ingredientName ||
      ingredient.name ||
      ""
  ).trim();

export default function PizzaCreatorExtras({ partner, language = "es" }) {
  const partnerId = partner?.partnerId;
  const storeId = partner?.storeId;
  const activeLocale = useMemo(
    () => normalizeExtrasLocale(language),
    [language]
  );
  const t = useCallback(
    (key, values) => translateExtras(activeLocale, key, values),
    [activeLocale]
  );
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
      getIngredientDisplayName(a).localeCompare(
        getIngredientDisplayName(b),
        activeLocale,
        { sensitivity: "base" }
      )
    );
  }, [activeLocale, ingredients]);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients]
  );

  const ingredientOptions = useMemo(() => {
    if (!editingExtra?.ingredientId) return sortedIngredients;

    const exists = sortedIngredients.some(
      (ingredient) => ingredient.id === editingExtra.ingredientId
    );

    if (exists) return sortedIngredients;

    return [
      {
        id: editingExtra.ingredientId,
        displayName:
          editingExtra.ingredientName ||
          t("fallback.ingredient", { id: editingExtra.ingredientId }),
        name:
          editingExtra.ingredientName ||
          t("fallback.ingredient", { id: editingExtra.ingredientId }),
      },
      ...sortedIngredients,
    ];
  }, [editingExtra, sortedIngredients, t]);

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

  const selectableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.enabled !== false &&
          categorySizesById.has(category.id)
      ),
    [categories, categorySizesById]
  );

  const selectableCategoryIds = useMemo(
    () => new Set(selectableCategories.map((category) => category.id)),
    [selectableCategories]
  );

  const loadAll = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoading(true);

      const [catRes, ingRes, extraRes, pizzaRes] = await Promise.all([
        api.get(`/api/partners/${partnerId}/categories`),
        api.get(`/stores/${storeId}/ingredients`, {
          params: { locale: activeLocale },
        }),
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
  }, [activeLocale, partnerId, storeId]);

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
      extra.categories
        .filter((category) => selectableCategoryIds.has(category.id))
        .map((category) => ({
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
      alert(t("alert.selectIngredient"));
      return;
    }

    if (!selectedCategories.length) {
      alert(t("alert.selectCategory"));
      return;
    }

    try {
      setSaving(true);

      const links = selectedCategories
        .filter((category) => selectableCategoryIds.has(category.id))
        .map((category) => ({
          categoryId: category.id,
          price: getPrimaryPrice(category.priceBySize),
          priceBySize: category.priceBySize,
        }));

      if (!links.length) {
        alert(t("alert.selectCategoryWithProducts"));
        return;
      }

      await api.post("/api/ingredient-extras", {
        storeId,
        ingredientId: Number(selectedIngredient),
        links,
      });

      closeModal();
      loadAll();
    } catch (err) {
      console.error(err);
      setFeedback(t("feedback.saveError"));
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
      setFeedback(t("feedback.deleteError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pcex-page">
      <div className="pcex-header">
        <div>
          <div className="pcex-kicker">Pizza Creator</div>
          <h2 className="pcex-title">{t("title")}</h2>
        </div>

        <button type="button" className="pcex-addBtn" onClick={openCreate}>
          {t("action.addExtra")}
        </button>
      </div>

      <div className="pcex-list">
        {loading && <div className="pcex-empty">{t("state.loading")}</div>}
        {!!feedback && <div className="pcex-error">{feedback}</div>}

        {!loading && extras.length === 0 && (
          <div className="pcex-empty">{t("state.empty")}</div>
        )}

        {!loading &&
          extras.map((extra) => {
            const visibleName =
              getIngredientDisplayName(ingredientById.get(extra.ingredientId)) ||
              extra.ingredientName ||
              t("fallback.ingredient", { id: extra.ingredientId });

            return (
              <div key={extra.ingredientId} className="pcex-row">
                <div>
                  <strong className="pcex-rowTitle">{visibleName}</strong>
                </div>

                <div className="pcex-actions">
                  <button type="button" onClick={() => openEdit(extra)}>
                    {t("action.edit")}
                  </button>
                  <button type="button" onClick={() => openDelete(extra)}>
                    {t("action.delete")}
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {(modal === "create" || modal === "edit") && (
        <div className="pcex-modalBackdrop">
          <div className="pcex-modal">
            <h3>{modal === "create" ? t("modal.add") : t("modal.edit")}</h3>

            <div className="pcex-field">
              <label>{t("field.ingredient")}</label>
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
              >
                <option value="">{t("field.select")}</option>
                {ingredientOptions.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {getIngredientDisplayName(ingredient)}
                  </option>
                ))}
              </select>
            </div>

            <div className="pcex-field">
              <label>{t("field.categories")}</label>
              <div className="pcex-categoryGrid">
                {selectableCategories.map((category) => {
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
                {t("action.cancel")}
              </button>
              <button type="button" onClick={save} disabled={saving}>
                {saving ? t("action.saving") : t("action.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "delete" && (
        <div className="pcex-modalBackdrop">
          <div className="pcex-modal pcex-modal--small">
            <h3>{t("delete.title")}</h3>
            <p>
              {t("delete.confirm", {
                name:
                  getIngredientDisplayName(
                    ingredientById.get(editingExtra?.ingredientId)
                  ) ||
                  editingExtra?.ingredientName ||
                  "",
              })}
            </p>

            <div className="pcex-modalActions">
              <button type="button" onClick={closeModal}>
                {t("action.cancel")}
              </button>
              <button type="button" onClick={confirmDelete} disabled={saving}>
                {saving ? t("delete.deleting") : t("action.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
