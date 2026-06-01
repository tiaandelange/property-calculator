import { useEffect, useState } from "react";
import { patchProfileInvoicePaymentDetails } from "../../api/user";
import { useAuth } from "../../contexts/AuthContext";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { useProfileQuery } from "../queries";
import {
  invoicePaymentDetailsFormFromApi,
  invoicePaymentDetailsFormToPayload,
  type InvoicePaymentDetailsFormState
} from "./invoicePaymentDetailsForm";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function InvoiceBankingDetailsModal({ open, onClose }: Props) {
  const { refreshProfile } = useAuth();
  const profileQuery = useProfileQuery({ enabled: open });
  const [form, setForm] = useState<InvoicePaymentDetailsFormState>(() =>
    invoicePaymentDetailsFormFromApi(null)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const email = profileQuery.data?.email ?? "";

  useEffect(() => {
    if (!open) {
      setError("");
      setSavedFlash(false);
      return;
    }
    const me = profileQuery.data;
    if (!me) return;
    const loaded = invoicePaymentDetailsFormFromApi(me.invoicePaymentDetails);
    setForm({
      ...loaded,
      ccEmail: loaded.ccEmail.trim() || (me.email ?? "").trim()
    });
  }, [open, profileQuery.data]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSavedFlash(false);
    try {
      const updated = await patchProfileInvoicePaymentDetails(invoicePaymentDetailsFormToPayload(form));
      setForm(invoicePaymentDetailsFormFromApi(updated.invoicePaymentDetails));
      await refreshProfile();
      setSavedFlash(true);
      window.setTimeout(() => {
        setSavedFlash(false);
        onClose();
      }, 1200);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? (e instanceof Error ? e.message : "Could not save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const loading = open && profileQuery.isLoading && !profileQuery.data;

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Invoice & banking details"
      description="Shown on invoice PDFs and used when emailing invoices to tenants."
      size="md"
      loading={saving}
      closeOnOverlayClick={!saving}
      onClose={onClose}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={onClose} disabled={saving}>
            Discard
          </Button>
          <Button type="button" loading={saving} disabled={loading} onClick={() => void save()}>
            Save
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="pg-alert pg-alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {savedFlash ? (
        <div className="pg-alert" role="status" style={{ marginBottom: 12 }}>
          Saved. These details will appear on generated invoices.
        </div>
      ) : null}

      {loading ? (
        <p className="pg-muted">Loading…</p>
      ) : (
        <div className="pg-inv-banking-modal-fields">
          <Field
            label="Invoice copy (CC) email"
            help="Copied on invoice emails when sending is enabled. Defaults to your login email."
          >
            <Input
              type="email"
              value={form.ccEmail}
              onChange={(e) => setForm({ ...form, ccEmail: e.target.value })}
              autoComplete="email"
              placeholder={email || "you@example.com"}
              disabled={saving}
            />
          </Field>
          <Field label="Bank name">
            <Input
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              autoComplete="organization"
              disabled={saving}
            />
          </Field>
          <Field label="Account holder">
            <Input
              value={form.accountHolder}
              onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
              autoComplete="name"
              disabled={saving}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              autoComplete="off"
              disabled={saving}
            />
          </Field>
          <Field label="Branch / universal code" help="e.g. branch code or universal branch number for your bank.">
            <Input
              value={form.branchCode}
              onChange={(e) => setForm({ ...form, branchCode: e.target.value })}
              autoComplete="off"
              disabled={saving}
            />
          </Field>
          <Field label="Payment reference note" help="What tenants should put on their proof of payment.">
            <Input
              value={form.referenceNote}
              onChange={(e) => setForm({ ...form, referenceNote: e.target.value })}
              autoComplete="off"
              disabled={saving}
            />
          </Field>
          <Field label="Extra lines" help="Optional — one line per row (e.g. SWIFT, VAT number, instructions).">
            <textarea
              className="pg-input pg-inv-banking-modal-textarea"
              rows={5}
              value={form.extraLinesText}
              onChange={(e) => setForm({ ...form, extraLinesText: e.target.value })}
              disabled={saving}
            />
          </Field>
        </div>
      )}
    </AppFormModal>
  );
}
