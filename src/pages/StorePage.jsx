import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStore } from "../services/api";
import StoreGate from "../components/StoreGate";

export default function StorePage() {
  const { slug } = useParams();
  const [store, setStore] = useState(null);

  useEffect(() => {
    if (!slug) return;

    getStore(slug)
      .then(setStore)
      .catch(console.error);
  }, [slug]);

  if (!store) return <div>Loading...</div>;

  return <StoreGate store={store} />;
}