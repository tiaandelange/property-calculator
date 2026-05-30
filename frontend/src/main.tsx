import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { App } from "./router/App";
import { AuthProvider } from "./contexts/AuthContext";
import { AppQueryProvider } from "./providers/AppQueryProvider";
import { RouteErrorBoundary } from "./components/ui/RouteErrorBoundary";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouteErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <AppQueryProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </AppQueryProvider>
        </BrowserRouter>
      </HelmetProvider>
    </RouteErrorBoundary>
  </React.StrictMode>
);
