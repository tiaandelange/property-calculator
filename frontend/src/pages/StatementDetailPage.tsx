import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getTenant } from "../api/ownedProperties";
import { meFinancialDisplayName } from "../api/user";
import { resolveTenantPropertyId } from "../features/tenants/tenantPropertyContext";
import { useProfileQuery } from "../features/queries";
import { AppEditorPage } from "../components/ui/AppPage";
import { formatQueryErrorMessage } from "../lib/queryErrors";
import { StatementDetailPanel } from "../features/statements/StatementDetailPanel";
import { statementDetailPath } from "../features/statements/statementRoutes";
import type { TenantStatementDocumentType } from "../features/statements/statementTypes";

function parseStatementType(raw: string | null): TenantStatementDocumentType {
  return String(raw ?? "").toLowerCase() === "deposit" ? "DEPOSIT" : "FINANCIAL";
}

export function StatementDetailPage() {
  const { statementId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !statementId || statementId === "new";
  const tenantId = search.get("tenantId") ?? "";
  const propertyIdFromUrl = search.get("propertyId") ?? "";
  const leaseIdFromUrl = search.get("leaseId") ?? "";
  const statementType = parseStatementType(search.get("type"));
  const profileQuery = useProfileQuery({ enabled: isNew && Boolean(tenantId) });

  const [bootstrap, setBootstrap] = useState<{
    propertyId: string;
    tenantName: string;
    tenantEmail: string | null;
    leaseId: string | null;
    profileName: string;
    depositAmount?: number;
    leaseStartDate?: string | null;
    tenantLeaseIds: string[];
  } | null>(null);
  const [loading, setLoading] = useState(isNew && Boolean(tenantId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew) {
      setLoading(false);
      return;
    }
    if (!tenantId) {
      setError("Tenant is required to create a statement.");
      setLoading(false);
      return;
    }
    if (profileQuery.isLoading) return;
    if (profileQuery.isError) {
      setError(formatQueryErrorMessage(profileQuery.error, "Failed to load profile."));
      setLoading(false);
      return;
    }
    const me = profileQuery.data;
    if (!me) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const { tenant, currentLease } = await getTenant(tenantId);
        if (cancelled) return;
        const propertyId = propertyIdFromUrl || resolveTenantPropertyId(tenant, currentLease);
        if (!propertyId) {
          setError("This tenant is not linked to a property.");
          setBootstrap(null);
          return;
        }
        const tenantName =
          `${String(tenant.firstName ?? "").trim()} ${String(tenant.lastName ?? "").trim()}`.trim() || "Tenant";
        const leaseIds = currentLease?.id != null ? [String(currentLease.id)] : [];
        setBootstrap({
          propertyId,
          tenantName,
          tenantEmail: tenant.email != null ? String(tenant.email) : null,
          leaseId: leaseIdFromUrl || (currentLease?.id != null ? String(currentLease.id) : null),
          profileName: meFinancialDisplayName(me),
          depositAmount:
            currentLease?.depositAmount != null && Number.isFinite(Number(currentLease.depositAmount))
              ? Number(currentLease.depositAmount)
              : undefined,
          leaseStartDate:
            currentLease?.startDate != null ? String(currentLease.startDate).slice(0, 10) : null,
          tenantLeaseIds: leaseIds
        });
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tenant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isNew,
    tenantId,
    propertyIdFromUrl,
    leaseIdFromUrl,
    profileQuery.data,
    profileQuery.isLoading,
    profileQuery.isError,
    profileQuery.error
  ]);

  const title =
    statementType === "DEPOSIT"
      ? isNew
        ? "Create Deposit Statement"
        : "Edit Deposit Statement"
      : isNew
        ? "Create Financial Statement"
        : "Edit Financial Statement";

  return (
    <>
      <Helmet>
        <title>{title} | The Property Guy</title>
      </Helmet>
      <AppEditorPage className="pg-inv-editor-page">
        {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}
        {loading ? (
          <div className="pg-tstmt-skeleton" style={{ minHeight: 320 }} aria-busy="true" />
        ) : isNew ? (
          bootstrap && tenantId ? (
            <StatementDetailPanel
              statementType={statementType}
              propertyId={bootstrap.propertyId}
              tenantId={tenantId}
              tenantName={bootstrap.tenantName}
              tenantEmail={bootstrap.tenantEmail}
              leaseId={bootstrap.leaseId}
              profileName={bootstrap.profileName}
              depositAmount={bootstrap.depositAmount}
              leaseStartDate={bootstrap.leaseStartDate}
              tenantLeaseIds={bootstrap.tenantLeaseIds}
              onStatementCreated={(newId) => navigate(statementDetailPath(newId), { replace: true })}
              onCancel={() => navigate(`/tenants/${tenantId}`)}
            />
          ) : (
            <p className="pg-muted">
              Open a statement from a{" "}
              <Link className="pg-link" to="/tenants">
                tenant profile
              </Link>
              .
            </p>
          )
        ) : (
          <StatementDetailPanel
            statementId={statementId}
            statementType={statementType}
            onDeleted={() => navigate("/tenants")}
            onCancel={() => navigate(-1)}
          />
        )}
      </AppEditorPage>
    </>
  );
}
