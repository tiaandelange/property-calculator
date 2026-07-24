import { useState } from "react";
import { Button, ButtonLink } from "../ui/Button";
import { BACKEND_UNAVAILABLE_MESSAGE } from "../../lib/authBackendAvailability";
import { useAuth } from "../../contexts/AuthContext";

type BackendUnavailableProps = {
  /** Override the default protected-route message. */
  message?: string;
  /** Show a link back to the public homepage (default true). */
  showHomeLink?: boolean;
};

/**
 * Controlled error state for protected routes when Supabase is unreachable.
 * Never used as a global app shell gate — public pages must remain available.
 */
export function BackendUnavailable({
  message = BACKEND_UNAVAILABLE_MESSAGE,
  showHomeLink = true
}: BackendUnavailableProps) {
  const { retryConnection } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const onRetry = async () => {
    setRetrying(true);
    try {
      await retryConnection();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="pg-empty-state" role="alert" data-testid="backend-unavailable">
      <h2>Account services unavailable</h2>
      <p>{message}</p>
      <div className="pg-empty-actions">
        <Button type="button" variant="primary" onClick={() => void onRetry()} loading={retrying}>
          Retry connection
        </Button>
        {showHomeLink ? (
          <ButtonLink href="/" variant="soft">
            Back to homepage
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
