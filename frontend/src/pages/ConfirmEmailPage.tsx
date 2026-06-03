import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { ButtonLink } from "../components/ui/Button";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { completeConfirmEmailAuth, parseConfirmEmailRedirect } from "../lib/confirmEmailAuth";
import { PageBrandMark } from "../components/brand/PageBrandMark";

/** Supabase email confirmation (PKCE `code`, hash tokens, or `token_hash` + `type`). */
export function ConfirmEmailPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const redirect = parseConfirmEmailRedirect(
        window.location.search,
        window.location.hash
      );

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
      const result = await completeConfirmEmailAuth(sb, redirect);
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setMessage({ kind: "ok", text: "You have been successfully verified." });
      setRedirectIn(3);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

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
                <ButtonLink href="/owned-properties/dashboard" variant="primary">
                  Go to dashboard now
                </ButtonLink>
              </div>
            ) : null}
            {!loading && message?.kind === "error" ? (
              <div style={{ marginTop: 16 }}>
                <ButtonLink href="/login" variant="ghost">
                  Back to login
                </ButtonLink>
              </div>
            ) : null}
          </Card>
        </div>
      </Container>
    </Section>
  );
}
