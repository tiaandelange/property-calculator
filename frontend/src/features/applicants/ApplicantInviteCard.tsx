import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Input";
import {
  applicantApplyUrl,
  getOrCreateApplicantInvite
} from "../../services/applicantApplicationsSupabase";

export function ApplicantInviteModal({
  open,
  onOpenChange,
  properties
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Array<{ id: string; name: string }>;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) return;
    setPropertyId("");
    setToken("");
    setError("");
    setCopied(false);
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open || !propertyId) {
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
  }, [open, propertyId]);

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
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Share applicant form"
      description="Select a property, then copy the private link. Only people you share it with can open the application form."
      size="md"
      className="pg-applicant-invite-modal"
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={!propertyId || !token || loading} onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      }
    >
      <p className="pg-muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        <Link to="/settings#applicant-form-template">Edit default form template</Link>
      </p>

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

      <div className="pg-applicant-invite-modal__row">
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
      </div>

      {loading ? <p className="pg-muted">Preparing link…</p> : null}

      {shareUrl ? (
        <p className="pg-applicant-invite-modal__url pg-muted" aria-live="polite">
          {shareUrl}
        </p>
      ) : null}
    </AppModal>
  );
}
