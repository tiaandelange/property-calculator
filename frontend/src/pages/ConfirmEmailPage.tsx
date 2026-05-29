import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { formatAuthError } from "../utils/authErrors";
import type { EmailOtpType } from "@supabase/supabase-js";
import { PageBrandMark } from "../components/brand/PageBrandMark";

/** Supabase email confirmation (`token_hash` + `type` query params). */
export function ConfirmEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!tokenHash || !typeParam) {
        if (!cancelled) {
          setLoading(false);
          setMessage({
            kind: "error",
            text: "Missing confirmation parameters. Open the link from your email, or go back to sign in."
          });
        }
        return;
      }

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setLoading(false);
          setMessage({
            kind: "error",
            text: "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
          });
        }
        return;
      }

      const sb = getSupabase();
      const { error } = await sb.auth.verifyOtp({
        token_hash: tokenHash,
        type: typeParam as EmailOtpType
      });
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setMessage({ kind: "error", text: formatAuthError(error) });
        return;
      }
      setMessage({ kind: "ok", text: "You have been successfully verified." });
      setRedirectIn(3);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [tokenHash, typeParam]);

  useEffect(() => {
    if (redirectIn === null) return;
    if (redirectIn <= 0) {
      navigate("/owned-properties/dashboard", { replace: true });
      return;
    }

    const t = window.setTimeout(() => setRedirectIn((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [redirectIn, navigate]);

  return (
    <Section>
      <Helmet>
        <title>Confirm Email | The Property Guy</title>
        <meta name="description" content="Confirm your email for The Property Guy." />
      </Helmet>
      <Container>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <PageBrandMark linkToHome />
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              Confirm your email
            </h1>
            <p className="pg-lead">Confirming your email enables login and report storage.</p>
            {loading ? <p className="pg-muted">Working…</p> : null}
            {message ? (
              <div className={`pg-alert ${message.kind === "error" ? "pg-alert-error" : ""}`} style={{ marginTop: 16 }}>
                {message.text}
              </div>
            ) : null}
            {!loading && message?.kind === "ok" ? (
              <p className="pg-muted" style={{ marginTop: 12 }}>
                Redirecting you to your dashboard in {redirectIn ?? 3} seconds…
              </p>
            ) : null}
            {!loading && message?.kind === "ok" ? (
              <div style={{ marginTop: 16 }}>
                <Link className="pg-btn pg-btn-primary" to="/owned-properties/dashboard">
                  Go to dashboard now
                </Link>
              </div>
            ) : null}
            {!loading && message?.kind === "error" ? (
              <div style={{ marginTop: 16 }}>
                <Link className="pg-btn pg-btn-ghost" to="/login">
                  Back to login
                </Link>
              </div>
            ) : null}
          </Card>
        </div>
      </Container>
    </Section>
  );
}
