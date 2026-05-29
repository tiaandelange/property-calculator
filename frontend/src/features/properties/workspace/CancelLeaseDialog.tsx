import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Input } from "../../../components/ui/Input";

export function CancelLeaseDialog({
  open,
  leaseLabel,
  errorMessage,
  loading,
  onClose,
  onConfirm
}: {
  open: boolean;
  leaseLabel?: ReactNode;
  errorMessage?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: { cancellationDate: string; cancellationReason?: string }) => void;
}) {
  const [cancellationDate, setCancellationDate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setCancellationDate(new Date().toISOString().slice(0, 10));
    setCancellationReason("");
  }, [open]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!cancellationDate.trim()) return;
    onConfirm({
      cancellationDate: cancellationDate.trim(),
      cancellationReason: cancellationReason.trim() || undefined
    });
  };

  return (
    <ConfirmDialog
      open={open}
      title="Cancel lease"
      confirmLabel="Cancel lease"
      confirmVariant="primary"
      loading={loading}
      onClose={onClose}
      onConfirm={() => submit()}
    >
      <form onSubmit={submit}>
        {leaseLabel ? <div className="pg-muted" style={{ marginTop: 0, marginBottom: 8 }}>{leaseLabel}</div> : null}
        <p className="pg-muted" style={{ fontSize: 13 }}>
          The lease moves to lease history so you can still view past financials. It is not permanently deleted.
        </p>
        <label className="pg-muted" style={{ display: "block", fontSize: 13, marginBottom: 12 }}>
          Cancellation date
          <Input type="date" value={cancellationDate} onChange={(e) => setCancellationDate(e.target.value)} required />
        </label>
        <label className="pg-muted" style={{ display: "block", fontSize: 13 }}>
          Reason (optional)
          <Input value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} />
        </label>
        {errorMessage ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{errorMessage}</div> : null}
      </form>
    </ConfirmDialog>
  );
}
