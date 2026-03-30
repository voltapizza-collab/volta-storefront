export default function StoreGate({ store }) {
  const handleOrder = () => {
    alert("Aquí empieza el motor de pedidos 🔥");
    // luego aquí redirigiremos a /menu o checkout
  };

  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>

      {/* <h2 style={{ marginBottom: 10 }}>
        {store.partner?.name}
      </h2> */}

      <h1 style={{ marginBottom: 10 }}>
        {store.name}
      </h1>

      <p style={{ marginBottom: 30, color: "#666" }}>
        {store.city}, {store.country}
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