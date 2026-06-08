import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LoginBrandPanel } from "../features/auth/LoginBrandPanel";
import { LoginSignInCard } from "../features/auth/LoginSignInCard";
import { LoginSignupCard } from "../features/auth/LoginSignupCard";
import { ProplyticLogo } from "../components/brand/ProplyticLogo";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "../services/subscriptionPlansSupabase";
import {
  PENDING_SIGNUP_PLAN_STORAGE_KEY,
  resolveSignupPlanSelection,
  SIGNUP_PLAN_USER_METADATA_KEY
} from "../features/signup/signupPlan";
import { readAuthSession } from "../lib/authSession";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { authLoginInProgressRef } from "../lib/authLoginGuard";
import { getConfirmEmailRedirectUrl } from "../lib/authRedirect";
import { formatAuthError } from "../utils/authErrors";
import { logSignInFlow } from "../lib/authDebug";
import { useAuth } from "../contexts/AuthContext";
import { ensureUserSubscriptionForPlanCode } from "../services/userSubscriptionsSupabase";
import { resolvePublicPageUrl } from "../lib/publicPageSeo";
import {
  buildSignupBillingRedirect,
  consumeSignupBillingRedirect,
  settingsSubscriptionPath,
  storeSignupBillingRedirect
} from "../features/signup/signupBillingFlow";
import { isPaidPlan } from "../features/pricing/pricingPlanDisplay";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session, authLoading, initialized, isAuthenticated, recognizeSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "login" | "register">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>(FALLBACK_SUBSCRIPTION_PLANS);

  const planCode = searchParams.get("plan")?.trim() ?? "";
  const isSignupEntry = location.pathname === "/signup" || Boolean(planCode);
  const signupPlan = resolveSignupPlanSelection(location.pathname, planCode, plans);

  useEffect(() => {
    let cancelled = false;
    void listActiveSubscriptionPlans()
      .then((rows) => {
        if (!cancelled) setPlans(rows.length ? rows : FALLBACK_SUBSCRIPTION_PLANS);
      })
      .catch(() => {
        if (!cancelled) setPlans(FALLBACK_SUBSCRIPTION_PLANS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialized || authLoading || loading) return;
    if (!session?.user?.id || !isAuthenticated) return;

    logSignInFlow("redirect-after-session", { hasSession: true });

    const redirectTo = searchParams.get("redirectTo")?.trim();
    if (
      redirectTo &&
      redirectTo.startsWith("/") &&
      !redirectTo.startsWith("//") &&
      redirectTo !== "/login" &&
      !redirectTo.startsWith("/login?")
    ) {
      navigate(redirectTo, { replace: true });
      return;
    }

    const billingRedirect = consumeSignupBillingRedirect();
    if (billingRedirect) {
      navigate(
        settingsSubscriptionPath({
          checkout: billingRedirect.autoCheckout,
          planCode: billingRedirect.planCode
        }),
        { replace: true }
      );
      return;
    }

    const from = (location.state as { from?: string } | null)?.from;
    if (from && from !== "/login" && from !== "/signup" && from !== "/") {
      navigate(from, { replace: true });
      return;
    }

    navigate("/owned-properties/dashboard", { replace: true });
  }, [session, authLoading, initialized, isAuthenticated, loading, location.state, navigate, searchParams]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const pending = sessionStorage.getItem(PENDING_SIGNUP_PLAN_STORAGE_KEY);
    const meta = session.user.user_metadata?.[SIGNUP_PLAN_USER_METADATA_KEY];
    const code =
      typeof pending === "string" && pending.trim()
        ? pending.trim()
        : typeof meta === "string" && meta.trim()
          ? meta.trim()
          : null;

    if (!code) return;

    void ensureUserSubscriptionForPlanCode(code)
      .catch((e) => {
        console.warn(
          "[signup] user_subscriptions",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        sessionStorage.removeItem(PENDING_SIGNUP_PLAN_STORAGE_KEY);
      });
  }, [session?.user?.id, session?.user?.user_metadata]);

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
        logSignInFlow("start");
        authLoginInProgressRef.current = true;
        try {
          // Clear stale refresh tokens so a slow bootstrap getSession cannot sign the user out after login.
          try {
            await sb.auth.signOut({ scope: "local" });
          } catch {
            /* non-fatal */
          }
          const { data: signInData, error } = await sb.auth.signInWithPassword({
            email: email.trim(),
            password
          });
          if (error) {
            logSignInFlow("error", { message: error.message });
            setMessage({ kind: "error", text: formatAuthError(error) });
            return;
          }
          if (signInData.session) {
            recognizeSession(signInData.session);
            logSignInFlow("success", { via: "signInResponse" });
          } else {
            const { session: signedIn } = await readAuthSession();
            if (signedIn) recognizeSession(signedIn);
            logSignInFlow("success", { via: "readAuthSession" });
          }
          setMessage({ kind: "ok", text: "Signed in successfully." });
        } finally {
          authLoginInProgressRef.current = false;
        }
        return;
      }

      const selectedPlanCode = isSignupEntry ? signupPlan.plan.code : null;
      if (selectedPlanCode) {
        sessionStorage.setItem(PENDING_SIGNUP_PLAN_STORAGE_KEY, selectedPlanCode);
        const billingRedirect = buildSignupBillingRedirect(signupPlan.plan);
        if (billingRedirect) {
          storeSignupBillingRedirect(billingRedirect);
        }
      }

      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getConfirmEmailRedirectUrl(),
          ...(selectedPlanCode
            ? { data: { [SIGNUP_PLAN_USER_METADATA_KEY]: selectedPlanCode } }
            : {})
        }
      });
      if (error) {
        if (selectedPlanCode) {
          sessionStorage.removeItem(PENDING_SIGNUP_PLAN_STORAGE_KEY);
        }
        setMessage({ kind: "error", text: formatAuthError(error) });
        return;
      }

      if (data.session) {
        recognizeSession(data.session);
        if (selectedPlanCode) {
          try {
            await ensureUserSubscriptionForPlanCode(selectedPlanCode);
            sessionStorage.removeItem(PENDING_SIGNUP_PLAN_STORAGE_KEY);
          } catch (subErr) {
            console.warn(
              "[signup] user_subscriptions",
              subErr instanceof Error ? subErr.message : subErr
            );
          }
          const paidPlan = isPaidPlan(signupPlan.plan);
          const needsPayment = paidPlan && signupPlan.plan.trialDays === 0;
          setMessage({
            kind: "ok",
            text: needsPayment
              ? `Account created on the ${signupPlan.plan.name} plan. Complete payment in Settings to activate billing.`
              : paidPlan && signupPlan.plan.trialDays > 0
                ? `Account created on the ${signupPlan.plan.name} plan. Your trial is active — no payment was charged yet.`
                : `Account created on the ${signupPlan.plan.name} plan. You are signed in.`
          });
        } else {
          setMessage({
            kind: "ok",
            text: "Account created. You are signed in."
          });
        }
        return;
      }

      setMessage({
        kind: "ok",
        text: selectedPlanCode
          ? `Check your email for a confirmation link. Your ${signupPlan.plan.name} plan will be applied after you sign in. No payment is required yet.`
          : "Check your email for a confirmation link. After confirming, return here to sign in."
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
      <div className="pg-login-card__alert pg-login-card__alert--error" style={{ marginBottom: 12 }}>
        Supabase environment variables are missing. Add them to <code className="pg-code">frontend/.env.local</code>{" "}
        and reload.
      </div>
    ) : null;

  return (
    <div className="pg-login-page">
      <Helmet>
        <title>{isSignupEntry ? "Create Account | Proplytic" : "Sign In | Proplytic"}</title>
        <meta
          name="description"
          content={
            isSignupEntry
              ? "Create a Proplytic account to save calculations, generate property reports, and manage your South African rental portfolio."
              : "Sign in to Proplytic to save property calculations, generate reports, and manage your rental portfolio."
          }
        />
        <link rel="canonical" href={resolvePublicPageUrl(isSignupEntry ? "/signup" : "/login")} />
      </Helmet>

      <Link to="/" className="pg-login-page__mobile-logo" aria-label="Proplytic — Home">
        <ProplyticLogo mode="full" title="Proplytic" />
      </Link>

      <div className="pg-login-page__grid">
        <LoginBrandPanel />
        <div className="pg-login-page__form-column">
          {isSignupEntry ? (
            <LoginSignupCard
              email={email}
              password={password}
              loading={loading === "register"}
              message={message}
              configHint={configHint}
              plan={signupPlan.plan}
              invalidRequested={signupPlan.invalidRequested}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={() => void submit("register")}
            />
          ) : (
            <LoginSignInCard
              email={email}
              password={password}
              loading={loading === "login"}
              message={message}
              configHint={configHint}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={() => void submit("login")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
