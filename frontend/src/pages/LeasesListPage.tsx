import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
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
import { Button, ButtonLink } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CancelLeaseDialog } from "../features/properties/workspace/CancelLeaseDialog";

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
  const [deleteLeaseId, setDeleteLeaseId] = useState<string | null>(null);
  const [cancelLeaseItem, setCancelLeaseItem] = useState<LeaseListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

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

  const confirmCancelLease = async (payload: { cancellationDate: string; cancellationReason?: string }) => {
    if (!cancelLeaseItem?.isCancellable) return;
    setActionLoading(true);
    setActionError("");
    try {
      await cancelLeaseApi(cancelLeaseItem.id, {
        cancellationDate: payload.cancellationDate,
        cancellationReason: payload.cancellationReason,
        cancelledBy: "LANDLORD"
      });
      invalidatePropertyWorkspace(cancelLeaseItem.propertyId);
      setCancelLeaseItem(null);
      await load();
    } catch (e: unknown) {
      setActionError(propertyApiErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteLease = async () => {
    if (!deleteLeaseId) return;
    const lease = items.find((l) => l.id === deleteLeaseId);
    setActionLoading(true);
    setActionError("");
    try {
      await hardDeleteLease(deleteLeaseId);
      if (lease?.propertyId) invalidatePropertyWorkspace(lease.propertyId);
      setDeleteLeaseId(null);
      await load();
    } catch (e: unknown) {
      setActionError(propertyApiErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteLeaseItem = deleteLeaseId ? items.find((l) => l.id === deleteLeaseId) : null;

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
              <ButtonLink href="/leases/new" variant="primary">
                Add Lease
              </ButtonLink>
            </section>
          ) : (
            <>
              <section className="pg-leases-list-panel pg-workspace-card pg-leases-desktop-only" aria-busy={loading}>
                <LeaseDesktopTable
                  items={pageItems}
                  loading={loading}
                  onCancelLease={(id) => {
                    const lease = items.find((l) => l.id === id);
                    if (lease?.isCancellable) {
                      setActionError("");
                      setCancelLeaseItem(lease);
                    }
                  }}
                  onDeleteLease={(id) => {
                    setActionError("");
                    setDeleteLeaseId(id);
                  }}
                />
                <LeasePagination page={page} totalItems={filtered.length} onPageChange={setPage} />
              </section>
              <div className="pg-leases-mobile-only pg-workspace-card-stack" aria-busy={loading}>
                <LeaseMobileList
                  items={pageItems}
                  loading={loading}
                  onCancelLease={(id) => {
                    const lease = items.find((l) => l.id === id);
                    if (lease?.isCancellable) {
                      setActionError("");
                      setCancelLeaseItem(lease);
                    }
                  }}
                  onDeleteLease={(id) => {
                    setActionError("");
                    setDeleteLeaseId(id);
                  }}
                />
                <section className="pg-workspace-card pg-leases-pagination-panel">
                  <LeasePagination page={page} totalItems={filtered.length} onPageChange={setPage} />
                </section>
              </div>
            </>
          )}
        </div>
      </Container>

      <ConfirmDialog
        open={deleteLeaseId != null}
        title="Delete lease permanently?"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={actionLoading}
        onClose={() => {
          if (!actionLoading) setDeleteLeaseId(null);
        }}
        onConfirm={() => void confirmDeleteLease()}
      >
        <p style={{ marginTop: 0 }}>
          Permanently delete the lease for <strong>{deleteLeaseItem?.tenantName ?? "this tenant"}</strong> at{" "}
          <strong>{deleteLeaseItem?.propertyName ?? "this property"}</strong>? This removes the property/unit link and
          associated lease financial history. The tenant record will remain in Global Tenants.
        </p>
        {actionError ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{actionError}</div> : null}
      </ConfirmDialog>

      <CancelLeaseDialog
        open={cancelLeaseItem != null}
        leaseLabel={
          cancelLeaseItem ? `${cancelLeaseItem.tenantName} · ${cancelLeaseItem.propertyName}` : undefined
        }
        errorMessage={cancelLeaseItem ? actionError : undefined}
        loading={actionLoading}
        onClose={() => {
          if (!actionLoading) {
            setCancelLeaseItem(null);
            setActionError("");
          }
        }}
        onConfirm={(payload) => void confirmCancelLease(payload)}
      />
    </Section>
  );
}
