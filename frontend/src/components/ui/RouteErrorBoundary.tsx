import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { hasChunkReloadBeenAttempted, isChunkLoadError } from "../../lib/chunkLoadError";
import { logRouteRenderError } from "../../lib/routeLoadLog";
import { Button } from "./Button";

type Props = {
  children: ReactNode;
  /** Remount boundary when route changes. */
  resetKey?: string;
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
    logRouteRenderError(error, info.componentStack ?? undefined);
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
        </div>
      );
    }

    return this.props.children;
  }
}
