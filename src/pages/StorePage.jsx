import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/Storefront.css";

export default function StorePage() {
  const navigate = useNavigate();
  const { partnerSlug, storeSlug } = useParams();

  const [menu, setMenu] = useState([]);
  const [store, setStore] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!partnerSlug || !storeSlug) return;

    const loadMenu = async () => {
      try {
        const data = await api.get(`/stores/${partnerSlug}/${storeSlug}/menu`);
        setMenu(Array.isArray(data?.menu) ? data.menu : []);
        setStore(data?.store || null);
      } catch (err) {
        console.error(err);
        setError("Error loading menu");
      }
    };

    loadMenu();
  }, [partnerSlug, storeSlug]);

  const categories = useMemo(() => {
    const uniques = new Map();

    menu.forEach((item) => {
      const key = item.categoryId || item.category;
      if (!key) return;
      if (!uniques.has(key)) {
        uniques.set(key, item.category || "Sin categoria");
      }
    });

    return [...uniques.values()];
  }, [menu]);

  if (error) {
    return (
      <div className="sf-error">
        <div className="sf-errorCard">{error}</div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="sf-loading">
        <div className="sf-loadingCard">Loading store...</div>
      </div>
    );
  }

  return (
    <div className="sf-shell">
      <div className="sf-wrap sf-menu">
        <section className="sf-menuHero">
          <div className="sf-menuHeroTop">
            <div>
              <h2 className="sf-menuTitle">{store.storeName}</h2>
              <p className="sf-menuLead">
                Motor por tienda. Aquí ya no definimos método ni sucursal: eso quedó
                resuelto en la capa anterior.
              </p>
            </div>

            <div className="sf-heroActions">
              <button
                type="button"
                className="sf-secondaryBtn"
                onClick={() => navigate(`/${partnerSlug}/order`)}
              >
                Cambiar tienda
              </button>
              <button type="button" className="sf-offersBtn">
                Ofertas
              </button>
            </div>
          </div>

          {!!categories.length && (
            <div className="sf-chipRow">
              {categories.map((category) => (
                <span key={category} className="sf-chip">
                  {category}
                </span>
              ))}
            </div>
          )}
        </section>

        {menu.length === 0 ? (
          <div className="sf-empty">No products available</div>
        ) : (
          <div className="sf-menuGrid">
            {menu.map((item) => (
              <article key={item.pizzaId} className="sf-menuCard">
                <div className="sf-menuCardHead">
                  <div>
                    <h3 className="sf-menuCardTitle">{item.name}</h3>
                    <div className="sf-menuCardMeta">
                      {item.category || "Sin categoria"}
                    </div>
                  </div>
                  <span className="sf-badge">ACTIVE</span>
                </div>

                <div>
                  <div className="sf-sectionLabel">Tamanos y precios</div>
                  <div className="sf-priceRow">
                    {Object.entries(item.priceBySize || {})
                      .filter(([_, value]) => value !== "" && value != null)
                      .map(([size, value]) => (
                        <span key={size} className="sf-priceTag">
                          {size}: EUR{value}
                        </span>
                      ))}
                  </div>
                </div>

                <div>
                  <div className="sf-sectionLabel">Ingredientes activos</div>
                  <div className="sf-chipRow">
                    {(item.ingredients || []).map((ingredient) => (
                      <span key={ingredient.id} className="sf-chip">
                        {ingredient.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="sf-sectionLabel">Extras disponibles</div>
                  <div className="sf-chipRow">
                    {(item.extras || []).length ? (
                      item.extras.map((extra) => (
                        <span
                          key={`${item.pizzaId}-${extra.ingredientId}`}
                          className="sf-chip"
                        >
                          {extra.name} +EUR{Number(extra.price || 0).toFixed(2)}
                        </span>
                      ))
                    ) : (
                      <span className="sf-chip">Sin extras para esta categoria</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
