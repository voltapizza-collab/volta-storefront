import React, { useEffect, useState } from "react";
import "../styles/Backoffice.css";
import voltaLogo from "../assets/logo/the pizza sale enganine.png";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import InventoryModule from "../components/Backoffice/InventoryModule";
import EngineBackground from "../components/Backoffice/EngineBackground";
import AppFooter from "../components/Layout/AppFooter";
import api from "../setupAxios";

export default function Backoffice() {
  const [activeModule, setActiveModule] = useState("inventory");
  const [partners, setPartners] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(true);

  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("volta_backoffice_auth");
    return saved ? JSON.parse(saved) : null;
  });

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [loginError, setLoginError] = useState("");

  // 🔥 LOAD PARTNERS
  useEffect(() => {
    const loadPartners = async () => {
      try {
        const res = await api.get("/partners");
        setPartners(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error loading partners", err);
      } finally {
        setLoadingPartners(false);
      }
    };

    loadPartners();
  }, []);

  // 🔥 REHIDRATAR storeId SI FALTA
  useEffect(() => {
    const hydrateStore = async () => {
      if (!auth?.partnerId || auth?.storeId) return;

      try {
        const res = await api.get(`/stores?partnerId=${auth.partnerId}`);
        const store = Array.isArray(res.data) ? res.data[0] : null;

        if (!store) return;

        const updated = {
          ...auth,
          storeId: store.id,
        };

        console.log("REHYDRATED AUTH:", updated);

        setAuth(updated);
        localStorage.setItem(
          "volta_backoffice_auth",
          JSON.stringify(updated)
        );
      } catch (err) {
        console.error("Error hydrating store", err);
      }
    };

    hydrateStore();
  }, [auth]);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLoginError("");
  };

  // 🔥 LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();

    const username = loginForm.username.trim().toLowerCase();
    const password = loginForm.password.trim().toLowerCase();

    if (!username || !password) {
      setLoginError("Debes introducir usuario y contraseña.");
      return;
    }

    const partner = partners.find((p) => {
      const slug = (p.slug || "").trim().toLowerCase();
      return slug === username && slug === password;
    });

    if (!partner) {
      setLoginError("Credenciales inválidas.");
      return;
    }

    try {
      const res = await api.get(`/stores?partnerId=${partner.id}`);
      const store = Array.isArray(res.data) ? res.data[0] : null;

      const session = {
        partnerId: partner.id,
        storeId: store?.id,
        partnerName: partner.name,
        partnerSlug: partner.slug,
      };

      console.log("SESSION:", session);

      setAuth(session);
      localStorage.setItem(
        "volta_backoffice_auth",
        JSON.stringify(session)
      );

      setLoginForm({ username: "", password: "" });
      setLoginError("");
    } catch (err) {
      console.error("Error fetching store", err);
      setLoginError("Error obteniendo store.");
    }
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem("volta_backoffice_auth");
    setActiveModule("inventory");
  };

  if (loadingPartners) {
    return (
      <div className="bo-container">
        <div className="bo-main">
          <div className="bo-workspace">
            <div className="bo-loginCard">
              <h2 className="bo-loginTitle">Cargando acceso...</h2>
            </div>
          </div>
          <AppFooter />
        </div>
      </div>
    );
  }

if (!auth) {
  return (
    <div className="bo-loginScreen">

      <EngineBackground />

      <PizzaBg className="bo-bgPizza" />

      <div className="bo-loginCardPro">

        <img
          src={voltaLogo}
          alt="Volta System"
          className="bo-loginLogo"
        />

        <h1 className="bo-loginTitlePro">Backoffice</h1>

        <p className="bo-loginSubtitle">
          Accede con tu partner slug
        </p>

        <form onSubmit={handleLogin} className="bo-loginForm">

          <div className="bo-inputGroup">
            <input
              type="text"
              name="username"
              value={loginForm.username}
              onChange={handleLoginChange}
              placeholder="Usuario"
            />
          </div>

          <div className="bo-inputGroup">
            <input
              type="password"
              name="password"
              value={loginForm.password}
              onChange={handleLoginChange}
              placeholder="Contraseña"
            />
          </div>

          {loginError && (
            <div className="bo-loginErrorPro">
              {loginError}
            </div>
          )}

          <button type="submit" className="bo-loginBtnPro">
            Entrar
          </button>

        </form>

      </div>

    </div>
  );
}

  console.log("AUTH FINAL:", auth);

  return (
    <div className="bo-container">

      <div className="bo-sidebar">
        <div className="bo-title">Volta — Backoffice</div>

        <div className="bo-partnerBox">
          <div className="bo-partnerLabel">Partner</div>
          <div className="bo-partnerName">{auth.partnerName}</div>
          <div className="bo-partnerSlug">@{auth.partnerSlug}</div>
        </div>

        <div className="bo-nav">
          <button
            className={`bo-btn ${activeModule === "inventory" ? "active" : ""}`}
            onClick={() => setActiveModule("inventory")}
          >
            Inventory
          </button>

          <button className="bo-btn" disabled>Pizzas</button>
          <button className="bo-btn" disabled>Offers</button>
        </div>

        <button className="bo-logoutBtn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="bo-main">
        <div className="bo-workspace">
          {activeModule === "inventory" && auth.storeId && (
            <InventoryModule partner={auth} />
          )}
        </div>

        <AppFooter />
      </div>

    </div>
  );
}