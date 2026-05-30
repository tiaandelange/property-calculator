import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { cancelLease as cancelLeaseApi, hardDeleteLease, propertyApiErrorMessage } from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import {
  invalidateLeaseQueries,
  isInitialQueryLoad,
  queryKeys,
  useLeasesDirectoryQuery,
  usePropertyOptionsQuery,
  useWorkspaceId
} from "../features/queries";
import { LeaseControlsBar } from "../features/leases/LeaseControlsBar";
import { LeaseDesktopTable } from "../features/leases/LeaseDesktopTable";
import { LeaseMetricCards } from "../features/leases/LeaseMetricCards";
import { LeaseMobileList } from "../features/leases/LeaseMobileCard";
import { LeasePagination } from "../features/leases/LeasePagination";
import type { LeaseDirectoryMetrics, LeaseFilters, LeaseListItem } from "../features/leases/leaseDirectoryTypes";
import { AppListPage } from "../components/ui/AppPage";
import { Button, ButtonLink } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CancelLeaseDialog } from "../features/properties/workspace/CancelLeaseDialog";

const EMPTY_METRICS: LeaseDirectoryMetrics = {
  totalLeases: 0,
  activeLeases: 0,
  monthlyRentRoll: 0,
  renewalsDue: 0
};

export function LeasesListPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LeaseFilters>({
    q: "",
    propertyId: "ALL",
    status: "ALL",
    leaseType: "ALL"
  });

  const directoryParams = useMemo(
    () => ({
      page,
      pageSize: 6,
      q: filters.q,
      propertyId: filters.propertyId,
      status: filters.status,
      leaseType: filters.leaseType
    }),
    [page, filters]
  );

  const directoryQuery = useLeasesDirectoryQuery(directoryParams);
  const propertyOptionsQuery = usePropertyOptionsQuery();

  const pageItems = directoryQuery.data?.items ?? [];
  const totalCount = directoryQuery.data?.totalCount ?? 0;
  const metrics = directoryQuery.data?.metrics ?? EMPTY_METRICS;
  const properties = propertyOptionsQuery.data ?? [];
  const loading = isInitialQueryLoad(directoryQuery);
  const error = directoryQuery.error ? propertyApiErrorMessage(directoryQuery.error) : "";
  const [deleteLeaseId, setDeleteLeaseId] = useState<string | null>(null);
  const [cancelLeaseItem, setCancelLeaseItem] = useState<LeaseListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.propertyId, filters.status, filters.leaseType]);

  const patchFilters = (next: Partial<LeaseFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const refreshDirectory = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leasesDirectory(workspaceId) });
    }
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
      invalidateLeaseQueries({
        workspaceId,
        propertyId: cancelLeaseItem.propertyId,
        tenantId: cancelLeaseItem.tenantId
      });
      invalidatePropertyWorkspace(cancelLeaseItem.propertyId);
      setCancelLeaseItem(null);
    } catch (e: unknown) {
      setActionError(propertyApiErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteLease = async () => {
    if (!deleteLeaseId) return;
    const lease = pageItems.find((l) => l.id === deleteLeaseId) ?? directoryQuery.data?.items.find((l) => l.id === deleteLeaseId);
    setActionLoading(true);
    setActionError("");
    try {
      await hardDeleteLease(deleteLeaseId);
      if (lease?.propertyId) {
        invalidateLeaseQueries({
          workspaceId,
          propertyId: lease.propertyId,
          tenantId: lease.tenantId
        });
        invalidatePropertyWorkspace(lease.propertyId);
      }
      setDeleteLeaseId(null);
    } catch (e: unknown) {
      setActionError(propertyApiErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteLeaseItem = deleteLeaseId
    ? (pageItems.find((l) => l.id === deleteLeaseId) ??
      directoryQuery.data?.items.find((l) => l.id === deleteLeaseId))
    : null;

  return (
    <>
      <AppListPage contentClassName="pg-leases">
        <Helmet>
          <title>Leases | The Property Guy</title>
        </Helmet>
          <div className="pg-leases-toolbar">
            <div className="pg-leases-toolbar-actions pg-leases-desktop-only">
              <Button onClick={refreshDirectory} loading={directoryQuery.isFetching && !loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          <LeaseMetricCards metrics={metrics} loading={loading} />

          <LeaseControlsBar filters={filters} onChange={patchFilters} properties={properties} />

          {!loading && totalCount === 0 ? (
            <section className="pg-leases-empty pg-workspace-card" aria-busy={directoryQuery.isFetching}>
              <h2>No leases found</h2>
              <p>
                {totalCount === 0 && !filters.q && filters.propertyId === "ALL"
                  ? "Create your first lease to link a tenant to a property."
                  : "Try adjusting your search or filters."}
              </p>
              <ButtonLink href="/leases/new" variant="primary">
                Add Lease
              </ButtonLink>
            </section>
          ) : (
            <>
              <section className="pg-leases-list-panel pg-workspace-card pg-leases-desktop-only" aria-busy={directoryQuery.isFetching}>
                <LeaseDesktopTable
                  items={pageItems}
                  loading={loading}
                  onCancelLease={(id) => {
                    const lease = pageItems.find((l) => l.id === id);
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
                <LeasePagination page={page} totalItems={totalCount} onPageChange={setPage} />
              </section>
              <div className="pg-leases-mobile-only pg-workspace-card-stack" aria-busy={directoryQuery.isFetching}>
                <LeaseMobileList
                  items={pageItems}
                  loading={loading}
                  onCancelLease={(id) => {
                    const lease = pageItems.find((l) => l.id === id);
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
                  <LeasePagination page={page} totalItems={totalCount} onPageChange={setPage} />
                </section>
              </div>
            </>
          )}
      </AppListPage>

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
    </>
  );
}
