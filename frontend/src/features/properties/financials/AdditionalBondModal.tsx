import { FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { AppFormModal } from "../../../components/ui/AppModal";
import { Field, Input } from "../../../components/ui/Input";

export const ADDITIONAL_BOND_TERM_YEAR_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

export type AdditionalBondFormState = {
  description: string;
  outstandingBondBalance: string;
  bondAnnualInterestRatePercent: string;
  bondTermYears: string;
  bondStartDate: string;
  monthlyBondPayment: string;
};

export function emptyAdditionalBondForm(): AdditionalBondFormState {
  return {
    description: "",
    outstandingBondBalance: "",
    bondAnnualInterestRatePercent: "",
    bondTermYears: "",
    bondStartDate: "",
    monthlyBondPayment: ""
  };
}

export function additionalBondFormFromRecord(bond: {
  description: string;
  outstandingBalance: number | null;
  bondAnnualInterestRatePercent: number | null;
  bondTermYears: number | null;
  bondStartDate: string | null;
  monthlyPayment: number | null;
}): AdditionalBondFormState {
  const str = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? "" : String(v));
  return {
    description: bond.description ?? "",
    outstandingBondBalance: str(bond.outstandingBalance),
    bondAnnualInterestRatePercent: str(bond.bondAnnualInterestRatePercent),
    bondTermYears: bond.bondTermYears != null ? String(bond.bondTermYears) : "",
    bondStartDate: bond.bondStartDate ?? "",
    monthlyBondPayment: str(bond.monthlyPayment)
  };
}

export function parseAdditionalBondForm(form: AdditionalBondFormState): {
  description: string;
  outstandingBalance: number | null;
  bondAnnualInterestRatePercent: number | null;
  bondTermYears: number | null;
  bondStartDate: string | null;
  bondRemainingTermMonths: null;
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
    bondRemainingTermMonths: null,
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
  const busy = saving || deleting;

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title={mode === "add" ? "Add additional bond" : "Edit additional bond"}
      description="Track a second bond, access bond, or credit facility linked to this property. This is separate from the primary home-loan bond on the property profile."
      size="md"
      loading={busy}
      closeOnOverlayClick={!busy}
      onSubmit={onSubmit}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          {mode === "edit" && onDelete ? (
            <Button type="button" variant="danger" disabled={busy} loading={deleting} onClick={onDelete}>
              Remove bond
            </Button>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy} loading={saving}>
            {mode === "add" ? "Add bond" : "Save changes"}
          </Button>
        </div>
      }
    >
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
      <Field label="Interest rate (% p.a.)" help="Used with term and start date to derive months remaining.">
        <Input
          type="number"
          step="any"
          min={0}
          value={form.bondAnnualInterestRatePercent}
          onChange={(e) => onPatch({ bondAnnualInterestRatePercent: e.target.value })}
        />
      </Field>
      <Field label="Original term (years)" help="Registered term in 5-year steps up to 30 years.">
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
      <Field label="Start date" help="Registration or first debit date — pairs with term for remaining months.">
        <Input type="date" value={form.bondStartDate} onChange={(e) => onPatch({ bondStartDate: e.target.value })} />
      </Field>
      <Field
        label="Monthly payment"
        help="Leave blank to derive from balance, rate, and term. Adjust actual debits on the statement."
      >
        <Input
          type="number"
          step="any"
          min={0}
          value={form.monthlyBondPayment}
          onChange={(e) => onPatch({ monthlyBondPayment: e.target.value })}
        />
      </Field>
    </AppFormModal>
  );
}
