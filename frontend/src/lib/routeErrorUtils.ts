import { isChunkLoadError } from "./chunkLoadError";

export type RouteErrorContext = {
  routeLabel?: string;
  path?: string;
  locationKey?: string;
  error: unknown;
  componentStack?: string;
};

export function isQueryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name.includes("query") ||
    message.includes("query") ||
    message.includes("queryclient") ||
    message.includes("query data")
  );
}

export function formatRouteErrorForDev(error: unknown): {
  name: string;
  message: string;
  stack?: string;
  isChunkLoad: boolean;
  isQueryError: boolean;
} {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    isChunkLoad: isChunkLoadError(err),
    isQueryError: isQueryError(err)
  };
}
