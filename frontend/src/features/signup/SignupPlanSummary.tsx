import { Link } from "react-router-dom";
import {
  formatPlanPrice,
  planPriceHeadline,
  planPropertyLimitLabel,
  planReportLimitLabel
} from "../pricing/pricingPlanDisplay";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";

type SignupPlanSummaryProps = {
  plan: SubscriptionPlanRecord;
  invalidRequested?: boolean;
};

export function SignupPlanSummary({ plan, invalidRequested = false }: SignupPlanSummaryProps) {
  return (
    <div
      className={`pg-login-plan-summary pg-login-plan-summary--selected${invalidRequested ? " pg-login-plan-summary--warn" : ""}`}
      aria-labelledby="signup-plan-summary-title"
    >
      {invalidRequested ? (
        <p className="pg-login-plan-summary__notice" role="status">
          That plan is not available. Showing <strong>Starter</strong> instead.{" "}
          <Link to="/pricing">Choose a plan</Link>
        </p>
      ) : null}

      <h2 id="signup-plan-summary-title" className="pg-login-plan-summary__title">
        {plan.name}
      </h2>
      <p className="pg-login-plan-summary__price">{planPriceHeadline(plan)}</p>

      <ul className="pg-login-plan-summary__list">
        <li>{planPropertyLimitLabel(plan)}</li>
        <li>{planReportLimitLabel(plan)}</li>
      </ul>

      <p className="pg-login-plan-summary__change">
        <Link to="/pricing">Change plan</Link>
      </p>
    </div>
  );
}
