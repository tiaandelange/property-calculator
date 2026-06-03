import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";
import {
  homepageCalculatorPropertyTypes,
  homepageCalculatorsWizardPreview
} from "../../../data/homepageCalculatorsSectionPreview";
import { homepagePublicCalculators } from "../../../data/homepageMarketingContent";

const STEPS = [
  { id: 1, title: "Select Type", subtitle: "Duplex" },
  { id: 2, title: "Answer Questions", subtitle: "Tailored inputs" },
  { id: 3, title: "Generate Report", subtitle: "Preview outputs" }
] as const;

export function HomeMarketingCalculatorsWizardPreview() {
  const preview = homepageCalculatorsWizardPreview;
  const selected = homepageCalculatorPropertyTypes.find((t) => t.id === preview.selectedTypeId);

  return (
    <div
      className="hm-calc-wizard-preview"
      role="img"
      aria-label="Illustrative Proplytic property-type calculator with step progress, property type grid and sample duplex inputs"
    >
      <div className="hm-calc-wizard-preview__frame">
        <header className="hm-calc-wizard-preview__header">
          <div>
            <p className="hm-calc-wizard-preview__eyebrow">{homepagePublicCalculators.eyebrow}</p>
            <h3 className="hm-calc-wizard-preview__title">Property-type calculator</h3>
            <p className="hm-calc-wizard-preview__lead">
              Choose a property type, answer tailored questions, and generate an investment report in your workspace
            </p>
          </div>
          <span className="hm-calc-wizard-preview__badge">Preview</span>
        </header>

        <div className="hm-calc-wizard-preview__stepper" aria-hidden>
          {STEPS.map((step) => (
            <div
              key={step.id}
              className="hm-calc-wizard-preview__step"
              data-active={step.id === preview.activeStep ? "true" : "false"}
              data-complete={step.id < preview.activeStep ? "true" : "false"}
            >
              <span className="hm-calc-wizard-preview__step-num">{step.id}</span>
              <span className="hm-calc-wizard-preview__step-body">
                <span className="hm-calc-wizard-preview__step-title">{step.title}</span>
                <span className="hm-calc-wizard-preview__step-sub">{step.subtitle}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="hm-calc-wizard-preview__body">
          <section className="hm-calc-wizard-preview__panel">
            <h4 className="hm-calc-wizard-preview__panel-title">Select property type</h4>
            <ul className="hm-calc-type-grid" aria-hidden>
              {homepageCalculatorPropertyTypes.map((type) => {
                const isSelected = type.id === preview.selectedTypeId;
                return (
                  <li key={type.id}>
                    <div
                      className="hm-calc-type-card"
                      data-selected={isSelected ? "true" : "false"}
                      data-category={type.category}
                    >
                      <span className="hm-calc-type-card__icon" aria-hidden>
                        <AppIcon name={type.icon as IconName} size="md" />
                      </span>
                      <span className="hm-calc-type-card__title">{type.label}</span>
                      <span className="hm-calc-type-card__desc">{type.description}</span>
                      {isSelected ? (
                        <span className="hm-calc-type-card__check" aria-hidden>
                          <AppIcon name="save" size="sm" />
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="hm-calc-wizard-preview__aside">
            <h4 className="hm-calc-wizard-preview__panel-title">
              {selected ? `${selected.label} · sample inputs` : "Tailored questions"}
            </h4>
            <p className="hm-calc-wizard-preview__aside-note">
              Fields change by property type — units for a duplex, beds for student housing, nightly rate for Airbnb.
            </p>
            <ul className="hm-calc-wizard-preview__fields">
              {preview.sampleQuestions.map((field) => (
                <li key={field.label} className="hm-calc-wizard-preview__field">
                  <span className="hm-calc-wizard-preview__field-label">{field.label}</span>
                  <span className="hm-calc-wizard-preview__field-value">{field.value}</span>
                </li>
              ))}
            </ul>
            <div className="hm-calc-wizard-preview__metrics">
              {preview.previewMetrics.map((m) => (
                <div key={m.label} className="hm-calc-wizard-preview__metric">
                  <span>{m.label}</span>
                  <strong>{m.value}</strong>
                </div>
              ))}
            </div>
            <span className="hm-calc-wizard-preview__report-btn" aria-hidden>
              Generate report
            </span>
          </aside>
        </div>
      </div>
      <p className="hm-calc-wizard-preview__caption">{preview.caption}</p>
    </div>
  );
}
