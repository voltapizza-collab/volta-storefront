import React, { useEffect, useState } from "react";
import "../../styles/IngredientsModule.css";
import { Tree } from "react-arborist";


const INGREDIENTS_BASE = {

  QUESOS: [
    { name: "Mozzarella", allergens: ["LACTOSE"] },
    { name: "Cheddar", allergens: ["LACTOSE"] },
    { name: "Parmesano", allergens: ["LACTOSE"] },
    { name: "Gorgonzola", allergens: ["LACTOSE"] },
    { name: "Queso azul", allergens: ["LACTOSE"] },
    { name: "Burrata", allergens: ["LACTOSE"] },
    { name: "Ricotta", allergens: ["LACTOSE"] },
    { name: "Queso de cabra", allergens: ["LACTOSE"] },
    { name: "Emmental", allergens: ["LACTOSE"] },
    { name: "Provolone", allergens: ["LACTOSE"] }
  ],

  SALSAS: [
    { name: "Tomate", allergens: [] },
    { name: "BBQ", allergens: [] },
    { name: "Pesto", allergens: ["NUTS"] },
    { name: "Crema", allergens: ["LACTOSE"] },
    { name: "Salsa picante", allergens: [] },
    { name: "Salsa de ajo", allergens: ["EGG"] },
    { name: "Salsa miel-mostaza", allergens: ["MUSTARD"] }
  ],

  CARNES: [
    { name: "Pepperoni", allergens: [] },
    { name: "Bacon", allergens: [] },
    { name: "Pollo", allergens: [] },
    { name: "Carne molida", allergens: [] },
    { name: "Chorizo", allergens: [] },
    { name: "Salchicha italiana", allergens: [] }
  ],

  FIAMBRES: [
    { name: "Jamón cocido (York)", allergens: [] },
    { name: "Jamón serrano", allergens: [] },
    { name: "Prosciutto", allergens: [] },
    { name: "Pavo", allergens: [] },
    { name: "Salami", allergens: [] },
    { name: "Mortadela", allergens: ["NUTS"] }
  ],

  PESCADOS: [
    { name: "Atún", allergens: ["FISH"] },
    { name: "Anchoas", allergens: ["FISH"] },
    { name: "Salmón", allergens: ["FISH"] }
  ],

  MARISCOS: [
    { name: "Camarones", allergens: ["SHELLFISH"] },
    { name: "Langostinos", allergens: ["SHELLFISH"] },
    { name: "Cangrejo", allergens: ["SHELLFISH"] },
    { name: "Pulpo", allergens: ["SHELLFISH"] },
    { name: "Mejillones", allergens: ["SHELLFISH"] }
  ],

  VERDURAS: [
    { name: "Cebolla", allergens: [] },
    { name: "Pimiento verde", allergens: [] },
    { name: "Pimiento rojo", allergens: [] },
    { name: "Pimiento amarillo", allergens: [] },
    { name: "Maíz", allergens: [] },
    { name: "Tomate fresco", allergens: [] },
    { name: "Rúcula", allergens: [] },
    { name: "Espinaca", allergens: [] },
    { name: "Berenjena", allergens: [] },
    { name: "Calabacín", allergens: [] },
    { name: "Aceitunas negras", allergens: [] },
    { name: "Aceitunas verdes", allergens: [] },
    { name: "Alcachofa", allergens: [] }
  ],

  SETAS: [
    { name: "Champiñones", allergens: [] },
    { name: "Portobello", allergens: [] },
    { name: "Trufa", allergens: [] }
  ],

  FRUTAS: [
    { name: "Piña", allergens: [] },
    { name: "Higos", allergens: [] },
    { name: "Manzana", allergens: [] },
    { name: "Pera", allergens: [] }
  ],

  ESPECIAS: [
    { name: "Orégano", allergens: [] },
    { name: "Chili flakes", allergens: [] },
    { name: "Ajo", allergens: [] },
    { name: "Albahaca", allergens: [] }
  ],

  ACEITES: [
    { name: "Aceite de oliva", allergens: [] },
    { name: "Aceite picante", allergens: [] }
  ],

  EXTRAS: [
    { name: "Huevo", allergens: ["EGG"] }
  ]

};

export default function IngredientsModule() {
  const [ingredients, setIngredients] = useState([]);
  const [category, setCategory] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

const getDisplayName = (name) => (name || "").toUpperCase();
const normalizeIngredientName = (name) =>
  (name || "").trim().toLowerCase();

const loadIngredients = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:8080/ingredients");
      const data = await res.json();
      setIngredients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
};
const loadSuggestions = async () => {
  try {
    setLoadingSuggestions(true);
    const res = await fetch("http://localhost:8080/ingredients/suggestions?status=PENDING");
    const data = await res.json();
    setSuggestions(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
  } finally {
    setLoadingSuggestions(false);
  }
};

useEffect(() => {
  loadIngredients();
  loadSuggestions();
}, []);

const handleCreate = async () => {
    if (!category || !selectedName) return;

    const selected = INGREDIENTS_BASE[category].find(
      (i) => i.name === selectedName
    );

    if (!selected) return;

    try {
      await fetch("http://localhost:8080/ingredients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: selected.name,
          category,
          allergens: selected.allergens,
        }),
      });

      setSelectedName("");
      loadIngredients();
    } catch (err) {
      console.error(err);
    }
};
const handleApprove = async (id) => {
  try {
    await fetch(
      "http://localhost:8080/ingredients/suggestions/" + id + "/approve",
      { method: "PATCH" }
    );

    loadSuggestions();
  } catch (err) {
    console.error(err);
  }
};
const handleReject = async (id) => {
  try {
    await fetch(
      "http://localhost:8080/ingredients/suggestions/" + id + "/reject",
      { method: "PATCH" }
    );

    loadSuggestions();
  } catch (err) {
    console.error(err);
  }
};

const handleDeleteIngredient = async (id, name) => {
  const confirmed = window.confirm(
    `Delete ${getDisplayName(name)} from the ingredients table?`
  );

  if (!confirmed) return;

  try {
    await fetch(`http://localhost:8080/ingredients/${id}`, {
      method: "DELETE",
    });

    loadIngredients();
  } catch (err) {
    console.error(err);
  }
};

const existingIngredientNames = new Set(
  ingredients.map((ing) => normalizeIngredientName(ing.name))
);

const availableBaseIngredients = category
  ? INGREDIENTS_BASE[category].filter(
      (item) =>
        !existingIngredientNames.has(
          normalizeIngredientName(item.name)
        )
    )
  : [];

const treeData = Object.entries(
  ingredients.reduce((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = [];
    acc[ing.category].push(ing);
    return acc;
  }, {})
)
  .sort(([a], [b]) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  ).map(([category, items]) => ({
    id: `cat-${category}`, // 🔥 ID SEGURO
    name: category,
    children: items
    .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      )
      .map((i) => ({
        id: `ing-${i.id}`, // 🔥 ID SEGURO
        ingredientId: i.id,
        name: i.name,
        allergens: i.allergens || [],
      })),
  }));

  return (
    <div>
      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        {/* CATEGORY */}
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSelectedName("");
          }}
        >
          <option value="">Select category</option>
          {Object.keys(INGREDIENTS_BASE).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* INGREDIENT */}
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          style={{ marginLeft: 10 }}
          disabled={!category}
        >
          <option value="">Select ingredient</option>
          {category &&
            availableBaseIngredients.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
        </select>

        <button onClick={handleCreate} style={{ marginLeft: 10 }}>
          + Create
        </button>
      </div>

      <h2>Ingredients</h2>
      {/* 🔥 SUGGESTIONS */}
<div
  style={{
    marginBottom: 20,
    padding: 10,
    border: "1px solid #444",
    borderRadius: 8,
    background: "#111",
  }}
>
  <strong>Suggestions</strong>

  {loadingSuggestions && <p>Loading...</p>}

  {!loadingSuggestions && suggestions.length === 0 && (
    <p style={{ opacity: 0.6 }}>No pending</p>
  )}

  {suggestions.map((s) => (
    <div
      key={s.id}
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 6,
        padding: 6,
        background: "#222",
        borderRadius: 6,
      }}
    >
      <span>
        {s.name} ({s.category})
      </span>

      <div>
        <button onClick={() => handleApprove(s.id)}>✔</button>
        <button onClick={() => handleReject(s.id)}>✖</button>
      </div>
    </div>
  ))}
</div>

      {/* TREE */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div
          style={{
            height: 400,
            border: "1px solid #333",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          
        <div className="gm-tree">
          <Tree
            data={treeData}
            openByDefault={false}
            width="100%"
            height={400}
          >
            {({ node, style }) => (
              <div
                style={style}
                className={`gm-node ${node.isLeaf ? "leaf" : "parent"}`}
                onClick={() => {
                  if (!node.isLeaf) node.toggle();
                }}
              >
                <div className="gm-node-left">
                  {!node.isLeaf && (
                    <span className="gm-arrow">
                      {node.isOpen ? "▼" : "▶"}
                    </span>
                  )}

                  {node.isLeaf && <span className="gm-dot">•</span>}

                  <span className="gm-name">
                    {node.isLeaf
                      ? getDisplayName(node.data.name)
                      : node.data.name}
                  </span>
                </div>

                {node.isLeaf && (
                  <div className="gm-node-right">
                    {node.data.allergens.length > 0 && (
                      <div className="gm-allergens">
                        {node.data.allergens.join(", ")}
                      </div>
                    )}

                    <button
                      type="button"
                      className="gm-deleteBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteIngredient(
                          node.data.ingredientId,
                          node.data.name
                        );
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}
          </Tree>
        </div>
        </div>
      )}
    </div>
  );
}
