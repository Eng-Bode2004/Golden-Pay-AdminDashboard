import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth";
import { OfficeApp } from "./OfficeApp";
import "../styles.css";
import "../locale";
import "../premium.css";
import "../points.css";
import "./templates/templates.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OfficeApp />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
