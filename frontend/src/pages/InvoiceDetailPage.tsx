import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getTenant } from "../api/ownedProperties";
import { resolveTenantPropertyId } from "../features/tenants/tenantPropertyContext";
import { AppEditorPage } from "../components/ui/AppPage";
import { fetchMe, meFinancialDisplayName } from "../api/user";
import { InvoiceDetailPanel } from "../features/invoices/InvoiceDetailPanel";
import { invoiceDetailPath } from "../features/invoices/invoiceRoutes";

export function LegacyTenantInvoiceRedirect() {
  const { id: tenantId, invoiceId } = useParams();
  const [search] = useSearchParams();
  const propertyId = search.get("propertyId");
  if (!tenantId) return null;
  if (!invoiceId || invoiceId === "new") {
    const params = new URLSearchParams({ tenantId });
    if (propertyId) params.set("propertyId", propertyId);
    return <Navigate to={`/invoices/new?${params.toString()}`} replace />;
  }
  return <Navigate to={invoiceDetailPath(invoiceId)} replace />;
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !invoiceId || invoiceId === "new";
  const tenantId = search.get("tenantId") ?? "";
  const propertyIdFromUrl = search.get("propertyId") ?? "";
  const leaseIdFromUrl = search.get("leaseId") ?? "";

  const [bootstrap, setBootstrap] = useState<{
    propertyId: string;
    tenantName: string;
    tenantEmail: string | null;
    leaseId: string | null;
    profileName: string;
    invoicePaymentDetails: unknown;
    defaultRent?: number;
  } | null>(null);
  const [loading, setLoading] = useState(isNew && Boolean(tenantId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew) {
      setLoading(false);
      return;
    }
    if (!tenantId) {
      setError("Tenant is required to create an invoice.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [{ tenant, currentLease }, me] = await Promise.all([getTenant(tenantId), fetchMe()]);
        if (cancelled) return;
        const propertyId = propertyIdFromUrl || resolveTenantPropertyId(tenant, currentLease);
        if (!propertyId) {
          setError("This tenant is not linked to a property.");
          setBootstrap(null);
          return;
        }
        const tenantName = `${String(tenant.firstName ?? "").trim()} ${String(tenant.lastName ?? "").trim()}`.trim() || "Tenant";
        setBootstrap({
          propertyId,
          tenantName,
          tenantEmail: tenant.email != null ? String(tenant.email) : null,
          leaseId: leaseIdFromUrl || (currentLease?.id != null ? String(currentLease.id) : null),
          profileName: meFinancialDisplayName(me),
          invoicePaymentDetails: me.invoicePaymentDetails ?? null,
          defaultRent:
            currentLease?.monthlyRent != null && Number.isFinite(Number(currentLease.monthlyRent))
              ? Number(currentLease.monthlyRent)
              : undefined
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
  }, [isNew, tenantId, propertyIdFromUrl, leaseIdFromUrl]);

  const handleCreated = (newId: string) => {
    navigate(invoiceDetailPath(newId), { replace: true });
  };

  const handleDeleted = () => {
    navigate("/invoices", { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>{isNew ? "Create Invoice" : "Edit Invoice"} | The Property Guy</title>
      </Helmet>
      <AppEditorPage className="pg-inv-editor-page">
        {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}
        {loading ? (
          <div className="pg-tstmt-skeleton" style={{ minHeight: 320 }} aria-busy="true" />
        ) : isNew ? (
          bootstrap && tenantId ? (
            <InvoiceDetailPanel
              propertyId={bootstrap.propertyId}
              tenantId={tenantId}
              tenantName={bootstrap.tenantName}
              tenantEmail={bootstrap.tenantEmail}
              leaseId={bootstrap.leaseId}
              profileName={bootstrap.profileName}
              invoicePaymentDetails={bootstrap.invoicePaymentDetails}
              defaultRent={bootstrap.defaultRent}
              onInvoiceCreated={handleCreated}
              onCancel={() => navigate("/invoices")}
            />
          ) : (
            <p className="pg-muted">
              Open an invoice from the{" "}
              <Link className="pg-link" to="/invoices">
                invoices list
              </Link>{" "}
              or create one from a{" "}
              <Link className="pg-link" to="/leases">
                lease
              </Link>
              .
            </p>
          )
        ) : (
          <InvoiceDetailPanel invoiceId={invoiceId} onDeleted={handleDeleted} />
        )}
      </AppEditorPage>
    </>
  );
}
