import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "../services/subscriptionPlansSupabase";
import { planDisplayName } from "../features/pricing/pricingPlanDisplay";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { getConfirmEmailRedirectUrl } from "../lib/authRedirect";
import { formatAuthError } from "../utils/authErrors";
import { useAuth } from "../contexts/AuthContext";
import { PageBrandMark } from "../components/brand/PageBrandMark";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session, initializing } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "login" | "register">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>(FALLBACK_SUBSCRIPTION_PLANS);

  const planCode = searchParams.get("plan")?.trim() ?? "";
  const isSignupEntry = location.pathname === "/signup" || Boolean(planCode);
  const selectedPlanName = planCode ? planDisplayName(planCode, plans) : null;

  useEffect(() => {
    let cancelled = false;
    void listActiveSubscriptionPlans()
      .then((rows) => {
        if (!cancelled) setPlans(rows);
      })
      .catch(() => {
        if (!cancelled) setPlans(FALLBACK_SUBSCRIPTION_PLANS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initializing || !session) return;
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from.startsWith("/calculators/")) {
      navigate(from, { replace: true });
      return;
    }
    if (from && from !== "/login" && from !== "/signup" && from !== "/") {
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
          <PageBrandMark linkToHome />
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
                {isSignupEntry ? "Create your account" : "Sign in to save reports"}
              </h1>
              <p className="pg-lead" style={{ margin: 0 }}>
                {isSignupEntry
                  ? "Complete registration to start using Proplytic. Billing is not charged during signup."
                  : "Create an account to track your calculations and generate downloadable PDFs."}
              </p>
            </div>

            <div style={{ height: 18 }} />

            {selectedPlanName ? (
              <div className="pg-login-plan-banner" role="status">
                You selected the <strong>{selectedPlanName}</strong> plan.{" "}
                <Link to="/pricing">Change plan</Link>
              </div>
            ) : null}

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
              <ButtonLink href="/pricing" variant="ghost">
                View pricing
              </ButtonLink>
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
