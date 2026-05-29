import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Input } from "../../../components/ui/Input";
import { propertyFinancialsStatementUrl } from "../../financials/financialDirectoryUtils";
import { PropertyFormField } from "./PropertyFormField";
import { PropertyFormSection } from "./PropertyFormSection";
import { PropertyStructureSection } from "../units/PropertyStructureSection";
import {
  BOND_TERM_YEAR_OPTIONS,
  INVESTMENT_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  STATUS_OPTIONS,
  type PropertyFormMode,
  type PropertyFormValues
} from "./propertyFormConstants";

type SetForm = (patch: PropertyFormValues | ((prev: PropertyFormValues) => PropertyFormValues)) => void;

function numInputValue(v: unknown): string | number {
  if (v === "" || v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

export function PropertyFormSections({
  form,
  setForm,
  mode,
  propertyId,
  mediaSection
}: {
  form: PropertyFormValues;
  setForm: SetForm;
  mode: PropertyFormMode;
  propertyId?: string;
  mediaSection: ReactNode;
}) {
  const patch = (p: PropertyFormValues) => setForm((prev) => ({ ...prev, ...p }));
  const investmentType = String(form.investmentType ?? "LONG_TERM_RENTAL");

  return (
    <>
      <PropertyFormSection number={1} title="Basic Information" id="property-section-basic">
        <div className="pg-prop-grid pg-prop-grid--2">
          <PropertyFormField label="Property name" required className="pg-prop-grid__span-2">
            <Input value={String(form.name ?? "")} onChange={(e) => patch({ name: e.target.value })} required />
          </PropertyFormField>
          <PropertyFormField label="Investment strategy">
            <select
              className="pg-input"
              value={String(form.investmentType ?? "LONG_TERM_RENTAL")}
              onChange={(e) => patch({ investmentType: e.target.value })}
            >
              {INVESTMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </PropertyFormField>
          <PropertyFormField label="Property category">
            <select
              className="pg-input"
              value={String(form.propertyType ?? "OTHER")}
              onChange={(e) => patch({ propertyType: e.target.value })}
            >
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </PropertyFormField>
          <PropertyFormField label="Listing status">
            <select
              className="pg-input"
              value={String(form.status ?? "")}
              onChange={(e) => patch({ status: e.target.value || null })}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "unset"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </PropertyFormField>
        </div>
      </PropertyFormSection>

      <PropertyStructureSection form={form} setForm={setForm} mode={mode} />

      <PropertyFormSection number={3} title="Location" id="property-section-location">
        <div className="pg-prop-grid">
          <PropertyFormField label="Street address" required className="pg-prop-grid__span-2">
            <Input
              value={String(form.addressLine1 ?? "")}
              onChange={(e) => patch({ addressLine1: e.target.value })}
              required
            />
          </PropertyFormField>
          <PropertyFormField label="Address line 2" className="pg-prop-grid__span-2">
            <Input value={String(form.addressLine2 ?? "")} onChange={(e) => patch({ addressLine2: e.target.value })} />
          </PropertyFormField>
          <PropertyFormField label="Suburb">
            <Input value={String(form.suburb ?? "")} onChange={(e) => patch({ suburb: e.target.value })} />
          </PropertyFormField>
          <PropertyFormField label="ERF / unit number">
            <Input value={String(form.erfNumber ?? "")} onChange={(e) => patch({ erfNumber: e.target.value })} />
          </PropertyFormField>
          <PropertyFormField label="City" required>
            <Input value={String(form.city ?? "")} onChange={(e) => patch({ city: e.target.value })} required />
          </PropertyFormField>
          <PropertyFormField label="Province" required>
            <Input value={String(form.province ?? "")} onChange={(e) => patch({ province: e.target.value })} required />
          </PropertyFormField>
          <PropertyFormField label="Postal code">
            <Input value={String(form.postalCode ?? "")} onChange={(e) => patch({ postalCode: e.target.value })} />
          </PropertyFormField>
          <PropertyFormField label="Country">
            <Input
              value={String(form.country ?? "South Africa")}
              onChange={(e) => patch({ country: e.target.value })}
            />
          </PropertyFormField>
        </div>
      </PropertyFormSection>

      <PropertyFormSection number={4} title="Property Details" id="property-section-details">
        <div className="pg-prop-grid pg-prop-grid--4">
          <PropertyFormField label="Bedrooms">
            <Input
              type="number"
              min={0}
              step={1}
              value={numInputValue(form.bedrooms)}
              onChange={(e) => patch({ bedrooms: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
          <PropertyFormField label="Bathrooms">
            <Input
              type="number"
              min={0}
              step={1}
              value={numInputValue(form.bathrooms)}
              onChange={(e) => patch({ bathrooms: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
          <PropertyFormField label="Floor area (m²)">
            <Input
              type="number"
              min={0}
              value={numInputValue(form.sizeSqm)}
              onChange={(e) => patch({ sizeSqm: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
          <PropertyFormField label="Parking bays">
            <Input
              type="number"
              min={0}
              step={1}
              value={numInputValue(form.parkingBays)}
              onChange={(e) => patch({ parkingBays: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
        </div>
      </PropertyFormSection>

      <PropertyFormSection
        number={5}
        title="Financial Details"
        description="Purchase, bond, and portfolio assumptions. Ledger income and expenses are managed separately."
        id="property-section-financial"
      >
        {mode === "edit" && propertyId ? (
          <div className="pg-prop-related-actions">
            <Link to={`/owned-properties/${propertyId}?tab=overview`} className="pg-btn pg-btn-secondary">
              View Property
            </Link>
            <Link to={propertyFinancialsStatementUrl(propertyId, "statement")} className="pg-btn pg-btn-secondary">
              Manage Income
            </Link>
            <Link to={propertyFinancialsStatementUrl(propertyId, "expenses")} className="pg-btn pg-btn-secondary">
              Manage Expenses
            </Link>
            <Link to={`/financials?propertyId=${propertyId}`} className="pg-btn pg-btn-ghost">
              Open Financials Page
            </Link>
          </div>
        ) : null}

        <div className="pg-prop-grid pg-prop-grid--2">
          <PropertyFormField label="Purchase price" required>
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                value={numInputValue(form.purchasePrice)}
                onChange={(e) => patch({ purchasePrice: Number(e.target.value) })}
                required
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Purchase date">
            <Input
              type="date"
              value={
                typeof form.purchaseDate === "string"
                  ? form.purchaseDate.slice(0, 10)
                  : (form.purchaseDate as { slice?: (a: number, b: number) => string })?.slice?.(0, 10) ?? ""
              }
              onChange={(e) => patch({ purchaseDate: e.target.value })}
            />
          </PropertyFormField>
          <PropertyFormField label="Current estimated value">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                value={numInputValue(form.currentEstimatedValue)}
                onChange={(e) => patch({ currentEstimatedValue: Number(e.target.value) })}
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Outstanding bond balance">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                value={numInputValue(form.outstandingBondBalance)}
                onChange={(e) =>
                  patch({
                    outstandingBondBalance: e.target.value === "" ? null : Number(e.target.value)
                  })
                }
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
        </div>

        <h3 className="pg-prop-subheading" id="property-bond">
          Bond
        </h3>
        <div className="pg-prop-grid pg-prop-grid--2">
          <PropertyFormField
            label="Bond interest rate (% p.a.)"
            help="Nominal annual rate — used with remaining term (from duration + start date) to estimate instalment and interest split."
          >
            <Input
              type="number"
              step="any"
              min={0}
              value={numInputValue(form.bondAnnualInterestRatePercent)}
              onChange={(e) =>
                patch({
                  bondAnnualInterestRatePercent: e.target.value === "" ? null : Number(e.target.value)
                })
              }
            />
          </PropertyFormField>
          <PropertyFormField label="Bond duration (years)" help="Original registered term — steps of 5 years up to 30 years.">
            <select
              className="pg-input"
              value={form.bondTermYears === null || form.bondTermYears === undefined ? "" : String(form.bondTermYears)}
              onChange={(e) => patch({ bondTermYears: e.target.value === "" ? "" : Number(e.target.value) })}
            >
              <option value="">Not specified</option>
              {BOND_TERM_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y} years
                </option>
              ))}
            </select>
          </PropertyFormField>
          <PropertyFormField
            label="Bond start date"
            help="Registration / first debit month anchor — used with duration to calculate months remaining automatically."
          >
            <Input
              type="date"
              value={
                typeof form.bondStartDate === "string"
                  ? form.bondStartDate.slice(0, 10)
                  : (form.bondStartDate as { slice?: (a: number, b: number) => string })?.slice?.(0, 10) ?? ""
              }
              onChange={(e) => patch({ bondStartDate: e.target.value || "" })}
            />
          </PropertyFormField>
          <PropertyFormField
            label="Bond — months remaining (manual)"
            help="Used only when bond duration and start date are not both set."
          >
            <Input
              type="number"
              step={1}
              min={0}
              value={numInputValue(form.bondRemainingTermMonths)}
              onChange={(e) =>
                patch({
                  bondRemainingTermMonths:
                    e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)))
                })
              }
            />
          </PropertyFormField>
          <PropertyFormField label="Monthly bond payment" help="Leave blank to derive from balance + rate + term where possible.">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                step="any"
                min={0}
                value={numInputValue(form.monthlyBondPayment)}
                onChange={(e) => patch({ monthlyBondPayment: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Bond — interest portion override (optional)">
            <Input
              type="number"
              step="any"
              min={0}
              value={numInputValue(form.bondInterestPortionOverride)}
              onChange={(e) =>
                patch({ bondInterestPortionOverride: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </PropertyFormField>
          <PropertyFormField label="Bond — principal portion override (optional)">
            <Input
              type="number"
              step="any"
              min={0}
              value={numInputValue(form.bondPrincipalPortionOverride)}
              onChange={(e) =>
                patch({ bondPrincipalPortionOverride: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </PropertyFormField>
        </div>

        <h3 className="pg-prop-subheading">Investment assumptions</h3>
        <p className="pg-prop-section__desc pg-prop-section__desc--inline">
          Total cash invested should include deposit plus purchasing costs (bond, renovation and transfer costs),
          furnishings and other out-of-pocket acquisition costs. Portfolio IRR uses bond fields, appreciation &amp;
          selling cost %, holding period, cash invested, and — when both are set — expected monthly income &amp;
          expenses below.
        </p>
        <div className="pg-prop-grid pg-prop-grid--2">
          <PropertyFormField label="Total cash invested">
            <Input
              type="number"
              value={numInputValue(form.totalCashInvested)}
              onChange={(e) => patch({ totalCashInvested: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
          <PropertyFormField
            label="Expected monthly income (IRR)"
            help="Optional baseline for portfolio IRR when paired with expected expenses."
          >
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                step="any"
                min={0}
                value={numInputValue(form.expectedMonthlyIncome)}
                onChange={(e) =>
                  patch({ expectedMonthlyIncome: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Expected monthly expenses (IRR)">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                step="any"
                min={0}
                value={numInputValue(form.expectedMonthlyExpenses)}
                onChange={(e) =>
                  patch({ expectedMonthlyExpenses: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Bond costs (once-off)">
            <Input
              type="number"
              value={numInputValue(form.bondCosts)}
              onChange={(e) => patch({ bondCosts: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
          <PropertyFormField label="Transfer costs (once-off)">
            <Input
              type="number"
              value={numInputValue(form.transferCosts)}
              onChange={(e) => patch({ transferCosts: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
          <PropertyFormField label="Expected annual appreciation %">
            <Input
              type="number"
              value={numInputValue(form.expectedAnnualAppreciationPercent)}
              onChange={(e) =>
                patch({
                  expectedAnnualAppreciationPercent: e.target.value === "" ? null : Number(e.target.value)
                })
              }
            />
          </PropertyFormField>
          <PropertyFormField label="Holding period (years)">
            <Input
              type="number"
              value={numInputValue(form.holdingPeriodYears)}
              onChange={(e) => patch({ holdingPeriodYears: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </PropertyFormField>
          <PropertyFormField label="Estimated selling cost %">
            <Input
              type="number"
              value={numInputValue(form.estimatedSellingCostPercent)}
              onChange={(e) =>
                patch({ estimatedSellingCostPercent: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </PropertyFormField>
        </div>

        {investmentType === "VACANT_LAND" ? <VacantLandFields form={form} patch={patch} /> : null}
        {investmentType === "SHORT_TERM_RENTAL" ? <ShortTermRentalFields form={form} patch={patch} /> : null}
        {investmentType === "FLIP" ? <FlipFields form={form} patch={patch} /> : null}
        {investmentType === "BRRRR" ? <BrrrrFields form={form} patch={patch} /> : null}
      </PropertyFormSection>

      <PropertyFormSection
        number={6}
        title="Maintenance & Vacancy"
        id="property-section-maintenance"
      >
        <div className="pg-prop-grid pg-prop-grid--2">
          <PropertyFormField label="Maintenance (monthly)" help="Operating maintenance reserve or actual cost.">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                value={numInputValue(form.maintenanceMonthly)}
                onChange={(e) => patch({ maintenanceMonthly: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Rates & taxes (monthly)">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                value={numInputValue(form.ratesAndTaxesMonthly)}
                onChange={(e) => patch({ ratesAndTaxesMonthly: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Levies (monthly)">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                value={numInputValue(form.leviesMonthly)}
                onChange={(e) => patch({ leviesMonthly: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
          <PropertyFormField label="Security (monthly)">
            <div className="pg-prop-input-suffix">
              <Input
                type="number"
                value={numInputValue(form.securityMonthly)}
                onChange={(e) => patch({ securityMonthly: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <span className="pg-prop-input-suffix__tag">ZAR</span>
            </div>
          </PropertyFormField>
        </div>
      </PropertyFormSection>

      <PropertyFormSection number={7} title="Media Upload" id="property-section-media">
        {mediaSection}
      </PropertyFormSection>

      <PropertyFormSection number={8} title="Description & Notes" id="property-section-description">
        <PropertyFormField label="Property notes & description">
          <textarea
            className="pg-input pg-prop-textarea"
            rows={5}
            value={String(form.notes ?? "")}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Describe the property, amenities, and management notes…"
          />
        </PropertyFormField>
      </PropertyFormSection>
    </>
  );
}

function VacantLandFields({
  form,
  patch
}: {
  form: PropertyFormValues;
  patch: (p: PropertyFormValues) => void;
}) {
  return (
    <>
      <h3 className="pg-prop-subheading">Vacant land</h3>
      <div className="pg-prop-grid pg-prop-grid--2">
        <PropertyFormField label="Land use">
          <select className="pg-input" value={String(form.landUse ?? "")} onChange={(e) => patch({ landUse: e.target.value || null })}>
            <option value="">Unknown</option>
            <option value="RESIDENTIAL">Residential</option>
            <option value="AGRICULTURAL">Agricultural</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="OTHER">Other</option>
          </select>
        </PropertyFormField>
        <PropertyFormField label="Zoning (optional)">
          <Input value={String(form.zoning ?? "")} onChange={(e) => patch({ zoning: e.target.value })} />
        </PropertyFormField>
      </div>
    </>
  );
}

function ShortTermRentalFields({
  form,
  patch
}: {
  form: PropertyFormValues;
  patch: (p: PropertyFormValues) => void;
}) {
  return (
    <>
      <h3 className="pg-prop-subheading">Short-term rental</h3>
      <div className="pg-prop-grid pg-prop-grid--2">
        <PropertyFormField label="Average daily rate (ADR)">
          <Input
            type="number"
            value={numInputValue(form.averageDailyRate)}
            onChange={(e) => patch({ averageDailyRate: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Occupancy rate (0 to 1)">
          <Input
            type="number"
            value={numInputValue(form.occupancyRate)}
            onChange={(e) => patch({ occupancyRate: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Available nights per month">
          <Input
            type="number"
            value={numInputValue(form.availableNightsPerMonth)}
            onChange={(e) => patch({ availableNightsPerMonth: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Platform fee %">
          <Input
            type="number"
            value={numInputValue(form.platformFeePercent)}
            onChange={(e) => patch({ platformFeePercent: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Management fee %">
          <Input
            type="number"
            value={numInputValue(form.managementFeePercent)}
            onChange={(e) => patch({ managementFeePercent: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Cleaning fees (monthly)">
          <Input
            type="number"
            value={numInputValue(form.cleaningFeesMonthly)}
            onChange={(e) => patch({ cleaningFeesMonthly: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Monthly utilities">
          <Input
            type="number"
            value={numInputValue(form.monthlyUtilities)}
            onChange={(e) => patch({ monthlyUtilities: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Furnishing value (optional)">
          <Input
            type="number"
            value={numInputValue(form.furnishingValue)}
            onChange={(e) => patch({ furnishingValue: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
      </div>
    </>
  );
}

function FlipFields({ form, patch }: { form: PropertyFormValues; patch: (p: PropertyFormValues) => void }) {
  return (
    <>
      <h3 className="pg-prop-subheading">Flip / renovation project</h3>
      <div className="pg-prop-grid pg-prop-grid--2">
        <PropertyFormField label="Project stage">
          <select
            className="pg-input"
            value={String(form.projectStage ?? "")}
            onChange={(e) => patch({ projectStage: e.target.value || null })}
          >
            <option value="">Unknown</option>
            <option value="ACQUISITION">Acquisition</option>
            <option value="RENOVATION">Renovation</option>
            <option value="FOR_SALE">For Sale</option>
            <option value="SOLD">Sold</option>
          </select>
        </PropertyFormField>
        <PropertyFormField label="Rehab budget">
          <Input
            type="number"
            value={numInputValue(form.rehabBudget)}
            onChange={(e) => patch({ rehabBudget: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Holding costs (monthly)">
          <Input
            type="number"
            value={numInputValue(form.holdingCostsMonthly)}
            onChange={(e) => patch({ holdingCostsMonthly: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Expected sale price">
          <Input
            type="number"
            value={numInputValue(form.expectedSalePrice)}
            onChange={(e) => patch({ expectedSalePrice: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Target sale date">
          <Input
            type="date"
            value={
              typeof form.targetSaleDate === "string"
                ? form.targetSaleDate.slice(0, 10)
                : (form.targetSaleDate as { slice?: (a: number, b: number) => string })?.slice?.(0, 10) ?? ""
            }
            onChange={(e) => patch({ targetSaleDate: e.target.value })}
          />
        </PropertyFormField>
      </div>
    </>
  );
}

function BrrrrFields({ form, patch }: { form: PropertyFormValues; patch: (p: PropertyFormValues) => void }) {
  return (
    <>
      <h3 className="pg-prop-subheading">BRRRR</h3>
      <div className="pg-prop-grid pg-prop-grid--2">
        <PropertyFormField label="Stage">
          <select
            className="pg-input"
            value={String(form.brrrrStage ?? "")}
            onChange={(e) => patch({ brrrrStage: e.target.value || null })}
          >
            <option value="">Unknown</option>
            <option value="ACQUISITION">Acquisition</option>
            <option value="RENOVATION">Renovation</option>
            <option value="RENTED">Rented</option>
            <option value="REFINANCED">Refinanced</option>
          </select>
        </PropertyFormField>
        <PropertyFormField label="Rehab budget">
          <Input
            type="number"
            value={numInputValue(form.rehabBudget)}
            onChange={(e) => patch({ rehabBudget: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="After repair value (ARV)">
          <Input
            type="number"
            value={numInputValue(form.afterRepairValue)}
            onChange={(e) => patch({ afterRepairValue: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
        <PropertyFormField label="Refinance amount">
          <Input
            type="number"
            value={numInputValue(form.refinanceAmount)}
            onChange={(e) => patch({ refinanceAmount: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </PropertyFormField>
      </div>
    </>
  );
}
