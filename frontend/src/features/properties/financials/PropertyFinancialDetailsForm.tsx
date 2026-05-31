import { FormEvent, useEffect, useState } from "react";
import { PropertyFormField } from "../form/PropertyFormField";
import { formatMetricPercent } from "./propertyFinancialMetrics";

export type FinancialDetailsFormState = {
  notes: string;
};

function str(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}

export function buildFinancialDetailsInitial(propertyDetail: Record<string, unknown> | null): FinancialDetailsFormState {
  const pf = propertyDetail ?? {};
  return {
    notes: str(pf.notes)
  };
}

export function PropertyFinancialDetailsForm({
  propertyDetail,
  combinedMonthlyRent,
  combinedDepositHeld,
  purchasePrice,
  marketValue,
  maintenancePercent,
  vacancyPercent,
  metricsPeriodLabel,
  compact,
  onSubmit,
  saving,
  formId
}: {
  propertyDetail: Record<string, unknown> | null;
  combinedMonthlyRent: number;
  combinedDepositHeld: number;
  purchasePrice: number;
  marketValue: number;
  maintenancePercent: number;
  vacancyPercent: number;
  metricsPeriodLabel?: string;
  compact?: boolean;
  onSubmit: (state: FinancialDetailsFormState) => Promise<void>;
  saving?: boolean;
  formId?: string;
}) {
  const [form, setForm] = useState<FinancialDetailsFormState>(() => buildFinancialDetailsInitial(propertyDetail));

  useEffect(() => {
    setForm(buildFinancialDetailsInitial(propertyDetail));
  }, [propertyDetail]);

  const patch = (p: Partial<FinancialDetailsFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(form);
  };

  const metricsHelp = metricsPeriodLabel
    ? `Calculated from actual ledger activity (${metricsPeriodLabel}). Add levies under Recurring expenses.`
    : "Calculated from actual ledger activity over the property period. Add levies under Recurring expenses.";

  const fields = (
    <>
      <PropertyFormField
        label="Monthly rent"
        info="Derived from active leases. Update this by creating or editing leases (read-only here)."
      >
        <div className="pg-pfin-readonly">R {Math.round(combinedMonthlyRent).toLocaleString()}</div>
      </PropertyFormField>
      <PropertyFormField
        label="Deposit held"
        info="Derived from active lease deposits. Update this on the lease (read-only here)."
      >
        <div className="pg-pfin-readonly">R {Math.round(combinedDepositHeld).toLocaleString()}</div>
      </PropertyFormField>
      <PropertyFormField label="Purchase price" info="Saved on the property record (read-only here).">
        <div className="pg-pfin-readonly">{purchasePrice > 0 ? `R ${Math.round(purchasePrice).toLocaleString()}` : "—"}</div>
      </PropertyFormField>
      <PropertyFormField label="Market value" info="Saved on the property record (read-only here).">
        <div className="pg-pfin-readonly">{marketValue > 0 ? `R ${Math.round(marketValue).toLocaleString()}` : "—"}</div>
      </PropertyFormField>
      <PropertyFormField
        label="Maintenance"
        info={`Actual maintenance and repair spend as a percentage of collected income. ${metricsHelp}`}
      >
        <div className="pg-pfin-readonly">{formatMetricPercent(maintenancePercent)}</div>
      </PropertyFormField>
      <PropertyFormField
        label="Vacancy"
        info="Months without an active lease count the expected rent not collected toward vacancy loss, as a percentage of collected income."
      >
        <div className="pg-pfin-readonly">{formatMetricPercent(vacancyPercent)}</div>
      </PropertyFormField>
      <PropertyFormField label="Financial notes" className="pg-pfin-grid__span-2 pg-pfin-notes-field">
        <textarea
          className="pg-input pg-pfin-textarea"
          rows={3}
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Notes for reporting and tenant management…"
        />
      </PropertyFormField>
    </>
  );

  if (compact) {
    return (
      <section className="pg-pfin-section">
        <header className="pg-pfin-section__head">
          <h2 className="pg-pfin-section__title">Key Financial Details</h2>
        </header>
        <form id={formId} className="pg-pfin-grid pg-pfin-grid--2" onSubmit={handleSubmit}>
          <PropertyFormField label="Monthly rent">
            <div className="pg-pfin-readonly">R {Math.round(combinedMonthlyRent).toLocaleString()}</div>
          </PropertyFormField>
          <PropertyFormField label="Maintenance">
            <div className="pg-pfin-readonly">{formatMetricPercent(maintenancePercent)}</div>
          </PropertyFormField>
          <PropertyFormField label="Vacancy">
            <div className="pg-pfin-readonly">{formatMetricPercent(vacancyPercent)}</div>
          </PropertyFormField>
        </form>
      </section>
    );
  }

  return (
    <section className="pg-pfin-section" id="pfin-full-details">
      <header className="pg-pfin-section__head">
        <h2 className="pg-pfin-section__title">Income &amp; Financial Details</h2>
        <p className="pg-pfin-section__desc">
          Property and lease figures used for reporting, IRR assumptions, and cash-flow forecasts.
          {" "}Monthly rent, deposits, maintenance, and vacancy are derived from leases and ledger activity (read-only here).
          {" "}HOA / levies belong under Recurring expenses.
        </p>
      </header>
      <form id={formId} className="pg-pfin-grid" onSubmit={handleSubmit}>
        {fields}
      </form>
    </section>
  );
}
