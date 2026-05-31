import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { hasChunkReloadBeenAttempted, isChunkLoadError } from "../../lib/chunkLoadError";
import { formatRouteErrorForDev, isQueryError } from "../../lib/routeErrorUtils";
import { logRouteRenderError } from "../../lib/routeLoadLog";
import { Button } from "./Button";

type Props = {
  children: ReactNode;
  /** Remount boundary when route changes. */
  resetKey?: string;
  routeLabel?: string;
  path?: string;
  locationKey?: string;
  /** Reset TanStack Query errors (from QueryErrorResetBoundary). */
  onReset?: () => void;
};

type State = {
  error: Error | null;
};

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logRouteRenderError({
      routeLabel: this.props.routeLabel,
      path: this.props.path,
      locationKey: this.props.locationKey,
      error,
      componentStack: info.componentStack ?? undefined
    });
  }

  private retry = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (error) {
      const staleDeploy = isChunkLoadError(error) || hasChunkReloadBeenAttempted();
      const devDetails = import.meta.env.DEV ? formatRouteErrorForDev(error) : null;

      return (
        <div className="pg-route-error" role="alert">
          <h1 className="pg-h3" style={{ marginTop: 0 }}>
            This page failed to load
          </h1>
          <p className="pg-muted">
            {staleDeploy
              ? "A new version of Proplytic is available. Reload to continue, or try again if you are offline."
              : "Something went wrong while loading this page. Try again, or reload the app if the problem continues."}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <Button type="button" variant="primary" onClick={this.retry}>
              Try again
            </Button>
            <Button type="button" variant="soft" onClick={this.reload}>
              Reload app
            </Button>
          </div>
          {import.meta.env.DEV && devDetails ? (
            <details style={{ marginTop: 20 }}>
              <summary className="pg-muted" style={{ cursor: "pointer", userSelect: "none" }}>
                Technical details (development only)
              </summary>
              <div
                className="pg-muted"
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  fontSize: 12,
                  fontFamily: "ui-monospace, monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }}
              >
                {`Route: ${this.props.routeLabel ?? "unknown"}\nPath: ${this.props.path ?? "unknown"}\nLocation key: ${this.props.locationKey ?? "unknown"}\nError: ${devDetails.name}: ${devDetails.message}\nChunk load: ${devDetails.isChunkLoad ? "yes" : "no"}\nQuery error: ${isQueryError(error) ? "yes" : "no"}\n\n${devDetails.stack ?? ""}`}
              </div>
            </details>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
