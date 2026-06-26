import React, { useEffect, useMemo, useState } from "react";
import "../styles/Backoffice.css";
import voltaLogo from "../assets/logo/the pizza sale enganine.png";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import InventoryModule from "../components/Backoffice/InventoryModule";
import PizzaCreator from "../components/Backoffice/PizzaCreator";
import PizzaCreatorExtras from "../components/Backoffice/PizzaCreatorExtras";
import SettingsModule from "../components/Backoffice/SettingsModule";
import SettingsDeliveryModule from "../components/Backoffice/SettingsDeliveryModule";
import SettingsBrandingModule from "../components/Backoffice/SettingsBrandingModule";
import SettingsPoliciesModule from "../components/Backoffice/SettingsPoliciesModule";
import SettingsTrackingModule from "../components/Backoffice/SettingsTrackingModule";
import CustomersModule from "../components/Backoffice/CustomersModule";
import CommunicationsPanel from "../components/Backoffice/CommunicationsPanel";
import CouponsModule from "../components/Backoffice/Coupons/CouponsModule";
import BillingModule, { FinanceBillingModule } from "../components/Backoffice/BillingModule";
import MyOrdersModule, { OrdersMovementsModule } from "../components/GlobalManager/MyOrdersModule";
import EngineBackground from "../components/Backoffice/EngineBackground";
import AppFooter from "../components/Layout/AppFooter";
import AdminStoresPage from "./AdminStoresPage";
import ReviewsModule from "../components/Backoffice/ReviewsModule";
import api from "../setupAxios";
import {
  BACKOFFICE_LANGUAGES,
  BACKOFFICE_LANGUAGE_STORAGE_KEY,
  createBackofficeTranslator,
  getInitialBackofficeLanguage,
  normalizeBackofficeLanguage,
} from "../constants/i18n";

const readSavedBackofficeAuth = () => {
  try {
    const saved = localStorage.getItem("volta_backoffice_auth");
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed?.partnerId ? parsed : null;
  } catch {
    localStorage.removeItem("volta_backoffice_auth");
    return null;
  }
};

const normalizeLoginValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const isDemoLoginCredential = (username, password) =>
  username === "prueba1" && password === "prueba1";

const isDemoLinkRequest = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return ["1", "true", "si", "yes"].includes(
    String(params.get("demo") || "").trim().toLowerCase()
  );
};

const createDemoSession = async () => {
  const res = await api.post("/partners/backoffice-demo-session", {
    username: "prueba1",
    password: "prueba1",
  });
  return {
    ...res.data,
    isDemo: true,
  };
};

export default function Backoffice() {
  const initialSmsPaymentStatus = new URLSearchParams(window.location.search).get("sms_payment");
  const [language, setLanguage] = useState(getInitialBackofficeLanguage);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [activeModule, setActiveModule] = useState(initialSmsPaymentStatus ? "customersCommunications" : "inventory");
  const [activeModuleGroup, setActiveModuleGroup] = useState(initialSmsPaymentStatus ? "customers" : "inventory");
  const [expandedModules, setExpandedModules] = useState({
    pizzaCreator: false,
    customers: Boolean(initialSmsPaymentStatus),
    offers: false,
    myorders: false,
    finance: false,
    stores: false,
    settings: false,
  });
  const [auth, setAuth] = useState(readSavedBackofficeAuth);

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authView, setAuthView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("reset") ? "reset" : "login";
  });
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetForm, setResetForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const t = useMemo(() => createBackofficeTranslator(language), [language]);
  const selectedLanguage = useMemo(
    () =>
      BACKOFFICE_LANGUAGES.find((option) => option.code === language) ||
      BACKOFFICE_LANGUAGES[0],
    [language]
  );

  useEffect(() => {
    localStorage.setItem(BACKOFFICE_LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (!isDemoLinkRequest() || auth?.isDemo) return undefined;

    let isActive = true;

    const startDemo = async () => {
      try {
        setLoginLoading(true);
        const session = await createDemoSession();

        if (!isActive) return;

        setAuth(session);
        localStorage.setItem(
          "volta_backoffice_auth",
          JSON.stringify(session)
        );
        setLoginForm({ username: "", password: "" });
        setLoginError("");
      } catch (err) {
        if (!isActive) return;
        console.error("Error starting demo session", err);
        setLoginError(t("auth.demoError"));
      } finally {
        if (isActive) setLoginLoading(false);
      }
    };

    startDemo();

    return () => {
      isActive = false;
    };
  }, [auth?.isDemo, t]);

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

    const username = normalizeLoginValue(loginForm.username);
    const password = String(loginForm.password || "").trim();
    const demoPassword = normalizeLoginValue(password);

    if (!username || !password) {
      setLoginError(t("auth.required"));
      return;
    }

    try {
      setLoginLoading(true);

      if (isDemoLoginCredential(username, demoPassword)) {
        const session = await createDemoSession();

        setAuth(session);
        localStorage.setItem(
          "volta_backoffice_auth",
          JSON.stringify(session)
        );

        setLoginForm({ username: "", password: "" });
        setLoginError("");
        return;
      }

      const loginResponse = await api.post("/partners/backoffice-login", {
        username,
        password,
      });
      const session = loginResponse.data;

      console.log("SESSION:", session);

      setAuth(session);
      localStorage.setItem(
        "volta_backoffice_auth",
        JSON.stringify(session)
      );

      setLoginForm({ username: "", password: "" });
      setLoginError("");
    } catch (err) {
      console.error("Error starting demo session", err);
      const message = isDemoLoginCredential(username, demoPassword) && err.response?.status >= 500
        ? t("auth.demoError")
        : t("auth.invalid");
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const requestPasswordReset = async (event) => {
    event.preventDefault();
    const identifier = resetIdentifier.trim();

    if (!identifier) {
      setResetMessage("Introduce tu usuario o el email de la tienda.");
      return;
    }

    try {
      setLoginLoading(true);
      setResetMessage("");
      await api.post("/partners/backoffice-password/request", { identifier });
      setResetMessage("Si encontramos una cuenta asociada, enviaremos un enlace para restablecer la contrasena.");
    } catch (error) {
      console.error("PASSWORD RESET REQUEST ERROR:", error);
      setResetMessage("No pudimos procesar la solicitud. Intentalo de nuevo.");
    } finally {
      setLoginLoading(false);
    }
  };

  const submitNewPassword = async (event) => {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset") || "";
    const password = resetForm.password.trim();

    if (password.length < 6) {
      setResetMessage("La nueva contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== resetForm.confirmPassword.trim()) {
      setResetMessage("Las contrasenas no coinciden.");
      return;
    }

    try {
      setLoginLoading(true);
      setResetMessage("");
      await api.post("/partners/backoffice-password/reset", { token, password });
      window.history.replaceState(null, "", window.location.pathname);
      setAuthView("login");
      setResetForm({ password: "", confirmPassword: "" });
      setLoginError("Contrasena actualizada. Ya puedes entrar con la nueva contrasena.");
    } catch (error) {
      console.error("PASSWORD RESET ERROR:", error);
      setResetMessage("El enlace no es valido o ha caducado. Solicita uno nuevo.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem("volta_backoffice_auth");
    setActiveModule("inventory");
    setActiveModuleGroup("inventory");
  };

  const handleLanguageChange = (value) => {
    setLanguage(normalizeBackofficeLanguage(value));
    setLanguageMenuOpen(false);
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

  const togglePizzaCreatorSection = () => {
    setExpandedModules((prev) => {
      const nextOpen = !prev.pizzaCreator;

      if (nextOpen) {
        setActiveModule("pizzaCreatorProducts");
        setActiveModuleGroup("pizzaCreator");
      } else if (activeModuleGroup === "pizzaCreator") {
        setActiveModule("inventory");
        setActiveModuleGroup("inventory");
      }

      return {
        ...prev,
        pizzaCreator: nextOpen,
      };
    });
  };

  const isPizzaCreatorProductsActive =
    activeModule === "pizzaCreator" || activeModule === "pizzaCreatorProducts";
  const isPizzaCreatorExtrasActive = activeModule === "pizzaCreatorExtras";
  const isPizzaCreatorGroupActive =
    activeModuleGroup === "pizzaCreator" ||
    isPizzaCreatorProductsActive ||
    isPizzaCreatorExtrasActive;
  const isSettingsOverviewActive = activeModule === "settings";
  const isSettingsPoliciesActive = activeModule === "settingsPolicies";
  const isSettingsDeliveryActive = activeModule === "settingsDelivery";
  const isSettingsBrandingActive = activeModule === "settingsBranding";
  const isSettingsTrackingActive = activeModule === "settingsTracking";
  const isSettingsGroupActive =
    activeModuleGroup === "settings" ||
    isSettingsOverviewActive ||
    isSettingsPoliciesActive ||
    isSettingsDeliveryActive ||
    isSettingsBrandingActive ||
    isSettingsTrackingActive;
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
  const isStoresListActive = activeModule === "stores";
  const isStoresLocationsActive = activeModule === "storesLocations";
  const isStoresReviewsActive = activeModule === "storesReviews";
  const isStoresGroupActive =
    activeModuleGroup === "stores" ||
    isStoresListActive ||
    isStoresLocationsActive ||
    isStoresReviewsActive;

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

          <h1 className="bo-loginTitlePro">{t("auth.title")}</h1>

          <p className="bo-loginSubtitle">
            {authView === "reset"
              ? "Crea una nueva contrasena para tu backoffice."
              : authView === "forgot"
                ? "Te enviaremos un enlace seguro al email asociado a tu tienda."
                : t("auth.subtitle")}
          </p>

          {authView === "forgot" ? (
            <form onSubmit={requestPasswordReset} className="bo-loginForm">
              <div className="bo-inputGroup">
                <input
                  type="text"
                  value={resetIdentifier}
                  onChange={(event) => {
                    setResetIdentifier(event.target.value);
                    setResetMessage("");
                  }}
                  placeholder="Usuario o email"
                />
              </div>

              {resetMessage && <div className="bo-loginErrorPro">{resetMessage}</div>}

              <button type="submit" className="bo-loginBtnPro" disabled={loginLoading}>
                {loginLoading ? "Enviando..." : "Enviar enlace"}
              </button>
              <button
                type="button"
                className="bo-loginLinkBtn"
                onClick={() => {
                  setAuthView("login");
                  setResetMessage("");
                }}
              >
                Volver al login
              </button>
            </form>
          ) : authView === "reset" ? (
            <form onSubmit={submitNewPassword} className="bo-loginForm">
              <div className="bo-inputGroup">
                <input
                  type="password"
                  value={resetForm.password}
                  onChange={(event) =>
                    setResetForm((previous) => ({ ...previous, password: event.target.value }))
                  }
                  placeholder="Nueva contrasena"
                />
              </div>
              <div className="bo-inputGroup">
                <input
                  type="password"
                  value={resetForm.confirmPassword}
                  onChange={(event) =>
                    setResetForm((previous) => ({ ...previous, confirmPassword: event.target.value }))
                  }
                  placeholder="Confirmar contrasena"
                />
              </div>

              {resetMessage && <div className="bo-loginErrorPro">{resetMessage}</div>}

              <button type="submit" className="bo-loginBtnPro" disabled={loginLoading}>
                {loginLoading ? "Guardando..." : "Guardar nueva contrasena"}
              </button>
              <button
                type="button"
                className="bo-loginLinkBtn"
                onClick={() => {
                  window.history.replaceState(null, "", window.location.pathname);
                  setAuthView("login");
                  setResetMessage("");
                }}
              >
                Volver al login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="bo-loginForm">
              <div className="bo-inputGroup">
                <input
                  type="text"
                  name="username"
                  value={loginForm.username}
                  onChange={handleLoginChange}
                  placeholder={t("auth.username")}
                />
              </div>

              <div className="bo-inputGroup bo-passwordGroup">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  placeholder={t("auth.password")}
                />

                <button
                  type="button"
                  className="bo-passwordToggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t("auth.hidePasswordLabel") : t("auth.showPasswordLabel")}
                >
                  {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                </button>
              </div>

              {loginError && (
                <div className="bo-loginErrorPro">
                  {loginError}
                </div>
              )}

              <button type="submit" className="bo-loginBtnPro" disabled={loginLoading}>
                {loginLoading ? t("auth.loading") : t("auth.submit")}
              </button>
              <button
                type="button"
                className="bo-loginLinkBtn"
                onClick={() => {
                  setAuthView("forgot");
                  setLoginError("");
                }}
              >
                No recuerdo la contrasena
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  console.log("AUTH FINAL:", auth);

  return (
    <div className="bo-container">
      <div className="bo-sidebar">
        <div className="bo-sidebarTop">
          <div className="bo-titleBar">
            <div className="bo-title">{t("app.title")}</div>
            <div
              className="bo-languageSelect"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setLanguageMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className="bo-languageButton"
                aria-haspopup="listbox"
                aria-expanded={languageMenuOpen}
                aria-label={t("language.label")}
                onClick={() => setLanguageMenuOpen((open) => !open)}
              >
                <span aria-hidden="true">Aa</span>
                <strong>{selectedLanguage.label}</strong>
              </button>
              {languageMenuOpen && (
                <div className="bo-languageMenu" role="listbox">
                  {BACKOFFICE_LANGUAGES.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      role="option"
                      aria-selected={option.code === language}
                      className={option.code === language ? "is-active" : ""}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleLanguageChange(option.code)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bo-partnerBox">
            <div className="bo-partnerLabel">{t("partner.company")}</div>
            <div className="bo-partnerName">{auth.partnerName}</div>
            {auth.isDemo && <div className="bo-demoBadge">{t("partner.demoMode")}</div>}
          </div>

          <div className="bo-modulesBox">
            <div className="bo-modulesLabel">{t("nav.modules")}</div>

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
                {t("nav.inventory")}
              </button>

              <button
                className={`bo-btn bo-btnAccordion ${
                  isPizzaCreatorGroupActive ? "active" : ""
                } ${
                  expandedModules.pizzaCreator ? "open" : ""
                }`}
                onClick={togglePizzaCreatorSection}
                type="button"
              >
                <span>{t("nav.pizzaCreator")}</span>
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
                    {t("nav.products")}
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
                    {t("nav.extras")}
                  </button>
                </div>
              )}

              <button
                className={`bo-btn bo-btnAccordion ${
                  isStoresGroupActive ? "active" : ""
                } ${
                  expandedModules.stores ? "open" : ""
                }`}
                onClick={() => {
                  setExpandedModules((prev) => {
                    const nextOpen = !prev.stores;

                    if (!nextOpen && activeModuleGroup === "stores") {
                      setActiveModule("inventory");
                      setActiveModuleGroup("inventory");
                    } else if (nextOpen) {
                      setActiveModule("stores");
                      setActiveModuleGroup("stores");
                    }

                    return {
                      ...prev,
                      stores: nextOpen,
                    };
                  });
                }}
                type="button"
              >
                <span>{t("nav.stores")}</span>
                <span className="bo-btnChevron">
                  {expandedModules.stores ? "v" : "^"}
                </span>
              </button>

              {expandedModules.stores && (
                <div
                  className={`bo-subnav ${
                    isStoresGroupActive ? "is-active-group" : ""
                  }`}
                >
                  <button
                    className={`bo-subbtn ${
                      isStoresLocationsActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("storesLocations");
                      setActiveModuleGroup("stores");
                    }}
                    type="button"
                  >
                    {t("nav.locations")}
                  </button>

                  <button
                    className={`bo-subbtn ${
                      isStoresReviewsActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("storesReviews");
                      setActiveModuleGroup("stores");
                    }}
                    type="button"
                  >
                    {t("nav.reviews")}
                  </button>
                </div>
              )}

              <button
                className={`bo-btn bo-btnAccordion ${
                  isCustomersGroupActive ? "active" : ""
                } ${
                  expandedModules.customers ? "open" : ""
                }`}
                onClick={() => toggleModuleSection("customers", "inventory")}
                type="button"
              >
                <span>{t("nav.customers")}</span>
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
                    {t("nav.sms")}
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
                <span>{t("nav.offers")}</span>
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
                      {t("nav.coupons")}
                    </button>
                    <button
                      className={`bo-subbtn ${isOffersPromosActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveModule("offersPromos");
                        setActiveModuleGroup("offers");
                      }}
                      type="button"
                    >
                      {t("nav.promos")}
                    </button>
                    <button
                      className={`bo-subbtn ${isOffersDirectDiscountsActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveModule("offersDirectDiscounts");
                        setActiveModuleGroup("offers");
                      }}
                      type="button"
                    >
                      {t("nav.topDeals")}
                    </button>
                    <button
                      className={`bo-subbtn ${isOffersIncentivesActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveModule("offersIncentives");
                        setActiveModuleGroup("offers");
                      }}
                      type="button"
                    >
                      {t("nav.incentives")}
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
                <span>{t("nav.orders")}</span>
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
                    {t("nav.movements")}
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
                <span>{t("nav.finance")}</span>
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
                    {t("nav.invoices")}
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
                <span>{t("nav.settings")}</span>
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
                      isSettingsPoliciesActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("settingsPolicies");
                      setActiveModuleGroup("settings");
                    }}
                    type="button"
                  >
                    {t("nav.rules")}
                  </button>

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
                    {t("nav.delivery")}
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
                    {t("nav.branding")}
                  </button>

                  <button
                    className={`bo-subbtn ${
                      isSettingsTrackingActive ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveModule("settingsTracking");
                      setActiveModuleGroup("settings");
                    }}
                    type="button"
                  >
                    {t("nav.tracking")}
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
          {t("nav.logout")}
        </button>
      </div>

      <div className="bo-main">
        <div className="bo-workspace">
          {activeModule === "inventory" && auth.storeId && (
            <InventoryModule partner={auth} language={language} />
          )}

          {activeModule === "stores" && auth.partnerId && (
            <AdminStoresPage
              initialPartnerId={String(auth.partnerId)}
              lockPartner
              view="stores"
              language={language}
            />
          )}

          {activeModule === "storesLocations" && auth.partnerId && (
            <AdminStoresPage
              initialPartnerId={String(auth.partnerId)}
              lockPartner
              view="locations"
              language={language}
            />
          )}

          {activeModule === "storesReviews" && auth.partnerId && (
            <ReviewsModule partner={auth} />
          )}

          {activeModule === "customers" && auth.partnerId && (
            <CustomersModule partner={auth} />
          )}

          {activeModule === "customersCommunications" && auth.partnerId && (
            <CommunicationsPanel partnerId={auth.partnerId} />
          )}

          {isPizzaCreatorProductsActive && auth.partnerId && (
            <PizzaCreator partner={auth} language={language} />
          )}

          {activeModule === "pizzaCreatorExtras" && auth.partnerId && (
            <PizzaCreatorExtras partner={auth} language={language} />
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
              onOpenPolicies={() => {
                setExpandedModules((prev) => ({
                  ...prev,
                  settings: true,
                }));
                setActiveModule("settingsPolicies");
                setActiveModuleGroup("settings");
              }}
              onOpenTracking={() => {
                setExpandedModules((prev) => ({
                  ...prev,
                  settings: true,
                }));
                setActiveModule("settingsTracking");
                setActiveModuleGroup("settings");
              }}
            />
          )}

          {activeModule === "settingsPolicies" && auth.partnerId && (
            <SettingsPoliciesModule partner={auth} />
          )}

          {activeModule === "settingsDelivery" && auth.partnerId && (
            <SettingsDeliveryModule partner={auth} />
          )}

          {activeModule === "settingsBranding" && auth.partnerId && (
            <SettingsBrandingModule partner={auth} />
          )}

          {activeModule === "settingsTracking" && auth.partnerId && (
            <SettingsTrackingModule partner={auth} />
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
