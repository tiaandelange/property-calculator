import { ButtonLink } from "../../components/ui/Button";
import { usePlanPermissions } from "./usePlanPermissions";
import { PENDING_PAYMENT_BANNER_MESSAGE } from "./planFeatures";
import { settingsSubscriptionPath } from "../../features/signup/signupBillingFlow";

export function PendingPaymentBanner() {
  const permissions = usePlanPermissions();

  if (permissions.isLoading || permissions.isAdmin || !permissions.isPendingPayment) {
    return null;
  }

  const checkoutPath = settingsSubscriptionPath({
    checkout: true,
    planCode: permissions.selectedPlanCode ?? undefined
  });

  return (
    <div className="pg-pending-payment-banner pg-alert-banner pg-status-warning" role="status">
      <div className="pg-pending-payment-banner__body">
        <p className="pg-pending-payment-banner__message">
          <strong>{PENDING_PAYMENT_BANNER_MESSAGE}</strong>
          {permissions.selectedPlanName ? (
            <span className="pg-pending-payment-banner__plan">
              {" "}
              Selected plan: {permissions.selectedPlanName}. You have Starter access until payment is
              confirmed.
            </span>
          ) : null}
        </p>
      </div>
      <ButtonLink href={checkoutPath} variant="primary" size="sm">
        Complete payment
      </ButtonLink>
    </div>
  );
}
