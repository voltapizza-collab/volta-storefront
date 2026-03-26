import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStore } from "../services/api";
import StoreGate from "../components/StoreGate";

export default function StorePage() {
  const { slug } = useParams();

  const [store, setStore] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    getStore(slug)
      .then(setStore)
      .catch((err) => {
        console.error(err);
        setError("Store not found");
      });
  }, [slug]);

  if (error) return <div>{error}</div>;
  if (!store) return <div>Loading...</div>;

  return <StoreGate store={store} />;
}