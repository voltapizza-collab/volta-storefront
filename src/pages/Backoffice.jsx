import React, { useEffect, useState } from "react";
import "../styles/Backoffice.css";
import voltaLogo from "../assets/logo/the pizza sale enganine.png";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import InventoryModule from "../components/Backoffice/InventoryModule";
import PizzaCreator from "../components/Backoffice/PizzaCreator";
import PizzaCreatorExtras from "../components/Backoffice/PizzaCreatorExtras";
import PizzaCreatorOverview from "../components/Backoffice/PizzaCreatorOverview";
import EngineBackground from "../components/Backoffice/EngineBackground";
import AppFooter from "../components/Layout/AppFooter";
import api from "../setupAxios";

export default function Backoffice() {
  const [activeModule, setActiveModule] = useState("inventory");
  const [activeModuleGroup, setActiveModuleGroup] = useState("inventory");
  const [expandedModules, setExpandedModules] = useState({
    pizzaCreator: false,
    offers: false,
  });
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
  const [showPassword, setShowPassword] = useState(false);

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

  const handleLogin = async (e) => {
    e.preventDefault();

    const username = loginForm.username.trim().toLowerCase();
    const password = loginForm.password.trim().toLowerCase();

    if (!username || !password) {
      setLoginError("Debes introducir usuario y contrasena.");
      return;
    }

    const partner = partners.find((p) => {
      const slug = (p.slug || "").trim().toLowerCase();
      return slug === username && slug === password;
    });

    if (!partner) {
      setLoginError("Credenciales invalidas.");
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
    setActiveModuleGroup("inventory");
  };

  const toggleModuleGroup = (group) => {
    setExpandedModules((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
    setActiveModuleGroup(group);
  };

  const isPizzaCreatorOverviewActive = activeModule === "pizzaCreator";
  const isPizzaCreatorProductsActive = activeModule === "pizzaCreatorProducts";
  const isPizzaCreatorExtrasActive = activeModule === "pizzaCreatorExtras";
  const isPizzaCreatorGroupActive =
    activeModuleGroup === "pizzaCreator" ||
    isPizzaCreatorOverviewActive ||
    isPizzaCreatorProductsActive ||
    isPizzaCreatorExtrasActive;

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
        <div className="engine-lines"></div>
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

            <div className="bo-inputGroup bo-passwordGroup">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                placeholder="Contrasena"
              />

              <button
                type="button"
                className="bo-passwordToggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
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
        <div className="bo-sidebarTop">
          <div className="bo-title">Volta - Backoffice</div>

          <div className="bo-partnerBox">
            <div className="bo-partnerLabel">Empresa</div>
            <div className="bo-partnerName">{auth.partnerName}</div>
          </div>

          <div className="bo-modulesBox">
            <div className="bo-modulesLabel">Modules</div>

            <div className="bo-nav">
              <button
                className={`bo-btn ${
                  activeModuleGroup === "inventory" ? "active" : ""
                }`}
                onClick={() => {
                  setActiveModule("inventory");
                  setActiveModuleGroup("inventory");
                }}
                type="button"
              >
                Inventory
              </button>

              <button
                className={`bo-btn bo-btnAccordion ${
                  isPizzaCreatorGroupActive ? "active" : ""
                } ${
                  expandedModules.pizzaCreator ? "open" : ""
                }`}
                onClick={() => {
                  setExpandedModules((prev) => ({
                    ...prev,
                    pizzaCreator: true,
                  }));
                  setActiveModule("pizzaCreator");
                  setActiveModuleGroup("pizzaCreator");
                }}
                type="button"
              >
                <span>Pizza Creator</span>
                <span className="bo-btnChevron">
                  {expandedModules.pizzaCreator ? "v" : "^"}
                </span>
              </button>

              {expandedModules.pizzaCreator && (
                <div
                  className={`bo-subnav ${
                    isPizzaCreatorGroupActive ? "is-active-group" : ""
                  }`}
                >
                  <button
                    className={`bo-subbtn ${
                      isPizzaCreatorProductsActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("pizzaCreatorProducts");
                      setActiveModuleGroup("pizzaCreator");
                    }}
                    type="button"
                  >
                    Productos
                  </button>

                  <button
                    className={`bo-subbtn ${
                      isPizzaCreatorExtrasActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("pizzaCreatorExtras");
                      setActiveModuleGroup("pizzaCreator");
                    }}
                    type="button"
                  >
                    Extras
                  </button>
                </div>
              )}

              <button className="bo-btn" disabled type="button">
                Stores
              </button>

              <button className="bo-btn" disabled type="button">
                Customers
              </button>

              <button
                className={`bo-btn bo-btnAccordion ${
                  expandedModules.offers ? "open" : ""
                }`}
                onClick={() => toggleModuleGroup("offers")}
                type="button"
              >
                <span>Ofertas</span>
                <span className="bo-btnChevron">
                  {expandedModules.offers ? "v" : "^"}
                </span>
              </button>

              {expandedModules.offers && (
                <div className="bo-subnav">
                  <button className="bo-subbtn" disabled type="button">
                    Enviar SMS
                  </button>

                  <button className="bo-subbtn" disabled type="button">
                    Crear Ofertas
                  </button>

                  <button className="bo-subbtn" disabled type="button">
                    Incentivos
                  </button>
                </div>
              )}

              <button className="bo-btn" disabled type="button">
                My Orders
              </button>

              <button className="bo-btn" disabled type="button">
                Settings
              </button>
            </div>
          </div>
        </div>

        <button
          className="bo-logoutBtn"
          onClick={handleLogout}
          type="button"
        >
          Logout
        </button>
      </div>

      <div className="bo-main">
        <div className="bo-workspace">
          {activeModule === "inventory" && auth.storeId && (
            <InventoryModule partner={auth} />
          )}

          {activeModule === "pizzaCreator" && auth.partnerId && (
            <PizzaCreatorOverview
              partner={auth}
              onOpenProducts={() => {
                setExpandedModules((prev) => ({
                  ...prev,
                  pizzaCreator: true,
                }));
                setActiveModule("pizzaCreatorProducts");
                setActiveModuleGroup("pizzaCreator");
              }}
            />
          )}

          {activeModule === "pizzaCreatorProducts" && auth.partnerId && (
            <PizzaCreator partner={auth} />
          )}

          {activeModule === "pizzaCreatorExtras" && auth.partnerId && (
            <PizzaCreatorExtras partner={auth} />
          )}
        </div>

        <AppFooter />
      </div>
    </div>
  );
}
