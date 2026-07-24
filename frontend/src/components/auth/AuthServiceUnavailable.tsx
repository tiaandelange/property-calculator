import { useState } from "react";
import { Button, ButtonLink } from "../ui/Button";
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from "../../lib/authBackendAvailability";
import { useAuth } from "../../contexts/AuthContext";

type AuthServiceUnavailableProps = {
  message?: string;
};

/**
 * Inline unavailable state for sign-in / join pages when Supabase cannot be reached.
 * Keeps the auth page shell rendered — no full-page spinner.
 */
export function AuthServiceUnavailable({
  message = AUTH_SERVICE_UNAVAILABLE_MESSAGE
}: AuthServiceUnavailableProps) {
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
    <div
      className="pg-login-card__alert pg-login-card__alert--error"
      role="alert"
      data-testid="auth-service-unavailable"
    >
      <p style={{ margin: "0 0 12px" }}>{message}</p>
      <div className="pg-empty-actions" style={{ justifyContent: "flex-start" }}>
        <Button type="button" variant="soft" onClick={() => void onRetry()} loading={retrying}>
          Retry
        </Button>
        <ButtonLink href="/" variant="ghost">
          Back to homepage
        </ButtonLink>
      </div>
    </div>
  );
}
