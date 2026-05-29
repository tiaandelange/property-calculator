import { FormEvent } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/Input";

export type RecurringExpenseFormState = {
  recurringStartDate: string;
  recurringEndDate: string;
  recurringOpenEnded: boolean;
  recurringMonthAnchor: "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH";
  recurringDayOfMonth: number;
  category: string;
  description: string;
  amount: string;
};

const RECURRING_ANCHOR_OPTIONS: Array<{ value: RecurringExpenseFormState["recurringMonthAnchor"]; label: string }> = [
  { value: "FIRST_OF_MONTH", label: "1st of the month" },
  { value: "LAST_OF_MONTH", label: "Last day of the month" },
  { value: "DAY_OF_MONTH", label: "Specific calendar day" }
];

function ymdCarrierForDayDom(day: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const d = Math.min(Math.max(1, Math.floor(day)), dim);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDomFromYmd(ymd: string): number {
  const p = ymd.split("-");
  const dom = Number(p[2]);
  return Number.isFinite(dom) ? Math.min(31, Math.max(1, Math.floor(dom))) : 15;
}

export function RecurringExpenseModal({
  open,
  mode,
  form,
  onPatch,
  onSubmit,
  onClose,
  saving,
  categoryOptions
}: {
  open: boolean;
  mode: "add" | "edit";
  form: RecurringExpenseFormState;
  onPatch: (patch: Partial<RecurringExpenseFormState>) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  saving?: boolean;
  categoryOptions: Array<{ value: string; label: string }>;
}) {
  if (!open) return null;

  return (
    <div
      className="pg-pfin-modal-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (!saving && ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="pg-pfin-modal" role="dialog" aria-modal="true" aria-labelledby="pfin-recurring-modal-title">
        <Card title={mode === "add" ? "Add recurring expense" : "Edit recurring expense"}>
          <p className="pg-muted" style={{ marginTop: 0, fontSize: 14 }}>
            Monthly schedules post automatically to your property ledger on each due date.
          </p>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <Field label="Schedule starts">
              <Input
                type="date"
                value={form.recurringStartDate}
                onChange={(e) => onPatch({ recurringStartDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Due each month">
              <select
                className="pg-input"
                value={form.recurringMonthAnchor}
                onChange={(e) =>
                  onPatch({
                    recurringMonthAnchor: e.target.value as RecurringExpenseFormState["recurringMonthAnchor"]
                  })
                }
              >
                {RECURRING_ANCHOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            {form.recurringMonthAnchor === "DAY_OF_MONTH" ? (
              <Field
                label="Calendar day"
                help="Only the day number repeats each month (e.g. the 14th). Short months use the last valid day."
              >
                <Input
                  type="date"
                  value={ymdCarrierForDayDom(form.recurringDayOfMonth)}
                  onChange={(e) => onPatch({ recurringDayOfMonth: parseDomFromYmd(e.target.value) })}
                  required
                />
              </Field>
            ) : null}
            <label className="pg-pill" style={{ cursor: "pointer", justifyContent: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.recurringOpenEnded}
                onChange={(e) =>
                  onPatch({
                    recurringOpenEnded: e.target.checked,
                    recurringEndDate: e.target.checked ? "" : form.recurringEndDate
                  })
                }
              />{" "}
              No end date
            </label>
            {!form.recurringOpenEnded ? (
              <Field label="Schedule ends">
                <Input
                  type="date"
                  value={form.recurringEndDate}
                  onChange={(e) => onPatch({ recurringEndDate: e.target.value })}
                  required={!form.recurringOpenEnded}
                />
              </Field>
            ) : null}
            <Field label="Category" help="Bond instalments are managed separately under bond payment profile.">
              <select
                className="pg-input"
                value={form.category}
                onChange={(e) => {
                  const v = e.target.value;
                  const label = categoryOptions.find((o) => o.value === v)?.label ?? v;
                  onPatch({ category: v, description: label });
                }}
              >
                {categoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(e) => onPatch({ description: e.target.value })} required />
            </Field>
            <Field label="Amount (R)">
              <Input
                type="number"
                step="any"
                min={0}
                value={form.amount}
                onChange={(e) => onPatch({ amount: e.target.value })}
                placeholder="0"
                required
              />
            </Field>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button type="submit" variant="primary" disabled={saving} loading={saving}>
                {mode === "add" ? "Add recurring expense" : "Save changes"}
              </Button>
              <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
