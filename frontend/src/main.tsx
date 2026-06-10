import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { App } from "./router/App";
import { AuthProvider } from "./contexts/AuthContext";
import { AppQueryProvider } from "./providers/AppQueryProvider";
import { RouteErrorBoundary } from "./components/ui/RouteErrorBoundary";
import {
  hasChunkReloadBeenAttempted,
  markChunkReloadAttempted
} from "./lib/chunkLoadError";
import { logChunkLoadFailure } from "./lib/routeLoadLog";
import { initGoogleTagManager } from "./lib/analytics/gtm";
import { AnalyticsRouteTracker } from "./lib/analytics/AnalyticsRouteTracker";
import { CookieConsentBanner } from "./components/consent/CookieConsentBanner";
import "./styles/global.css";

initGoogleTagManager();

// Stale chunk after deploy — one safe reload attempt, then route error boundary handles it.
window.addEventListener("vite:preloadError", (event: Event) => {
  event.preventDefault();
  const preloadError = (event as CustomEvent<unknown>).detail ?? event;
  logChunkLoadFailure("vite:preloadError", preloadError);

  if (!hasChunkReloadBeenAttempted()) {
    markChunkReloadAttempted();
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouteErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <AnalyticsRouteTracker />
          <AppQueryProvider>
            <AuthProvider>
              <App />
              <CookieConsentBanner />
            </AuthProvider>
          </AppQueryProvider>
        </BrowserRouter>
      </HelmetProvider>
    </RouteErrorBoundary>
  </React.StrictMode>
);
