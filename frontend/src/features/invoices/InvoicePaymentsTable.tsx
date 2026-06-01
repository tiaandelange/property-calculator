import { useState } from "react";
import {
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableWrap
} from "../../components/tables";
import { IconButton } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { fmtZar } from "./invoiceDirectoryUtils";
import { formatPaymentDateLabel, type InvoicePaymentRow } from "./invoicePaymentUtils";

type Props = {
  payments: InvoicePaymentRow[];
  invoiceTotal: number;
  busyId?: string | null;
  onSave: (paymentId: string, patch: { paymentDate: string; paymentReference: string; amount: number }) => void;
  onDelete?: (paymentId: string) => void;
};

export function InvoicePaymentsTable({ payments, invoiceTotal, busyId, onSave, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftRef, setDraftRef] = useState("");
  const [draftAmount, setDraftAmount] = useState("");

  const startEdit = (p: InvoicePaymentRow) => {
    setEditingId(p.id);
    setDraftDate(p.paymentDate);
    setDraftRef(p.paymentReference ?? "");
    setDraftAmount(String(p.amount));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    const amount = Number(draftAmount);
    if (!draftDate || !Number.isFinite(amount) || amount <= 0) return;
    onSave(id, {
      paymentDate: draftDate,
      paymentReference: draftRef.trim(),
      amount
    });
    setEditingId(null);
  };

  return (
    <section className="pg-inv-payments" aria-labelledby="pg-inv-payments-heading">
      <h3 id="pg-inv-payments-heading" className="pg-inv-lines__section-title">
        Payments received
      </h3>
      {payments.length === 0 ? (
        <ProplyticTableEmptyState title="No payments recorded yet." />
      ) : (
        <ProplyticTableWrap responsive>
          <ProplyticTable>
            <ProplyticTableHeader>
              <ProplyticTableRow>
                <ProplyticTableHeadCell columnType="date">Date</ProplyticTableHeadCell>
                <ProplyticTableHeadCell columnType="text">Reference</ProplyticTableHeadCell>
                <ProplyticTableHeadCell columnType="currency">Amount</ProplyticTableHeadCell>
                <ProplyticTableHeadCell columnType="text">Type</ProplyticTableHeadCell>
                <ProplyticTableHeadCell columnType="actions" />
              </ProplyticTableRow>
            </ProplyticTableHeader>
            <ProplyticTableBody>
              {payments.map((p) => {
                const isEditing = editingId === p.id;
                const isPartial = invoiceTotal > 0 && p.amount < invoiceTotal - 0.005;
                const rowBusy = busyId === p.id;
                return (
                  <ProplyticTableRow key={p.id}>
                    <ProplyticTableCell columnType="date">
                      {isEditing ? (
                        <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
                      ) : (
                        formatPaymentDateLabel(p.paymentDate)
                      )}
                    </ProplyticTableCell>
                    <ProplyticTableCell columnType="text">
                      {isEditing ? (
                        <Input value={draftRef} onChange={(e) => setDraftRef(e.target.value)} />
                      ) : (
                        p.paymentReference?.trim() || "—"
                      )}
                    </ProplyticTableCell>
                    <ProplyticTableCell columnType="currency">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={draftAmount}
                          onChange={(e) => setDraftAmount(e.target.value)}
                        />
                      ) : (
                        fmtZar(p.amount)
                      )}
                    </ProplyticTableCell>
                    <ProplyticTableCell columnType="text">
                      {isPartial ? "Partial payment" : "Full payment"}
                    </ProplyticTableCell>
                    <ProplyticTableCell columnType="actions">
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <Button type="button" variant="soft" size="sm" loading={rowBusy} onClick={() => saveEdit(p.id)}>
                            Save
                          </Button>
                          <Button type="button" variant="ghost" size="sm" disabled={rowBusy} onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <IconButton
                            icon="edit"
                            aria-label="Edit payment"
                            variant="ghost"
                            size="sm"
                            disabled={Boolean(busyId)}
                            onClick={() => startEdit(p)}
                          />
                          {onDelete ? (
                            <IconButton
                              icon="delete"
                              aria-label="Delete payment"
                              variant="danger-outline"
                              size="sm"
                              disabled={Boolean(busyId)}
                              onClick={() => onDelete(p.id)}
                            />
                          ) : null}
                        </div>
                      )}
                    </ProplyticTableCell>
                  </ProplyticTableRow>
                );
              })}
            </ProplyticTableBody>
          </ProplyticTable>
        </ProplyticTableWrap>
      )}
    </section>
  );
}
