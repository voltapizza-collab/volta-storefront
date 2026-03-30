import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { getStore } from "../services/api";
import StoreGate from "../components/StoreGate";

export default function StorePage() {
  const { partnerSlug, storeSlug } = useParams();

  const [store, setStore] = useState(null);
  const [menu, setMenu] = useState([]);
  const [error, setError] = useState("");

useEffect(() => {
  if (!partnerSlug || !storeSlug) return;

  const loadData = async () => {
    try {
      // 1. store
      const storeData = await getStore(partnerSlug, storeSlug);
      setStore(storeData);

      // 2. menu
      const menuData = await api.get(
        `/stores/${partnerSlug}/${storeSlug}/menu`
      );

      setMenu(menuData);
    } catch (err) {
      console.error(err);
      setError("Store not found");
    }
  };

  loadData();
}, [partnerSlug, storeSlug]);

  if (error) return <div>{error}</div>;
  if (!store) return <div>Loading...</div>;

  return (
    <div>
      {/* Store base */}
      <StoreGate store={store} />

      {/* MENÚ (primer render real del motor) */}
      <div style={{ padding: 20 }}>
        <h3>Menu</h3>

        {menu.length === 0 ? (
          <div>No products available</div>
        ) : (
          <ul>
            {menu.map((item) => (
              <li key={item.pizzaId}>
                {item.pizza.name} — stock: {item.stock}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}