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

  const label =
    choice === "accepted"
      ? "Analytics cookies accepted"
      : choice === "rejected"
        ? "Analytics cookies rejected"
        : "No preference saved";

  return (
    <SettingsRow
      label="Cookie & analytics preferences"
      description={`Usage analytics via Google Tag Manager. Current: ${label}${
        bannerPending ? " — reload to see the consent banner again." : ""
      }`}
    >
      <div className="pg-settings-panel-inline-actions">
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
      </div>
    </SettingsRow>
  );
}
