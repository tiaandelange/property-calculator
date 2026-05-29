import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { cancelLease as cancelLeaseApi, hardDeleteLease, getLeasesDirectory, getProperties, propertyApiErrorMessage } from "../api/ownedProperties";
import { PROPERTY_DATA_INVALIDATION, invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { LeaseControlsBar } from "../features/leases/LeaseControlsBar";
import { LeaseDesktopTable } from "../features/leases/LeaseDesktopTable";
import { LeaseMetricCards } from "../features/leases/LeaseMetricCards";
import { LeaseMobileList } from "../features/leases/LeaseMobileCard";
import { LeasePagination } from "../features/leases/LeasePagination";
import type { LeaseDirectoryMetrics, LeaseFilters, LeaseListItem } from "../features/leases/leaseDirectoryTypes";
import { paginate } from "../features/leases/leaseDirectoryUtils";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";

const EMPTY_METRICS: LeaseDirectoryMetrics = {
  totalLeases: 0,
  activeLeases: 0,
  monthlyRentRoll: 0,
  renewalsDue: 0
};

function matchesFilters(item: LeaseListItem, filters: LeaseFilters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const hay = `${item.tenantName} ${item.tenantEmail ?? ""} ${item.propertyName} ${item.propertyAddress} ${item.displayStatus}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.propertyId !== "ALL" && item.propertyId !== filters.propertyId) return false;
  if (filters.status !== "ALL" && item.lifecycleStatus !== filters.status) return false;
  if (filters.leaseType !== "ALL" && item.leaseType.toUpperCase() !== filters.leaseType) return false;
  return true;
}

export function LeasesListPage() {
  const [items, setItems] = useState<LeaseListItem[]>([]);
  const [metrics, setMetrics] = useState<LeaseDirectoryMetrics>(EMPTY_METRICS);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LeaseFilters>({
    q: "",
    propertyId: "ALL",
    status: "ALL",
    leaseType: "ALL"
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [directory, props] = await Promise.all([
        getLeasesDirectory(),
        getProperties().catch(() => [])
      ]);
      setItems(directory.items);
      setMetrics(directory.metrics);
      setProperties(
        (props as Array<Record<string, unknown>>).map((p) => ({
          id: String(p.id),
          name: String(p.name ?? "Property")
        }))
      );
    } catch (e: unknown) {
      console.error("[LeasesList] Load failed", e);
      setError(propertyApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener(PROPERTY_DATA_INVALIDATION, handler);
    return () => window.removeEventListener(PROPERTY_DATA_INVALIDATION, handler);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.propertyId, filters.status, filters.leaseType]);

  const filtered = useMemo(
    () =>
      items
        .filter((l) => matchesFilters(l, filters))
        .sort((a, b) => new Date(String(b.startDate ?? 0)).getTime() - new Date(String(a.startDate ?? 0)).getTime()),
    [items, filters]
  );

  const { slice: pageItems, totalPages } = useMemo(() => paginate(filtered, page), [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const patchFilters = (next: Partial<LeaseFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const handleCancelLease = async (leaseId: string) => {
    const lease = items.find((l) => l.id === leaseId);
    if (!lease?.isCancellable) return;
    const cancellationDate = window.prompt("Cancellation date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!cancellationDate) return;
    const cancellationReason = window.prompt("Cancellation reason (optional)", "") ?? undefined;
    try {
      await cancelLeaseApi(leaseId, { cancellationDate, cancellationReason, cancelledBy: "LANDLORD" });
      invalidatePropertyWorkspace(lease.propertyId);
      await load();
    } catch (e: unknown) {
      window.alert(propertyApiErrorMessage(e));
    }
  };

  const handleDeleteLease = async (leaseId: string) => {
    const lease = items.find((l) => l.id === leaseId);
    if (
      !window.confirm(
        "Permanently delete this lease? This cannot be undone. If the lease has invoices or income on record, cancel it instead to keep financial history."
      )
    ) {
      return;
    }
    try {
      await hardDeleteLease(leaseId);
      if (lease?.propertyId) invalidatePropertyWorkspace(lease.propertyId);
      await load();
    } catch (e: unknown) {
      window.alert(propertyApiErrorMessage(e));
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Leases | The Property Guy</title>
      </Helmet>
      <Container className="pg-container--leases-dashboard">
        <div className="pg-leases pg-workspace-page">
          <div className="pg-leases-toolbar">
            <div className="pg-leases-toolbar-actions pg-leases-desktop-only">
              <Button onClick={() => load()} loading={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          <LeaseMetricCards metrics={metrics} loading={loading && !items.length} />

          <LeaseControlsBar filters={filters} onChange={patchFilters} properties={properties} />

          {!loading && filtered.length === 0 ? (
            <section className="pg-leases-empty pg-workspace-card" aria-busy={loading}>
              <h2>No leases found</h2>
              <p>
                {items.length === 0
                  ? "Create your first lease to link a tenant to a property."
                  : "Try adjusting your search or filters."}
              </p>
              <Link className="pg-btn pg-btn-primary" to="/leases/new">
                Add Lease
              </Link>
            </section>
          ) : (
            <>
              <section className="pg-leases-list-panel pg-workspace-card pg-leases-desktop-only" aria-busy={loading}>
                <LeaseDesktopTable
                  items={pageItems}
                  loading={loading}
                  onCancelLease={(id) => void handleCancelLease(id)}
                  onDeleteLease={(id) => void handleDeleteLease(id)}
                />
                <LeasePagination page={page} totalItems={filtered.length} onPageChange={setPage} />
              </section>
              <div className="pg-leases-mobile-only pg-workspace-card-stack" aria-busy={loading}>
                <LeaseMobileList
                  items={pageItems}
                  loading={loading}
                  onCancelLease={(id) => void handleCancelLease(id)}
                  onDeleteLease={(id) => void handleDeleteLease(id)}
                />
                <section className="pg-workspace-card pg-leases-pagination-panel">
                  <LeasePagination page={page} totalItems={filtered.length} onPageChange={setPage} />
                </section>
              </div>
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}
