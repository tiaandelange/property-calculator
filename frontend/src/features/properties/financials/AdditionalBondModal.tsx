import { FormEvent } from "react";
import { Card } from "../../../components/ui/Card";
import { Field, Input } from "../../../components/ui/Input";

export const ADDITIONAL_BOND_TERM_YEAR_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

export type AdditionalBondFormState = {
  description: string;
  outstandingBondBalance: string;
  bondAnnualInterestRatePercent: string;
  bondTermYears: string;
  bondStartDate: string;
  bondRemainingTermMonths: string;
  monthlyBondPayment: string;
};

export function emptyAdditionalBondForm(): AdditionalBondFormState {
  return {
    description: "",
    outstandingBondBalance: "",
    bondAnnualInterestRatePercent: "",
    bondTermYears: "",
    bondStartDate: "",
    bondRemainingTermMonths: "",
    monthlyBondPayment: ""
  };
}

export function additionalBondFormFromRecord(bond: {
  description: string;
  outstandingBalance: number | null;
  bondAnnualInterestRatePercent: number | null;
  bondTermYears: number | null;
  bondStartDate: string | null;
  bondRemainingTermMonths: number | null;
  monthlyPayment: number | null;
}): AdditionalBondFormState {
  const str = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? "" : String(v));
  return {
    description: bond.description ?? "",
    outstandingBondBalance: str(bond.outstandingBalance),
    bondAnnualInterestRatePercent: str(bond.bondAnnualInterestRatePercent),
    bondTermYears: bond.bondTermYears != null ? String(bond.bondTermYears) : "",
    bondStartDate: bond.bondStartDate ?? "",
    bondRemainingTermMonths: str(bond.bondRemainingTermMonths),
    monthlyBondPayment: str(bond.monthlyPayment)
  };
}

export function parseAdditionalBondForm(form: AdditionalBondFormState): {
  description: string;
  outstandingBalance: number | null;
  bondAnnualInterestRatePercent: number | null;
  bondTermYears: number | null;
  bondStartDate: string | null;
  bondRemainingTermMonths: number | null;
  monthlyPayment: number | null;
} {
  const parseOpt = (s: string) => {
    const t = String(s ?? "").trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const tyRaw = String(form.bondTermYears ?? "").trim();
  const allowedYears = ADDITIONAL_BOND_TERM_YEAR_OPTIONS as unknown as number[];
  const bondTermYears = tyRaw === "" ? null : allowedYears.includes(Number(tyRaw)) ? Number(tyRaw) : null;
  const sdRaw = String(form.bondStartDate ?? "").trim();
  const bondStartDate = /^\d{4}-\d{2}-\d{2}$/.test(sdRaw) ? sdRaw : null;

  return {
    description: form.description.trim(),
    outstandingBalance: parseOpt(form.outstandingBondBalance),
    bondAnnualInterestRatePercent: parseOpt(form.bondAnnualInterestRatePercent),
    bondTermYears,
    bondStartDate,
    bondRemainingTermMonths:
      bondTermYears != null && bondStartDate != null
        ? null
        : parseOpt(form.bondRemainingTermMonths) != null
          ? Math.max(0, Math.floor(Number(parseOpt(form.bondRemainingTermMonths))))
          : null,
    monthlyPayment: parseOpt(form.monthlyBondPayment)
  };
}

export function AdditionalBondModal({
  open,
  mode,
  form,
  onPatch,
  onSubmit,
  onDelete,
  onClose,
  saving,
  deleting
}: {
  open: boolean;
  mode: "add" | "edit";
  form: AdditionalBondFormState;
  onPatch: (patch: Partial<AdditionalBondFormState>) => void;
  onSubmit: (e: FormEvent) => void;
  onDelete?: () => void;
  onClose: () => void;
  saving?: boolean;
  deleting?: boolean;
}) {
  if (!open) return null;

  const busy = saving || deleting;

  return (
    <div
      className="pg-pfin-modal-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (!busy && ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="pg-pfin-modal" role="dialog" aria-modal="true" aria-labelledby="pfin-additional-bond-title">
        <Card title={mode === "add" ? "Add additional bond" : "Edit additional bond"}>
          <p className="pg-muted" style={{ marginTop: 0, fontSize: 14 }}>
            Track a second bond, access bond, or credit facility linked to this property. This is separate from the
            primary home-loan bond on the property profile.
          </p>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <Field label="Description" help="e.g. Second bond, credit card facility, access bond">
              <Input
                value={form.description}
                onChange={(e) => onPatch({ description: e.target.value })}
                placeholder="Second bond — FNB"
                required
              />
            </Field>
            <Field label="Outstanding balance">
              <Input
                type="number"
                step="any"
                min={0}
                value={form.outstandingBondBalance}
                onChange={(e) => onPatch({ outstandingBondBalance: e.target.value })}
              />
            </Field>
            <Field label="Interest rate (% p.a.)">
              <Input
                type="number"
                step="any"
                min={0}
                value={form.bondAnnualInterestRatePercent}
                onChange={(e) => onPatch({ bondAnnualInterestRatePercent: e.target.value })}
              />
            </Field>
            <Field label="Original term (years)">
              <select
                className="pg-input"
                value={form.bondTermYears}
                onChange={(e) => onPatch({ bondTermYears: e.target.value })}
              >
                <option value="">Not specified</option>
                {ADDITIONAL_BOND_TERM_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y} years
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start date">
              <Input
                type="date"
                value={form.bondStartDate}
                onChange={(e) => onPatch({ bondStartDate: e.target.value })}
              />
            </Field>
            <Field
              label="Months remaining (manual)"
              help="Only used when term and start date are not both set."
            >
              <Input
                type="number"
                step={1}
                min={0}
                value={form.bondRemainingTermMonths}
                onChange={(e) => onPatch({ bondRemainingTermMonths: e.target.value })}
              />
            </Field>
            <Field label="Monthly payment" help="Leave blank to derive from balance, rate, and term where possible.">
              <Input
                type="number"
                step="any"
                min={0}
                value={form.monthlyBondPayment}
                onChange={(e) => onPatch({ monthlyBondPayment: e.target.value })}
              />
            </Field>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button type="submit" className="pg-btn pg-btn-primary" disabled={busy}>
                {saving ? "Saving…" : mode === "add" ? "Add bond" : "Save changes"}
              </button>
              {mode === "edit" && onDelete ? (
                <button type="button" className="pg-btn pg-btn-danger" disabled={busy} onClick={onDelete}>
                  {deleting ? "Removing…" : "Remove bond"}
                </button>
              ) : null}
              <button type="button" className="pg-btn pg-btn-ghost" disabled={busy} onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
