import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { ModalOverlay, ModalPanel } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { invoiceDetailPath } from "../invoices/invoiceRoutes";
import {
  billingPeriodOptions,
  defaultBillingPeriod,
  dueDateForBillingPeriod,
  MANUAL_INVOICE_TYPE_OPTIONS,
  type ManualInvoiceType
} from "./leaseBillingPeriodUtils";
import { manualGenerateLeaseInvoice } from "../../services/manualInvoiceSupabase";

type Step = "closed" | "warning" | "form" | "duplicate";

export function ManualGenerateLeaseInvoiceFlow({
  open,
  leaseId,
  tenantId,
  propertyId,
  monthlyRent,
  rentDueDay,
  onClose,
  onCreated
}: {
  open: boolean;
  leaseId: string;
  tenantId: string;
  propertyId: string;
  monthlyRent: number;
  rentDueDay: number;
  onClose: () => void;
  onCreated?: (invoiceId: string) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("closed");
  const [invoicePeriod, setInvoicePeriod] = useState("");
  const [invoiceType, setInvoiceType] = useState<ManualInvoiceType>("RENT");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateInvoiceId, setDuplicateInvoiceId] = useState("");

  const periodOptions = useMemo(() => billingPeriodOptions(), []);

  useEffect(() => {
    if (!open) {
      setStep("closed");
      return;
    }
    setStep("warning");
    setError("");
    setDuplicateInvoiceId("");
    const period = defaultBillingPeriod(rentDueDay);
    setInvoicePeriod(period);
    setInvoiceType("RENT");
    setDueDate(dueDateForBillingPeriod(period, rentDueDay));
    setAmount(String(monthlyRent ?? 0));
    setNotes("");
  }, [open, rentDueDay, monthlyRent]);

  useEffect(() => {
    if (!invoicePeriod) return;
    setDueDate(dueDateForBillingPeriod(invoicePeriod, rentDueDay));
  }, [invoicePeriod, rentDueDay]);

  function handleClose() {
    if (loading) return;
    setStep("closed");
    onClose();
  }

  async function submitForm(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(invoicePeriod)) {
      setError("Select a billing period.");
      return;
    }
    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    setLoading(true);
    try {
      const result = await manualGenerateLeaseInvoice({
        leaseId,
        invoicePeriod,
        invoiceType,
        dueDate,
        amount: parsedAmount,
        notes: notes.trim() || null
      });
      if (result.duplicate && result.invoiceId) {
        setDuplicateInvoiceId(result.invoiceId);
        setStep("duplicate");
        return;
      }
      if (!result.ok || !result.invoiceId) {
        throw new Error(result.message ?? "Could not generate invoice.");
      }
      onCreated?.(result.invoiceId);
      handleClose();
      navigate(invoiceDetailPath(result.invoiceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={open && step === "warning"}
        title="Manual invoice generation warning"
        confirmLabel="Confirm Generate Invoice"
        cancelLabel="Cancel"
        loading={loading}
        onClose={handleClose}
        onConfirm={() => setStep("form")}
      >
        <p className="pg-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Invoices are automatically generated 10 days before the rent due date for active leases. Manually
          generating an invoice may create a duplicate if an invoice already exists for this lease and billing
          period. Continue?
        </p>
      </ConfirmDialog>

      {open && step === "form" ? (
        <>
          <ModalOverlay open onClose={handleClose} />
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 16,
              zIndex: 60,
              pointerEvents: "none"
            }}
          >
            <div style={{ pointerEvents: "auto", width: "min(100%, 480px)" }}>
              <ModalPanel
                title="Generate invoice"
                onClose={handleClose}
                actions={
                  <>
                    <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                      Cancel
                    </Button>
                    <Button type="button" loading={loading} onClick={() => void submitForm()}>
                      Confirm Generate Invoice
                    </Button>
                  </>
                }
              >
                <form onSubmit={(e) => void submitForm(e)} style={{ display: "grid", gap: 12 }}>
                  <label className="pg-muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    Billing period
                    <Select value={invoicePeriod} onChange={(e) => setInvoicePeriod(e.target.value)}>
                      {periodOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="pg-muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    Invoice type
                    <Select
                      value={invoiceType}
                      onChange={(e) => setInvoiceType(e.target.value as ManualInvoiceType)}
                    >
                      {MANUAL_INVOICE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="pg-muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    Due date
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                  </label>
                  <label className="pg-muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    Amount
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                  <label className="pg-muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    Notes (optional)
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </label>
                  {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
                </form>
              </ModalPanel>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={open && step === "duplicate"}
        title="Invoice already exists"
        confirmLabel="View Existing Invoice"
        cancelLabel="Cancel"
        loading={loading}
        onClose={handleClose}
        onConfirm={() => {
          if (!duplicateInvoiceId) return;
          handleClose();
          navigate(invoiceDetailPath(duplicateInvoiceId));
        }}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          An invoice already exists for this lease and period.
        </p>
      </ConfirmDialog>
    </>
  );
}
