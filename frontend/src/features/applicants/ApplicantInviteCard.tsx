import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Input";
import {
  applicantApplyUrl,
  getOrCreateApplicantInvite
} from "../../services/applicantApplicationsSupabase";

export function ApplicantInviteCard({
  properties,
  onClose
}: {
  properties: Array<{ id: string; name: string }>;
  onClose?: () => void;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!propertyId) {
      setToken("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void getOrCreateApplicantInvite(propertyId)
      .then((invite) => {
        if (!cancelled) setToken(invite.token);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to create invite link.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const shareUrl = token ? applicantApplyUrl(token) : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link. Select and copy the URL manually.");
    }
  };

  return (
    <section className="pg-workspace-card pg-applicant-invite-card">
      <div className="pg-applicant-invite-card__head">
        <div>
          <h2 className="pg-applicant-invite-card__title">Share applicant form</h2>
          <p className="pg-applicant-invite-card__desc">
            Select a property, then copy the private link. Only people you share it with can open the application form.
            {" "}
            <Link to="/settings#applicant-form-template">Edit default form template</Link>
          </p>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

      <div className="pg-applicant-invite-card__row">
        <Field label="Property">
          <select
            className="pg-tenants-select"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            aria-label="Select property for applicant link"
          >
            <option value="">Select property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="pg-applicant-invite-card__copy">
          <Button type="button" variant="soft" disabled={!propertyId || !token || loading} onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy Link"}
          </Button>
        </div>
      </div>

      {shareUrl ? (
        <p className="pg-applicant-invite-card__url pg-muted" aria-live="polite">
          {shareUrl}
        </p>
      ) : null}
    </section>
  );
}
