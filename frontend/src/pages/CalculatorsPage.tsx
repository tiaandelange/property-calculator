import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AppListPage, AppPageActions, AppPageContent, AppPageHeader, AppPageSection, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { AppInfoCard, AppMetricCard, Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Input";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { PropertyTypeTile } from "../components/calculators/PropertyTypeTile";
import { CalculatorQuestionsForm } from "../components/calculators/CalculatorQuestionsForm";
import { PROPERTY_TYPES, type PropertyTypeDef, type PropertyTypeId } from "../data/calculatorPropertyTypes";
import { getDefaultAnswersForConfig, getQuestionConfig } from "../data/calculatorQuestionsConfig";
import { calculatePropertyTypeMetrics } from "../features/calculators/propertyTypeCalculations";
import { formatRand } from "../utils/mortgageRepayment";
import { CashFlowTrendChart, IncomeVsExpensesChart } from "../features/calculators/CalculatorsReportPreviewCharts";
import { buildCalculatorReportPayload } from "../features/calculators/calculatorReportPayload";
import { closeReportTab, navigateReportTab, openBlankReportTab } from "../services/openReportInNewTab";
import { generateReportViaVercel } from "../services/reportsVercel";
import { AppModal } from "../components/ui/AppModal";
import { deleteSavedCalculatorInput, listSavedCalculatorInputs, saveCalculatorInputs, type SavedCalculatorInput } from "../services/calculatorSavedInputsSupabase";
import { useSettingsQuery } from "../features/queries";
import { DEFAULT_USER_SETTINGS } from "../features/settings/settingsDefaults";

type StepId = 1 | 2 | 3;

export function CalculatorsPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [step, setStep] = useState<StepId>(1);
  const [propertyType, setPropertyType] = useState<PropertyTypeId | "">("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generateBusy, setGenerateBusy] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [savedRows, setSavedRows] = useState<SavedCalculatorInput[]>([]);
  const [savedError, setSavedError] = useState<string | null>(null);

  const selectedType = useMemo((): PropertyTypeDef | null => {
    if (!propertyType) return null;
    return PROPERTY_TYPES.find((t) => t.propertyType === propertyType) ?? null;
  }, [propertyType]);

  const questionConfig = useMemo(() => {
    if (!propertyType) return null;
    return getQuestionConfig(propertyType);
  }, [propertyType]);

  const metrics = useMemo(() => {
    if (!propertyType) return null;
    return calculatePropertyTypeMetrics(propertyType, answers);
  }, [propertyType, answers]);

  const settingsQuery = useSettingsQuery();
  const projectionAssumptions = useMemo(
    () => ({
      annualIncomeGrowthPercentAnnual:
        settingsQuery.data?.annualIncomeGrowthPercentAnnual ??
        DEFAULT_USER_SETTINGS.annualIncomeGrowthPercentAnnual,
      expenseGrowthPercentAnnual:
        settingsQuery.data?.expenseGrowthPercentAnnual ?? DEFAULT_USER_SETTINGS.expenseGrowthPercentAnnual
    }),
    [settingsQuery.data]
  );

  // When a property type is selected, seed defaults (but don't clobber existing answers).
  useEffect(() => {
    if (!questionConfig) return;
    const defaults = getDefaultAnswersForConfig(questionConfig);
    setAnswers((prev) => ({ ...defaults, ...prev }));
  }, [questionConfig]);

  const steps = [
    { id: 1 as const, title: "Select Type", subtitle: selectedType?.label ?? "Choose a property type" },
    { id: 2 as const, title: "Answer Questions", subtitle: "Provide a few key inputs" },
    { id: 3 as const, title: "Generate Report", subtitle: generatedReportId ? "Report ready" : "Preview your outputs" }
  ];

  const setAnswer = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  const refreshSaved = async () => {
    if (!propertyType) return;
    setSavedError(null);
    setLoadBusy(true);
    try {
      setSavedRows(await listSavedCalculatorInputs(propertyType));
    } catch (e: unknown) {
      setSavedError(e instanceof Error ? e.message : "Failed to load saved inputs.");
    } finally {
      setLoadBusy(false);
    }
  };

  const openLoad = () => {
    if (!propertyType) return;
    setLoadOpen(true);
    void refreshSaved();
  };

  const confirmSave = async () => {
    if (!propertyType) return;
    setSaveBusy(true);
    try {
      await saveCalculatorInputs({ propertyType, label: saveLabel, answers });
      setSaveOpen(false);
      setSaveLabel("");
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Could not save inputs.");
    } finally {
      setSaveBusy(false);
    }
  };

  const validateRequired = (): string[] => {
    if (!questionConfig) return ["Select a property type."];
    const missing: string[] = [];
    for (const section of questionConfig.sections) {
      for (const f of section.fields) {
        if (!f.required) continue;
        const raw = String(answers[f.key] ?? "").trim();
        if (!raw) {
          missing.push(f.label);
          continue;
        }
        // For numeric-like fields, treat 0 / non-numeric as missing.
        if (["currency", "percentage", "integer", "decimal"].includes(f.type)) {
          const cleaned = raw.replace(/[^\d.-]/g, "");
          const v = Number(cleaned);
          if (!(Number.isFinite(v) && v > 0)) missing.push(f.label);
        }
      }
    }
    return missing;
  };

  const generateReport = async () => {
    if (!propertyType || !metrics) return;
    setValidationError(null);
    const missing = validateRequired();
    if (missing.length) {
      setValidationError(`Missing required fields: ${missing.join(", ")}`);
      return;
    }
    setGenerateBusy(true);
    const tab = openBlankReportTab();
    try {
      const payload = buildCalculatorReportPayload({ propertyType, answers, metrics, projectionAssumptions });
      const gen = await generateReportViaVercel({ reportType: "INVESTMENT_REPORT", payload });
      const url = gen.downloadUrl;
      if (!url) {
        closeReportTab(tab);
        throw new Error(gen.error ?? "Report could not be generated.");
      }
      navigateReportTab(tab, url);
      setGeneratedReportId(gen.reportId);
      setStep(3);
    } catch (e: unknown) {
      closeReportTab(tab);
      setValidationError(e instanceof Error ? e.message : "Report could not be generated.");
    } finally {
      setGenerateBusy(false);
    }
  };

  return (
    <AppListPage className="pg-calculators-page">
      <Helmet>
        <title>Calculators | Proplytic</title>
      </Helmet>

      <AppPageContent>
        <AppPageHeader>
          <div className="pg-app-page-header__main">
            <AppPageTitle>Calculators</AppPageTitle>
            <AppPageSubtitle>Choose a property type and generate investment insights</AppPageSubtitle>
          </div>
          <AppPageActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPropertyType("");
                setAnswers({});
                setStep(1);
              }}
            >
              Reset
            </Button>
          </AppPageActions>
        </AppPageHeader>

        <AppPageSection>
          <div className="pg-calculators-stepper" role="list" aria-label="Calculator steps">
            {steps.map((s) => (
              <div
                key={s.id}
                role="listitem"
                className="pg-calculators-step"
                data-active={s.id === step ? "true" : "false"}
                data-complete={s.id < step || (s.id === 3 && generatedReportId) ? "true" : "false"}
              >
                <div className="pg-calculators-step__num" aria-hidden>
                  {s.id}
                </div>
                <div className="pg-calculators-step__body">
                  <div className="pg-calculators-step__title">{s.title}</div>
                  <div className="pg-calculators-step__sub">{s.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </AppPageSection>

        <AppPageSection>
          {/* Step 1 */}
          <div className="pg-calculators-layout pg-calculators-layout--type">
            <div className="pg-calculators-main">
              <Card title="Select Property Type">
                {isMobile ? (
                  <>
                    <Field label="Property type">
                      <Select
                        value={propertyType}
                        onChange={(e) => {
                          const next = e.target.value as PropertyTypeId | "";
                          setPropertyType(next);
                          setStep(next ? 2 : 1);
                          if (!next) setAnswers({});
                        }}
                      >
                        <option value="">Select…</option>
                        {PROPERTY_TYPES.map((t) => (
                          <option key={t.propertyType} value={t.propertyType}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {selectedType ? (
                      <div className="pg-prop-type-selected-summary" style={{ marginTop: 12 }}>
                        <PropertyTypeTile
                          title={selectedType.label}
                          description={selectedType.description}
                          icon={selectedType.icon}
                          selected
                          onClick={() => {}}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="pg-prop-type-grid" role="list" aria-label="Property types">
                    {PROPERTY_TYPES.map((t) => (
                      <div key={t.propertyType} role="listitem">
                        <PropertyTypeTile
                          title={t.label}
                          description={t.description}
                          icon={t.icon}
                          selected={propertyType === t.propertyType}
                          onClick={() => {
                            setPropertyType(t.propertyType);
                            setStep(2);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <aside className="pg-calculators-side" aria-label="Helper summary">
              <AppInfoCard
                title="Smart & Dynamic"
                description="Questions adjust automatically based on the property type you select."
                icon="fast"
              />
            </aside>
          </div>

          {/* Step 2 */}
          <div className="pg-calculators-layout pg-calculators-layout--questions">
            <div className="pg-calculators-main">
              <Card title="Property Questions">
                {!selectedType ? (
                  <div className="pg-muted">Select a property type above to see the questions.</div>
                ) : (
                  <>
                    {validationError ? (
                      <div className="pg-alert pg-alert-error" role="alert" style={{ marginBottom: 12 }}>
                        {validationError}
                      </div>
                    ) : null}
                    {questionConfig ? (
                      <CalculatorQuestionsForm sections={questionConfig.sections} values={answers} onChange={setAnswer} />
                    ) : null}

                    <div className="pg-calculators-actions-row">
                      <div className="pg-calculators-actions-row__left">
                        <Button type="button" variant="secondary" onClick={openLoad} disabled={!propertyType}>
                          Load Saved Input
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setSaveOpen(true)} disabled={!propertyType}>
                          Save Inputs
                        </Button>
                      </div>
                      <div className="pg-calculators-actions-row__right">
                        <Button type="button" variant="primary" loading={generateBusy} disabled={!propertyType || !metrics} onClick={() => void generateReport()}>
                          Generate Report
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>

            <aside className="pg-calculators-side" aria-label="Quick summary">
              <Card title="Quick Summary">
                <div className="pg-muted" style={{ marginBottom: 10 }}>
                  Updates as you fill in the form.
                </div>
                <div className="pg-calculators-summary-grid">
                  <AppMetricCard
                    label="Monthly Income"
                    value={metrics?.monthlyIncome == null ? "—" : formatRand(metrics.monthlyIncome)}
                    icon="income"
                  />
                  <AppMetricCard
                    label="Monthly Expenses"
                    value={metrics?.monthlyExpenses == null ? "—" : formatRand(metrics.monthlyExpenses)}
                    icon="expense"
                    iconAccent="danger"
                  />
                  <AppMetricCard
                    label="Gross Yield"
                    value={metrics?.grossYield == null ? "—" : `${metrics.grossYield.toFixed(1)}%`}
                    icon="percent"
                  />
                  <AppMetricCard
                    label="Cash Flow"
                    value={metrics?.projectedCashFlow == null ? "—" : formatRand(metrics.projectedCashFlow)}
                    icon="wallet"
                  />
                  <AppMetricCard
                    label="IRR"
                    value={
                      metrics?.internalRateofReturn == null ? "—" : `${metrics.internalRateofReturn.toFixed(1)}%`
                    }
                    icon="percent"
                    hint={
                      metrics?.internalRateofReturn == null
                        ? "Requires cash invested and projected exit value."
                        : undefined
                    }
                  />
                </div>

                <div className="pg-muted" style={{ marginTop: 10, fontSize: 12 }}>
                  {metrics?.ltv == null ? "LTV: —" : `LTV: ${metrics.ltv.toFixed(1)}%`}
                  {metrics?.unitsOccupied
                    ? ` · Occupancy: ${metrics.unitsOccupied.occupied}/${metrics.unitsOccupied.total}`
                    : ""}
                </div>
              </Card>
            </aside>
          </div>

          {/* Step 3 */}
          <div className="pg-calculators-layout pg-calculators-layout--preview">
            <div className="pg-calculators-main">
              <Card title="Report Preview">
                <div className="pg-calculators-metrics-6" aria-label="Report preview metrics">
                  <AppMetricCard
                    label="Projected Cash Flow"
                    value={metrics?.projectedCashFlow == null ? "—" : formatRand(metrics.projectedCashFlow)}
                    icon="wallet"
                  />
                  <AppMetricCard
                    label="Gross Yield"
                    value={metrics?.grossYield == null ? "—" : `${metrics.grossYield.toFixed(1)}%`}
                    icon="percent"
                  />
                  <AppMetricCard
                    label="Cash on Cash ROI"
                    value={metrics?.cashOnCashRoi == null ? "—" : `${metrics.cashOnCashRoi.toFixed(1)}%`}
                    icon="income"
                  />
                  <AppMetricCard
                    label="IRR"
                    value={
                      metrics?.internalRateofReturn == null ? "—" : `${metrics.internalRateofReturn.toFixed(1)}%`
                    }
                    icon="percent"
                    hint={
                      metrics?.internalRateofReturn == null
                        ? "Requires cash invested and projected exit value."
                        : undefined
                    }
                  />
                  <AppMetricCard
                    label="Monthly Income"
                    value={metrics?.monthlyIncome == null ? "—" : formatRand(metrics.monthlyIncome)}
                    icon="income"
                  />
                  <AppMetricCard
                    label="Monthly Expenses"
                    value={metrics?.monthlyExpenses == null ? "—" : formatRand(metrics.monthlyExpenses)}
                    icon="expense"
                    iconAccent="danger"
                  />
                  <AppMetricCard
                    label="Units Occupied"
                    value={metrics?.unitsOccupied == null ? "—" : `${metrics.unitsOccupied.occupied}/${metrics.unitsOccupied.total}`}
                    icon="units"
                  />
                </div>

                <div className="pg-calculators-charts-2" aria-label="Report preview charts">
                  <Card title="Income vs Expenses">
                    <IncomeVsExpensesChart metrics={metrics} />
                  </Card>
                  <Card title="5-Year Projected Cash Flow">
                    <CashFlowTrendChart metrics={metrics} projectionAssumptions={projectionAssumptions} />
                  </Card>
                </div>

                {/* Actions live under “Property Questions” only (avoid duplicates). */}
              </Card>
            </div>

            <aside className="pg-calculators-side" aria-label="Preview helper">
              <AppInfoCard
                title="Preview only"
                description="PDF export will be added once the question sets and calculations are final."
                icon="info"
              />
            </aside>
          </div>
        </AppPageSection>

        <AppModal
          open={saveOpen}
          onOpenChange={setSaveOpen}
          title="Save inputs"
          description={propertyType ? `Save inputs for ${propertyType.replace(/-/g, " ")}.` : undefined}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button type="button" variant="secondary" onClick={() => setSaveOpen(false)} disabled={saveBusy}>
                Cancel
              </Button>
              <Button type="button" variant="primary" loading={saveBusy} onClick={() => void confirmSave()} disabled={!propertyType}>
                Save
              </Button>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Label (optional)" help="Give this scenario a name to find it later.">
              <Input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} placeholder="e.g. Durban duplex draft" />
            </Field>
          </div>
        </AppModal>

        <AppModal
          open={loadOpen}
          onOpenChange={setLoadOpen}
          title="Load saved inputs"
          description="Select a saved scenario to load into the form."
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <Button type="button" variant="secondary" onClick={() => void refreshSaved()} disabled={loadBusy || !propertyType}>
                Refresh
              </Button>
              <Button type="button" variant="secondary" onClick={() => setLoadOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          {savedError ? (
            <div className="pg-alert pg-alert-error" role="alert">
              {savedError}
            </div>
          ) : null}
          {loadBusy ? (
            <div className="pg-muted">Loading…</div>
          ) : savedRows.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {savedRows.map((r) => {
                const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : "—";
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 10,
                      alignItems: "center",
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid color-mix(in srgb, var(--border) 82%, transparent)"
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.label || "Untitled"}
                      </div>
                      <div className="pg-muted" style={{ fontSize: 12 }}>
                        {when}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setAnswers(r.answers);
                        setLoadOpen(false);
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm("Delete this saved input?")) return;
                        try {
                          await deleteSavedCalculatorInput(r.id);
                          await refreshSaved();
                        } catch (e: unknown) {
                          window.alert(e instanceof Error ? e.message : "Delete failed.");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pg-muted">No saved inputs yet.</div>
          )}
        </AppModal>
      </AppPageContent>
    </AppListPage>
  );
}

