import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/PizzaCreatorExtras.css";

export default function PizzaCreatorExtras({ partner }) {
  const partnerId = partner?.partnerId;
  const storeId = partner?.storeId;
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [extras, setExtras] = useState([]);
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

  const loadAll = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoading(true);

      const [catRes, ingRes, extraRes] = await Promise.all([
        api.get(`/api/partners/${partnerId}/categories`),
        api.get(`/stores/${storeId}/ingredients`),
        api.get(`/api/ingredient-extras/all?storeId=${storeId}`),
      ]);

      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setIngredients(
        (Array.isArray(ingRes.data) ? ingRes.data : []).filter(
          (ingredient) => ingredient.exists && ingredient.active
        )
      );
      setExtras(Array.isArray(extraRes.data) ? extraRes.data : []);
    } catch (err) {
      console.error(err);
      setCategories([]);
      setIngredients([]);
      setExtras([]);
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
    setSelectedIngredient(extra.ingredientId);
    setSelectedCategories(
      extra.categories.map((category) => ({
        id: category.id,
        price: category.price || 0,
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
      return [...prev, { id, price: 0 }];
    });
  };

  const setCategoryPrice = (id, price) => {
    setSelectedCategories((prev) =>
      prev.map((category) =>
        category.id === id ? { ...category, price } : category
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
          price: Number(category.price || 0),
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

  const formatPrice = (value) => `EUR ${Number(value || 0).toFixed(2)}`;

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
                <div className="pcex-rowMeta">
                  {extra.categories
                    .map(
                      (category) =>
                        `${category.name} (${formatPrice(category.price)})`
                    )
                    .join(", ")}
                </div>
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
                onChange={(e) => setSelectedIngredient(Number(e.target.value))}
              >
                <option value="">- Selecciona -</option>
                {sortedIngredients.map((ingredient) => (
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

                        <div className="pcex-catPreview">
                          {formatPrice(selected?.price || 0)}
                        </div>
                      </div>

                      <div className="pcex-catEditor">
                        {selected ? (
                          <div className="pcex-catInput">
                            <span>EUR</span>
                            <input
                              type="number"
                              step="0.01"
                              value={selected?.price || ""}
                              placeholder="0.00"
                              onChange={(e) =>
                                setCategoryPrice(category.id, e.target.value)
                              }
                            />
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
