import { FormEvent, useEffect, useState } from "react";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { fmtZar } from "./invoiceDirectoryUtils";

export type InvoicePaymentFormState = {
  paymentDate: string;
  paymentReference: string;
  amount: string;
};

type Props = {
  open: boolean;
  title?: string;
  confirmLabel?: string;
  loading?: boolean;
  defaultReference?: string | null;
  defaultAmount: number;
  onClose: () => void;
  onSubmit: (values: InvoicePaymentFormState) => void | Promise<void>;
};

export function InvoiceRecordPaymentModal({
  open,
  title = "Add payment",
  confirmLabel = "Save payment",
  loading = false,
  defaultReference,
  defaultAmount,
  onClose,
  onSubmit
}: Props) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) return;
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentReference(defaultReference?.trim() ?? "");
    setAmount(Number.isFinite(defaultAmount) && defaultAmount > 0 ? String(defaultAmount) : "");
  }, [open, defaultReference, defaultAmount]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void onSubmit({ paymentDate, paymentReference, amount });
  };

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      size="sm"
      loading={loading}
      closeOnOverlayClick={!loading}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="pg-muted" style={{ marginTop: 0 }}>
        If the invoice has not been sent yet, it will be marked as sent when you save this payment.
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        <Field label="Payment date">
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </Field>
        <Field label="Payment reference" help="Defaults to the lease reference when available.">
          <Input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. lease reference"
          />
        </Field>
        <Field label="Amount paid" help={`Invoice balance: ${fmtZar(defaultAmount)}`}>
          <Input
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
      </div>
    </AppFormModal>
  );
}
