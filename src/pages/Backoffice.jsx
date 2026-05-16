import React, { useEffect, useState } from "react";
import "../styles/Backoffice.css";
import voltaLogo from "../assets/logo/the pizza sale enganine.png";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import InventoryModule from "../components/Backoffice/InventoryModule";
import PizzaCreator from "../components/Backoffice/PizzaCreator";
import PizzaCreatorExtras from "../components/Backoffice/PizzaCreatorExtras";
import PizzaCreatorOverview from "../components/Backoffice/PizzaCreatorOverview";
import SettingsModule from "../components/Backoffice/SettingsModule";
import SettingsDeliveryModule from "../components/Backoffice/SettingsDeliveryModule";
import SettingsBrandingModule from "../components/Backoffice/SettingsBrandingModule";
import CustomersModule from "../components/Backoffice/CustomersModule";
import CommunicationsPanel from "../components/Backoffice/CommunicationsPanel";
import CouponsModule from "../components/Backoffice/Coupons/CouponsModule";
import BillingModule, { FinanceBillingModule } from "../components/Backoffice/BillingModule";
import MyOrdersModule, { OrdersMovementsModule } from "../components/GlobalManager/MyOrdersModule";
import EngineBackground from "../components/Backoffice/EngineBackground";
import AppFooter from "../components/Layout/AppFooter";
import AdminStoresPage from "./AdminStoresPage";
import api from "../setupAxios";

export default function Backoffice() {
  const initialSmsPaymentStatus = new URLSearchParams(window.location.search).get("sms_payment");
  const [activeModule, setActiveModule] = useState(initialSmsPaymentStatus ? "customersCommunications" : "inventory");
  const [activeModuleGroup, setActiveModuleGroup] = useState(initialSmsPaymentStatus ? "customers" : "inventory");
  const [expandedModules, setExpandedModules] = useState({
    pizzaCreator: false,
    customers: Boolean(initialSmsPaymentStatus),
    offers: false,
    myorders: false,
    finance: false,
    settings: false,
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

  const toggleModuleSection = (group, fallbackModule) => {
    setExpandedModules((prev) => {
      const nextOpen = !prev[group];

      if (!nextOpen && activeModuleGroup === group) {
        setActiveModule(fallbackModule);
        setActiveModuleGroup(fallbackModule);
      } else if (nextOpen) {
        setActiveModule(group);
        setActiveModuleGroup(group);
      }

      return {
        ...prev,
        [group]: nextOpen,
      };
    });
  };

  const isPizzaCreatorOverviewActive = activeModule === "pizzaCreator";
  const isPizzaCreatorProductsActive = activeModule === "pizzaCreatorProducts";
  const isPizzaCreatorExtrasActive = activeModule === "pizzaCreatorExtras";
  const isPizzaCreatorGroupActive =
    activeModuleGroup === "pizzaCreator" ||
    isPizzaCreatorOverviewActive ||
    isPizzaCreatorProductsActive ||
    isPizzaCreatorExtrasActive;
  const isSettingsOverviewActive = activeModule === "settings";
  const isSettingsDeliveryActive = activeModule === "settingsDelivery";
  const isSettingsBrandingActive = activeModule === "settingsBranding";
  const isSettingsGroupActive =
    activeModuleGroup === "settings" ||
    isSettingsOverviewActive ||
    isSettingsDeliveryActive ||
    isSettingsBrandingActive;
  const isCustomersOverviewActive = activeModule === "customers";
  const isCustomersCommunicationsActive = activeModule === "customersCommunications";
  const isCustomersGroupActive =
    activeModuleGroup === "customers" ||
    isCustomersOverviewActive ||
    isCustomersCommunicationsActive;
  const isOffersOverviewActive = activeModule === "offers";
  const isOffersCreateActive = activeModule === "offersCreate";
  const isOffersPromosActive = activeModule === "offersPromos";
  const isOffersDirectDiscountsActive = activeModule === "offersDirectDiscounts";
  const isOffersIncentivesActive = activeModule === "offersIncentives";
  const isOffersGroupActive =
    activeModuleGroup === "offers" ||
    isOffersOverviewActive ||
    isOffersCreateActive ||
    isOffersPromosActive ||
    isOffersDirectDiscountsActive ||
    isOffersIncentivesActive;
  const isMyOrdersOverviewActive = activeModule === "myorders";
  const isMyOrdersMovementsActive = activeModule === "myordersMovements";
  const isMyOrdersGroupActive =
    activeModuleGroup === "myorders" ||
    isMyOrdersOverviewActive ||
    isMyOrdersMovementsActive;
  const isFinanceOverviewActive = activeModule === "finance";
  const isFinanceBillingActive = activeModule === "financeBilling";
  const isFinanceGroupActive =
    activeModuleGroup === "finance" ||
    isFinanceOverviewActive ||
    isFinanceBillingActive;

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
                Toppings Inventory
              </button>

              <button
                className={`bo-btn bo-btnAccordion ${
                  isPizzaCreatorGroupActive ? "active" : ""
                } ${
                  expandedModules.pizzaCreator ? "open" : ""
                }`}
                onClick={() => toggleModuleSection("pizzaCreator", "inventory")}
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

              <button
                className={`bo-btn ${
                  activeModuleGroup === "stores" ? "active" : ""
                }`}
                onClick={() => {
                  setActiveModule("stores");
                  setActiveModuleGroup("stores");
                }}
                type="button"
              >
                Stores
              </button>

              <button
                className={`bo-btn bo-btnAccordion ${
                  isCustomersGroupActive ? "active" : ""
                } ${
                  expandedModules.customers ? "open" : ""
                }`}
                onClick={() => toggleModuleSection("customers", "inventory")}
                type="button"
              >
                <span>Customers</span>
                <span className="bo-btnChevron">
                  {expandedModules.customers ? "v" : "^"}
                </span>
              </button>

              {expandedModules.customers && (
                <div
                  className={`bo-subnav ${
                    isCustomersGroupActive ? "is-active-group" : ""
                  }`}
                >
                  <button
                    className={`bo-subbtn ${isCustomersCommunicationsActive ? "active" : ""}`}
                    onClick={() => {
                      setActiveModule("customersCommunications");
                      setActiveModuleGroup("customers");
                    }}
                    type="button"
                  >
                    SMS
                  </button>
                </div>
              )}

              <button
                className={`bo-btn bo-btnAccordion ${
                  isOffersGroupActive ? "active" : ""
                } ${
                  expandedModules.offers ? "open" : ""
                }`}
                onClick={() => toggleModuleSection("offers", "inventory")}
                type="button"
              >
                <span>Ofertas</span>
                <span className="bo-btnChevron">
                  {expandedModules.offers ? "v" : "^"}
                </span>
              </button>

              {expandedModules.offers && (
                <div
                  className={`bo-subnav ${
                    isOffersGroupActive ? "is-active-group" : ""
                  }`}
                >
                    <button
                      className={`bo-subbtn ${isOffersCreateActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveModule("offersCreate");
                        setActiveModuleGroup("offers");
                    }}
                    type="button"
                    >
                      Cupones
                    </button>
                    <button
                      className={`bo-subbtn ${isOffersPromosActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveModule("offersPromos");
                        setActiveModuleGroup("offers");
                      }}
                      type="button"
                    >
                      Promos
                    </button>
                    <button
                      className={`bo-subbtn ${isOffersDirectDiscountsActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveModule("offersDirectDiscounts");
                        setActiveModuleGroup("offers");
                      }}
                      type="button"
                    >
                      Top Deals
                    </button>
                    <button
                      className={`bo-subbtn ${isOffersIncentivesActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveModule("offersIncentives");
                        setActiveModuleGroup("offers");
                      }}
                      type="button"
                    >
                      Incentivos
                    </button>
                  </div>
                )}

              <button
                className={`bo-btn bo-btnAccordion ${
                  isMyOrdersGroupActive ? "active" : ""
                } ${
                  expandedModules.myorders ? "open" : ""
                }`}
                onClick={() => toggleModuleSection("myorders", "inventory")}
                type="button"
              >
                <span>My Orders</span>
                <span className="bo-btnChevron">
                  {expandedModules.myorders ? "v" : "^"}
                </span>
              </button>

              {expandedModules.myorders && (
                <div
                  className={`bo-subnav ${
                    isMyOrdersGroupActive ? "is-active-group" : ""
                  }`}
                >
                  <button
                    className={`bo-subbtn ${
                      isMyOrdersMovementsActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("myordersMovements");
                      setActiveModuleGroup("myorders");
                    }}
                    type="button"
                  >
                    Movimientos
                  </button>
                </div>
              )}

              <button
                className={`bo-btn bo-btnAccordion ${
                  isFinanceGroupActive ? "active" : ""
                } ${
                  expandedModules.finance ? "open" : ""
                }`}
                onClick={() => toggleModuleSection("finance", "inventory")}
                type="button"
              >
                <span>Finance</span>
                <span className="bo-btnChevron">
                  {expandedModules.finance ? "v" : "^"}
                </span>
              </button>

              {expandedModules.finance && (
                <div
                  className={`bo-subnav ${
                    isFinanceGroupActive ? "is-active-group" : ""
                  }`}
                >
                  <button
                    className={`bo-subbtn ${
                      isFinanceBillingActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("financeBilling");
                      setActiveModuleGroup("finance");
                    }}
                    type="button"
                  >
                    Facturas
                  </button>
                </div>
              )}

              <button
                className={`bo-btn bo-btnAccordion ${
                  isSettingsGroupActive ? "active" : ""
                } ${
                  expandedModules.settings ? "open" : ""
                }`}
                onClick={() => toggleModuleSection("settings", "inventory")}
                type="button"
              >
                <span>Settings</span>
                <span className="bo-btnChevron">
                  {expandedModules.settings ? "v" : "^"}
                </span>
              </button>

              {expandedModules.settings && (
                <div
                  className={`bo-subnav ${
                    isSettingsGroupActive ? "is-active-group" : ""
                  }`}
                >
                  <button
                    className={`bo-subbtn ${
                      isSettingsDeliveryActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("settingsDelivery");
                      setActiveModuleGroup("settings");
                    }}
                    type="button"
                  >
                    Entregas
                  </button>

                  <button
                    className={`bo-subbtn ${
                      isSettingsBrandingActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("settingsBranding");
                      setActiveModuleGroup("settings");
                    }}
                    type="button"
                  >
                    Personalizacion
                  </button>
                </div>
              )}
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

          {activeModule === "stores" && auth.partnerId && (
            <AdminStoresPage
              initialPartnerId={String(auth.partnerId)}
              lockPartner
            />
          )}

          {activeModule === "customers" && auth.partnerId && (
            <CustomersModule partner={auth} />
          )}

          {activeModule === "customersCommunications" && auth.partnerId && (
            <CommunicationsPanel partnerId={auth.partnerId} />
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

          {activeModule === "settings" && auth.partnerId && (
            <SettingsModule
              partner={auth}
              onOpenDelivery={() => {
                setExpandedModules((prev) => ({
                  ...prev,
                  settings: true,
                }));
                setActiveModule("settingsDelivery");
                setActiveModuleGroup("settings");
              }}
              onOpenBranding={() => {
                setExpandedModules((prev) => ({
                  ...prev,
                  settings: true,
                }));
                setActiveModule("settingsBranding");
                setActiveModuleGroup("settings");
              }}
            />
          )}

          {activeModule === "settingsDelivery" && auth.partnerId && (
            <SettingsDeliveryModule partner={auth} />
          )}

          {activeModule === "settingsBranding" && auth.partnerId && (
            <SettingsBrandingModule partner={auth} />
          )}

          {activeModule === "offers" && auth.partnerId && (
            <CouponsModule partner={auth} initialView="overview" />
          )}

          {activeModule === "offersCreate" && auth.partnerId && (
            <CouponsModule partner={auth} initialView="create" />
          )}

          {activeModule === "offersPromos" && auth.partnerId && (
            <CouponsModule partner={auth} initialView="promos" />
          )}

          {activeModule === "offersDirectDiscounts" && auth.partnerId && (
            <CouponsModule partner={auth} initialView="directDiscounts" />
          )}

          {activeModule === "offersIncentives" && auth.partnerId && (
            <CouponsModule partner={auth} initialView="incentives" />
          )}

          {activeModule === "myorders" && auth.partnerId && (
            <MyOrdersModule partner={auth} />
          )}

          {activeModule === "myordersMovements" && auth.partnerId && (
            <OrdersMovementsModule partner={auth} />
          )}

          {activeModule === "finance" && auth.partnerId && (
            <BillingModule partner={auth} />
          )}

          {activeModule === "financeBilling" && auth.partnerId && (
            <FinanceBillingModule partner={auth} />
          )}

        </div>

        <AppFooter />
      </div>
    </div>
  );
}
