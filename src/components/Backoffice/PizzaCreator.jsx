import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const PRODUCT_TAG_OPTIONS = [
  { value: "spicy", labelKey: "tag.spicy" },
  { value: "vegan", labelKey: "tag.vegan" },
];
const RANDOM_SELECTION_OPTION_ID = "__random_selection__";

function Modal({ open, title, onClose, children, panelClassName = "" }) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className="pc-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className={`pc-modal__panel ${panelClassName}`}
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
  availableUntil: "",
  productTags: [],
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

const SUPPORTED_CREATOR_LOCALES = new Set(["en", "es", "it", "fr", "pt"]);
const RANDOM_SELECTION_CANONICAL_KEYS = new Set([
  "random_selection_1",
  "random_selection_2",
  "random_selection_3",
]);

const normalizeCreatorLocale = (value) => {
  const locale = String(value || "").trim().toLowerCase().slice(0, 2);
  return SUPPORTED_CREATOR_LOCALES.has(locale) ? locale : "en";
};

const PC_COPY = {
  en: {
    "title.create": "Create product",
    "title.edit": "Editing product",
    "section.productData": "Product data",
    "field.name": "Name",
    "field.category": "Category",
    "field.choose": "- choose -",
    "field.launchAt": "Launch date",
    "field.availableUntil": "End date",
    "section.specialNotices": "Special notices",
    "tag.spicy": "Spicy",
    "tag.vegan": "Vegan",
    "section.initialAvailability": "Initial availability",
    "action.all": "All",
    "action.none": "None",
    "state.loadingStores": "Loading stores...",
    "state.noStores": "No stores configured.",
    "section.sizesPrices": "Sizes and prices",
    "section.buildPizza": "Build your pizza",
    "hint.selectSize": "Select at least one size before setting quantities.",
    "hint.activeIngredients": "Only active ingredients from this store inventory/onboarding are shown.",
    "hint.randomSelection": "Random selection placeholders let the store choose the final surplus ingredients during production.",
    "state.loadingIngredients": "Loading ingredients...",
    "hint.reloadBeforeSave": "Do not save the product until the module is reloaded.",
    "field.ingredient": "- ingredient -",
    "allergen.none": "No declared allergen",
    "action.addIngredient": "+ Add ingredient",
    "modal.randomTitle": "Random selection",
    "field.randomSelectionCount": "Choose how many random selections this pizza will use",
    "action.apply": "Apply",
    "action.cancel": "Cancel",
    "image.current": "Current image",
    "image.change": "Change image",
    "image.add": "Add product image",
    "image.note": "The image will be uploaded to the product visual catalog.",
    "image.selected": "Selected: {name}",
    "action.saving": "Saving...",
    "action.saveProduct": "Save product",
    "action.cancelEdit": "Cancel edit",
    "side.categories": "Categories with products",
    "side.hint": "Business feed order. Empty categories remain available when creating products.",
    "side.productCount": "{count} products",
    "state.noProductsYet": "No products created yet.",
    "state.loadingData": "Loading data...",
    "modal.drag": "Drag",
    "modal.productAlt": "Product",
    "modal.edit": "Edit",
    "modal.delete": "Delete",
    "modal.noCategoryProducts": "There are no products in this category.",
    "alert.waitIngredients": "Wait until ingredients are loaded before changing the recipe.",
    "alert.duplicateIngredient": "This ingredient is already in the recipe.",
    "alert.randomSelectionDuplicate": "Random selection is already in the recipe. Change the quantity on that row.",
    "alert.randomSelectionUnavailable": "Random selection is not loaded yet. Reload the module and try again.",
    "alert.missingPartner": "Missing partner context.",
    "alert.missingStore": "No active store. Reload Backoffice before saving products.",
    "alert.missingCategory": "Select a category.",
    "alert.invalidDate": "End date must be after launch date.",
    "alert.inventoryLoadError": "The product cannot be saved because ingredients did not load correctly. Reload the module and try again.",
    "alert.emptyRecipeProtection": "This product already had ingredients and the recipe is now empty. It was not saved to avoid deleting important information.",
    "alert.updated": "Product updated",
    "alert.created": "Product created",
    "alert.deleteConfirm": "Delete product?",
    "alert.deleteError": "Could not delete",
  },
  es: {
    "title.create": "Crear producto",
    "title.edit": "Editando producto",
    "section.productData": "Datos del producto",
    "field.name": "Nombre",
    "field.category": "Categoria",
    "field.choose": "- elegir -",
    "field.launchAt": "Fecha de lanzamiento",
    "field.availableUntil": "Fecha de finalizacion",
    "section.specialNotices": "Avisos especiales",
    "tag.spicy": "Picante",
    "tag.vegan": "Vegano",
    "section.initialAvailability": "Disponibilidad inicial",
    "action.all": "Todas",
    "action.none": "Ninguna",
    "state.loadingStores": "Cargando tiendas...",
    "state.noStores": "No hay tiendas configuradas.",
    "section.sizesPrices": "Tamanos y precios",
    "section.buildPizza": "Arma tu pizza",
    "hint.selectSize": "Selecciona al menos un tamano para poder poner cantidades.",
    "hint.activeIngredients": "Solo aparecen ingredientes activos del inventario/onboarding de esta tienda.",
    "hint.randomSelection": "Random selection permite que la tienda decida los ingredientes finales de excedente durante produccion.",
    "state.loadingIngredients": "Cargando ingredientes...",
    "hint.reloadBeforeSave": "No guardes el producto hasta recargar el modulo.",
    "field.ingredient": "- ingrediente -",
    "allergen.none": "Sin alergeno declarado",
    "action.addIngredient": "+ Anadir ingrediente",
    "modal.randomTitle": "Random selection",
    "field.randomSelectionCount": "Escoge la cantidad de random selection que se usara en esta pizza",
    "action.apply": "Aplicar",
    "action.cancel": "Cancelar",
    "image.current": "Imagen actual",
    "image.change": "Cambiar imagen",
    "image.add": "Agrega la imagen del producto",
    "image.note": "La imagen se subira al catalogo visual del producto.",
    "image.selected": "Seleccionado: {name}",
    "action.saving": "Guardando...",
    "action.saveProduct": "Guardar producto",
    "action.cancelEdit": "Cancelar edicion",
    "side.categories": "Categorias con productos",
    "side.hint": "Orden del feed del negocio. Las categorias vacias siguen disponibles al crear productos.",
    "side.productCount": "{count} productos",
    "state.noProductsYet": "Aun no hay productos creados.",
    "state.loadingData": "Cargando datos...",
    "modal.drag": "Arrastrar",
    "modal.productAlt": "Producto",
    "modal.edit": "Editar",
    "modal.delete": "Eliminar",
    "modal.noCategoryProducts": "No hay productos en esta categoria.",
    "alert.waitIngredients": "Espera a que carguen los ingredientes antes de modificar la receta.",
    "alert.duplicateIngredient": "Este ingrediente ya esta en la receta.",
    "alert.randomSelectionDuplicate": "Random selection ya esta en la receta. Cambia la cantidad en esa fila.",
    "alert.randomSelectionUnavailable": "Random selection aun no esta cargado. Recarga el modulo e intenta de nuevo.",
    "alert.missingPartner": "Missing partner context.",
    "alert.missingStore": "No hay tienda activa. Recarga el Backoffice antes de guardar productos.",
    "alert.missingCategory": "Select a category.",
    "alert.invalidDate": "La fecha de finalizacion debe ser posterior a la fecha de lanzamiento.",
    "alert.inventoryLoadError": "No se puede guardar el producto porque los ingredientes no cargaron correctamente. Recarga el modulo e intenta de nuevo.",
    "alert.emptyRecipeProtection": "Este producto ya tenia ingredientes y ahora la receta esta vacia. No se guardo para evitar borrar informacion importante.",
    "alert.updated": "Producto actualizado",
    "alert.created": "Producto creado",
    "alert.deleteConfirm": "Eliminar producto?",
    "alert.deleteError": "No se pudo eliminar",
  },
};

const translateCreator = (locale, key, values = {}) => {
  const dictionary = PC_COPY[locale] || PC_COPY.en;
  const template = dictionary[key] || PC_COPY.en[key] || key;

  return template.replace(/\{(\w+)\}/g, (_, name) =>
    values[name] == null ? "" : String(values[name])
  );
};

const getRandomSelectionCount = (ingredient = {}) => {
  const match = String(ingredient.canonicalKey || "").match(
    /^random_selection_([123])$/
  );

  return match ? Number(match[1]) : 0;
};

const getIngredientDisplayName = (ingredient = {}) =>
  ingredient.id === RANDOM_SELECTION_OPTION_ID
    ? ingredient.displayName || "★ Random selection"
    : isRandomSelectionIngredient(ingredient)
    ? `★ Random selection ${getRandomSelectionCount(ingredient) || ""}`.trim()
    : String(
    ingredient.displayName ||
      ingredient.semanticMapping?.globalIngredient?.displayName ||
      ingredient.name ||
      ""
  ).trim();

const isRandomSelectionIngredient = (ingredient = {}) =>
  RANDOM_SELECTION_CANONICAL_KEYS.has(String(ingredient.canonicalKey || ""));

const isRandomSelectionOption = (ingredient = {}) =>
  ingredient.id === RANDOM_SELECTION_OPTION_ID || isRandomSelectionIngredient(ingredient);

const compareIngredientOptions = (locale) => (a, b) => {
  const aRandom = isRandomSelectionOption(a);
  const bRandom = isRandomSelectionOption(b);

  if (aRandom !== bRandom) return aRandom ? -1 : 1;

  return getIngredientDisplayName(a).localeCompare(
    getIngredientDisplayName(b),
    locale,
    { sensitivity: "base" }
  );
};

export default function PizzaCreator({ partner, language = "es" }) {
  const partnerId = partner?.partnerId;
  const storeId = partner?.storeId;
  const activeLocale = useMemo(
    () => normalizeCreatorLocale(language),
    [language]
  );
  const t = useCallback(
    (key, values) => translateCreator(activeLocale, key, values),
    [activeLocale]
  );
  const [categories, setCategories] = useState([]);
  const [pizzaOrderByCat, setPizzaOrderByCat] = useState({});
  const [form, setForm] = useState(createInitialForm);
  const [inventory, setInventory] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [targetStoreIds, setTargetStoreIds] = useState([]);
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
  const [randomSelectionModal, setRandomSelectionModal] = useState(null);
  const ingredientsListRef = useRef(null);
  const shouldFocusNewIngredientRef = useRef(false);

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

    if (!partnerId) {
      setStores([]);
      setLoadingStores(false);
      return () => {
        alive = false;
      };
    }

    setLoadingStores(true);
    api
      .get(`/stores?partnerId=${partnerId}`)
      .then((response) => {
        if (!alive) return;
        setStores(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => {
        console.error(err);
        if (alive) setStores([]);
      })
      .finally(() => {
        if (alive) setLoadingStores(false);
      });

    return () => {
      alive = false;
    };
  }, [partnerId]);

  useEffect(() => {
    setTargetStoreIds(storeId ? [String(storeId)] : []);
  }, [storeId]);

  useEffect(() => {
    if (!shouldFocusNewIngredientRef.current) return;

    shouldFocusNewIngredientRef.current = false;

    requestAnimationFrame(() => {
      const list = ingredientsListRef.current;
      if (!list) return;

      list.scrollTop = list.scrollHeight;

      const selects = list.querySelectorAll("select");
      const lastSelect = selects[selects.length - 1];
      lastSelect?.focus();
    });
  }, [form.ingredients.length]);

  useEffect(() => {
    let alive = true;

    if (!storeId) {
      setInventory([]);
      setInventoryLoadError(
        t("alert.missingStore")
      );
      setLoadingInventory(false);
      return () => {
        alive = false;
      };
    }

    setLoadingInventory(true);
    setInventoryLoadError("");

    api
      .get(`/stores/${storeId}/ingredients`, {
        params: { locale: activeLocale },
      })
      .then((r) => {
        if (!alive) return;
        const source = Array.isArray(r.data) ? r.data : [];
        setInventory(
          source.filter((item) => item.exists && item.active)
        );
      })
      .catch((err) => {
        console.error(err);
        if (!alive) return;
        setInventory([]);
        setInventoryLoadError(
          t("alert.inventoryLoadError")
        );
      })
      .finally(() => {
        if (alive) setLoadingInventory(false);
      });

    return () => {
      alive = false;
    };
  }, [activeLocale, storeId, t]);

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
      availableUntil: toDateTimeLocalValue(pizza.availableUntil),
      productTags: Array.isArray(pizza.productTags) ? pizza.productTags : [],
      imageFile: null,
      ingredients: (pizza.ingredients || []).map((i) => ({
        id: i.id,
        name: i.name,
        canonicalKey: i.canonicalKey || null,
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

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const productCategoryOrder = useMemo(
    () =>
      categoryOrder.filter((id) => {
        const category = categoryById.get(id);
        return category && (pizzasByCategory[category.name] || []).length > 0;
      }),
    [categoryById, categoryOrder, pizzasByCategory]
  );

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

  const toggleProductTag = (tagValue) => {
    setForm((current) => {
      const currentTags = Array.isArray(current.productTags)
        ? current.productTags
        : [];
      const productTags = currentTags.includes(tagValue)
        ? currentTags.filter((tag) => tag !== tagValue)
        : [...currentTags, tagValue];

      return { ...current, productTags };
    });
  };

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
      alert(t("alert.waitIngredients"));
      return;
    }

    const qty = {};
    sizeList.forEach((s) => {
      qty[s] = 0;
    });

    shouldFocusNewIngredientRef.current = true;

    setForm((p) => ({
      ...p,
      ingredients: [...p.ingredients, { id: "", name: "", qtyBySize: qty }],
    }));
  };

  const removeIngredient = (i) => {
    setForm((p) => ({
      ...p,
      ingredients: p.ingredients.filter((_, idx) => idx !== i),
    }));
  };

  const onIngredientSelect = (i, id) => {
    if (id === RANDOM_SELECTION_OPTION_ID) {
      const hasRandomSelectionElsewhere = form.ingredients.some(
        (row, idx) => idx !== i && isRandomSelectionIngredient(row)
      );

      if (hasRandomSelectionElsewhere) {
        alert(t("alert.randomSelectionDuplicate"));
        return;
      }

      const currentCount =
        getRandomSelectionCount(form.ingredients[i]) || 1;
      setRandomSelectionModal({
        rowIndex: i,
        count: String(currentCount),
      });
      return;
    }

    if (!id) {
      setForm((p) => {
        const ing = [...p.ingredients];
        ing[i] = {
          ...ing[i],
          id: "",
          name: "",
          canonicalKey: null,
          displayName: "",
        };
        return { ...p, ingredients: ing };
      });
      return;
    }

    const nextIngredientId = Number(id);
    const alreadySelected = form.ingredients.some(
      (row, idx) => idx !== i && Number(row.id) === nextIngredientId
    );

    if (alreadySelected) {
      alert(t("alert.duplicateIngredient"));
      return;
    }

    const row = inventory.find((r) => r.id === nextIngredientId);
    if (!row) return;

    setForm((p) => {
      const ing = [...p.ingredients];
      ing[i] = {
        ...ing[i],
        id: row.id,
        name: row.name,
        canonicalKey: row.canonicalKey || null,
        displayName: getIngredientDisplayName(row),
      };
      return { ...p, ingredients: ing };
    });
  };

  const confirmRandomSelection = () => {
    const rowIndex = Number(randomSelectionModal?.rowIndex);
    const count = Number(randomSelectionModal?.count || 1);
    const row = randomSelectionByCount.get(count);

    if (!row) {
      alert(t("alert.randomSelectionUnavailable"));
      return;
    }

    setForm((p) => {
      const ing = [...p.ingredients];
      if (!ing[rowIndex]) return p;

      ing[rowIndex] = {
        ...ing[rowIndex],
        id: row.id,
        name: row.name,
        canonicalKey: row.canonicalKey || null,
        displayName: getIngredientDisplayName(row),
      };

      return { ...p, ingredients: ing };
    });
    setRandomSelectionModal(null);
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

  const toggleTargetStore = (nextStoreId) => {
    const normalizedId = String(nextStoreId);

    setTargetStoreIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!partnerId) {
      alert(t("alert.missingPartner"));
      return;
    }

    if (!storeId) {
      alert(t("alert.missingStore"));
      return;
    }

    if (!form.categoryId) {
      alert(t("alert.missingCategory"));
      return;
    }

    if (form.launchAt && form.availableUntil) {
      const launchDate = new Date(form.launchAt);
      const endDate = new Date(form.availableUntil);

      if (
        !Number.isNaN(launchDate.getTime()) &&
        !Number.isNaN(endDate.getTime()) &&
        endDate <= launchDate
      ) {
        alert(t("alert.invalidDate"));
        return;
      }
    }

    if (inventoryLoadError) {
      alert(t("alert.inventoryLoadError"));
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
      alert(t("alert.emptyRecipeProtection"));
      return;
    }

    const buildPayload = ({ includeImage = true } = {}) => {
      const payload = new FormData();
      payload.append("name", form.name.trim());
      payload.append("partnerId", String(partnerId));
      payload.append("categoryId", String(Number(form.categoryId)));
      if (storeId) {
        payload.append("storeId", String(storeId));
      }
      if (!editingPizzaId) {
        payload.append(
          "storeIds",
          JSON.stringify(
            targetStoreIds
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          )
        );
      }
      payload.append("sizes", JSON.stringify(form.sizes));
      payload.append("priceBySize", JSON.stringify(form.priceBySize));
      payload.append("ingredients", JSON.stringify(ingredientsPayload));
      payload.append("launchAt", form.launchAt || "");
      payload.append("availableUntil", form.availableUntil || "");
      payload.append("productTags", JSON.stringify(form.productTags || []));
      payload.append("cookingMethod", "");
      if (includeImage && form.imageFile) {
        payload.append("image", form.imageFile);
      }
      return payload;
    };

    const savePayload = async (payload) => {
      if (editingPizzaId) {
        await api.put(`/api/pizzas/${editingPizzaId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return t("alert.updated");
      }

      await api.post("/api/pizzas", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return t("alert.created");
    };

    const finishSuccessfulSave = (message) => {
      alert(message);
      setEditingPizzaId(null);
      setExistingImage(null);
      setOriginalIngredientIds([]);
      setForm(createInitialForm());
      setTargetStoreIds(storeId ? [String(storeId)] : []);
      fetchPizzas();
    };

    try {
      setSavingProduct(true);

      const successMessage = await savePayload(buildPayload());
      finishSuccessfulSave(successMessage);
    } catch (err) {
      console.error(err);
      const backendError = err.response?.data?.error || "";
      const backendCode = String(err.response?.data?.code || "").toLowerCase();
      const databaseUnavailable =
        backendCode === "database_unavailable" ||
        backendError.includes("Can't reach database server");
      const imageUploadUnavailable =
        backendCode === "image_upload_not_configured" ||
        backendError === "Cloudinary not configured";

      if (
        imageUploadUnavailable &&
        form.imageFile &&
        window.confirm(
          "No se pudo subir la imagen porque Cloudinary no esta configurado. Quieres guardar el producto sin imagen?"
        )
      ) {
        try {
          const retryMessage = await savePayload(buildPayload({ includeImage: false }));
          finishSuccessfulSave(`${retryMessage} sin imagen`);
          return;
        } catch (retryErr) {
          console.error(retryErr);
          alert(retryErr.response?.data?.error || "Error al guardar sin imagen");
          return;
        }
      }

      alert(
        databaseUnavailable
          ? "No se pudo conectar con la base de datos. Revisa que el servidor de Railway/MySQL este activo e intenta de nuevo."
          : imageUploadUnavailable
          ? "No se pudo subir la imagen. Revisa la configuracion de Cloudinary o guarda el producto sin imagen."
          : backendError || "Error al guardar"
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const deletePizza = async (id) => {
    if (!window.confirm(t("alert.deleteConfirm"))) return;

    try {
      await api.delete(`/api/pizzas/${id}`);
      setPizzas((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert(t("alert.deleteError"));
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

  const randomSelectionByCount = useMemo(() => {
    const rows = new Map();

    inventory.forEach((item) => {
      const count = getRandomSelectionCount(item);
      if (count) rows.set(count, item);
    });

    return rows;
  }, [inventory]);

  const randomSelectionOption = useMemo(() => {
    const ready = [1, 2, 3].every((count) => randomSelectionByCount.has(count));

    return ready
      ? {
          id: RANDOM_SELECTION_OPTION_ID,
          name: "Random selection",
          displayName: "★ Random selection",
          isRandomSelectionVirtual: true,
        }
      : null;
  }, [randomSelectionByCount]);

  const sortedInventory = useMemo(
    () =>
      [...inventory]
        .filter((item) => !isRandomSelectionIngredient(item))
        .sort(compareIngredientOptions(activeLocale)),
    [activeLocale, inventory]
  );

  const ingredientOptions = useMemo(() => {
    const missingSelected = form.ingredients
      .map((row) => ({
        id: Number(row.id),
        displayName: row.displayName || row.name || `#${row.id}`,
        name: row.name || `Ingrediente #${row.id}`,
      }))
      .filter(
        (row) =>
          Number.isInteger(row.id) &&
          row.id > 0 &&
          !isRandomSelectionIngredient(row) &&
          !inventoryById.has(row.id)
      );

    const visibleOptions = randomSelectionOption
      ? [randomSelectionOption, ...sortedInventory, ...missingSelected]
      : [...sortedInventory, ...missingSelected];

    return visibleOptions.sort(
      compareIngredientOptions(activeLocale)
    );
  }, [
    activeLocale,
    form.ingredients,
    inventoryById,
    randomSelectionOption,
    sortedInventory,
  ]);

  const selectedIngredientIds = useMemo(
    () =>
      new Set(
        form.ingredients
          .map((row) => Number(row.id))
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    [form.ingredients]
  );
  const allStoreIds = useMemo(
    () => stores.map((store) => String(store.id)),
    [stores]
  );
  const allStoresSelected =
    allStoreIds.length > 0 &&
    allStoreIds.every((id) => targetStoreIds.includes(id));

  return (
    <>
      <div className="pc-layout">
        <h2 className="pc-title-creator">
          {editingPizzaId ? t("title.edit") : t("title.create")}
        </h2>

        <form className="pizza-form" onSubmit={onSubmit}>
          <div className="pc-grid">
            <section className="pc-section">
              <div className="pc-sectionTitle">{t("section.productData")}</div>

              <label>
                {t("field.name")}
                <input name="name" value={form.name} onChange={onChange} required />
              </label>

              <label>
                {t("field.category")}
                <select
                  name="categoryId"
                  value={form.categoryId}
                  onChange={onCategoryChange}
                  required
                >
                  <option value="">{t("field.choose")}</option>
                  {selectableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="pc-dateGrid">
                <label>
                  {t("field.launchAt")}
                  <input
                    type="datetime-local"
                    name="launchAt"
                    value={form.launchAt}
                    onChange={onChange}
                  />
                </label>

                <label>
                  {t("field.availableUntil")}
                  <input
                    type="datetime-local"
                    name="availableUntil"
                    value={form.availableUntil}
                    onChange={onChange}
                  />
                </label>
              </div>

              <div className="pc-block">
                <div className="pc-subsectionTitle">{t("section.specialNotices")}</div>
                <div className="pc-tagGrid">
                  {PRODUCT_TAG_OPTIONS.map((tag) => {
                    const checked = (form.productTags || []).includes(tag.value);

                    return (
                      <label
                        key={tag.value}
                        className={`pc-tagOption ${checked ? "is-active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProductTag(tag.value)}
                        />
                        <span>{t(tag.labelKey)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {!editingPizzaId && (
                <div className="pc-block pc-storeScope">
                  <div className="pc-sectionTitle">{t("section.initialAvailability")}</div>

                  <div className="pc-storeScopeActions">
                    <button
                      type="button"
                      onClick={() => setTargetStoreIds(allStoreIds)}
                      disabled={!allStoreIds.length || allStoresSelected}
                    >
                      {t("action.all")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetStoreIds([])}
                      disabled={!targetStoreIds.length}
                    >
                      {t("action.none")}
                    </button>
                  </div>

                  <div className="pc-storeScopeList">
                    {loadingStores && (
                      <div className="pc-hint">{t("state.loadingStores")}</div>
                    )}
                    {!loadingStores &&
                      stores.map((store) => {
                        const checked = targetStoreIds.includes(String(store.id));
                        return (
                          <label
                            key={store.id}
                            className={`pc-storeScopeOption ${checked ? "is-active" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTargetStore(store.id)}
                            />
                            <span>{store.storeName || store.name}</span>
                          </label>
                        );
                      })}
                    {!loadingStores && !stores.length && (
                      <div className="pc-hint">{t("state.noStores")}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="pc-block">
                <div className="pc-sectionTitle">{t("section.sizesPrices")}</div>

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
              <h3 className="pc-subtitle">{t("section.buildPizza")}</h3>

              {!selectedSizes.length && (
                <div className="pc-hint">
                  {t("hint.selectSize")}
                </div>
              )}

              <div className="pc-hint">
                {t("hint.activeIngredients")}
              </div>
              <div className="pc-hint pc-hint--random">
                {t("hint.randomSelection")}
              </div>
              {loadingInventory && (
                <div className="pc-hint">{t("state.loadingIngredients")}</div>
              )}
              {inventoryLoadError && (
                <div className="pc-hint pc-hint--error">
                  {inventoryLoadError} {t("hint.reloadBeforeSave")}
                </div>
              )}

              <fieldset className="ingredients-fieldset">
                <div className="pc-ingredientsList" ref={ingredientsListRef}>
                  {form.ingredients.map((row, i) => {
                    const currentIngredientId = Number(row.id);
                    const ingredientMeta = inventoryById.get(currentIngredientId);
                    const isRandomSelection =
                      isRandomSelectionIngredient(ingredientMeta) ||
                      isRandomSelectionIngredient(row);
                    const randomSelectionCount =
                      getRandomSelectionCount(ingredientMeta) ||
                      getRandomSelectionCount(row);
                    const allergenSummary = getAllergenSummary(
                      ingredientMeta?.allergens
                    );
                    const hasAllergens =
                      Array.isArray(ingredientMeta?.allergens) &&
                      ingredientMeta.allergens.length > 0;
                    const rowIngredientOptions = ingredientOptions.filter(
                      (item) => {
                        if (item.id === RANDOM_SELECTION_OPTION_ID) {
                          const hasRandomSelectionElsewhere = form.ingredients.some(
                            (ingredient, idx) =>
                              idx !== i && isRandomSelectionIngredient(ingredient)
                          );

                          return isRandomSelection || !hasRandomSelectionElsewhere;
                        }

                        return (
                          item.id === currentIngredientId ||
                          !selectedIngredientIds.has(item.id)
                        );
                      }
                    );

                    return (
                    <div
                      key={i}
                      className={`ing-row ${
                        isRandomSelection ? "ing-row--randomSelection" : ""
                      }`}
                    >
                      <div className="pc-ingredientCell">
                        <div className="pc-ingredientPicker">
                          <select
                            value={
                              isRandomSelection
                                ? RANDOM_SELECTION_OPTION_ID
                                : row.id
                            }
                            onChange={(e) => onIngredientSelect(i, e.target.value)}
                          >
                            <option value="">{t("field.ingredient")}</option>
                            {rowIngredientOptions.map((item) => (
                              <option key={item.id} value={item.id}>
                                {getIngredientDisplayName(item)}
                              </option>
                              ))}
                          </select>
                          {isRandomSelection && (
                            <button
                              type="button"
                              className="pc-randomSelectionBadge"
                              onClick={() =>
                                setRandomSelectionModal({
                                  rowIndex: i,
                                  count: String(randomSelectionCount || 1),
                                })
                              }
                            >
                              {randomSelectionCount || 1} random
                            </button>
                          )}

                        </div>
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
                              : t("allergen.none")
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
                </div>

                <div className="pc-addIngredientBar">
                  <button type="button" onClick={addIngredient}>
                    {t("action.addIngredient")}
                  </button>
                </div>
              </fieldset>
            </section>

            <section className="pc-section">
              {existingImage && !form.imageFile && (
                <div className="pc-imagePreview">
                  <div className="pc-imageLabel">{t("image.current")}</div>
                  <img src={existingImage} alt={t("image.current")} className="pc-imageThumb" />
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
                    ? t("image.change")
                    : t("image.add")}
                </span>
              </label>

              <div className="pc-note">
                {t("image.note")}
              </div>

              {form.imageFile && (
                <div className="pc-fileMeta">
                  {t("image.selected", { name: form.imageFile.name })}
                </div>
              )}
            </section>

            <button className="save-btn" type="submit" disabled={savingProduct}>
              {savingProduct ? t("action.saving") : t("action.saveProduct")}
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
                {t("action.cancelEdit")}
              </button>
            )}
          </div>
        </form>

        <aside className="pc-right">
          <div className="pc-right__title">{t("side.categories")}</div>
          <div className="pc-right__hint">
            {t("side.hint")}
          </div>

          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={onCategoryDragEnd}
          >
            <SortableContext
              items={productCategoryOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="pc-catsGrid">
                {productCategoryOrder.map((id) => {
                  const c = categoryById.get(id);
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

                          <div className="pc-catCount">
                            {t("side.productCount", { count })}
                          </div>
                        </button>
                      )}
                    </SortableCategory>
                  );
                })}

                {!loadingCategories &&
                  !loadingPizzas &&
                  productCategoryOrder.length === 0 && (
                    <div className="pc-emptyState">
                      {t("state.noProductsYet")}
                    </div>
                  )}
              </div>
            </SortableContext>
          </DndContext>

          {(loadingCategories || loadingPizzas) && (
            <div className="pc-sideInfo">{t("state.loadingData")}</div>
          )}
        </aside>
      </div>

      <Modal
        open={!!randomSelectionModal}
        title={t("modal.randomTitle")}
        onClose={() => setRandomSelectionModal(null)}
        panelClassName="pc-modal__panel--small"
      >
        <div className="pc-randomSelectionModal">
          <label>
            {t("field.randomSelectionCount")}
            <select
              value={randomSelectionModal?.count || "1"}
              onChange={(event) =>
                setRandomSelectionModal((current) =>
                  current
                    ? { ...current, count: event.target.value }
                    : current
                )
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>

          <div className="pc-randomSelectionActions">
            <button
              type="button"
              className="pc-cancelBtn"
              onClick={() => setRandomSelectionModal(null)}
            >
              {t("action.cancel")}
            </button>
            <button
              type="button"
              className="save-btn"
              onClick={confirmRandomSelection}
            >
              {t("action.apply")}
            </button>
          </div>
        </div>
      </Modal>

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
                          <span {...listeners} className="pc-modalDrag" title={t("modal.drag")}>
                            |||
                          </span>

                          <div className="pc-modalThumb" aria-hidden={!p.image}>
                            {p.image ? (
                              <img src={p.image} alt={p.name || t("modal.productAlt")} />
                            ) : (
                              <span>{String(p.name || "?").trim().slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>

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

                              {Array.isArray(p.productTags) &&
                                p.productTags.map((tag) => {
                                  const option = PRODUCT_TAG_OPTIONS.find(
                                    (item) => item.value === tag
                                  );

                                  return (
                                    <span key={tag} className="pc-productTagBadge">
                                      {option?.labelKey ? t(option.labelKey) : tag}
                                    </span>
                                  );
                                })}

                              {p.ingredients?.map((ing) => {
                                const visibleIngredient =
                                  getIngredientDisplayName(inventoryById.get(Number(ing.id))) ||
                                  ing.displayName ||
                                  ing.name ||
                                  `#${ing.id}`;

                                return (
                                  <span
                                    key={ing.id}
                                    title={visibleIngredient}
                                    className={`pc-ingredientBadge ${
                                      ing.status === "INACTIVE" ? "inactive" : ""
                                    } ${
                                      isRandomSelectionIngredient(ing)
                                        ? "pc-ingredientBadge--random"
                                        : ""
                                    }`}
                                  >
                                    {visibleIngredient}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div className="pc-modalActions">
                            <button type="button" onClick={() => loadPizzaForEdit(p)}>
                              {t("modal.edit")}
                            </button>

                            <button type="button" onClick={() => deletePizza(p.id)}>
                              {t("modal.delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </SortablePizza>
                  );
                })}

                {openCat && (pizzaOrderByCat[openCat]?.length ?? 0) === 0 && (
                  <div className="pc-emptyState">
                    {t("modal.noCategoryProducts")}
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
