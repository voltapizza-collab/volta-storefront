export default function StoreGate({ store }) {
  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      
      <h1 style={{ marginBottom: 20 }}>
        {store.name}
      </h1>

      <button
        style={{
          padding: "16px 28px",
          fontSize: "18px",
          background: "#00f9a7",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        Order Here
      </button>

    </div>
  );
}