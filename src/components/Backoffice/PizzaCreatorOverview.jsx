import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/PizzaCreator.css";

const sizeList = ["S", "M", "L", "XL", "XXL", "ST"];

const formatDate = (value) => {
  if (!value) return "Sin fecha";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const createEmptyCounter = () =>
  Object.fromEntries(sizeList.map((size) => [size, 0]));

export default function PizzaCreatorOverview({ partner, onOpenProducts }) {
  const partnerId = partner?.partnerId;
  const [categories, setCategories] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!partnerId) return [];

    try {
      const response = await api.get(`/api/partners/${partnerId}/categories`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.error(err);

      try {
        const fallback = await api.get("/api/categories");
        return Array.isArray(fallback.data) ? fallback.data : [];
      } catch (fallbackErr) {
        console.error(fallbackErr);
        return [];
      }
    }
  }, [partnerId]);

  const loadPizzas = useCallback(async () => {
    if (!partnerId) return [];

    try {
      const response = await api.get(`/api/pizzas?partnerId=${partnerId}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [partnerId]);

  const loadInventory = useCallback(async () => {
    try {
      const response = await api.get("/ingredients");
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const loadModuleData = async () => {
      if (!partnerId) return;

      setLoading(true);

      try {
        const [nextCategories, nextPizzas, nextInventory] = await Promise.all([
          loadCategories(),
          loadPizzas(),
          loadInventory(),
        ]);

        if (!alive) return;

        setCategories(nextCategories);
        setPizzas(nextPizzas);
        setInventory(nextInventory);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadModuleData();

    return () => {
      alive = false;
    };
  }, [partnerId, loadCategories, loadInventory, loadPizzas]);

  const totalPizzas = pizzas.length;
  const activePizzas = pizzas.filter((pizza) => pizza.status !== "INACTIVE").length;
  const inactivePizzas = totalPizzas - activePizzas;
  const totalConfiguredSizes = pizzas.reduce(
    (sum, pizza) => sum + (Array.isArray(pizza.selectSize) ? pizza.selectSize.length : 0),
    0
  );
  const avgSizesPerPizza = totalPizzas
    ? (totalConfiguredSizes / totalPizzas).toFixed(1)
    : "0.0";
  const avgIngredientsPerPizza = totalPizzas
    ? (
        pizzas.reduce(
          (sum, pizza) => sum + (Array.isArray(pizza.ingredients) ? pizza.ingredients.length : 0),
          0
        ) / totalPizzas
      ).toFixed(1)
    : "0.0";

  const categoryRanking = useMemo(() => {
    const counts = new Map();

    categories.forEach((category) => {
      counts.set(category.name, 0);
    });

    pizzas.forEach((pizza) => {
      const name = pizza.categoryName || pizza.category || "Sin categoria";
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  }, [categories, pizzas]);

  const topCategory = categoryRanking.find((item) => item.total > 0) || null;

  const topIngredients = useMemo(() => {
    const usage = new Map();

    pizzas.forEach((pizza) => {
      (pizza.ingredients || []).forEach((ingredient) => {
        const key = ingredient.id || ingredient.name;
        const qtyBySize = ingredient.qtyBySize || {};
        const totalQty = Object.values(qtyBySize).reduce(
          (sum, value) => sum + Number(value || 0),
          0
        );

        if (!usage.has(key)) {
          usage.set(key, {
            id: ingredient.id,
            name: ingredient.name || `Ingrediente ${ingredient.id}`,
            pizzas: 0,
            totalQty: 0,
          });
        }

        const current = usage.get(key);
        current.pizzas += 1;
        current.totalQty += totalQty;
      });
    });

    return [...usage.values()]
      .sort((a, b) => b.pizzas - a.pizzas || b.totalQty - a.totalQty || a.name.localeCompare(b.name, "es"))
      .slice(0, 5);
  }, [pizzas]);

  const sizeCoverage = useMemo(() => {
    const counter = createEmptyCounter();

    pizzas.forEach((pizza) => {
      (pizza.selectSize || []).forEach((size) => {
        if (counter[size] == null) {
          counter[size] = 0;
        }
        counter[size] += 1;
      });
    });

    const maxCount = Math.max(1, ...Object.values(counter));

    return Object.entries(counter).map(([size, total]) => ({
      size,
      total,
      width: `${Math.max(12, Math.round((total / maxCount) * 100))}%`,
    }));
  }, [pizzas]);

  const chronologicalPizzas = useMemo(() => {
    return [...pizzas]
      .filter((pizza) => pizza.createdAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [pizzas]);

  const oldestPizza = chronologicalPizzas[0] || null;
  const newestPizza = chronologicalPizzas[chronologicalPizzas.length - 1] || null;

  return (
    <div className="pc-overview">
      <section className="pc-overviewHero pc-section">
        <div>
          <div className="pc-sectionTitle">Pizza Creator</div>
          <h2 className="pc-overviewTitle">Panel del modulo</h2>
          <p className="pc-overviewIntro">
            Esta vista padre ya no cae en el hijo por defecto: resume el estado del
            catalogo, las categorias y el armado actual de pizzas del partner.
          </p>
        </div>

        <button
          type="button"
          className="pc-overviewCta"
          onClick={onOpenProducts}
        >
          Ir a productos
        </button>
      </section>

      <section className="pc-overviewStats">
        <article className="pc-kpiCard">
          <span className="pc-kpiLabel">Pizzas cargadas</span>
          <strong className="pc-kpiValue">{totalPizzas}</strong>
          <span className="pc-kpiMeta">
            {activePizzas} activas, {inactivePizzas} inactivas
          </span>
        </article>

        <article className="pc-kpiCard">
          <span className="pc-kpiLabel">Categoria lider</span>
          <strong className="pc-kpiValue">
            {topCategory ? topCategory.name : "Sin datos"}
          </strong>
          <span className="pc-kpiMeta">
            {topCategory ? `${topCategory.total} productos` : "Aun no hay pizzas"}
          </span>
        </article>

        <article className="pc-kpiCard">
          <span className="pc-kpiLabel">Tamanos por pizza</span>
          <strong className="pc-kpiValue">{avgSizesPerPizza}</strong>
          <span className="pc-kpiMeta">Promedio de configuraciones activas</span>
        </article>

        <article className="pc-kpiCard">
          <span className="pc-kpiLabel">Ingredientes por pizza</span>
          <strong className="pc-kpiValue">{avgIngredientsPerPizza}</strong>
          <span className="pc-kpiMeta">{inventory.length} ingredientes disponibles</span>
        </article>
      </section>

      <div className="pc-overviewGrid">
        <section className="pc-section">
          <div className="pc-sectionTitle">Categorias</div>
          <div className="pc-overviewList">
            {categoryRanking.length ? (
              categoryRanking.map((category) => (
                <div key={category.name} className="pc-overviewRow">
                  <span className="pc-overviewRowTitle">{category.name}</span>
                  <span className="pc-overviewRowBadge">{category.total}</span>
                </div>
              ))
            ) : (
              <div className="pc-emptyState">No hay categorias disponibles.</div>
            )}
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-sectionTitle">Ingredientes mas usados</div>
          <div className="pc-overviewList">
            {topIngredients.length ? (
              topIngredients.map((ingredient) => (
                <div key={ingredient.id || ingredient.name} className="pc-overviewRow">
                  <div>
                    <div className="pc-overviewRowTitle">{ingredient.name}</div>
                    <div className="pc-overviewRowMeta">
                      Presente en {ingredient.pizzas} pizzas
                    </div>
                  </div>
                  <span className="pc-overviewRowBadge">{ingredient.totalQty}</span>
                </div>
              ))
            ) : (
              <div className="pc-emptyState">Aun no hay ingredientes vinculados.</div>
            )}
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-sectionTitle">Cobertura por tamano</div>
          <div className="pc-sizeCoverage">
            {sizeCoverage.map((item) => (
              <div key={item.size} className="pc-sizeCoverageRow">
                <span className="pc-sizeCoverageLabel">{item.size}</span>
                <div className="pc-sizeCoverageTrack">
                  <div className="pc-sizeCoverageFill" style={{ width: item.width }} />
                </div>
                <span className="pc-sizeCoverageValue">{item.total}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-sectionTitle">Ciclo del catalogo</div>
          <div className="pc-timelineCard">
            <span className="pc-timelineLabel">Pizza mas antigua</span>
            <strong className="pc-timelineValue">
              {oldestPizza ? oldestPizza.name : "Sin datos"}
            </strong>
            <span className="pc-timelineMeta">
              {oldestPizza ? formatDate(oldestPizza.createdAt) : "Todavia no hay registros"}
            </span>
          </div>

          <div className="pc-timelineCard">
            <span className="pc-timelineLabel">Ultima incorporacion</span>
            <strong className="pc-timelineValue">
              {newestPizza ? newestPizza.name : "Sin datos"}
            </strong>
            <span className="pc-timelineMeta">
              {newestPizza ? formatDate(newestPizza.createdAt) : "Todavia no hay registros"}
            </span>
          </div>
        </section>
      </div>

      {loading && <div className="pc-sideInfo">Cargando resumen del modulo...</div>}
    </div>
  );
}
