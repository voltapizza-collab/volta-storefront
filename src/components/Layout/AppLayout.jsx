import React from "react";
import AppFooter from "./AppFooter";

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <div className="app-content">
        {children}
      </div>


    </div>
  );
}