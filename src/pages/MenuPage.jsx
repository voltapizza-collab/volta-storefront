
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";

export default function MenuPage() {
  const { partnerSlug, storeSlug } = useParams();

  const [menu, setMenu] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const data = await api.get(
          `/stores/${partnerSlug}/${storeSlug}/menu`
        );
        setMenu(data);
      } catch (err) {
        console.error(err);
        setError("Error loading menu");
      }
    };

    loadMenu();
  }, [partnerSlug, storeSlug]);

  if (error) return <div>{error}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Menu</h2>

      {menu.length === 0 ? (
        <div>No products available</div>
      ) : (
        <ul>
          {menu.map((item) => (
            <li key={item.pizzaId}>
              {item.pizza?.name} — stock: {item.stock}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}