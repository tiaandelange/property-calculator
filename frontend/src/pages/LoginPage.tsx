import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { getConfirmEmailRedirectUrl } from "../lib/authRedirect";
import { formatAuthError } from "../utils/authErrors";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, initializing } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "login" | "register">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (initializing || !session) return;
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from.startsWith("/calculators/")) {
      navigate(from, { replace: true });
      return;
    }
    if (from && from !== "/login" && from !== "/") {
      navigate(from, { replace: true });
      return;
    }
    navigate("/owned-properties/dashboard", { replace: true });
  }, [session, initializing, location.state, navigate]);

  const submit = async (mode: "login" | "register") => {
    setLoading(mode);
    setMessage(null);
    if (!isSupabaseConfigured) {
      setMessage({
        kind: "error",
        text: "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.local (see frontend/.env.example)."
      });
      setLoading(null);
      return;
    }

    const sb = getSupabase();

    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setMessage({ kind: "error", text: formatAuthError(error) });
          return;
        }
        setMessage({ kind: "ok", text: "Signed in successfully." });
        return;
      }

      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getConfirmEmailRedirectUrl()
        }
      });
      if (error) {
        setMessage({ kind: "error", text: formatAuthError(error) });
        return;
      }

      if (data.session) {
        setMessage({
          kind: "ok",
          text: "Account created. You are signed in."
        });
        return;
      }

      setMessage({
        kind: "ok",
        text: "Check your email for a confirmation link. After confirming, return here to sign in."
      });
    } catch (e: unknown) {
      setMessage({ kind: "error", text: formatAuthError(e as Error) });
    } finally {
      setLoading(null);
    }
  };

  const stateReason = (location.state as { reason?: string } | null)?.reason;
  const configHint =
    stateReason === "supabase_unconfigured" ? (
      <div className="pg-alert pg-alert-error" style={{ marginBottom: 12 }}>
        Supabase environment variables are missing. Add them to <code className="pg-code">frontend/.env.local</code>{" "}
        and reload.
      </div>
    ) : null;

  return (
    <Section>
      <Helmet>
        <title>Sign In | The Property Guy</title>
        <meta name="description" content="Sign in or create an account to save calculations and generate reports." />
      </Helmet>
      <Container>
        <div className="pg-auth-layout">
          <div className="pg-auth-marketing">
            <h2 className="pg-h2" style={{ marginTop: 0 }}>
              Track deals. Save reports. Manage your portfolio.
            </h2>
            <p className="pg-lead">
              Your first 3 calculator reports are free. Then upgrade for unlimited analysis and a full property command centre.
            </p>
          </div>
          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <h1 className="pg-h2" style={{ margin: 0 }}>
                Sign in to save reports
              </h1>
              <p className="pg-lead" style={{ margin: 0 }}>
                Create an account to track your calculations and generate downloadable PDFs.
              </p>
            </div>

            <div style={{ height: 18 }} />

            {configHint}

            <Field label="Email" help="Use the same email you’ll confirm.">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label="Password" help="At least 8 characters recommended.">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={() => void submit("login")} loading={loading === "login"}>
                Sign In
              </Button>
              <Button variant="secondary" onClick={() => void submit("register")} loading={loading === "register"}>
                Create Account
              </Button>
              <Link className="pg-btn pg-btn-ghost" to="/subscription">
                Pricing
              </Link>
            </div>

            {message ? (
              <div className={`pg-alert ${message.kind === "error" ? "pg-alert-error" : ""}`} style={{ marginTop: 16 }}>
                {message.text}
              </div>
            ) : null}
          </Card>
        </div>
      </Container>
    </Section>
  );
}
