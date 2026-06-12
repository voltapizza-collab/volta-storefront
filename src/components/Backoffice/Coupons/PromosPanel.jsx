import { useCallback, useEffect, useId, useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";

const WEEK_DAYS = [
  { value: "lunes", label: "Lun", number: 1 },
  { value: "martes", label: "Mar", number: 2 },
  { value: "miercoles", label: "Mie", number: 3 },
  { value: "jueves", label: "Jue", number: 4 },
  { value: "viernes", label: "Vie", number: 5 },
  { value: "sabado", label: "Sab", number: 6 },
  { value: "domingo", label: "Dom", number: 0 },
];

const QUANTITY_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

const initialForm = {
  title: "",
  description: "",
  totalPrice: "",
  activeFrom: "",
  expiresAt: "",
  isTemporal: false,
  daysActive: [],
  windowStart: "",
  windowEnd: "",
  imageFile: null,
  items: [],
};

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const formatPrice = (value) => `EUR ${Number(value || 0).toFixed(2)}`;

const timeToMinutes = (value) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return String(hours * 60 + minutes);
};

const minutesToTime = (value) => {
  if (value == null || value === "") return "";
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return "";
  const hoursPart = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minutesPart = String(minutes % 60).padStart(2, "0");
  return `${hoursPart}:${minutesPart}`;
};

const hasActivePrice = (value) =>
  value !== "" && value != null && Number.isFinite(Number(value));

const getPizzaSizes = (pizza) => {
  const selectSize = Array.isArray(pizza?.selectSize)
    ? pizza.selectSize.map((size) => String(size || "").trim()).filter(Boolean)
    : [];
  const priceBySize = pizza?.priceBySize || {};
  const pricedSelectedSizes = selectSize.filter((size) => hasActivePrice(priceBySize[size]));
  const pricedSizes = Object.entries(priceBySize)
    .filter(([, value]) => hasActivePrice(value))
    .map(([size]) => size);

  return [...new Set(pricedSelectedSizes.length ? pricedSelectedSizes : pricedSizes)];
};

const getItemSizes = (item) => {
  const sizes = Array.isArray(item?.sizeOptions) ? item.sizeOptions : [];
  const priceBySize = item?.priceBySize || {};
  const activeSizes = sizes.filter((size) => !Object.keys(priceBySize).length || hasActivePrice(priceBySize[size]));
  const pricedSizes = Object.entries(priceBySize)
    .filter(([, value]) => hasActivePrice(value))
    .map(([size]) => size);
  const candidates = activeSizes.length ? activeSizes : pricedSizes;

  return [...new Set((candidates.length ? candidates : [item?.size]).filter(Boolean))];
};

const getSizePrice = (item, size = item?.size) => {
  const rawPrice = item?.priceBySize?.[size];
  const price = Number(rawPrice);
  return Number.isFinite(price) ? price : null;
};

const isChoiceItem = (item) => {
  const type = String(item?.type || "").toUpperCase();
  return type === "CHOICE" || type === "CATEGORY";
};

const getChoiceOptionIds = (item) =>
  Array.isArray(item?.optionProductIds)
    ? item.optionProductIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];

const getPromoItemKey = (item) => {
  if (isChoiceItem(item)) {
    const optionIds = getChoiceOptionIds(item);
    const scope = optionIds.length
      ? `products-${optionIds.join("-")}`
      : `category-${item.categoryId || item.categoryName || item.category || item.name}`;
    return `choice-${scope}`;
  }

  return `product-${item?.pizzaId}`;
};

const getCategorySizes = (rows = []) => [
  ...new Set(rows.flatMap((pizza) => getPizzaSizes(pizza))),
];

const getLowestCategoryPrices = (rows = []) => {
  const result = {};

  rows.forEach((pizza) => {
    getPizzaSizes(pizza).forEach((size) => {
      const price = getSizePrice({ priceBySize: pizza.priceBySize || {} }, size);
      if (price == null) return;
      if (result[size] == null || price < result[size]) result[size] = price;
    });
  });

  return result;
};

const isPubliclyLaunched = (pizza) => {
  if (pizza?.status && pizza.status !== "ACTIVE") return false;
  if (pizza?.type && pizza.type !== "SELLABLE") return false;
  const now = new Date();

  if (pizza?.availableUntil) {
    const endDate = new Date(pizza.availableUntil);
    if (!Number.isNaN(endDate.getTime()) && endDate <= now) return false;
  }

  if (!pizza?.launchAt) return true;

  const launchDate = new Date(pizza.launchAt);
  return Number.isNaN(launchDate.getTime()) || launchDate <= now;
};

export default function PromosPanel({ partnerId }) {
  const fileInputId = useId();
  const [pizzas, setPizzas] = useState([]);
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [existingImage, setExistingImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [choiceDrafts, setChoiceDrafts] = useState({});
  const [openCategoryKey, setOpenCategoryKey] = useState("");

  const loadAll = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      const [pizzaResult, promoResult] = await Promise.allSettled([
        api.get(`/api/pizzas?partnerId=${partnerId}`),
        api.get(`/api/promos?partnerId=${partnerId}`),
      ]);

      if (pizzaResult.status === "fulfilled") {
        const rows = pizzaResult.value.data;
        setPizzas(Array.isArray(rows) ? rows : rows?.pizzas || []);
      } else {
        console.error(pizzaResult.reason);
        setPizzas([]);
        setMessage("No se pudieron cargar los productos.");
      }

      if (promoResult.status === "fulfilled") {
        setPromos(Array.isArray(promoResult.value.data?.promos) ? promoResult.value.data.promos : []);
      } else {
        console.error(promoResult.reason);
        setPromos([]);
        setMessage("No se pudieron cargar las promos.");
      }
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pizzaById = useMemo(() => {
    const map = new Map();
    pizzas.forEach((pizza) => map.set(pizza.id, pizza));
    return map;
  }, [pizzas]);

  const pizzasByCategory = useMemo(() => {
    const map = new Map();

    pizzas.filter(isPubliclyLaunched).forEach((pizza) => {
      const category = pizza.categoryName || pizza.category || "Sin categoria";
      const categoryId = Number(pizza.categoryId);
      const key = Number.isInteger(categoryId) && categoryId > 0
        ? `id:${categoryId}`
        : `name:${category}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
          category,
          rows: [],
        });
      }
      map.get(key).rows.push(pizza);
    });

    return [...map.values()].map((group) => ({
      ...group,
      sizeOptions: getCategorySizes(group.rows),
      priceBySize: getLowestCategoryPrices(group.rows),
      rows: group.rows
        .slice()
        .sort((left, right) =>
          String(left.name || "").localeCompare(String(right.name || ""), "es", {
            sensitivity: "base",
          })
        ),
    }));
  }, [pizzas]);

  useEffect(() => {
    setOpenCategoryKey((current) => current || pizzasByCategory[0]?.key || "");
  }, [pizzasByCategory]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setExistingImage("");
    setChoiceDrafts({});
    setOpenCategoryKey(pizzasByCategory[0]?.key || "");
  };

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      daysActive: prev.daysActive.includes(day)
        ? prev.daysActive.filter((item) => item !== day)
        : [...prev.daysActive, day],
    }));
  };

  const buildPromoItem = (pizza) => {
    const sizeOptions = getPizzaSizes(pizza);
    const defaultSize = sizeOptions[0] || "";

    return {
      type: "PRODUCT",
      pizzaId: pizza.id,
      name: pizza.name,
      categoryId: pizza.categoryId || null,
      category: pizza.categoryName || pizza.category || "Sin categoria",
      quantity: 1,
      size: defaultSize,
      sizeOptions,
      priceBySize: pizza.priceBySize || {},
      unitPrice: getSizePrice({ priceBySize: pizza.priceBySize }, defaultSize),
    };
  };

  const getChoiceDraft = (group) =>
    choiceDrafts[group.key] || {
      source: "CATEGORY",
      quantity: 1,
      productIds: [],
    };

  const updateChoiceDraft = (groupKey, patch) => {
    setChoiceDrafts((prev) => ({
      ...prev,
      [groupKey]: {
        source: "CATEGORY",
        quantity: 1,
        productIds: [],
        ...(prev[groupKey] || {}),
        ...patch,
      },
    }));
  };

  const toggleChoiceDraftProduct = (groupKey, pizzaId) => {
    setChoiceDrafts((prev) => {
      const draft = {
        source: "PRODUCTS",
        quantity: 1,
        productIds: [],
        ...(prev[groupKey] || {}),
      };
      const currentIds = draft.productIds.map((id) => Number(id));
      const exists = currentIds.includes(Number(pizzaId));

      return {
        ...prev,
        [groupKey]: {
          ...draft,
          source: "PRODUCTS",
          productIds: exists
            ? currentIds.filter((id) => id !== Number(pizzaId))
            : [...currentIds, Number(pizzaId)],
        },
      };
    });
  };

  const buildChoicePromoItem = (group, draft = getChoiceDraft(group)) => {
    const defaultSize = group.sizeOptions[0] || "";
    const source = draft.source === "PRODUCTS" ? "PRODUCTS" : "CATEGORY";
    const optionProductIds =
      source === "PRODUCTS"
        ? draft.productIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];
    const selectedNames = optionProductIds
      .map((id) => pizzaById.get(id)?.name)
      .filter(Boolean);
    const label =
      source === "PRODUCTS" && selectedNames.length
        ? selectedNames.join(" / ")
        : group.category;

    return {
      type: "CHOICE",
      choiceType: source,
      categoryId: group.categoryId || null,
      categoryName: group.category,
      name: label,
      category: group.category,
      quantity: Math.max(1, Number(draft.quantity || 1)),
      optionProductIds,
      size: defaultSize,
      sizeOptions: group.sizeOptions,
      priceBySize: group.priceBySize || {},
    };
  };

  const addChoiceItem = (group) => {
    const draft = getChoiceDraft(group);
    const choiceItem = buildChoicePromoItem(group, draft);
    const itemKey = getPromoItemKey(choiceItem);

    if (choiceItem.choiceType === "PRODUCTS" && !choiceItem.optionProductIds.length) {
      setMessage("Marca al menos un producto para esa eleccion.");
      return;
    }

    if (choiceItem.choiceType === "PRODUCTS" && choiceItem.quantity > choiceItem.optionProductIds.length) {
      setMessage("La cantidad a elegir no puede superar los productos marcados.");
      return;
    }

    setMessage("");
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items.filter((item) => getPromoItemKey(item) !== itemKey),
        choiceItem,
      ],
    }));
    setOpenCategoryKey("");
  };

  const addItem = (pizza) => {
    setForm((prev) => {
      const existing = prev.items.find((item) => item.pizzaId === pizza.id);

      if (existing) {
        return {
          ...prev,
          items: prev.items.filter((item) => item.pizzaId !== pizza.id),
        };
      }

      return {
        ...prev,
        items: [...prev.items, buildPromoItem(pizza)],
      };
    });
  };

  const isItemSelected = (pizzaId) => form.items.some((item) => item.pizzaId === pizzaId);

  const updateItem = (itemKey, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        getPromoItemKey(item) === itemKey
          ? {
              ...item,
              [key]: value,
              ...(key === "size" ? { unitPrice: getSizePrice(item, value) } : {}),
            }
          : item
      ),
    }));
  };

  const removeItem = (itemKey) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => getPromoItemKey(item) !== itemKey),
    }));
  };

  const editPromo = (promo) => {
    const daysActive = Array.isArray(promo.daysActive)
      ? promo.daysActive
          .map((day) => WEEK_DAYS.find((item) => item.number === Number(day))?.value)
          .filter(Boolean)
      : [];
    const windowStart = minutesToTime(promo.windowStart);
    const windowEnd = minutesToTime(promo.windowEnd);

    setEditingId(promo.id);
    setExistingImage(promo.image || "");
    setForm({
      title: promo.title || "",
      description: promo.description || "",
      totalPrice: promo.totalPrice || "",
      activeFrom: toDateTimeLocalValue(promo.activeFrom),
      expiresAt: toDateTimeLocalValue(promo.expiresAt),
      isTemporal: !!daysActive.length || !!windowStart || !!windowEnd,
      daysActive,
      windowStart,
      windowEnd,
      imageFile: null,
      items: Array.isArray(promo.items)
        ? promo.items.map((item) => normalizePromoItem(item))
        : [],
    });
  };

  const deletePromo = async (promoId) => {
    if (!window.confirm("Eliminar promo?")) return;

    try {
      await api.delete(`/api/promos/${promoId}?partnerId=${partnerId}`);
      resetForm();
      loadAll();
    } catch (error) {
      console.error(error);
      setMessage("No se pudo eliminar la promo.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    if (!form.items.length) {
      setMessage("Agrega al menos un producto a la bolsa.");
      setSaving(false);
      return;
    }

    const normalizedItems = form.items.map((item) => normalizePromoItem(item));
    const payload = new FormData();
    payload.append("partnerId", String(partnerId));
    payload.append("title", form.title.trim());
    payload.append("description", form.description.trim());
    payload.append("totalPrice", String(Number(form.totalPrice || 0)));
    payload.append("activeFrom", form.activeFrom || "");
    payload.append("expiresAt", form.expiresAt || "");
    payload.append("daysActive", JSON.stringify(form.isTemporal ? form.daysActive : []));
    payload.append("windowStart", form.isTemporal ? timeToMinutes(form.windowStart) : "");
    payload.append("windowEnd", form.isTemporal ? timeToMinutes(form.windowEnd) : "");
    payload.append("items", JSON.stringify(normalizedItems));
    if (form.imageFile) payload.append("image", form.imageFile);

    try {
      if (editingId) {
        await api.put(`/api/promos/${editingId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Promo actualizada.");
      } else {
        await api.post("/api/promos", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Promo creada.");
      }

      resetForm();
      loadAll();
    } catch (error) {
      console.error(error);
      setMessage("No se pudo guardar la promo.");
    } finally {
      setSaving(false);
    }
  };

  const selectedFileName = form.imageFile?.name || (existingImage ? "Imagen actual" : "Sin archivo");
  const selectedProductCount = form.items.filter((item) => !isChoiceItem(item)).length;
  const selectedChoiceCount = form.items.filter(isChoiceItem).length;

  const normalizePromoItem = (item) => {
    if (isChoiceItem(item)) {
      const optionProductIds = getChoiceOptionIds(item);
      const matchingGroup = pizzasByCategory.find(
        (group) =>
          (group.categoryId && Number(group.categoryId) === Number(item.categoryId)) ||
          String(group.category) === String(item.categoryName || item.category || item.name)
      );
      const sizeOptions = matchingGroup?.sizeOptions?.length
        ? matchingGroup.sizeOptions
        : getItemSizes(item);
      const priceBySize = matchingGroup?.priceBySize || item.priceBySize || {};
      const size = sizeOptions.includes(item.size) ? item.size : sizeOptions[0] || "";
      const categoryName = matchingGroup?.category || item.categoryName || item.category || item.name || "Categoria";
      const optionNames = optionProductIds
        .map((id) => pizzaById.get(id)?.name)
        .filter(Boolean);
      const choiceType = optionProductIds.length ? "PRODUCTS" : item.choiceType || "CATEGORY";

      return {
        ...item,
        type: "CHOICE",
        choiceType,
        categoryId: matchingGroup?.categoryId || item.categoryId || null,
        categoryName,
        name: choiceType === "PRODUCTS" && optionNames.length ? optionNames.join(" / ") : categoryName,
        category: categoryName,
        optionProductIds,
        quantity: Math.max(1, Number(item.quantity || 1)),
        size,
        sizeOptions,
        priceBySize,
        unitPrice: getSizePrice({ priceBySize }, size),
      };
    }

    const pizza = pizzaById.get(item.pizzaId);
    const priceBySize = pizza?.priceBySize || item.priceBySize || {};
    const sizeOptions = pizza ? getPizzaSizes(pizza) : getItemSizes(item);
    const size = sizeOptions.includes(item.size) ? item.size : sizeOptions[0] || "";

    return {
      ...item,
      type: "PRODUCT",
      name: pizza?.name || item.name,
      categoryId: pizza?.categoryId || item.categoryId || null,
      category: pizza?.categoryName || pizza?.category || item.category || "Sin categoria",
      size,
      sizeOptions,
      priceBySize,
      unitPrice: getSizePrice({ priceBySize }, size),
    };
  };

  return (
    <div className="cp-promosLayout">
      <form className="cp-card cp-form cp-promoBuilder" onSubmit={submit}>
        <div>
          <div className="cp-kicker">Promos</div>
          <h3>{editingId ? "Editar promo" : "Crear promo"}</h3>
        </div>

        <div className="cp-formGrid">
          <label className="cp-field">
            <span>Nombre</span>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              required
            />
          </label>

          <label className="cp-field">
            <span>Precio global</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.totalPrice}
              onChange={(event) => updateForm("totalPrice", event.target.value)}
              required
            />
          </label>

          <label className="cp-field">
            <span>Valido desde</span>
            <input
              type="datetime-local"
              value={form.activeFrom}
              onChange={(event) => updateForm("activeFrom", event.target.value)}
            />
          </label>

          <label className="cp-field">
            <span>Valido hasta</span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => updateForm("expiresAt", event.target.value)}
            />
          </label>
        </div>

        <label className="cp-field">
          <span>Descripcion</span>
          <textarea
            rows="2"
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
          />
        </label>

        <label className="cp-checkRow">
          <input
            checked={form.isTemporal}
            onChange={(event) => updateForm("isTemporal", event.target.checked)}
            type="checkbox"
          />
          Limitar por dias y horas
        </label>

        {form.isTemporal && (
          <div className="cp-targetPanel">
            <div className="cp-pillRow">
              {WEEK_DAYS.map((day) => (
                <button
                  key={day.value}
                  className={`cp-pill ${form.daysActive.includes(day.value) ? "is-active" : ""}`}
                  onClick={() => toggleDay(day.value)}
                  type="button"
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="cp-formGrid">
              <label className="cp-field">
                <span>Inicio</span>
                <input
                  type="time"
                  value={form.windowStart}
                  onChange={(event) => updateForm("windowStart", event.target.value)}
                />
              </label>

              <label className="cp-field">
                <span>Fin</span>
                <input
                  type="time"
                  value={form.windowEnd}
                  onChange={(event) => updateForm("windowEnd", event.target.value)}
                />
              </label>
            </div>
          </div>
        )}

        <div className="cp-field">
          <span>Foto</span>
          <div className="cp-fileControl">
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              onChange={(event) =>
                updateForm("imageFile", event.target.files?.[0] || null)
              }
            />
            <label htmlFor={fileInputId}>Seleccionar foto</label>
            <span>{selectedFileName}</span>
          </div>
        </div>

        {existingImage && !form.imageFile && (
          <div className="cp-promoImageNote">Imagen actual cargada.</div>
        )}

        <div className="cp-promoPicker">
          <div>
            <div className="cp-kicker">Productos</div>
            <div className="cp-helper">
              {selectedProductCount + selectedChoiceCount} bloques:{" "}
              {selectedProductCount} producto{selectedProductCount === 1 ? "" : "s"} fijo
              {selectedProductCount === 1 ? "" : "s"} y {selectedChoiceCount} eleccion
              {selectedChoiceCount === 1 ? "" : "es"} del cliente.
            </div>
          </div>

          {pizzasByCategory.map((group, index) => {
            const draft = getChoiceDraft(group);
            const draftProductIds = draft.productIds.map((id) => Number(id));
            const draftOptionCount =
              draft.source === "PRODUCTS" ? draftProductIds.length : group.rows.length;
            const choicePreview =
              draft.source === "PRODUCTS"
                ? `${draftOptionCount} producto${draftOptionCount === 1 ? "" : "s"} marcado${draftOptionCount === 1 ? "" : "s"}`
                : `toda la categoria ${group.category}`;

            return (
              <details
                key={group.key}
                className="cp-directCategory"
                open={openCategoryKey === group.key}
                onToggle={(event) => {
                  if (event.currentTarget.open) {
                    setOpenCategoryKey(group.key);
                  } else if (openCategoryKey === group.key) {
                    setOpenCategoryKey("");
                  }
                }}
              >
                <summary className="cp-directCategorySummary">
                  <strong>{group.category}</strong>
                  <span>{group.rows.length} productos</span>
                </summary>

                <div className="cp-choiceBuilder">
                  <div>
                    <strong>Eleccion del cliente</strong>
                    <small>
                      El cliente elige {draft.quantity} de {choicePreview}.
                    </small>
                  </div>

                  <div className="cp-choiceControls">
                    <label>
                      Puede elegir
                      <select
                        value={draft.source}
                        onChange={(event) =>
                          updateChoiceDraft(group.key, {
                            source: event.target.value,
                            productIds: event.target.value === "CATEGORY" ? [] : draft.productIds,
                          })
                        }
                      >
                        <option value="CATEGORY">Toda la categoria</option>
                        <option value="PRODUCTS">Productos marcados</option>
                      </select>
                    </label>

                    <label>
                      Cantidad
                      <select
                        value={draft.quantity}
                        onChange={(event) =>
                          updateChoiceDraft(group.key, {
                            quantity: Number(event.target.value),
                          })
                        }
                      >
                        {QUANTITY_OPTIONS.map((quantity) => (
                          <option key={quantity} value={quantity}>
                            {quantity}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="cp-tabBtn"
                      onClick={() => addChoiceItem(group)}
                    >
                      Anadir eleccion
                    </button>
                  </div>

                  {draft.source === "PRODUCTS" && (
                    <div className="cp-choiceOptionList">
                      {group.rows.map((pizza) => {
                        const checked = draftProductIds.includes(Number(pizza.id));

                        return (
                          <label
                            key={`choice-${pizza.id}`}
                            className={`cp-choiceOption ${checked ? "is-selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleChoiceDraftProduct(group.key, pizza.id)}
                            />
                            <span>{pizza.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="cp-directProductList">
                  <div className="cp-directProductListHead">Productos fijos</div>
                  {group.rows.map((pizza) => {
                    const selected = isItemSelected(pizza.id);

                    return (
                      <label
                        key={pizza.id}
                        className={`cp-directProductRow ${selected ? "is-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => addItem(pizza)}
                        />
                        <span>{pizza.name}</span>
                        {selected && <em>Fijo</em>}
                      </label>
                    );
                  })}
                </div>
              </details>
            );
          })}

          {!pizzasByCategory.length && (
            <div className="cp-empty">No hay productos cargados para este partner.</div>
          )}
        </div>

        <div className="cp-promoBag">
          <div className="cp-promoBagHead">
            <strong>Bolsa</strong>
            <span>{form.items.length} items</span>
          </div>

          {form.items.map((item) => {
            const normalizedItem = normalizePromoItem(item);
            const itemKey = getPromoItemKey(normalizedItem);
            const choiceItem = isChoiceItem(normalizedItem);
            const optionCount = getChoiceOptionIds(normalizedItem).length;

            return (
            <div key={itemKey} className="cp-promoBagRow">
              <div>
                <strong>
                  {choiceItem
                    ? `El cliente elige ${normalizedItem.quantity || 1}`
                    : normalizedItem.name}
                </strong>
                <span>
                  {choiceItem
                    ? optionCount
                      ? `${optionCount} opciones de ${normalizedItem.category}`
                      : `De ${normalizedItem.category}`
                    : normalizedItem.category}
                </span>
              </div>

              <label>
                {choiceItem ? "Elige" : "Cant."}
                <select
                  value={normalizedItem.quantity}
                  onChange={(event) =>
                    updateItem(itemKey, "quantity", Number(event.target.value))
                  }
                >
                  {QUANTITY_OPTIONS.map((quantity) => (
                    <option key={quantity} value={quantity}>
                      {quantity}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tam.
                <select
                  value={normalizedItem.size || ""}
                  onChange={(event) =>
                    updateItem(itemKey, "size", event.target.value)
                  }
                >
                  {getItemSizes(normalizedItem).map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                  {!getItemSizes(normalizedItem).length && <option value="">-</option>}
                </select>
              </label>

              <label>
                {choiceItem ? "Base" : "Precio"}
                <span className="cp-promoBagPrice">
                  {getSizePrice(normalizedItem) == null ? "-" : formatPrice(getSizePrice(normalizedItem))}
                </span>
              </label>

              <button
                type="button"
                className="cp-miniDanger"
                onClick={() => removeItem(itemKey)}
              >
                Quitar
              </button>
            </div>
            );
          })}

          {!form.items.length && (
            <div className="cp-empty">La bolsa esta vacia.</div>
          )}
        </div>

        <div className="cp-actions">
          {editingId && (
            <button type="button" className="cp-tabBtn" onClick={resetForm}>
              Cancelar edicion
            </button>
          )}
          <button className="cp-primaryBtn" disabled={saving} type="submit">
            {saving ? "Guardando..." : editingId ? "Actualizar promo" : "Crear promo"}
          </button>
        </div>

        {message && <div className="cp-feedback">{message}</div>}
      </form>

      <section className="cp-card">
        <div className="cp-kicker">Activas</div>
        <h3>Promos publicadas</h3>

        {loading ? (
          <div className="cp-stateCard">Cargando promos...</div>
        ) : (
          <div className="cp-tableWrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Promo name</th>
                  <th>Precio global</th>
                  <th>Fecha de lanzamiento</th>
                  <th>Vendidas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((promo) => (
                  <tr key={promo.id}>
                    <td>{promo.title}</td>
                    <td>{formatPrice(promo.totalPrice)}</td>
                    <td>
                      {promo.activeFrom ? toDateTimeLocalValue(promo.activeFrom) : "Ahora"}
                    </td>
                    <td>{promo.soldCount || 0}</td>
                    <td>
                      <div className="cp-rowActions">
                        <button type="button" onClick={() => editPromo(promo)}>
                          Editar
                        </button>
                        <button type="button" onClick={() => deletePromo(promo.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!promos.length && (
                  <tr>
                    <td colSpan="5">No hay promos todavia.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
