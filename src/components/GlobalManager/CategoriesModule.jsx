import React, { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/CategoriesModule.css";

export default function CategoriesModule() {
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCustomizable, setNewCategoryCustomizable] = useState(false);
  const [newCategoryHalfAndHalf, setNewCategoryHalfAndHalf] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingCustomizable, setEditingCustomizable] = useState(false);
  const [editingHalfAndHalf, setEditingHalfAndHalf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert("No se pudieron cargar las categorias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const orderedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        return String(a.name || "").localeCompare(String(b.name || ""), "es", {
          sensitivity: "base",
        });
      }),
    [categories]
  );

  const createCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    const alreadyExists = categories.some(
      (category) =>
        String(category.name || "").trim().toLowerCase() ===
        trimmedName.toLowerCase()
    );

    if (alreadyExists) {
      alert("Esa categoria ya existe.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/api/categories", {
        name: trimmedName,
        customizable: newCategoryCustomizable,
        halfAndHalf: newCategoryHalfAndHalf,
      });
      setNewCategoryName("");
      setNewCategoryCustomizable(false);
      setNewCategoryHalfAndHalf(false);
      await loadCategories();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear la categoria.");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (category) => {
    setEditingCategoryId(category.id);
    setEditingName(category.name || "");
    setEditingCustomizable(Boolean(category.customizable));
    setEditingHalfAndHalf(Boolean(category.halfAndHalf));
  };

  const cancelEditing = () => {
    setEditingCategoryId(null);
    setEditingName("");
    setEditingCustomizable(false);
    setEditingHalfAndHalf(false);
  };

  const saveCategory = async (category) => {
    const trimmedName = editingName.trim();

    if (!trimmedName) {
      alert("El nombre es obligatorio.");
      return;
    }

    const alreadyExists = categories.some(
      (item) =>
        item.id !== category.id &&
        String(item.name || "").trim().toLowerCase() ===
          trimmedName.toLowerCase()
    );

    if (alreadyExists) {
      alert("Esa categoria ya existe.");
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.patch(`/api/categories/${category.id}`, {
        name: trimmedName,
        customizable: editingCustomizable,
        halfAndHalf: editingHalfAndHalf,
      });

      setCategories((prev) =>
        prev.map((item) => (item.id === category.id ? data : item))
      );
      cancelEditing();
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar la categoria.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category) => {
    const confirmed = window.confirm(
      `Delete ${category.name} from categories?`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/api/categories/${category.id}`);
      setCategories((prev) => prev.filter((item) => item.id !== category.id));
    } catch (err) {
      console.error(err);
      alert(
        err?.response?.data?.error || "No se pudo eliminar la categoria."
      );
    }
  };

  return (
    <div className="gmc-container">
      <div className="gmc-header">
        <h2 className="gmc-title">Categories</h2>
        <p className="gmc-subtitle">
          Create and maintain the global category catalog. Feed order and
          visibility are managed by each business from Backoffice.
        </p>
      </div>

      <div className="gmc-createCard">
        <label className="gmc-label" htmlFor="gm-category-name">
          New category
        </label>

        <div className="gmc-createRow">
          <input
            id="gm-category-name"
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createCategory();
              }
            }}
            placeholder="Pizza Especial"
            className="gmc-input"
            disabled={saving}
          />

          <label className="gmc-customizeCheck">
            <input
              type="checkbox"
              checked={newCategoryCustomizable}
              onChange={(e) => setNewCategoryCustomizable(e.target.checked)}
              disabled={saving}
            />
            Personalizable
          </label>

          <label className="gmc-customizeCheck">
            <input
              type="checkbox"
              checked={newCategoryHalfAndHalf}
              onChange={(e) => setNewCategoryHalfAndHalf(e.target.checked)}
              disabled={saving}
            />
            Mitad / mitad
          </label>

          <button
            type="button"
            className="gmc-createBtn"
            onClick={createCategory}
            disabled={saving || !newCategoryName.trim()}
          >
            + Create
          </button>
        </div>
      </div>

      <div className="gmc-listCard">
        <div className="gmc-listHeader">
          <strong>Current categories</strong>
          <span>{orderedCategories.length} items</span>
        </div>

        {loading ? (
          <p className="gmc-empty">Loading...</p>
        ) : orderedCategories.length === 0 ? (
          <p className="gmc-empty">No categories yet.</p>
        ) : (
          <div className="gmc-list">
            {orderedCategories.map((category) => (
              <div key={category.id} className="gmc-row gmc-rowStatic">
                <div className="gmc-rowInfo">
                  {editingCategoryId === category.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="gmc-inlineInput"
                      disabled={saving}
                    />
                  ) : (
                    <div className="gmc-rowName">{category.name}</div>
                  )}
                  <div className="gmc-rowMeta">
                    {[
                      category.customizable ? "Personalizable en armado" : "Catalogo global",
                      category.halfAndHalf ? "Disponible para mitad / mitad" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {editingCategoryId === category.id && (
                    <div className="gmc-inlineChecks">
                      <label className="gmc-customizeCheck gmc-customizeCheck--inline">
                        <input
                          type="checkbox"
                          checked={editingCustomizable}
                          onChange={(e) =>
                            setEditingCustomizable(e.target.checked)
                          }
                          disabled={saving}
                        />
                        Personalizable
                      </label>
                      <label className="gmc-customizeCheck gmc-customizeCheck--inline">
                        <input
                          type="checkbox"
                          checked={editingHalfAndHalf}
                          onChange={(e) =>
                            setEditingHalfAndHalf(e.target.checked)
                          }
                          disabled={saving}
                        />
                        Mitad / mitad
                      </label>
                    </div>
                  )}
                </div>

                <div className="gmc-actions">
                  {editingCategoryId === category.id ? (
                    <>
                      <button
                        type="button"
                        className="gmc-saveBtn"
                        onClick={() => saveCategory(category)}
                        disabled={saving || !editingName.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="gmc-cancelBtn"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="gmc-editBtn"
                        onClick={() => startEditing(category)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="gmc-deleteBtn"
                        onClick={() => deleteCategory(category)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
