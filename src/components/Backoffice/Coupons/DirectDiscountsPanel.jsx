import { useCallback, useEffect, useMemo, useState } from "react";
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

const initialForm = {
  title: "",
  discountType: "PERCENT",
  value: "",
  targetType: "CATEGORY",
  productIds: [],
  categoryIds: [],
  categoryNames: [],
  storeIds: [],
  activeFrom: "",
  expiresAt: "",
  isTemporal: false,
  daysActive: [],
  windowStart: "",
  windowEnd: "",
  status: "ACTIVE",
};

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const timeToMinutes = (value) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return String(hours * 60 + minutes);
};

const minutesToTime = (value) => {
  if (value == null || value === "") return "";
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const formatDiscount = (discount) =>
  discount.discountType === "PERCENT"
    ? `${Number(discount.value || 0).toFixed(0)}%`
    : `EUR ${Number(discount.value || 0).toFixed(2)}`;

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

export default function DirectDiscountsPanel({ partnerId }) {
  const [pizzas, setPizzas] = useState([]);
  const [stores, setStores] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [storesTouched, setStoresTouched] = useState(false);

  const loadAll = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      const [pizzaResult, storeResult, discountResult] = await Promise.allSettled([
        api.get(`/api/pizzas?partnerId=${partnerId}`),
        api.get(`/stores?partnerId=${partnerId}`),
        api.get(`/api/direct-discounts?partnerId=${partnerId}`),
      ]);

      setPizzas(
        pizzaResult.status === "fulfilled"
          ? Array.isArray(pizzaResult.value.data)
            ? pizzaResult.value.data
            : pizzaResult.value.data?.pizzas || []
          : []
      );
      setStores(
        storeResult.status === "fulfilled" && Array.isArray(storeResult.value.data)
          ? storeResult.value.data
          : []
      );
      setDiscounts(
        discountResult.status === "fulfilled" && Array.isArray(discountResult.value.data?.discounts)
          ? discountResult.value.data.discounts
          : []
      );
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pizzasByCategory = useMemo(() => {
    const map = new Map();

    pizzas.filter(isPubliclyLaunched).forEach((pizza) => {
      const key = pizza.categoryId || pizza.category || "Sin categoria";
      const current = map.get(key) || {
        id: pizza.categoryId || null,
        name: pizza.categoryName || pizza.category || "Sin categoria",
        rows: [],
      };
      current.rows.push(pizza);
      map.set(key, current);
    });

    return [...map.values()].map((group) => ({
      ...group,
      rows: group.rows
        .slice()
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "es")),
    }));
  }, [pizzas]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleValue = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  const toggleCategory = (category) => {
    if (category.id) {
      toggleValue("categoryIds", category.id);
      return;
    }

    toggleValue("categoryNames", category.name);
  };

  const isCategorySelected = (category) =>
    (category.id && form.categoryIds.includes(category.id)) || form.categoryNames.includes(category.name);

  const allStoreIds = useMemo(() => stores.map((store) => store.id), [stores]);
  const allStoresSelected =
    allStoreIds.length > 0 &&
    allStoreIds.every((storeId) => form.storeIds.some((item) => String(item) === String(storeId)));

  const toggleStore = (storeId) => {
    setStoresTouched(true);
    setForm((current) => {
      const isSelected = current.storeIds.some((item) => String(item) === String(storeId));

      return {
        ...current,
        storeIds: isSelected
          ? current.storeIds.filter((item) => String(item) !== String(storeId))
          : [...current.storeIds, storeId],
      };
    });
  };

  const toggleAllStores = () => {
    setStoresTouched(true);
    setForm((current) => {
      const selectedIds = current.storeIds.map((item) => String(item));
      const hasEveryStore =
        allStoreIds.length > 0 && allStoreIds.every((storeId) => selectedIds.includes(String(storeId)));

      return {
        ...current,
        storeIds: hasEveryStore ? [] : allStoreIds,
      };
    });
  };

  useEffect(() => {
    if (!allStoreIds.length || editingId || storesTouched) return;

    setForm((current) => ({
      ...current,
      storeIds: current.storeIds.length ? current.storeIds : allStoreIds,
    }));
  }, [allStoreIds, editingId, storesTouched]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setStoresTouched(false);
  };

  const editDiscount = (discount) => {
    const daysActive = Array.isArray(discount.daysActive)
      ? discount.daysActive
          .map((day) => WEEK_DAYS.find((item) => item.number === Number(day))?.value)
          .filter(Boolean)
      : [];
    const windowStart = minutesToTime(discount.windowStart);
    const windowEnd = minutesToTime(discount.windowEnd);

    setEditingId(discount.id);
    setStoresTouched(true);
    setForm({
      title: discount.title || "",
      discountType: discount.discountType || "PERCENT",
      value: discount.value || "",
      targetType: discount.targetType || "CATEGORY",
      productIds: Array.isArray(discount.productIds) ? discount.productIds : [],
      categoryIds: Array.isArray(discount.categoryIds) ? discount.categoryIds : [],
      categoryNames: Array.isArray(discount.categoryNames) ? discount.categoryNames : [],
      storeIds:
        Array.isArray(discount.storeIds) && discount.storeIds.length
          ? discount.storeIds
          : allStoreIds,
      activeFrom: toDateTimeLocalValue(discount.activeFrom),
      expiresAt: toDateTimeLocalValue(discount.expiresAt),
      isTemporal: !!daysActive.length || !!windowStart || !!windowEnd,
      daysActive,
      windowStart,
      windowEnd,
      status: discount.status || "ACTIVE",
    });
  };

  const deleteDiscount = async (discountId) => {
    if (!window.confirm("Eliminar Top Deal?")) return;

    try {
      await api.delete(`/api/direct-discounts/${discountId}?partnerId=${partnerId}`);
      resetForm();
      loadAll();
    } catch (error) {
      console.error(error);
      setMessage("No se pudo eliminar el Top Deal.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const hasCategoryTargets = form.categoryIds.length > 0 || form.categoryNames.length > 0;
    const selectedStoreIds = form.storeIds;

    if (allStoreIds.length && !selectedStoreIds.length) {
      setMessage("Selecciona al menos una tienda para este Top Deal.");
      setSaving(false);
      return;
    }

    const payload = {
      partnerId,
      title: form.title.trim(),
      discountType: form.discountType,
      value: Number(form.value || 0),
      targetType: hasCategoryTargets ? "CATEGORY" : "PRODUCT",
      productIds: form.productIds,
      categoryIds: form.categoryIds,
      categoryNames: form.categoryNames,
      storeIds: selectedStoreIds,
      activeFrom: form.activeFrom || "",
      expiresAt: form.expiresAt || "",
      daysActive: form.isTemporal ? form.daysActive : [],
      windowStart: form.isTemporal ? timeToMinutes(form.windowStart) : "",
      windowEnd: form.isTemporal ? timeToMinutes(form.windowEnd) : "",
      status: form.status,
    };

    try {
      if (editingId) {
        await api.put(`/api/direct-discounts/${editingId}`, payload);
        setMessage("Top Deal actualizado.");
      } else {
        await api.post("/api/direct-discounts", payload);
        setMessage("Top Deal creado.");
      }

      resetForm();
      loadAll();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo guardar el Top Deal.");
    } finally {
      setSaving(false);
    }
  };

  const selectedCategoryCount = form.categoryIds.length + form.categoryNames.length;
  const selectedProductCount = form.productIds.length;
  const targetCount = selectedCategoryCount + selectedProductCount;

  return (
    <div className="cp-promosLayout">
      <form className="cp-card cp-form cp-directDiscountBuilder" onSubmit={submit}>
        <div>
          <div className="cp-kicker">Top Deals</div>
          <h3>{editingId ? "Editar Top Deal" : "Crear Top Deal"}</h3>
        </div>

        <div className="cp-formGrid">
          <label className="cp-field">
            <span>Nombre</span>
            <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} required />
          </label>

          <label className="cp-field">
            <span>Valor</span>
            <input
              type="number"
              min="0"
              max={form.discountType === "PERCENT" ? "100" : undefined}
              step="0.01"
              value={form.value}
              onChange={(event) => updateForm("value", event.target.value)}
              required
            />
          </label>
        </div>

        <div className="cp-formGrid cp-formGrid--compact">
          <label className="cp-field">
            <span>Tipo</span>
            <select value={form.discountType} onChange={(event) => updateForm("discountType", event.target.value)}>
              <option value="PERCENT">Porcentaje</option>
              <option value="FIXED_AMOUNT">Monto fijo</option>
            </select>
          </label>
        </div>

        <div className="cp-targetPanel">
          <div className="cp-kicker">Tiendas</div>
          <div className="cp-pillRow">
            <button
              type="button"
              className={`cp-pill ${allStoresSelected ? "is-active" : ""}`}
              onClick={toggleAllStores}
            >
              {allStoresSelected ? "Deseleccionar todo" : "Seleccionar todo"}
            </button>
            {stores.map((store) => (
              <button
                key={store.id}
                type="button"
                className={`cp-pill ${
                  form.storeIds.some((item) => String(item) === String(store.id)) ? "is-active" : ""
                }`}
                onClick={() => toggleStore(store.id)}
              >
                {store.storeName}
              </button>
            ))}
          </div>
        </div>

        <div className="cp-promoPicker">
          <div>
            <div className="cp-kicker">Productos</div>
            <div className="cp-helper">
              {targetCount} seleccionados: {selectedCategoryCount} categoria
              {selectedCategoryCount === 1 ? "" : "s"} completa{selectedCategoryCount === 1 ? "" : "s"} y{" "}
              {selectedProductCount} producto{selectedProductCount === 1 ? "" : "s"} suelto
              {selectedProductCount === 1 ? "" : "s"}.
            </div>
          </div>

          {pizzasByCategory.map((group, index) => (
            <details key={group.id || group.name} className="cp-directCategory" open={index === 0}>
              <summary className="cp-directCategorySummary">
                <strong>{group.name}</strong>
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
                  <small>Todos los productos actuales de {group.name} recibiran este Top Deal.</small>
                </span>
              </label>

              <div className="cp-directProductList">
                {group.rows.map((pizza) => {
                  const categorySelected = isCategorySelected(group);
                  const productSelected = form.productIds.includes(pizza.id);

                  return (
                    <label
                      key={pizza.id}
                      className={`cp-directProductRow ${
                        categorySelected || productSelected ? "is-selected" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={categorySelected || productSelected}
                        disabled={categorySelected}
                        onChange={() => toggleValue("productIds", pizza.id)}
                      />
                      <span>{pizza.name}</span>
                      {categorySelected && <em>Cubierto por categoria</em>}
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </div>

        <div className="cp-formGrid">
          <label className="cp-field">
            <span>Valido desde</span>
            <input type="datetime-local" value={form.activeFrom} onChange={(event) => updateForm("activeFrom", event.target.value)} />
          </label>
          <label className="cp-field">
            <span>Valido hasta</span>
            <input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm("expiresAt", event.target.value)} />
          </label>
        </div>

        <label className="cp-checkRow">
          <input checked={form.isTemporal} onChange={(event) => updateForm("isTemporal", event.target.checked)} type="checkbox" />
          Limitar por dias y horas
        </label>

        {form.isTemporal && (
          <div className="cp-targetPanel">
            <div className="cp-pillRow">
              {WEEK_DAYS.map((day) => (
                <button
                  key={day.value}
                  className={`cp-pill ${form.daysActive.includes(day.value) ? "is-active" : ""}`}
                  onClick={() => toggleValue("daysActive", day.value)}
                  type="button"
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="cp-formGrid">
              <label className="cp-field">
                <span>Inicio</span>
                <input type="time" value={form.windowStart} onChange={(event) => updateForm("windowStart", event.target.value)} />
              </label>
              <label className="cp-field">
                <span>Fin</span>
                <input type="time" value={form.windowEnd} onChange={(event) => updateForm("windowEnd", event.target.value)} />
              </label>
            </div>
          </div>
        )}

        <div className="cp-actions">
          {editingId && (
            <button type="button" className="cp-tabBtn" onClick={resetForm}>
              Cancelar edicion
            </button>
          )}
          <button className="cp-primaryBtn" disabled={saving} type="submit">
            {saving ? "Guardando..." : editingId ? "Actualizar Top Deal" : "Crear Top Deal"}
          </button>
        </div>

        {message && <div className="cp-feedback">{message}</div>}
      </form>

      <section className="cp-card">
        <div className="cp-kicker">Activos</div>
        <h3>Top Deals publicados</h3>

        {loading ? (
          <div className="cp-stateCard">Cargando Top Deals...</div>
        ) : (
          <div className="cp-tableWrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Top Deal</th>
                  <th>Productos</th>
                  <th>Tiendas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => (
                  <tr key={discount.id}>
                    <td>{discount.title}</td>
                    <td>{formatDiscount(discount)}</td>
                    <td>
                      {discount.targetType === "PRODUCT"
                        ? `${discount.productIds?.length || 0} productos`
                        : `${(discount.categoryIds?.length || 0) + (discount.categoryNames?.length || 0)} categorias`}
                    </td>
                    <td>{discount.storeIds?.length ? `${discount.storeIds.length} tiendas` : "Todas"}</td>
                    <td>
                      <div className="cp-rowActions">
                        <button type="button" onClick={() => editDiscount(discount)}>
                          Editar
                        </button>
                        <button type="button" onClick={() => deleteDiscount(discount.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!discounts.length && (
                  <tr>
                    <td colSpan="5">No hay Top Deals todavia.</td>
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
