import { FormEvent, useEffect, useState } from "react";
import { Input } from "../../../components/ui/Input";
import { PropertyFormField } from "../form/PropertyFormField";

export type FinancialDetailsFormState = {
  monthlyRent: string;
  depositHeld: string;
  purchasePrice: string;
  marketValue: string;
  leviesMonthly: string;
  ratesAndTaxesMonthly: string;
  maintenanceMonthly: string;
  expectedMonthlyIncome: string;
  expectedMonthlyExpenses: string;
  rentDueDay: string;
  leaseStartDate: string;
  leaseEndDate: string;
  notes: string;
};

function str(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}

export function buildFinancialDetailsInitial(
  propertyDetail: Record<string, unknown> | null,
  primaryLease: Record<string, unknown> | null,
  depositHeldTotal: number
): FinancialDetailsFormState {
  const pf = propertyDetail ?? {};
  return {
    monthlyRent: str(primaryLease?.monthlyRent),
    depositHeld: depositHeldTotal > 0 ? String(depositHeldTotal) : str(primaryLease?.depositAmount),
    purchasePrice: str(pf.purchasePrice),
    marketValue: str(pf.currentEstimatedValue),
    leviesMonthly: str(pf.leviesMonthly),
    ratesAndTaxesMonthly: str(pf.ratesAndTaxesMonthly),
    maintenanceMonthly: str(pf.maintenanceMonthly),
    expectedMonthlyIncome: str(pf.expectedMonthlyIncome),
    expectedMonthlyExpenses: str(pf.expectedMonthlyExpenses),
    rentDueDay: str(primaryLease?.rentDueDay),
    leaseStartDate: primaryLease?.startDate ? String(primaryLease.startDate).slice(0, 10) : "",
    leaseEndDate: primaryLease?.endDate ? String(primaryLease.endDate).slice(0, 10) : "",
    notes: str(pf.notes)
  };
}

export function PropertyFinancialDetailsForm({
  propertyDetail,
  primaryLease,
  depositHeldTotal,
  compact,
  onSubmit,
  saving,
  formId
}: {
  propertyDetail: Record<string, unknown> | null;
  primaryLease: Record<string, unknown> | null;
  depositHeldTotal: number;
  compact?: boolean;
  onSubmit: (state: FinancialDetailsFormState) => Promise<void>;
  saving?: boolean;
  formId?: string;
}) {
  const [form, setForm] = useState<FinancialDetailsFormState>(() =>
    buildFinancialDetailsInitial(propertyDetail, primaryLease, depositHeldTotal)
  );

  useEffect(() => {
    setForm(buildFinancialDetailsInitial(propertyDetail, primaryLease, depositHeldTotal));
  }, [propertyDetail, primaryLease, depositHeldTotal]);

  const patch = (p: Partial<FinancialDetailsFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(form);
  };

  const fields = (
    <>
      <PropertyFormField label="Monthly rent">
        <div className="pg-pfin-input-suffix">
          <Input value={form.monthlyRent} onChange={(e) => patch({ monthlyRent: e.target.value })} type="number" min={0} />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Deposit held">
        <div className="pg-pfin-input-suffix">
          <Input value={form.depositHeld} onChange={(e) => patch({ depositHeld: e.target.value })} type="number" min={0} />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Purchase price">
        <div className="pg-pfin-input-suffix">
          <Input value={form.purchasePrice} onChange={(e) => patch({ purchasePrice: e.target.value })} type="number" min={0} />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Market value">
        <div className="pg-pfin-input-suffix">
          <Input value={form.marketValue} onChange={(e) => patch({ marketValue: e.target.value })} type="number" min={0} />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
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
      <PropertyFormField label="Maintenance reserve">
        <div className="pg-pfin-input-suffix">
          <Input
            value={form.maintenanceMonthly}
            onChange={(e) => patch({ maintenanceMonthly: e.target.value })}
            type="number"
            min={0}
          />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Expected monthly income (IRR)">
        <div className="pg-pfin-input-suffix">
          <Input
            value={form.expectedMonthlyIncome}
            onChange={(e) => patch({ expectedMonthlyIncome: e.target.value })}
            type="number"
            min={0}
          />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Expected monthly expenses (IRR)">
        <div className="pg-pfin-input-suffix">
          <Input
            value={form.expectedMonthlyExpenses}
            onChange={(e) => patch({ expectedMonthlyExpenses: e.target.value })}
            type="number"
            min={0}
          />
          <span className="pg-pfin-input-suffix__tag">ZAR</span>
        </div>
      </PropertyFormField>
      <PropertyFormField label="Rent due day">
        <Input
          value={form.rentDueDay}
          onChange={(e) => patch({ rentDueDay: e.target.value })}
          type="number"
          min={1}
          max={31}
          disabled={!primaryLease}
        />
      </PropertyFormField>
      <PropertyFormField label="Lease start date">
        <Input
          type="date"
          value={form.leaseStartDate}
          onChange={(e) => patch({ leaseStartDate: e.target.value })}
          disabled={!primaryLease}
        />
      </PropertyFormField>
      <PropertyFormField label="Lease end date">
        <Input
          type="date"
          value={form.leaseEndDate}
          onChange={(e) => patch({ leaseEndDate: e.target.value })}
          disabled={!primaryLease}
        />
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
            <div className="pg-pfin-input-suffix">
              <Input value={form.monthlyRent} onChange={(e) => patch({ monthlyRent: e.target.value })} type="number" />
              <span className="pg-pfin-input-suffix__tag">ZAR</span>
            </div>
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
          <PropertyFormField label="Maintenance reserve">
            <div className="pg-pfin-input-suffix">
              <Input
                value={form.maintenanceMonthly}
                onChange={(e) => patch({ maintenanceMonthly: e.target.value })}
                type="number"
              />
              <span className="pg-pfin-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <a href="#pfin-full-details" className="pg-pfin-link-all">
            View all financial details
          </a>
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
          {!primaryLease ? " Add an active lease to edit rent and lease dates." : null}
        </p>
      </header>
      <form id={formId} className="pg-pfin-grid" onSubmit={handleSubmit}>
        {fields}
        <div className="pg-pfin-form-actions">
          <button type="submit" className="pg-btn pg-btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save financial details"}
          </button>
        </div>
      </form>
    </section>
  );
}
