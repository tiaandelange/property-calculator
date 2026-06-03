import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons/AppIcon";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { SignupPlanSummary } from "../signup/SignupPlanSummary";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import { LoginIconField } from "./LoginIconField";

type LoginSignupCardProps = {
  email: string;
  password: string;
  loading: boolean;
  message: { kind: "ok" | "error"; text: string } | null;
  configHint: React.ReactNode;
  plan: SubscriptionPlanRecord;
  invalidRequested: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function LoginSignupCard({
  email,
  password,
  loading,
  message,
  configHint,
  plan,
  invalidRequested,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: LoginSignupCardProps) {
  return (
    <div className="pg-login-card">
      <header className="pg-login-card__header">
        <h1 className="pg-login-card__title">Create your account</h1>
        <p className="pg-login-card__subtitle">
          Complete registration to start using Proplytic. Billing is not charged during signup.
        </p>
      </header>

      <SignupPlanSummary plan={plan} invalidRequested={invalidRequested} />

      {configHint}

      {message ? (
        <div
          className={`pg-login-card__alert ${message.kind === "error" ? "pg-login-card__alert--error" : "pg-login-card__alert--ok"}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      ) : null}

      <form
        className="pg-login-card__form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <LoginIconField label="Email address" icon="email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
            className="pg-login-input"
            required
          />
        </LoginIconField>

        <LoginIconField label="Password" icon="lock">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="••••••••"
            className="pg-login-input"
            required
          />
        </LoginIconField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          className="pg-login-card__submit"
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="pg-login-card__signup-actions">
        <ButtonLink href="/pricing" variant="ghost" size="md">
          View pricing
        </ButtonLink>
        <p className="pg-login-card__signup">
          Already have an account?{" "}
          <Link to="/login" className="pg-login-card__signup-link">
            Sign in
          </Link>
        </p>
      </div>

      <div className="pg-login-card__secure">
        <span className="pg-login-card__secure-icon" aria-hidden="true">
          <AppIcon name="shield" size="sm" />
        </span>
        <p>
          <strong>Your data is secure and private.</strong>
          <span>We never share your information.</span>
        </p>
      </div>
    </div>
  );
}
