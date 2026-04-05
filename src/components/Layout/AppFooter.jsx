import React, { useEffect, useState } from "react";
import api from "../../setupAxios";

export default function AppFooter() {
  const [status, setStatus] = useState("Checking...");
  const version = "v0.1";

  useEffect(() => {
    api.get("/")
      .then(() => setStatus("Connected"))
      .catch(() => setStatus("Offline"));
  }, []);

  return (
    <div className="app-footer">
      <span>Volta Pizza System — {version}</span>
      <span>{status}</span>
    </div>
  );
}