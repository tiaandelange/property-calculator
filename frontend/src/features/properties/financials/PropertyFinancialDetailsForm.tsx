import { FormEvent, useEffect, useState } from "react";
import { Input } from "../../../components/ui/Input";
import { PropertyFormField } from "../form/PropertyFormField";

export type FinancialDetailsFormState = {
  leviesMonthly: string;
  ratesAndTaxesMonthly: string;
  maintenancePercent: string;
  notes: string;
};

function str(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}

export function buildFinancialDetailsInitial(
  propertyDetail: Record<string, unknown> | null,
  _primaryLease: Record<string, unknown> | null,
  _depositHeldTotal: number
): FinancialDetailsFormState {
  const pf = propertyDetail ?? {};
  const rent = Number(pf.expectedMonthlyIncome ?? 0);
  const maintMonthly = Number(pf.maintenanceMonthly ?? 0);
  const maintPct = rent > 0 && maintMonthly > 0 ? ((maintMonthly / rent) * 100) : null;
  return {
    leviesMonthly: str(pf.leviesMonthly),
    ratesAndTaxesMonthly: str(pf.ratesAndTaxesMonthly),
    maintenancePercent: maintPct == null ? "" : String(Math.round(maintPct * 10) / 10),
    notes: str(pf.notes)
  };
}

export function PropertyFinancialDetailsForm({
  propertyDetail,
  primaryLease: _primaryLease,
  depositHeldTotal: _depositHeldTotal,
  combinedMonthlyRent,
  combinedDepositHeld,
  purchasePrice,
  marketValue,
  compact,
  onSubmit,
  saving,
  formId
}: {
  propertyDetail: Record<string, unknown> | null;
  primaryLease: Record<string, unknown> | null;
  depositHeldTotal: number;
  combinedMonthlyRent: number;
  combinedDepositHeld: number;
  purchasePrice: number;
  marketValue: number;
  compact?: boolean;
  onSubmit: (state: FinancialDetailsFormState) => Promise<void>;
  saving?: boolean;
  formId?: string;
}) {
  const [form, setForm] = useState<FinancialDetailsFormState>(() =>
    buildFinancialDetailsInitial(propertyDetail, _primaryLease, _depositHeldTotal)
  );

  useEffect(() => {
    setForm(buildFinancialDetailsInitial(propertyDetail, _primaryLease, _depositHeldTotal));
  }, [propertyDetail, _primaryLease, _depositHeldTotal]);

  const patch = (p: Partial<FinancialDetailsFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(form);
  };

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
      <PropertyFormField label="HOA / levies">
        <div className="pg-pfin-input-suffix">
          <Input value={form.leviesMonthly} onChange={(e) => patch({ leviesMonthly: e.target.value })} type="number" min={0} />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Rates & taxes">
        <div className="pg-pfin-input-suffix">
          <Input
            value={form.ratesAndTaxesMonthly}
            onChange={(e) => patch({ ratesAndTaxesMonthly: e.target.value })}
            type="number"
            min={0}
          />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Maintenance" info="Reserve as a percentage of monthly rent. Used for planning and reporting.">
        <div className="pg-pfin-input-suffix">
          <Input
            value={form.maintenancePercent}
            onChange={(e) => patch({ maintenancePercent: e.target.value })}
            type="number"
            min={0}
            step="0.1"
          />
          <span className="pg-pfin-input-suffix__tag">%</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Financial notes" className="pg-pfin-grid__span-2">
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
          <PropertyFormField label="Rates & taxes">
            <div className="pg-pfin-input-suffix">
              <Input
                value={form.ratesAndTaxesMonthly}
                onChange={(e) => patch({ ratesAndTaxesMonthly: e.target.value })}
                type="number"
              />
              <span className="pg-pfin-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Maintenance">
            <div className="pg-pfin-input-suffix">
              <Input
                value={form.maintenancePercent}
                onChange={(e) => patch({ maintenancePercent: e.target.value })}
                type="number"
                step="0.1"
              />
              <span className="pg-pfin-input-suffix__tag">%</span>
            </div>
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
          {" "}Monthly rent and deposits are derived from leases and are read-only here.
        </p>
      </header>
      <form id={formId} className="pg-pfin-grid" onSubmit={handleSubmit}>
        {fields}
      </form>
    </section>
  );
}
