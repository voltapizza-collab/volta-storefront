import { useNavigate } from "react-router-dom";

export default function StoreGate({ store }) {
  const navigate = useNavigate();

  const handleOrder = () => {
    navigate(`/${store.partner.slug}/${store.slug}/menu`);
  };

  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>

      <h1 style={{ marginBottom: 10 }}>
        {store.storeName}
      </h1>

      <p style={{ marginBottom: 30, color: "#666" }}>
        {store.city || ""} {store.city ? "," : ""} {store.partner?.country || ""}
      </p>

      <button
        onClick={handleOrder}
        style={{
          padding: "18px 32px",
          fontSize: "18px",
          background: "#00f9a7",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        Order Here
      </button>

    </div>
  );
}