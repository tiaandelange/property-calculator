import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import {
  hasCookieConsentChoice,
  saveCookieConsent,
  type CookieConsentChoice
} from "../../lib/analytics/consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasCookieConsentChoice());
  }, []);

  const choose = useCallback((choice: CookieConsentChoice) => {
    saveCookieConsent(choice);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="pg-cookie-banner" role="dialog" aria-label="Cookie consent" aria-live="polite">
      <div className="pg-cookie-banner__inner">
        <p className="pg-cookie-banner__text">
          We use analytics cookies to understand how Proplytic is used and improve the product.{" "}
          <Link to="/cookie-notice" className="pg-cookie-banner__link">
            Cookie notice
          </Link>
          {" · "}
          <Link to="/privacy-policy" className="pg-cookie-banner__link">
            Privacy policy
          </Link>
        </p>
        <div className="pg-cookie-banner__actions">
          <Button type="button" variant="secondary" size="sm" onClick={() => choose("rejected")}>
            Reject
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={() => choose("accepted")}>
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
