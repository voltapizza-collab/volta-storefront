import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStore } from "../services/api";
import StoreGate from "../components/StoreGate";

export default function StorePage() {
  const { partnerSlug, storeSlug } = useParams();

  const [store, setStore] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!partnerSlug || !storeSlug) return;

    const loadStore = async () => {
      try {
        const data = await getStore(partnerSlug, storeSlug);
        setStore(data);
      } catch (err) {
        console.error(err);
        setError("Store not found");
      }
    };

    loadStore();
  }, [partnerSlug, storeSlug]);

  if (error) return <div>{error}</div>;
  if (!store) return <div>Loading...</div>;

  return <StoreGate store={store} />;
}