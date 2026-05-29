import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { fetchPortfolioProjectionMetrics, patchPortfolioProjectionMetrics } from "../api/admin";
import { fetchMe, patchProfileUiColorScheme } from "../api/user";
import { useAuth } from "../contexts/AuthContext";
import { UiColorSchemeSwitch } from "../components/ui/UiColorSchemeSwitch";
import { AdminInvoiceAutomationPanel } from "../features/invoices/AdminInvoiceAutomationPanel";
import { applyUiColorScheme, normalizeUiColorScheme, type UiColorScheme } from "../theme/uiColorScheme";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Container } from "../components/ui/Container";
import { Field, Input } from "../components/ui/Input";
import { Section } from "../components/ui/Section";

export function AdminPanelPage() {
  const { refreshProfile } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [description, setDescription] = useState("");
  const [rentalGrowth, setRentalGrowth] = useState("6");
  const [expenseGrowth, setExpenseGrowth] = useState("6");
  const [uiColorScheme, setUiColorScheme] = useState<UiColorScheme>("dark");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setRole(me.role ?? null);
        setUiColorScheme(normalizeUiColorScheme(me.uiColorScheme));
        if (me.role !== "ADMIN") {
          setLoading(false);
          return;
        }
        const res = await fetchPortfolioProjectionMetrics();
        if (cancelled) return;
        setDescription(res.description);
        setRentalGrowth(String(res.metrics.rentalIncomeGrowthPercentAnnual));
        setExpenseGrowth(String(res.metrics.totalExpensesGrowthPercentAnnual));
      } catch (e: unknown) {
        if (!cancelled) setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not load admin metrics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setSavedFlash(false);
    try {
      const rental = Number(rentalGrowth);
      const expenses = Number(expenseGrowth);
      if (!Number.isFinite(rental) || !Number.isFinite(expenses)) {
        setError("Enter valid numbers for growth rates.");
        return;
      }
      const res = await patchPortfolioProjectionMetrics({
        rentalIncomeGrowthPercentAnnual: rental,
        totalExpensesGrowthPercentAnnual: expenses
      });
      setRentalGrowth(String(res.metrics.rentalIncomeGrowthPercentAnnual));
      setExpenseGrowth(String(res.metrics.totalExpensesGrowthPercentAnnual));
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 4000);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const saveUiColorScheme = async (next: UiColorScheme) => {
    const prev = uiColorScheme;
    setThemeError("");
    setUiColorScheme(next);
    applyUiColorScheme(next);
    setThemeSaving(true);
    try {
      await patchProfileUiColorScheme(next);
      await refreshProfile();
    } catch (e: unknown) {
      setUiColorScheme(prev);
      applyUiColorScheme(prev);
      const ax = e as { response?: { data?: { message?: string } } };
      setThemeError(ax.response?.data?.message ?? "Could not save appearance.");
    } finally {
      setThemeSaving(false);
    }
  };

  if (!loading && role !== "ADMIN") {
    return (
      <Section>
        <Helmet>
          <title>Admin | The Property Guy</title>
        </Helmet>
        <Container>
          <h1 className="pg-h2">Admin panel</h1>
          <p className="pg-muted">You need an administrator account to view this page.</p>
          <Link className="pg-btn pg-btn-secondary" to="/settings" style={{ marginTop: 12, display: "inline-block" }}>
            Back to settings
          </Link>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Helmet>
        <title>Admin — projection metrics | The Property Guy</title>
      </Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 className="pg-h2" style={{ margin: "8px 0 0" }}>
            Admin metrics
          </h1>
          <Link className="pg-link" to="/settings">
            Settings overview
          </Link>
        </div>

        <p className="pg-muted" style={{ marginTop: 8 }}>
          Global assumptions for projected portfolio IRR. Property-specific value growth still uses each property&apos;s expected annual appreciation %
          when you create or edit the asset.
        </p>

        {error ? (
          <div className="pg-alert pg-alert-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        ) : null}
        {savedFlash ? (
          <div className="pg-alert" style={{ marginTop: 16 }}>
            Saved.
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
        <AdminInvoiceAutomationPanel />

        <div style={{ marginTop: 20 }}>
        <Card title="Portfolio IRR projections">
          {loading ? (
            <div className="pg-muted">Loading…</div>
          ) : (
            <>
              <p className="pg-muted" style={{ marginTop: 0 }}>
                {description}
              </p>
              <div style={{ marginTop: 16, display: "grid", gap: 14, maxWidth: 360 }}>
                <Field label="Rental income growth (% per year)">
                  <Input value={rentalGrowth} onChange={(e) => setRentalGrowth(e.target.value)} inputMode="decimal" />
                </Field>
                <Field label="Total expenses growth (% per year)">
                  <Input value={expenseGrowth} onChange={(e) => setExpenseGrowth(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <div style={{ marginTop: 18 }}>
                <Button onClick={() => void save()} loading={saving}>
                  Save metrics
                </Button>
              </div>
              <p className="pg-muted" style={{ marginTop: 16, fontSize: 13 }}>
                IRR uses discounted cash flows: 0 = CF₀ + CF₁/(1+r)¹ + ⋯ + CFₙ/(1+r)ⁿ, with CF₀ negative (cash invested) and CFₙ including operating cash
                plus sale/refinance proceeds.
              </p>
            </>
          )}
        </Card>

        <div style={{ marginTop: 20 }}>
          <Card title="Color scheme">
            <p className="pg-muted" style={{ marginTop: 0 }}>
              Light mode uses a warm off-white background with charcoal text and grey controls. Dark mode matches the default black and blue workspace. Your choice applies across the site and is saved to your account.
            </p>
            {themeError ? (
              <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>
                {themeError}
              </div>
            ) : null}
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Interface brightness</div>
                <p className="pg-muted" style={{ margin: 0, fontSize: 13 }}>
                  Toggle light or dark. {themeSaving ? "Saving…" : null}
                </p>
              </div>
              <UiColorSchemeSwitch
                value={uiColorScheme}
                disabled={loading || themeSaving}
                onChange={(next) => void saveUiColorScheme(next)}
              />
            </div>
          </Card>
        </div>
        </div>
        </div>
      </Container>
    </Section>
  );
}
