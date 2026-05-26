import { Check, Circle, Home, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { propertyFinancialsStatementUrl } from "../../financials/financialDirectoryUtils";
import {
  INVESTMENT_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyFormMode,
  type PropertyFormValues
} from "./propertyFormConstants";
import { PROPERTY_FORM_SECTIONS, isPropertyFormSectionComplete, propertyFormProgress } from "./propertyFormProgress";

function formatRent(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `R ${Math.round(n).toLocaleString()} /mo`;
}

function statusBadgeClass(status: string): string {
  const u = status.toUpperCase();
  if (u === "ACTIVE" || u === "FOR_RENT") return "pg-prop-summary__badge pg-prop-summary__badge--success";
  if (u === "DRAFT") return "pg-prop-summary__badge pg-prop-summary__badge--muted";
  return "pg-prop-summary__badge";
}

export function PropertySummaryPanel({
  form,
  mode,
  propertyId,
  mediaCount
}: {
  form: PropertyFormValues;
  mode: PropertyFormMode;
  propertyId?: string;
  mediaCount: number;
}) {
  const { completed, total, pct } = propertyFormProgress(mediaCount, form);
  const investmentType = String(form.investmentType ?? "");
  const propertyType = String(form.propertyType ?? "OTHER");
  const status = String(form.status ?? "").trim() || "Draft";

  return (
    <aside className="pg-prop-summary" aria-label="Property summary">
      <div className="pg-prop-summary__card">
        <div className="pg-prop-summary__hero" aria-hidden="true">
          <Home size={32} strokeWidth={1.75} />
        </div>
        <h2 className="pg-prop-summary__title">Property Summary</h2>
        <dl className="pg-prop-summary__facts">
          <div>
            <dt>Property type</dt>
            <dd>{INVESTMENT_TYPE_LABELS[investmentType] ?? (investmentType || "—")}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{PROPERTY_TYPE_LABELS[propertyType] ?? propertyType}</dd>
          </div>
          <div>
            <dt>Expected rent</dt>
            <dd>{formatRent(form.expectedMonthlyIncome)}</dd>
          </div>
        </dl>
        <span className={statusBadgeClass(status)}>{status.replace(/_/g, " ")}</span>

        <div className="pg-prop-summary__progress">
          <div className="pg-prop-summary__progress-head">
            <span>Setup progress</span>
            <span>
              {completed} of {total} completed
            </span>
          </div>
          <div className="pg-prop-summary__progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="pg-prop-summary__progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <ul className="pg-prop-summary__checklist">
          {PROPERTY_FORM_SECTIONS.map((s) => {
            const done = isPropertyFormSectionComplete(s.id, form, mediaCount);
            return (
              <li key={s.id} className={done ? "pg-prop-summary__checklist-item--done" : ""}>
                {done ? <Check size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
                <span>{s.label}</span>
              </li>
            );
          })}
        </ul>

        {mode === "edit" && propertyId ? (
          <div className="pg-prop-summary__actions">
            <Link to={`/owned-properties/${propertyId}?tab=overview`} className="pg-btn pg-btn-secondary pg-prop-summary__action-btn">
              View Property
            </Link>
            <Link
              to={propertyFinancialsStatementUrl(propertyId, "statement")}
              className="pg-btn pg-btn-secondary pg-prop-summary__action-btn"
            >
              Manage Income
            </Link>
            <Link
              to={propertyFinancialsStatementUrl(propertyId, "expenses")}
              className="pg-btn pg-btn-secondary pg-prop-summary__action-btn"
            >
              Manage Expenses
            </Link>
          </div>
        ) : null}

        <div className="pg-prop-summary__tip">
          <Lightbulb size={18} aria-hidden />
          <p>
            {mode === "edit"
              ? "Keep property details up to date to improve reporting and tenant management."
              : "Complete all sections to publish your property and attract potential tenants."}
          </p>
        </div>
      </div>
    </aside>
  );
}
