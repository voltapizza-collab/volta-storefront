import React, { useCallback, useEffect, useState } from "react";
import api from "../../setupAxios";
import "../../styles/PizzaCreator.css";

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

const EMPTY_OVERVIEW = {
  categories: [],
  topIngredients: [],
  topPizzaByStore: [],
  latestProduct: null,
  totals: {
    active: 0,
    inactive: 0,
    total: 0,
  },
};

export default function PizzaCreatorOverview({ partner, onOpenProducts }) {
  const partnerId = partner?.partnerId;
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/pizzas/overview?partnerId=${partnerId}`);
      setOverview({
        ...EMPTY_OVERVIEW,
        ...(response.data || {}),
        totals: {
          ...EMPTY_OVERVIEW.totals,
          ...(response.data?.totals || {}),
        },
      });
    } catch (err) {
      console.error("Error loading pizza creator overview", err);
      setOverview(EMPTY_OVERVIEW);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return (
    <div className="pc-overview">
      <section className="pc-overviewHero pc-section">
        <div>
          <div className="pc-sectionTitle">Pizza Creator</div>
          <h2 className="pc-overviewTitle">Panel del modulo</h2>
        </div>

        <button
          type="button"
          className="pc-overviewCta"
          onClick={onOpenProducts}
        >
          Ir a productos
        </button>
      </section>

      <div className="pc-overviewGrid pc-overviewGrid--compact">
        <section className="pc-section">
          <div className="pc-sectionHeader">
            <div>
              <div className="pc-sectionTitle">Categorias</div>
              <p className="pc-sectionHint">Sin bebidas ni complementos</p>
            </div>
            <span className="pc-overviewRowBadge">{overview.totals.total}</span>
          </div>

          <div className="pc-compactCategoryList">
            {overview.categories.length ? (
              overview.categories.map((category) => {
                const active = Number(category.active) || 0;
                const inactive = Number(category.inactive) || 0;
                const total = Number(category.total) || active + inactive;
                const activePercent = total ? Math.round((active / total) * 100) : 0;

                return (
                  <div key={category.categoryId || category.name} className="pc-categoryCompactRow">
                    <div className="pc-categoryCompactInfo">
                      <span className="pc-overviewRowTitle">{category.name}</span>
                      <div
                        className="pc-categoryStatus"
                        aria-label={`${active} activos y ${inactive} inactivos`}
                      >
                        <span className="pc-categoryStatusPill pc-categoryStatusPill--active">
                          <span className="pc-categoryStatusDot" aria-hidden="true" />
                          <strong>{active}</strong> activos
                        </span>
                        <span className="pc-categoryStatusPill pc-categoryStatusPill--inactive">
                          <span className="pc-categoryStatusDot" aria-hidden="true" />
                          <strong>{inactive}</strong> inactivos
                        </span>
                      </div>
                      <div className="pc-categoryMeter" aria-hidden="true">
                        <span style={{ width: `${activePercent}%` }} />
                      </div>
                    </div>
                    <span className="pc-overviewRowBadge">{total}</span>
                  </div>
                );
              })
            ) : (
              <div className="pc-emptyState">No hay categorias con productos.</div>
            )}
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-sectionTitle">Top 5 ingredientes usados</div>
          <div className="pc-overviewList">
            {overview.topIngredients.length ? (
              overview.topIngredients.map((ingredient) => (
                <div key={ingredient.id || ingredient.name} className="pc-overviewRow">
                  <div>
                    <div className="pc-overviewRowTitle">{ingredient.name}</div>
                    <div className="pc-overviewRowMeta">
                      Presente en {ingredient.pizzas} productos
                    </div>
                  </div>
                  <span className="pc-overviewRowBadge">{ingredient.totalQty}</span>
                </div>
              ))
            ) : (
              <div className="pc-emptyState">Sin ingredientes suficientes.</div>
            )}
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-sectionTitle">Pizza mas vendida por tienda</div>
          <div className="pc-overviewList">
            {overview.topPizzaByStore.length ? (
              overview.topPizzaByStore.map((store) => (
                <div key={store.storeId} className="pc-overviewRow">
                  <div>
                    <div className="pc-overviewRowTitle">{store.storeName}</div>
                    <div className="pc-overviewRowMeta">
                      {store.topPizza
                        ? store.topPizza.name
                        : "Sin ventas registradas"}
                    </div>
                  </div>
                  <span className="pc-overviewRowBadge">
                    {store.topPizza ? store.topPizza.qty : 0}
                  </span>
                </div>
              ))
            ) : (
              <div className="pc-emptyState">No hay tiendas disponibles.</div>
            )}
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-sectionTitle">Ultima incorporacion</div>
          <div className="pc-timelineCard pc-timelineCard--single">
            <span className="pc-timelineLabel">
              {overview.latestProduct?.category || "Catalogo"}
            </span>
            <strong className="pc-timelineValue">
              {overview.latestProduct ? overview.latestProduct.name : "Sin datos"}
            </strong>
            <span className="pc-timelineMeta">
              {overview.latestProduct
                ? formatDate(overview.latestProduct.createdAt)
                : "Todavia no hay productos"}
            </span>
          </div>
        </section>
      </div>

      {loading && <div className="pc-sideInfo">Cargando resumen del modulo...</div>}
    </div>
  );
}
