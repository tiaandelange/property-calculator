import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

type Props = {
  children: ReactNode;
  /** Remount boundary when route changes. */
  resetKey?: string;
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
    console.error("[RouteErrorBoundary]", error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="pg-route-error" role="alert">
          <h1 className="pg-h3" style={{ marginTop: 0 }}>
            This page could not be loaded
          </h1>
          <p className="pg-muted">
            A temporary loading error occurred. Try again, or refresh the page if the problem continues.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <Button type="button" variant="primary" onClick={this.retry}>
              Try again
            </Button>
            <Button type="button" variant="soft" onClick={this.reload}>
              Refresh page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
