import { useState } from "react";
import { Button } from "../../components/ui/Button";
import {
  hasCookieConsentChoice,
  readCookieConsent,
  resetCookieConsent,
  saveCookieConsent,
  type CookieConsentChoice
} from "../../lib/analytics/consent";

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
    <div className="pg-settings-row pg-settings-row--stack">
      <div>
        <div className="pg-settings-row-label">Cookie & analytics preferences</div>
        <div className="pg-settings-row-desc">
          Usage analytics via Google Tag Manager. No personal or financial data is sent. Current:{" "}
          <strong>{label}</strong>
          {bannerPending ? " — reload the page to see the consent banner again." : null}
        </div>
      </div>
      <div className="pg-settings-actions">
        <Button type="button" variant="secondary" size="sm" onClick={() => apply("accepted")}>
          Accept analytics
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => apply("rejected")}>
          Reject analytics
        </Button>
        {hasCookieConsentChoice() || choice ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            Reset preference
          </Button>
        ) : null}
      </div>
    </div>
  );
}
