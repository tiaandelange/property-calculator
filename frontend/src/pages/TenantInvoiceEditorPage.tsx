import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getTenant } from "../api/ownedProperties";
import { fetchMe } from "../api/user";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { TenantInvoiceEditorForm } from "../features/tenants/workspace/TenantInvoiceEditorForm";

type EditorBootstrap = {
  propertyId: string;
  tenantName: string;
  tenantEmail: string | null;
  leaseId: string | null;
  profileName: string;
  invoicePaymentDetails: unknown;
  defaultRent?: number;
};

export function TenantInvoiceEditorPage() {
  const { id: tenantId, invoiceId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const propertyIdFromUrl = search.get("propertyId") ?? "";
  const isNew = !invoiceId || invoiceId === "new";
  const editId = isNew ? undefined : invoiceId;

  const [bootstrap, setBootstrap] = useState<EditorBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantId) {
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
        const property = (tenant.property ?? null) as Record<string, unknown> | null;
        const propertyId =
          propertyIdFromUrl || (property?.id != null ? String(property.id) : tenant.propertyId != null ? String(tenant.propertyId) : "");
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
          leaseId: currentLease?.id != null ? String(currentLease.id) : null,
          profileName: String(me.name ?? me.email ?? "Proplytic"),
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
  }, [tenantId, propertyIdFromUrl]);

  const handleCreated = (newId: string) => {
    if (!tenantId || !bootstrap) return;
    navigate(`/tenants/${tenantId}/invoices/${newId}?propertyId=${encodeURIComponent(bootstrap.propertyId)}`, {
      replace: true
    });
  };

  return (
    <Section>
      <Helmet>
        <title>{isNew ? "Create Invoice" : "Edit Invoice"} | The Property Guy</title>
      </Helmet>
      <Container>
        <div className="pg-tstmt pg-workspace-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <h1 className="pg-h2" style={{ margin: 0 }}>
              {isNew ? "Create Invoice" : "Edit Invoice"}
            </h1>
            {tenantId ? (
              <Link className="pg-btn pg-btn-ghost" to={`/tenants/${tenantId}?tab=statement&fin=invoices`}>
                Back to tenant
              </Link>
            ) : null}
          </div>
          {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
          {loading ? (
            <div className="pg-tstmt-skeleton" style={{ marginTop: 20, minHeight: 320 }} aria-busy="true" />
          ) : bootstrap && tenantId ? (
            <div style={{ marginTop: 20 }}>
              <TenantInvoiceEditorForm
                propertyId={bootstrap.propertyId}
                tenantId={tenantId}
                tenantName={bootstrap.tenantName}
                tenantEmail={bootstrap.tenantEmail}
                invoiceId={editId}
                leaseId={bootstrap.leaseId}
                profileName={bootstrap.profileName}
                invoicePaymentDetails={bootstrap.invoicePaymentDetails}
                defaultRent={bootstrap.defaultRent}
                onInvoiceCreated={handleCreated}
              />
            </div>
          ) : (
            <p className="pg-muted" style={{ marginTop: 16 }}>
              No tenant selected.
            </p>
          )}
        </div>
      </Container>
    </Section>
  );
}
