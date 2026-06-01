import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { patchProfileInvoicePaymentDetails } from "../../api/user";
import { useAuth } from "../../contexts/AuthContext";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { queryKeys, useProfileQuery, useWorkspaceId } from "../queries";
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
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
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
    void profileQuery.refetch();
  }, [open, profileQuery]);

  useEffect(() => {
    if (!open) return;
    const me = profileQuery.data;
    if (!me) return;
    const loaded = invoicePaymentDetailsFormFromApi(me.invoicePaymentDetails);
    setForm({
      ...loaded,
      ccEmail: loaded.ccEmail.trim() || (me.email ?? "").trim()
    });
  }, [open, profileQuery.data, profileQuery.dataUpdatedAt]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSavedFlash(false);
    try {
      const updated = await patchProfileInvoicePaymentDetails(invoicePaymentDetailsFormToPayload(form));
      if (workspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile(workspaceId) });
      }
      await refreshProfile();
      const refetched = await profileQuery.refetch();
      const me = refetched.data;
      const loaded = invoicePaymentDetailsFormFromApi(
        updated.invoicePaymentDetails ?? me?.invoicePaymentDetails
      );
      setForm({
        ...loaded,
        ccEmail: loaded.ccEmail.trim() || (me?.email ?? "").trim()
      });
      setSavedFlash(true);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? (e instanceof Error ? e.message : "Could not save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const loading = open && (profileQuery.isLoading || profileQuery.isFetching) && !profileQuery.data;

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Invoice & banking details"
      description="Business contact and banking lines appear on invoice PDFs. Each invoice uses its lease reference as the payment reference."
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
          <Field label="Business phone" help="Shown on invoice PDFs in the header (top right).">
            <Input
              type="tel"
              value={form.businessPhone}
              onChange={(e) => setForm({ ...form, businessPhone: e.target.value })}
              autoComplete="tel"
              disabled={saving}
            />
          </Field>
          <Field label="Business address" help="Optional — shown on invoice PDFs in the header.">
            <textarea
              className="pg-input pg-inv-banking-modal-textarea"
              rows={2}
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
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
          <Field label="Extra lines" help="Optional — one line per row (e.g. SWIFT, VAT number, instructions).">
            <textarea
              className="pg-input pg-inv-banking-modal-textarea"
              rows={5}
              value={form.extraLinesText}
              onChange={(e) => setForm({ ...form, extraLinesText: e.target.value })}
              disabled={saving}
            />
          </Field>
          <p className="pg-text-helper" style={{ margin: 0 }}>
            Payment reference on each invoice is taken from the linked lease reference (not configured here).
          </p>
        </div>
      )}
    </AppFormModal>
  );
}
