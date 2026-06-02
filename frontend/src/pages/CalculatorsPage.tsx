import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AppListPage, AppPageActions, AppPageContent, AppPageHeader, AppPageSection, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { AppInfoCard, AppMetricCard, Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Select } from "../components/ui/Input";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { PropertyTypeTile } from "../components/calculators/PropertyTypeTile";
import { CalculatorQuestionsForm } from "../components/calculators/CalculatorQuestionsForm";
import { PROPERTY_TYPES, type PropertyTypeDef, type PropertyTypeId } from "../data/calculatorPropertyTypes";
import { getDefaultAnswersForConfig, getQuestionConfig } from "../data/calculatorQuestionsConfig";
import { calculatePropertyTypeMetrics } from "../features/calculators/propertyTypeCalculations";
import { formatRand } from "../utils/mortgageRepayment";

type StepId = 1 | 2 | 3;

const SAVED_INPUTS_KEY = "pg.calculators.savedInputs.v1";

function storageKeyForType(propertyType: PropertyTypeId): string {
  return `${SAVED_INPUTS_KEY}.${propertyType}`;
}

export function CalculatorsPage() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [step, setStep] = useState<StepId>(1);
  const [propertyType, setPropertyType] = useState<PropertyTypeId | "">("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

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

  // When a property type is selected, seed defaults (but don't clobber existing answers).
  useEffect(() => {
    if (!questionConfig) return;
    const defaults = getDefaultAnswersForConfig(questionConfig);
    setAnswers((prev) => ({ ...defaults, ...prev }));
  }, [questionConfig]);

  const steps = [
    { id: 1 as const, title: "Select Type", subtitle: selectedType?.label ?? "Choose a property type" },
    { id: 2 as const, title: "Answer Questions", subtitle: "Provide a few key inputs" },
    { id: 3 as const, title: "Generate Report", subtitle: "Preview your outputs" }
  ];

  const setAnswer = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  const loadSaved = () => {
    if (!propertyType) return;
    try {
      const raw = localStorage.getItem(storageKeyForType(propertyType));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) next[k] = v == null ? "" : String(v);
      setAnswers(next);
    } catch {
      window.alert("Saved inputs could not be loaded (corrupt data).");
    }
  };

  const saveInputs = () => {
    if (!propertyType) return;
    try {
      localStorage.setItem(storageKeyForType(propertyType), JSON.stringify(answers));
      window.alert("Saved inputs.");
    } catch {
      window.alert("Could not save inputs (storage unavailable).");
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
                data-complete={s.id < step ? "true" : "false"}
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
                    {questionConfig ? (
                      <CalculatorQuestionsForm sections={questionConfig.sections} values={answers} onChange={setAnswer} />
                    ) : null}

                    <div className="pg-calculators-actions-row">
                      <div className="pg-calculators-actions-row__left">
                        <Button type="button" variant="secondary" onClick={loadSaved} disabled={!propertyType}>
                          Load Saved Input
                        </Button>
                        <Button type="button" variant="secondary" onClick={saveInputs} disabled={!propertyType}>
                          Save Inputs
                        </Button>
                      </div>
                      <div className="pg-calculators-actions-row__right">
                        <Button type="button" variant="primary" disabled>
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
                    <div className="pg-muted">Chart placeholder (coming soon)</div>
                  </Card>
                  <Card title="Projected Cash Flow Trend">
                    <div className="pg-muted">Chart placeholder (coming soon)</div>
                  </Card>
                </div>
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
      </AppPageContent>
    </AppListPage>
  );
}

