import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";
import "./styles/theme.css";

const redirectHost = window.location.hostname.toLowerCase();
const hostRedirects = {
  "mycrushpizza.com": "https://voltapizza.com/mycrushpizza",
  "www.mycrushpizza.com": "https://voltapizza.com/mycrushpizza",
  "juego.mycrushpizza.com": "https://voltapizza.com/mycrushpizza/coupons",
};

if (hostRedirects[redirectHost]) {
  window.location.replace(
    `${hostRedirects[redirectHost]}${window.location.search}${window.location.hash}`
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
