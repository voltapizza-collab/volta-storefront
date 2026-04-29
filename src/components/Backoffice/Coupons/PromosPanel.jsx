import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";

const initialForm = {
  title: "",
  description: "",
  totalPrice: "",
  activeFrom: "",
  expiresAt: "",
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

export default function PromosPanel({ partnerId }) {
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
      const [pizzaResponse, promoResponse] = await Promise.all([
        api.get(`/api/pizzas?partnerId=${partnerId}`),
        api.get(`/api/promos?partnerId=${partnerId}`),
      ]);

      setPizzas(Array.isArray(pizzaResponse.data) ? pizzaResponse.data : []);
      setPromos(Array.isArray(promoResponse.data?.promos) ? promoResponse.data.promos : []);
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar las promos.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pizzasByCategory = useMemo(() => {
    const map = new Map();

    pizzas.forEach((pizza) => {
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

  const addItem = (pizza) => {
    setForm((prev) => {
      const existing = prev.items.find((item) => item.pizzaId === pizza.id);

      if (existing) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.pizzaId === pizza.id
              ? { ...item, quantity: Number(item.quantity || 1) + 1 }
              : item
          ),
        };
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            pizzaId: pizza.id,
            name: pizza.name,
            category: pizza.categoryName || pizza.category || "Sin categoria",
            quantity: 1,
            size: Array.isArray(pizza.selectSize) ? pizza.selectSize[0] || "" : "",
          },
        ],
      };
    });
  };

  const updateItem = (pizzaId, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.pizzaId === pizzaId ? { ...item, [key]: value } : item
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
    setEditingId(promo.id);
    setExistingImage(promo.image || "");
    setForm({
      title: promo.title || "",
      description: promo.description || "",
      totalPrice: promo.totalPrice || "",
      activeFrom: toDateTimeLocalValue(promo.activeFrom),
      expiresAt: toDateTimeLocalValue(promo.expiresAt),
      imageFile: null,
      items: Array.isArray(promo.items) ? promo.items : [],
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

    const payload = new FormData();
    payload.append("partnerId", String(partnerId));
    payload.append("title", form.title.trim());
    payload.append("description", form.description.trim());
    payload.append("totalPrice", String(Number(form.totalPrice || 0)));
    payload.append("activeFrom", form.activeFrom || "");
    payload.append("expiresAt", form.expiresAt || "");
    payload.append("items", JSON.stringify(form.items));
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

        <label className="cp-field">
          <span>Foto</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) =>
              updateForm("imageFile", event.target.files?.[0] || null)
            }
          />
        </label>

        {existingImage && !form.imageFile && (
          <div className="cp-promoImageNote">Imagen actual cargada.</div>
        )}

        <div className="cp-promoPicker">
          <div>
            <div className="cp-kicker">Productos</div>
            <div className="cp-helper">Selecciona productos por categoria para meterlos en la bolsa.</div>
          </div>

          {pizzasByCategory.map((group) => (
            <section key={group.category} className="cp-promoCategory">
              <div className="cp-promoCategoryHead">
                <strong>{group.category}</strong>
                <span>{group.rows.length} productos</span>
              </div>

              <div className="cp-promoProductGrid">
                {group.rows.map((pizza) => (
                  <button
                    key={pizza.id}
                    type="button"
                    className="cp-promoProductBtn"
                    onClick={() => addItem(pizza)}
                  >
                    <strong>{pizza.name}</strong>
                    <span>
                      {Object.entries(pizza.priceBySize || {})
                        .filter(([, value]) => value !== "" && value != null)
                        .slice(0, 3)
                        .map(([size, value]) => `${size} ${formatPrice(value)}`)
                        .join(" · ") || "Sin precio"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="cp-promoBag">
          <div className="cp-promoBagHead">
            <strong>Bolsa</strong>
            <span>{form.items.length} items</span>
          </div>

          {form.items.map((item) => (
            <div key={item.pizzaId} className="cp-promoBagRow">
              <div>
                <strong>{item.name}</strong>
                <span>{item.category}</span>
              </div>

              <label>
                Cant.
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.pizzaId, "quantity", event.target.value)
                  }
                />
              </label>

              <label>
                Tam.
                <input
                  value={item.size || ""}
                  onChange={(event) =>
                    updateItem(item.pizzaId, "size", event.target.value)
                  }
                  placeholder="M"
                />
              </label>

              <button
                type="button"
                className="cp-miniDanger"
                onClick={() => removeItem(item.pizzaId)}
              >
                Quitar
              </button>
            </div>
          ))}

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
                  <th>Promo</th>
                  <th>Contenido</th>
                  <th>Precio</th>
                  <th>Vigencia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((promo) => (
                  <tr key={promo.id}>
                    <td>{promo.title}</td>
                    <td>
                      {(promo.items || [])
                        .map((item) => `${item.quantity || 1}x ${item.name}`)
                        .join(", ")}
                    </td>
                    <td>{formatPrice(promo.totalPrice)}</td>
                    <td>
                      {promo.activeFrom ? toDateTimeLocalValue(promo.activeFrom) : "Ahora"}
                      {" / "}
                      {promo.expiresAt ? toDateTimeLocalValue(promo.expiresAt) : "Sin fin"}
                    </td>
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
