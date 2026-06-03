import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons/AppIcon";
import { Button } from "../../components/ui/Button";
import { LoginIconField } from "./LoginIconField";

type LoginSignInCardProps = {
  email: string;
  password: string;
  loading: boolean;
  message: { kind: "ok" | "error"; text: string } | null;
  configHint: ReactNode;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function LoginSignInCard({
  email,
  password,
  loading,
  message,
  configHint,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: LoginSignInCardProps) {
  return (
    <div className="pg-login-card pg-login-card--signin">
      <div className="pg-login-card__stack">
      <header className="pg-login-card__header">
        <h1 className="pg-login-card__title">Welcome back 👋</h1>
        <p className="pg-login-card__subtitle">Sign in to your Proplytic account</p>
      </header>

      {configHint}

      {message?.kind === "error" ? (
        <div className="pg-login-card__alert pg-login-card__alert--error" role="alert">
          {message.text}
        </div>
      ) : null}
      {message?.kind === "ok" ? (
        <div className="pg-login-card__alert pg-login-card__alert--ok" role="status">
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
        <LoginIconField
          label="Email address"
          icon="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={onEmailChange}
          placeholder="you@example.com"
          required
        />

        <LoginIconField
          label="Password"
          icon="lock"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={onPasswordChange}
          placeholder="••••••••"
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          className="pg-login-card__submit"
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="pg-login-card__signup">
        Don&apos;t have an account?{" "}
        <Link to="/signup?plan=starter" className="pg-login-card__signup-link">
          Join free
        </Link>
      </p>

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
    </div>
  );
}
