import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Input";
import { unitDisplayLabel } from "../properties/link-tenants/unitTenantLinkUtils";
import type { PropertyUnitDraft } from "../properties/units/propertyUnitTypes";
import {
  applicantApplyUrl,
  getOrCreateApplicantInvite
} from "../../services/applicantApplicationsSupabase";
import { listPropertyUnits } from "../../services/propertyUnitsSupabase";
import { UpgradePrompt } from "../../lib/subscription/UpgradePrompt";
import { usePlanPermissions } from "../../lib/subscription/usePlanPermissions";

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
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState<PropertyUnitDraft[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const permissions = usePlanPermissions();
  const canInvite = permissions.canCreateApplicationLink;

  const activeUnits = useMemo(
    () => units.filter((u) => u.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    [units]
  );
  const showUnitField = activeUnits.length > 0;
  const inviteReady = Boolean(propertyId && (!showUnitField || unitId));

  useEffect(() => {
    if (open) return;
    setPropertyId("");
    setUnitId("");
    setUnits([]);
    setToken("");
    setError("");
    setCopied(false);
    setLoading(false);
    setUnitsLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open || !propertyId) {
      setUnits([]);
      setUnitId("");
      return;
    }

    let cancelled = false;
    setUnitsLoading(true);
    setError("");
    void listPropertyUnits(propertyId)
      .then((rows) => {
        if (cancelled) return;
        setUnits(rows);
        const active = rows.filter((u) => u.isActive !== false);
        if (active.length === 1 && active[0]?.id) {
          setUnitId(active[0].id);
        } else {
          setUnitId("");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setUnits([]);
          setUnitId("");
          setError(e instanceof Error ? e.message : "Failed to load property units.");
        }
      })
      .finally(() => {
        if (!cancelled) setUnitsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, propertyId]);

  useEffect(() => {
    if (!open || !inviteReady || !canInvite) {
      setToken("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    void getOrCreateApplicantInvite(propertyId, showUnitField ? unitId : null)
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
  }, [open, propertyId, unitId, inviteReady, showUnitField, canInvite]);

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
          <Button
            type="button"
            disabled={!canInvite || !inviteReady || !token || loading}
            onClick={() => void copyLink()}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      }
    >
      <p className="pg-muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        <Link to="/settings#applicant-form-template">Edit default form template</Link>
      </p>

      {!canInvite && !permissions.isLoading ? (
        <UpgradePrompt feature="applicationLinks" limit="maxApplicationLinks" context="feature" />
      ) : null}

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

      {canInvite ? (
        <>
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

      {propertyId && showUnitField ? (
        <div className="pg-applicant-invite-modal__row">
          <Field label="Unit">
            <select
              className="pg-tenants-select"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={unitsLoading}
              aria-label="Select unit for applicant link"
              required
            >
              <option value="">{unitsLoading ? "Loading units…" : "Select unit…"}</option>
              {activeUnits.map((u) => (
                <option key={u.id ?? u.clientId} value={u.id ?? ""}>
                  {unitDisplayLabel(u)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {loading ? <p className="pg-muted">Preparing link…</p> : null}

      {propertyId && showUnitField && !unitId && !unitsLoading ? (
        <p className="pg-muted">Select a unit to generate the application link.</p>
      ) : null}

      {shareUrl ? (
        <p className="pg-applicant-invite-modal__url pg-muted" aria-live="polite">
          {shareUrl}
        </p>
      ) : null}
        </>
      ) : null}
    </AppModal>
  );
}
