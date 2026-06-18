import { useState } from "react";
import { Button } from "../../components/ui/Button";
import {
  hasCookieConsentChoice,
  readCookieConsent,
  resetCookieConsent,
  saveCookieConsent,
  type CookieConsentChoice
} from "../../lib/analytics/consent";
import { SettingsRow } from "./SettingsRow";

export function CookieConsentSettingsCard() {
  const [choice, setChoice] = useState<CookieConsentChoice | null>(() => readCookieConsent());
  const [bannerPending, setBannerPending] = useState(false);

  function apply(next: CookieConsentChoice) {
    saveCookieConsent(next);
    setChoice(next);
    setBannerPending(false);
  }

  function handleReset() {
    resetCookieConsent();
    setChoice(null);
    setBannerPending(true);
  }

  const statusLabel =
    choice === "accepted"
      ? "Accepted"
      : choice === "rejected"
        ? "Rejected"
        : "Not set";

  return (
    <SettingsRow label="Cookie and analytics">
      <div className="pg-settings-panel-inline-actions">
        <span className="pg-settings-badge pg-settings-badge--muted">{statusLabel}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => apply("accepted")}>
          Accept
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => apply("rejected")}>
          Reject
        </Button>
        {hasCookieConsentChoice() || choice ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
        ) : null}
        {bannerPending ? (
          <span className="pg-settings-panel-muted">Reload to see the banner again.</span>
        ) : null}
      </div>
    </SettingsRow>
  );
}
