import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AppListPage, AppPageActions, AppPageContent, AppPageHeader, AppPageSection, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { AppEmptyStateCard, AppInfoCard, Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";

type PropertyTypeId = "residential" | "multiUnit" | "commercial";

type PropertyTypeDef = {
  id: PropertyTypeId;
  title: string;
  description: string;
};

const PROPERTY_TYPES: PropertyTypeDef[] = [
  {
    id: "residential",
    title: "Residential",
    description: "Houses, townhouses, and apartments — typical long-term lets."
  },
  {
    id: "multiUnit",
    title: "Multi-unit",
    description: "Flats, student housing, or mixed unit blocks with multiple leases."
  },
  {
    id: "commercial",
    title: "Commercial",
    description: "Retail, office, and industrial scenarios with longer leases and vacancies."
  }
];

type StepId = 1 | 2 | 3;

function clampStep(step: number): StepId {
  if (step <= 1) return 1;
  if (step >= 3) return 3;
  return step as StepId;
}

export function CalculatorsPage() {
  const [step, setStep] = useState<StepId>(1);
  const [propertyType, setPropertyType] = useState<PropertyTypeId | null>(null);
  const [answers, setAnswers] = useState({
    purchasePrice: "",
    monthlyRent: "",
    depositPct: ""
  });

  const selectedType = useMemo(
    () => (propertyType ? PROPERTY_TYPES.find((t) => t.id === propertyType) ?? null : null),
    [propertyType]
  );

  const canGoStep2 = propertyType != null;
  const canGoStep3 = canGoStep2;

  const steps = [
    { id: 1 as const, title: "Select Type", subtitle: selectedType?.title ?? "Choose a category" },
    { id: 2 as const, title: "Answer Questions", subtitle: "Provide a few key inputs" },
    { id: 3 as const, title: "Generate Report", subtitle: "Preview your outputs" }
  ];

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
              disabled={step === 1}
              onClick={() => setStep((s) => clampStep(s - 1))}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3) || step === 3}
              onClick={() => setStep((s) => clampStep(s + 1))}
            >
              Next
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
          <div className="pg-calculators-layout">
            <div className="pg-calculators-main">
              {step === 1 ? (
                <Card title="Step 1 — Select a property type">
                  <div className="pg-calculators-type-grid" role="list" aria-label="Property types">
                    {PROPERTY_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="listitem"
                        className="pg-calculators-type-card"
                        data-selected={propertyType === t.id ? "true" : "false"}
                        onClick={() => {
                          setPropertyType(t.id);
                          setStep(2);
                        }}
                      >
                        <div className="pg-calculators-type-card__title">{t.title}</div>
                        <div className="pg-calculators-type-card__desc">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </Card>
              ) : null}

              {step === 2 ? (
                <Card title="Step 2 — Answer a few questions">
                  <div className="pg-calculators-q-grid" aria-label="Calculator questions">
                    <Field label="Purchase price (R)">
                      <Input
                        inputMode="numeric"
                        placeholder="e.g. 1 450 000"
                        value={answers.purchasePrice}
                        onChange={(e) => setAnswers((a) => ({ ...a, purchasePrice: e.target.value }))}
                      />
                    </Field>
                    <Field label="Expected monthly rent (R)">
                      <Input
                        inputMode="numeric"
                        placeholder="e.g. 12 500"
                        value={answers.monthlyRent}
                        onChange={(e) => setAnswers((a) => ({ ...a, monthlyRent: e.target.value }))}
                      />
                    </Field>
                    <Field label="Deposit (%)">
                      <Input
                        inputMode="decimal"
                        placeholder="e.g. 10"
                        value={answers.depositPct}
                        onChange={(e) => setAnswers((a) => ({ ...a, depositPct: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <div className="pg-calculators-inline-actions">
                    <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                      Change property type
                    </Button>
                    <Button type="button" variant="primary" disabled={!canGoStep3} onClick={() => setStep(3)}>
                      Continue to preview
                    </Button>
                  </div>
                </Card>
              ) : null}

              {step === 3 ? (
                <Card title="Step 3 — Report preview">
                  {selectedType ? (
                    <div className="pg-calculators-preview">
                      <div className="pg-calculators-preview__row">
                        <span className="pg-muted">Property type</span>
                        <strong>{selectedType.title}</strong>
                      </div>
                      <div className="pg-calculators-preview__row">
                        <span className="pg-muted">Purchase price</span>
                        <strong>{answers.purchasePrice || "—"}</strong>
                      </div>
                      <div className="pg-calculators-preview__row">
                        <span className="pg-muted">Monthly rent</span>
                        <strong>{answers.monthlyRent || "—"}</strong>
                      </div>
                      <div className="pg-calculators-preview__row">
                        <span className="pg-muted">Deposit</span>
                        <strong>{answers.depositPct ? `${answers.depositPct}%` : "—"}</strong>
                      </div>
                      <div className="pg-calculators-inline-actions">
                        <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                          Edit answers
                        </Button>
                        <Button type="button" variant="primary" disabled>
                          Generate report (coming soon)
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <AppEmptyStateCard
                      title="Select a property type first"
                      description="Start by choosing a category, then provide a few inputs."
                      actions={
                        <Button type="button" variant="primary" onClick={() => setStep(1)}>
                          Choose property type
                        </Button>
                      }
                    />
                  )}
                </Card>
              ) : null}
            </div>

            <aside className="pg-calculators-side" aria-label="Helper summary">
              <AppInfoCard
                title="How this works"
                description="This guided flow helps you build a report-ready scenario."
                icon="reports"
              >
                <ul className="pg-calculators-help-list">
                  <li>Pick the property type that matches your deal.</li>
                  <li>Answer a few high-impact questions (more will be added later).</li>
                  <li>Preview the report outputs before generating a PDF.</li>
                </ul>
                <div className="pg-muted" style={{ marginTop: 12, fontSize: 12 }}>
                  PDF export is intentionally not implemented on this page yet.
                </div>
              </AppInfoCard>
            </aside>
          </div>
        </AppPageSection>
      </AppPageContent>
    </AppListPage>
  );
}

