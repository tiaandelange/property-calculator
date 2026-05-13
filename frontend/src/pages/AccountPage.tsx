import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { fetchMe, patchProfileInvoicePaymentDetails } from "../api/user";
import type { InvoicePaymentDetailsPayload } from "../api/user";
import { useAuth } from "../contexts/AuthContext";
import { PageBreadcrumb } from "../components/nav/PageBreadcrumb";
import { workspacePage } from "../nav/workspaceBreadcrumbs";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Container } from "../components/ui/Container";
import { Field, Input } from "../components/ui/Input";
import { Section } from "../components/ui/Section";

type FormState = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  referenceNote: string;
  extraLinesText: string;
};

function emptyForm(): FormState {
  return {
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    branchCode: "",
    referenceNote: "",
    extraLinesText: ""
  };
}

function formFromApi(raw: unknown): FormState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyForm();
  }
  const d = raw as Record<string, unknown>;
  const extraLines = Array.isArray(d.extraLines)
    ? d.extraLines.filter((x): x is string => typeof x === "string")
    : [];
  return {
    bankName: typeof d.bankName === "string" ? d.bankName : "",
    accountHolder: typeof d.accountHolder === "string" ? d.accountHolder : "",
    accountNumber: typeof d.accountNumber === "string" ? d.accountNumber : "",
    branchCode: typeof d.branchCode === "string" ? d.branchCode : "",
    referenceNote: typeof d.referenceNote === "string" ? d.referenceNote : "",
    extraLinesText: extraLines.join("\n")
  };
}

function toPayload(form: FormState): InvoicePaymentDetailsPayload {
  const extraLines = form.extraLinesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    bankName: form.bankName.trim(),
    accountHolder: form.accountHolder.trim(),
    accountNumber: form.accountNumber.trim(),
    branchCode: form.branchCode.trim(),
    referenceNote: form.referenceNote.trim(),
    extraLines
  };
}

export function AccountPage() {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setEmail(me.email ?? "");
        setForm(formFromApi(me.invoicePaymentDetails));
      } catch (e: unknown) {
        if (!cancelled) setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not load account.");
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
      const updated = await patchProfileInvoicePaymentDetails(toPayload(form));
      setForm(formFromApi(updated.invoicePaymentDetails));
      await refreshProfile();
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 4000);
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { message?: string } } };
      setError(ax.response?.data?.message ?? "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Account | The Property Guy</title>
        <meta name="description" content="Manage your profile and invoice payment details shown on tenant invoices." />
      </Helmet>
      <Container>
        <PageBreadcrumb items={workspacePage("Account")} />
        <h1 className="pg-h2" style={{ margin: "8px 0 0" }}>
          Account
        </h1>
        <p className="pg-lead" style={{ margin: "8px 0 0" }}>
          Signed in as {email || "…"}
        </p>

        <div style={{ height: 20 }} />

        {error ? (
          <div className="pg-alert pg-alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        ) : null}
        {savedFlash ? (
          <div className="pg-alert" style={{ marginBottom: 16, borderColor: "rgba(46, 160, 67, 0.35)", background: "rgba(46, 160, 67, 0.08)" }}>
            Saved.
          </div>
        ) : null}

        <div id="invoice-payment">
          <Card title="Invoice payment details">
            <p className="pg-muted" style={{ marginTop: 0 }}>
              These lines appear on generated tenant invoices (PDF). They are not shown on the public website.
            </p>

            {loading ? (
              <p className="pg-muted">Loading…</p>
            ) : (
              <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
                <Field label="Bank name">
                  <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} autoComplete="organization" />
                </Field>
                <Field label="Account holder">
                  <Input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} autoComplete="name" />
                </Field>
                <Field label="Account number">
                  <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} autoComplete="off" />
                </Field>
                <Field label="Branch / universal code" help="e.g. branch code or universal branch number for your bank.">
                  <Input value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} autoComplete="off" />
                </Field>
                <Field label="Payment reference note" help="What tenants should put on their proof of payment.">
                  <Input value={form.referenceNote} onChange={(e) => setForm({ ...form, referenceNote: e.target.value })} autoComplete="off" />
                </Field>
                <Field label="Extra lines" help="Optional — one line per row (e.g. SWIFT, VAT number, instructions).">
                  <textarea
                    className="pg-input"
                    rows={5}
                    value={form.extraLinesText}
                    onChange={(e) => setForm({ ...form, extraLinesText: e.target.value })}
                  />
                </Field>
                <div>
                  <Button type="button" loading={saving} onClick={() => void save()}>
                    Save invoice details
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Container>
    </Section>
  );
}
