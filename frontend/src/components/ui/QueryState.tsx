import { Button } from "./Button";

/** Small non-blocking indicator while a cached query refetches in the background. */
export function QueryRefreshingIndicator({ active }: { active?: boolean }) {
  if (!active) return null;
  return (
    <span className="pg-query-refreshing" role="status" aria-live="polite">
      Refreshing…
    </span>
  );
}

/** Content-area error with optional retry — does not unmount the app shell. */
export function QueryErrorCard({
  message,
  onRetry,
  retrying
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="pg-workspace-card pg-query-error" role="alert">
      <p className="pg-query-error__message">{message}</p>
      {onRetry ? (
        <Button type="button" variant="soft" onClick={onRetry} loading={retrying}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
