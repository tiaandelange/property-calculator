import { useEffect, useState } from "react";
import type { ApplicantApplicationRecord } from "../../applicants/applicantTypes";
import { fetchApplicantApplicationDetailsByTenantId } from "../../../services/applicantApplicationsSupabase";

export function useTenantApplicantDetails(tenantId: string | undefined) {
  const [record, setRecord] = useState<ApplicantApplicationRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchApplicantApplicationDetailsByTenantId(tenantId)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch(() => {
        if (!cancelled) setRecord(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return { record, loading };
}
