import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Input, Field } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import {
  createProperty,
  deleteProperty,
  getProperty,
  propertyApiErrorMessage,
  updateProperty
} from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { PageBreadcrumb } from "../components/nav/PageBreadcrumb";
import { workspaceMyProperties } from "../nav/workspaceBreadcrumbs";

const BOND_TERM_YEAR_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

export function OwnedPropertyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<any>({
    name: "",
    propertyType: "OTHER",
    investmentType: "LONG_TERM_RENTAL",
    addressLine1: "",
    city: "",
    province: "",
    country: "South Africa",
    purchasePrice: ""
  });
  useEffect(() => {
    async function load() {
      if (!isEdit || !id) return;
      const data = await getProperty(id);
      setForm({
        ...data,
        propertyType: data.propertyType ?? "OTHER",
        investmentType: data.investmentType ?? "LONG_TERM_RENTAL",
        purchasePrice: data.purchasePrice ?? "",
        currentEstimatedValue: data.currentEstimatedValue ?? "",
        outstandingBondBalance: data.outstandingBondBalance ?? ""
      });
    }
    void load();
  }, [id, isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const tyRaw = form.bondTermYears;
      const allowedYears = BOND_TERM_YEAR_OPTIONS as unknown as number[];
      const bondTermYears =
        tyRaw === "" || tyRaw == null ? null : allowedYears.includes(Number(tyRaw)) ? Number(tyRaw) : null;
      const sdRaw = typeof form.bondStartDate === "string" ? form.bondStartDate.trim() : "";
      const bondStartDate = /^\d{4}-\d{2}-\d{2}$/.test(sdRaw) ? sdRaw : null;

      const propertyPayload: any = {
        ...form,
        propertyType: form.propertyType ?? "OTHER",
        bondTermYears,
        bondStartDate,
        bondRemainingTermMonths: bondTermYears != null && bondStartDate != null ? null : form.bondRemainingTermMonths ?? null
      };
      const saved = isEdit && id ? await updateProperty(id, propertyPayload) : await createProperty(propertyPayload);
      const propertyId = isEdit && id ? id : (saved?.id as string | number | undefined);
      if (propertyId != null && propertyId !== "") invalidatePropertyWorkspace(propertyId);

      if (!isEdit) navigate(`/owned-properties/${propertyId}?tab=overview`);
      else navigate(`/owned-properties/${propertyId}?tab=overview`);
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e) || "Failed to save property.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!isEdit || !id) return;
    if (!window.confirm("Permanently delete this property? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    try {
      await deleteProperty(id);
      invalidatePropertyWorkspace(id);
      navigate("/owned-properties");
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e) || "Failed to delete property.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Section>
      <Helmet><title>{isEdit ? "Edit Property" : "Add Property"} | The Property Guy</title></Helmet>
      <Container>
        <PageBreadcrumb
          items={workspaceMyProperties(isEdit ? (form.name?.trim() ? form.name.trim() : "Edit property") : "Add property")}
        />
        <Card>
          <h1 className="pg-h2">{isEdit ? "Edit Property" : "Add Property"}</h1>
          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
          {isEdit && id ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <a className="pg-btn pg-btn-ghost" href={`/owned-properties/${id}?tab=tenants`}>View Property → Tenants</a>
              <a className="pg-btn pg-btn-ghost" href={`/owned-properties/${id}?tab=financials`}>View Property → Financials</a>
              <a className="pg-btn pg-btn-ghost" href={`/financials?propertyId=${id}`}>Open Financials Page</a>
            </div>
          ) : null}
          <form onSubmit={submit}>
            <Field label="Property name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Property type">
              <select className="pg-input" value={form.investmentType} onChange={(e) => setForm({ ...form, investmentType: e.target.value })}>
                <option value="LONG_TERM_RENTAL">Long-Term Rental</option>
                <option value="SHORT_TERM_RENTAL">Airbnb / Short-Term Rental</option>
                <option value="PRIMARY_RESIDENCE">Primary Residence</option>
                <option value="HOUSE_HACK">House Hack</option>
                <option value="BRRRR">BRRRR Property</option>
                <option value="FLIP">Flip / Renovation Project</option>
                <option value="VACANT_LAND">Vacant Land</option>
                <option value="COMMERCIAL">Commercial Property</option>
                <option value="MIXED_USE">Mixed Use</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Address line 1"><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} required /></Field>
            <Field label="Address line 2"><Input value={form.addressLine2 ?? ""} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></Field>
            <Field label="Suburb"><Input value={form.suburb ?? ""} onChange={(e) => setForm({ ...form, suburb: e.target.value })} /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></Field>
            <Field label="Province"><Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} required /></Field>
            <Field label="Postal code"><Input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
            <Field label="Country"><Input value={form.country ?? "South Africa"} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            <Field label="Purchase price"><Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} required /></Field>
            <Field label="Purchase date"><Input type="date" value={form.purchaseDate?.slice?.(0, 10) ?? ""} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></Field>
            <Field label="Current estimated value"><Input type="number" value={form.currentEstimatedValue} onChange={(e) => setForm({ ...form, currentEstimatedValue: Number(e.target.value) })} /></Field>
            <Field label="Outstanding bond balance"><Input type="number" value={form.outstandingBondBalance} onChange={(e) => setForm({ ...form, outstandingBondBalance: Number(e.target.value) })} /></Field>
            <Field
              label="Bond interest rate (% p.a.)"
              help="Nominal annual rate — used with remaining term (from duration + start date) to estimate instalment and interest split."
            >
              <Input
                type="number"
                step="any"
                min={0}
                value={form.bondAnnualInterestRatePercent ?? ""}
                onChange={(e) =>
                  setForm({ ...form, bondAnnualInterestRatePercent: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Bond duration (years)" help="Original registered term — steps of 5 years up to 30 years.">
              <select
                className="pg-input"
                value={form.bondTermYears === null || form.bondTermYears === undefined ? "" : String(form.bondTermYears)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bondTermYears: e.target.value === "" ? "" : Number(e.target.value)
                  })
                }
              >
                <option value="">Not specified</option>
                {BOND_TERM_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y} years
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bond start date" help="Registration / first debit month anchor — used with duration to calculate months remaining automatically.">
              <Input
                type="date"
                value={
                  typeof form.bondStartDate === "string"
                    ? form.bondStartDate.slice(0, 10)
                    : form.bondStartDate?.slice?.(0, 10) ?? ""
                }
                onChange={(e) => setForm({ ...form, bondStartDate: e.target.value || "" })}
              />
            </Field>
            <Field
              label="Bond — months remaining (manual)"
              help="Used only when bond duration and start date are not both set. Otherwise remaining months come from duration minus elapsed time."
            >
              <Input
                type="number"
                step={1}
                min={0}
                value={form.bondRemainingTermMonths ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bondRemainingTermMonths: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)))
                  })
                }
              />
            </Field>
            <Field label="Monthly bond payment (bank debit)" help="Leave blank to derive from balance + rate + term where possible.">
              <Input
                type="number"
                step="any"
                min={0}
                value={form.monthlyBondPayment ?? ""}
                onChange={(e) => setForm({ ...form, monthlyBondPayment: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Bond — interest portion override (optional)" help="When the bank statement differs from the estimate for this period.">
              <Input
                type="number"
                step="any"
                min={0}
                value={form.bondInterestPortionOverride ?? ""}
                onChange={(e) =>
                  setForm({ ...form, bondInterestPortionOverride: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Bond — principal portion override (optional)">
              <Input
                type="number"
                step="any"
                min={0}
                value={form.bondPrincipalPortionOverride ?? ""}
                onChange={(e) =>
                  setForm({ ...form, bondPrincipalPortionOverride: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Notes"><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

            <div style={{ height: 10 }} />
            <h3 className="pg-h3" style={{ margin: "8px 0" }}>Investment assumptions</h3>
            <div className="pg-muted" style={{ marginBottom: 8 }}>
              Total cash invested should include deposit plus purchasing costs (Bond, renovation and Transfer costs), furnishings and other out-of-pocket acquisition costs.
              Portfolio IRR uses bond fields (rate, term, outstanding balance, instalment), appreciation & selling cost %, holding period, cash invested, and — when both are set — expected monthly income & expenses below; otherwise trailing‑12 statement averages.
            </div>
            <Field label="Total cash invested">
              <Input type="number" value={form.totalCashInvested ?? ""} onChange={(e) => setForm({ ...form, totalCashInvested: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field
              label="Expected monthly income (IRR)"
              help="Optional. When both income and expenses here are set, portfolio IRR uses them as the operating baseline (×12), then applies admin income/expense growth rates. Otherwise averages from your ledger/statements apply."
            >
              <Input
                type="number"
                step="any"
                min={0}
                value={form.expectedMonthlyIncome ?? ""}
                onChange={(e) =>
                  setForm({ ...form, expectedMonthlyIncome: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field
              label="Expected monthly expenses (IRR)"
              help="Include bond instalment here if you want all‑in monthly cash burden in this baseline; otherwise match how you define income (e.g. operating costs only if bond is tracked separately in statements)."
            >
              <Input
                type="number"
                step="any"
                min={0}
                value={form.expectedMonthlyExpenses ?? ""}
                onChange={(e) =>
                  setForm({ ...form, expectedMonthlyExpenses: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Bond costs (once-off)">
              <Input type="number" value={form.bondCosts ?? ""} onChange={(e) => setForm({ ...form, bondCosts: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Transfer costs (once-off)">
              <Input type="number" value={form.transferCosts ?? ""} onChange={(e) => setForm({ ...form, transferCosts: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Expected annual appreciation %">
              <Input type="number" value={form.expectedAnnualAppreciationPercent ?? ""} onChange={(e) => setForm({ ...form, expectedAnnualAppreciationPercent: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Holding period (years)">
              <Input type="number" value={form.holdingPeriodYears ?? ""} onChange={(e) => setForm({ ...form, holdingPeriodYears: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Estimated selling cost %">
              <Input type="number" value={form.estimatedSellingCostPercent ?? ""} onChange={(e) => setForm({ ...form, estimatedSellingCostPercent: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>

            {form.investmentType === "VACANT_LAND" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>Vacant Land</h3>
                <Field label="Land use">
                  <select className="pg-input" value={form.landUse ?? ""} onChange={(e) => setForm({ ...form, landUse: e.target.value || null })}>
                    <option value="">Unknown</option>
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="AGRICULTURAL">Agricultural</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="INDUSTRIAL">Industrial</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Zoning (optional)"><Input value={form.zoning ?? ""} onChange={(e) => setForm({ ...form, zoning: e.target.value })} /></Field>
                <Field label="Rates & taxes (monthly)"><Input type="number" value={form.ratesAndTaxesMonthly ?? ""} onChange={(e) => setForm({ ...form, ratesAndTaxesMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Levies (monthly)"><Input type="number" value={form.leviesMonthly ?? ""} onChange={(e) => setForm({ ...form, leviesMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Security (monthly)"><Input type="number" value={form.securityMonthly ?? ""} onChange={(e) => setForm({ ...form, securityMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Maintenance (monthly)"><Input type="number" value={form.maintenanceMonthly ?? ""} onChange={(e) => setForm({ ...form, maintenanceMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Expected annual appreciation % (optional)"><Input type="number" value={form.expectedAnnualAppreciationPercent ?? ""} onChange={(e) => setForm({ ...form, expectedAnnualAppreciationPercent: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </>
            ) : null}

            {form.investmentType === "SHORT_TERM_RENTAL" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>Short-Term Rental</h3>
                <Field label="Average daily rate (ADR)"><Input type="number" value={form.averageDailyRate ?? ""} onChange={(e) => setForm({ ...form, averageDailyRate: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Occupancy rate (0 to 1)"><Input type="number" value={form.occupancyRate ?? ""} onChange={(e) => setForm({ ...form, occupancyRate: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Available nights per month"><Input type="number" value={form.availableNightsPerMonth ?? ""} onChange={(e) => setForm({ ...form, availableNightsPerMonth: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Platform fee %"><Input type="number" value={form.platformFeePercent ?? ""} onChange={(e) => setForm({ ...form, platformFeePercent: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Management fee %"><Input type="number" value={form.managementFeePercent ?? ""} onChange={(e) => setForm({ ...form, managementFeePercent: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Cleaning fees (monthly)"><Input type="number" value={form.cleaningFeesMonthly ?? ""} onChange={(e) => setForm({ ...form, cleaningFeesMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Monthly utilities"><Input type="number" value={form.monthlyUtilities ?? ""} onChange={(e) => setForm({ ...form, monthlyUtilities: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Furnishing value (optional)"><Input type="number" value={form.furnishingValue ?? ""} onChange={(e) => setForm({ ...form, furnishingValue: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </>
            ) : null}

            {form.investmentType === "FLIP" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>Flip / Renovation Project</h3>
                <Field label="Project stage">
                  <select className="pg-input" value={form.projectStage ?? ""} onChange={(e) => setForm({ ...form, projectStage: e.target.value || null })}>
                    <option value="">Unknown</option>
                    <option value="ACQUISITION">Acquisition</option>
                    <option value="RENOVATION">Renovation</option>
                    <option value="FOR_SALE">For Sale</option>
                    <option value="SOLD">Sold</option>
                  </select>
                </Field>
                <Field label="Rehab budget"><Input type="number" value={form.rehabBudget ?? ""} onChange={(e) => setForm({ ...form, rehabBudget: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Holding costs (monthly)"><Input type="number" value={form.holdingCostsMonthly ?? ""} onChange={(e) => setForm({ ...form, holdingCostsMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Expected sale price"><Input type="number" value={form.expectedSalePrice ?? ""} onChange={(e) => setForm({ ...form, expectedSalePrice: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Target sale date"><Input type="date" value={form.targetSaleDate?.slice?.(0, 10) ?? ""} onChange={(e) => setForm({ ...form, targetSaleDate: e.target.value })} /></Field>
              </>
            ) : null}

            {form.investmentType === "BRRRR" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>BRRRR</h3>
                <Field label="Stage">
                  <select className="pg-input" value={form.brrrrStage ?? ""} onChange={(e) => setForm({ ...form, brrrrStage: e.target.value || null })}>
                    <option value="">Unknown</option>
                    <option value="ACQUISITION">Acquisition</option>
                    <option value="RENOVATION">Renovation</option>
                    <option value="RENTED">Rented</option>
                    <option value="REFINANCED">Refinanced</option>
                  </select>
                </Field>
                <Field label="Rehab budget"><Input type="number" value={form.rehabBudget ?? ""} onChange={(e) => setForm({ ...form, rehabBudget: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="After repair value (ARV)"><Input type="number" value={form.afterRepairValue ?? ""} onChange={(e) => setForm({ ...form, afterRepairValue: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Refinance amount"><Input type="number" value={form.refinanceAmount ?? ""} onChange={(e) => setForm({ ...form, refinanceAmount: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Button type="submit" loading={saving}>{isEdit ? "Update Property" : "Create Property"}</Button>
              {isEdit && id ? (
                <Button
                  type="button"
                  variant="secondary"
                  loading={deleting}
                  onClick={() => void onDelete()}
                  style={{ borderColor: "rgba(255,77,79,.45)", color: "var(--danger)" }}
                >
                  Delete property
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </Container>
    </Section>
  );
}
