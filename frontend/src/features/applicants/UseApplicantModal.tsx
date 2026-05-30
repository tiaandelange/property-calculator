import { useEffect, useMemo, useState } from "react";
import { AppModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { getTenantsDirectory } from "../../api/ownedProperties";
import { isApplicantListItem } from "../tenants/tenantDirectoryAdapter";
import type { TenantListItem } from "../tenants/tenantDirectoryTypes";
import { fmtZar } from "../tenants/tenantDirectoryUtils";
import { getApplicantApplicationOwner } from "../../services/applicantApplicationsSupabase";
import type { ApplicantApplicationRecord } from "./applicantTypes";

export type ApplicantPrefill = {
  applicantId: string;
  applicantName: string;
  propertyId: string | null;
  form: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    idNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
};

function applicantToPrefill(record: ApplicantApplicationRecord): ApplicantPrefill {
  const primary = record.formData?.primary;
  return {
    applicantId: record.tenantId,
    applicantName: record.fullName,
    propertyId: record.propertyId,
    form: {
      firstName: record.firstName,
      lastName: record.lastName,
      email: record.email ?? "",
      phone: record.phone ?? "",
      idNumber: primary?.idNumber != null ? String(primary.idNumber) : "",
      emergencyContactName: "",
      emergencyContactPhone: ""
    }
  };
}

export function UseApplicantModal({
  open,
  onOpenChange,
  onSelect
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (prefill: ApplicantPrefill) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [applicants, setApplicants] = useState<TenantListItem[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError("");
      setSelectingId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void getTenantsDirectory()
      .then((directory) => {
        if (cancelled) return;
        setApplicants(directory.items.filter(isApplicantListItem));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load applicants.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applicants;
    return applicants.filter((item) => {
      const hay = `${item.fullName} ${item.email ?? ""} ${item.phone ?? ""} ${item.propertyName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [applicants, query]);

  const pick = async (item: TenantListItem) => {
    setSelectingId(item.id);
    setError("");
    try {
      const record = await getApplicantApplicationOwner(item.id);
      onSelect(applicantToPrefill(record));
      onOpenChange(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load applicant details.");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Use applicant"
      description="Search and select an applicant to prefill the new tenant form. Their application stays linked after you create the tenant."
      size="md"
      className="pg-use-applicant-modal"
    >
      <Field label="Search applicants">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email, phone, or property…"
          autoComplete="off"
        />
      </Field>

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

      <div className="pg-use-applicant-list" aria-busy={loading || Boolean(selectingId)}>
        {loading ? <p className="pg-muted">Loading applicants…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="pg-muted">No applicants match your search.</p>
        ) : null}
        {!loading
          ? filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="pg-use-applicant-list__item"
                disabled={Boolean(selectingId)}
                onClick={() => void pick(item)}
              >
                <span className="pg-use-applicant-list__name">{item.fullName}</span>
                <span className="pg-use-applicant-list__meta pg-muted">
                  {item.propertyName ?? "No property linked"}
                  {item.fitScore != null ? ` · Fit ${Math.round(item.fitScore)}%` : ""}
                  {item.monthlyIncome ? ` · Income ${fmtZar(item.monthlyIncome)}` : ""}
                </span>
                {selectingId === item.id ? <span className="pg-muted">Loading…</span> : null}
              </button>
            ))
          : null}
      </div>

      <div className="pg-app-modal-actions" style={{ marginTop: 16 }}>
        <Button type="button" variant="soft" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </AppModal>
  );
}
