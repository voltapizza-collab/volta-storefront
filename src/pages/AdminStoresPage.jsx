import { useEffect, useState } from "react";
import api from "../services/api";

const DEFAULT_PARTNER_ID = 1;

export default function AdminStoresPage() {
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    partnerId: DEFAULT_PARTNER_ID,
  });

  const loadStores = async () => {
    try {
      const res = await api.get("/stores");
      setStores(res.data);
    } catch (err) {
      console.error("Error loading stores", err);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleCreate = async () => {
    try {
      await api.post("/stores", {
        ...form,
        partnerId: DEFAULT_PARTNER_ID,
      });

      setForm({
        name: "",
        slug: "",
        partnerId: DEFAULT_PARTNER_ID,
      });

      loadStores();
    } catch (err) {
      console.error("Error creating store", err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin - Stores</h2>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <button onClick={handleCreate}>Create</button>
      </div>

      {/* LIST */}
      <ul>
        {stores.map((s) => (
          <li key={s.id}>
            {s.name} — {s.slug} — {s.active ? "🟢" : "🔴"}
          </li>
        ))}
      </ul>
    </div>
  );
}