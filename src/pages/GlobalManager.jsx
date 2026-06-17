import React, { useState } from "react";
import "../styles/GlobalManager.css";


// módulos
import IngredientsModule from "../components/GlobalManager/IngredientsModule";
import CategoriesModule from "../components/GlobalManager/CategoriesModule";
import SmsCreditsModule from "../components/GlobalManager/SmsCreditsModule";
import MyOrdersModule from "../components/GlobalManager/MyOrdersModule";
import BoostSettingsModule from "../components/GlobalManager/BoostSettingsModule";
import OnboardingModule from "../components/GlobalManager/OnboardingModule";
import PartnersModule from "../components/GlobalManager/PartnersModule";

// footer global
import AppFooter from "../components/Layout/AppFooter";

export default function GlobalManager() {
  const [activeModule, setActiveModule] = useState("myorders");

  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("volta_gm_auth");
    return saved ? JSON.parse(saved) : null;
  });

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [loginError, setLoginError] = useState("");

  // 🔥 HANDLE INPUT
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLoginError("");
  };

  // 🔥 LOGIN (HARDCODED)
  const handleLogin = (e) => {
    e.preventDefault();

    const username = loginForm.username.trim();
    const password = loginForm.password.trim();

    if (username !== "admin" || password !== "7676") {
      setLoginError("Credenciales inválidas.");
      return;
    }

    const session = {
      role: "global_admin",
    };

    setAuth(session);
    localStorage.setItem("volta_gm_auth", JSON.stringify(session));

    setLoginForm({ username: "", password: "" });
    setLoginError("");
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem("volta_gm_auth");
    setActiveModule("myorders");
  };

  // 🔥 LOGIN SCREEN
  if (!auth) {
    return (
      <div className="gm-loginScreen">

        {/* FONDO (puedes reutilizar la pizza si quieres) */}
        <div className="gm-bgPizza" />

<div className="gm-loginCard">

  <h1 className="gm-loginTitle">
    Global Manager
  </h1>

  <form onSubmit={handleLogin} className="gm-loginForm">

    <input
      type="text"
      name="username"
      value={loginForm.username}
      onChange={handleLoginChange}
      placeholder="user"
      className="gm-input"
    />

    <input
      type="password"
      name="password"
      value={loginForm.password}
      onChange={handleLoginChange}
      placeholder="password"
      className="gm-input"
    />

    {loginError && (
      <div className="gm-loginError">
        {loginError}
      </div>
    )}

    <button type="submit" className="gm-loginBtn">
      enter
    </button>

  </form>

</div>
      </div>
    );
  }

  // 🔥 APP
  return (
    <div className="gm-container">

      {/* SIDEBAR */}
      <div className="gm-sidebar">

        <div className="gm-title">
          Volta — Global Manager
        </div>

        <div className="gm-nav">

          <button
            className={`gm-btn ${
              activeModule === "myorders" ? "active" : ""
            }`}
            onClick={() => setActiveModule("myorders")}
          >
            My Orders
          </button>

          <button
            className={`gm-btn ${
              activeModule === "ingredients" ? "active" : ""
            }`}
            onClick={() => setActiveModule("ingredients")}
          >
            Ingredients
          </button>

          <button
            className={`gm-btn ${
              activeModule === "categories" ? "active" : ""
            }`}
            onClick={() => setActiveModule("categories")}
          >
            Categories
          </button>

          <button
            className={`gm-btn ${
              activeModule === "smsCredits" ? "active" : ""
            }`}
            onClick={() => setActiveModule("smsCredits")}
          >
            SMS Credits
          </button>

          <button
            className={`gm-btn ${
              activeModule === "boostSettings" ? "active" : ""
            }`}
            onClick={() => setActiveModule("boostSettings")}
          >
            Boost
          </button>

          <button
            className={`gm-btn ${
              activeModule === "onboarding" ? "active" : ""
            }`}
            onClick={() => setActiveModule("onboarding")}
          >
            Onboarding
          </button>

          <button
            className={`gm-btn ${
              activeModule === "partners" ? "active" : ""
            }`}
            onClick={() => setActiveModule("partners")}
          >
            Partners
          </button>

          <button className="gm-btn" disabled>
            Analytics
          </button>

        </div>

        <button className="gm-logoutBtn" onClick={handleLogout}>
          Logout
        </button>

      </div>

      {/* MAIN */}
      <div className="gm-main">

        <div className="gm-workspace">
          {activeModule === "myorders" && <MyOrdersModule />}
          {activeModule === "ingredients" && <IngredientsModule />}
          {activeModule === "categories" && <CategoriesModule />}
          {activeModule === "smsCredits" && <SmsCreditsModule />}
          {activeModule === "boostSettings" && <BoostSettingsModule />}
          {activeModule === "onboarding" && <OnboardingModule />}
          {activeModule === "partners" && <PartnersModule />}

          {!["myorders", "ingredients", "categories", "smsCredits", "boostSettings", "onboarding", "partners"].includes(activeModule) && (
            <div style={{ opacity: 0.6 }}>
              Module not implemented yet
            </div>
          )}
        </div>

        <AppFooter />

      </div>
    </div>
  );
}
