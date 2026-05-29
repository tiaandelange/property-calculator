import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { getLease } from "../api/ownedProperties";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { ManualGenerateLeaseInvoiceFlow } from "../features/leases/ManualGenerateLeaseInvoiceFlow";
import { PropertyLeaseCard } from "../features/properties/workspace/PropertyLeaseCard";
import { LeaseDisplayStatusBadge, LeaseLifecycleBadge } from "../features/leases/LeaseStatusBadges";
import { deriveLeaseStatus } from "../features/tenants/tenantDirectoryAdapter";
import { isCurrentLeaseStatus } from "../utils/leaseDisplay";

export function LeaseAgreementPage() {
  const { id } = useParams();
  const [lease, setLease] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const row = await getLease(id);
        setLease(row);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load lease.");
        setLease(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const property = (lease?.property as Record<string, unknown> | null) ?? null;
  const propertyId = String(lease?.propertyId ?? property?.id ?? "");
  const tenantId = String(lease?.tenantId ?? "");
  const displayStatus = String(lease?.displayStatus ?? lease?.status ?? "");
  const lifecycleStatus = lease
    ? deriveLeaseStatus(
        {
          id: String(lease.id ?? ""),
          tenantId,
          propertyId,
          startDate: lease.startDate != null ? String(lease.startDate) : null,
          fixedTermEndDate: lease.fixedTermEndDate != null ? String(lease.fixedTermEndDate) : null,
          monthlyRent: lease.monthlyRent != null ? Number(lease.monthlyRent) : null,
          status: lease.status != null ? String(lease.status) : null
        },
        new Date()
      )
    : "inactive";
  const canGenerate = Boolean(lease?.id && tenantId && isCurrentLeaseStatus(displayStatus));

  return (
    <Section>
      <Helmet>
        <title>Lease Agreement | The Property Guy</title>
      </Helmet>
      <Container className="pg-container--leases-dashboard">
        <div className="pg-leases pg-workspace-page">
          <div style={{ marginBottom: 16 }}>
            <Link className="pg-btn pg-btn-ghost" to="/leases" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={16} aria-hidden />
              Back to leases
            </Link>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          {loading ? <div className="pg-muted">Loading lease agreement…</div> : null}

          {!loading && lease ? (
            <>
              <header className="pg-workspace-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>Lease Agreement</h1>
                    {property?.name ? (
                      <p className="pg-muted" style={{ margin: 0 }}>
                        <Link className="pg-link" to={`/owned-properties/${propertyId}?tab=leases`}>
                          {String(property.name)}
                        </Link>
                      </p>
                    ) : null}
                    <div className="pg-leases-status-stack" style={{ marginTop: 10 }}>
                      <LeaseLifecycleBadge status={lifecycleStatus} />
                      <LeaseDisplayStatusBadge status={displayStatus} />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setGenerateOpen(true)}
                    disabled={!canGenerate}
                    title={canGenerate ? "Generate invoice for this lease" : "Only active leases can generate invoices"}
                  >
                    <ReceiptText size={16} aria-hidden style={{ marginRight: 6 }} />
                    Generate Invoice
                  </Button>
                </div>
              </header>

              <PropertyLeaseCard lease={lease as Parameters<typeof PropertyLeaseCard>[0]["lease"]} showEdit={false} showCancel={false} showDelete={false} />
            </>
          ) : null}
        </div>
      </Container>

      {lease && canGenerate ? (
        <ManualGenerateLeaseInvoiceFlow
          open={generateOpen}
          leaseId={String(lease.id)}
          tenantId={tenantId}
          propertyId={propertyId}
          monthlyRent={Number(lease.monthlyRent ?? 0)}
          rentDueDay={Number(lease.rentDueDay ?? 1)}
          onClose={() => setGenerateOpen(false)}
        />
      ) : null}
    </Section>
  );
}
