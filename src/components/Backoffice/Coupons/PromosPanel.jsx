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

const isPubliclyLaunched = (pizza) => {
  if (pizza?.status && pizza.status !== "ACTIVE") return false;
  if (pizza?.type && pizza.type !== "SELLABLE") return false;
  if (!pizza?.launchAt) return true;

  const launchDate = new Date(pizza.launchAt);
  return Number.isNaN(launchDate.getTime()) || launchDate <= new Date();
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
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(pizza);
    });

    return [...map.entries()].map(([category, rows]) => ({
      category,
      rows: rows
        .slice()
        .sort((left, right) =>
          String(left.name || "").localeCompare(String(right.name || ""), "es", {
            sensitivity: "base",
          })
        ),
    }));
  }, [pizzas]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setExistingImage("");
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
      pizzaId: pizza.id,
      name: pizza.name,
      category: pizza.categoryName || pizza.category || "Sin categoria",
      quantity: 1,
      size: defaultSize,
      sizeOptions,
      priceBySize: pizza.priceBySize || {},
      unitPrice: getSizePrice({ priceBySize: pizza.priceBySize }, defaultSize),
    };
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

  const isCategorySelected = (group) =>
    group.rows.length > 0 && group.rows.every((pizza) => isItemSelected(pizza.id));

  const toggleCategory = (group) => {
    setForm((prev) => {
      const categoryIds = new Set(group.rows.map((pizza) => pizza.id));
      const currentIds = new Set(prev.items.map((item) => item.pizzaId));
      const allSelected = group.rows.length > 0 && group.rows.every((pizza) => currentIds.has(pizza.id));

      if (allSelected) {
        return {
          ...prev,
          items: prev.items.filter((item) => !categoryIds.has(item.pizzaId)),
        };
      }

      const missingItems = group.rows
        .filter((pizza) => !currentIds.has(pizza.id))
        .map((pizza) => buildPromoItem(pizza));

      return {
        ...prev,
        items: [...prev.items, ...missingItems],
      };
    });
  };

  const updateItem = (pizzaId, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.pizzaId === pizzaId
          ? {
              ...item,
              [key]: value,
              ...(key === "size" ? { unitPrice: getSizePrice(item, value) } : {}),
            }
          : item
      ),
    }));
  };

  const removeItem = (pizzaId) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.pizzaId !== pizzaId),
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
  const selectedProductCount = form.items.length;
  const selectedCategoryCount = pizzasByCategory.filter(isCategorySelected).length;

  const normalizePromoItem = (item) => {
    const pizza = pizzaById.get(item.pizzaId);
    const priceBySize = pizza?.priceBySize || item.priceBySize || {};
    const sizeOptions = pizza ? getPizzaSizes(pizza) : getItemSizes(item);
    const size = sizeOptions.includes(item.size) ? item.size : sizeOptions[0] || "";

    return {
      ...item,
      name: pizza?.name || item.name,
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
              {selectedProductCount} seleccionados: {selectedCategoryCount} categoria
              {selectedCategoryCount === 1 ? "" : "s"} completa{selectedCategoryCount === 1 ? "" : "s"} y{" "}
              {selectedProductCount} producto{selectedProductCount === 1 ? "" : "s"} en bolsa.
            </div>
          </div>

          {pizzasByCategory.map((group, index) => (
            <details key={group.category} className="cp-directCategory" open={index === 0}>
              <summary className="cp-directCategorySummary">
                <strong>{group.category}</strong>
                <span>{group.rows.length} productos</span>
              </summary>

              <label className={`cp-directCategorySelect ${isCategorySelected(group) ? "is-selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={isCategorySelected(group)}
                  onChange={() => toggleCategory(group)}
                />
                <span>
                  <strong>Seleccionar categoria completa</strong>
                  <small>Todos los productos de {group.category} se agregan a la bolsa.</small>
                </span>
              </label>

              <div className="cp-directProductList">
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
                      {selected && <em>En bolsa</em>}
                    </label>
                  );
                })}
              </div>
            </details>
          ))}

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

            return (
            <div key={normalizedItem.pizzaId} className="cp-promoBagRow">
              <div>
                <strong>{normalizedItem.name}</strong>
                <span>{normalizedItem.category}</span>
              </div>

              <label>
                Cant.
                <select
                  value={normalizedItem.quantity}
                  onChange={(event) =>
                    updateItem(normalizedItem.pizzaId, "quantity", Number(event.target.value))
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
                    updateItem(normalizedItem.pizzaId, "size", event.target.value)
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
                Precio
                <span className="cp-promoBagPrice">
                  {getSizePrice(normalizedItem) == null ? "-" : formatPrice(getSizePrice(normalizedItem))}
                </span>
              </label>

              <button
                type="button"
                className="cp-miniDanger"
                onClick={() => removeItem(normalizedItem.pizzaId)}
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
