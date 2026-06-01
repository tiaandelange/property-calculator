import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AppListPage } from "../components/ui/AppPage";
import { AppSectionTabs } from "../components/ui/AppSectionTabs";
import { Button, ButtonLink } from "../components/ui/Button";
import { MetricCardsSkeletonRow } from "../components/ui/PageSkeletons";
import { QueryErrorCard, QueryRefreshingIndicator } from "../components/ui/QueryState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { deleteTenant } from "../api/ownedProperties";
import { ApplicantDetailModal } from "../features/applicants/ApplicantDetailModal";
import { ApplicantDesktopTable } from "../features/applicants/ApplicantDesktopTable";
import { ApplicantInviteModal } from "../features/applicants/ApplicantInviteCard";
import {
  computeApplicantDirectoryMetrics
} from "../features/tenants/tenantDirectoryAdapter";
import { ApplicantMetricCards, TenantMetricCards } from "../features/tenants/TenantMetricCards";
import { TenantControlsBar, type TenantFilters } from "../features/tenants/TenantControlsBar";
import { TenantDesktopTable } from "../features/tenants/TenantDesktopTable";
import { TenantMobileList } from "../features/tenants/TenantMobileCard";
import { TenantPagination } from "../features/tenants/TenantPagination";
import type { TenantDirectoryMetrics, TenantListItem } from "../features/tenants/tenantDirectoryTypes";
import { PAGE_SIZE } from "../features/tenants/tenantDirectoryUtils";
import {
  invalidateTenantQueries,
  isInitialQueryLoad,
  isQueryRefreshing,
  queryKeys,
  usePropertyOptionsQuery,
  useTenantsDirectoryQuery,
  useWorkspaceId
} from "../features/queries";

const EMPTY_TENANT_METRICS: TenantDirectoryMetrics = {
  totalTenants: 0,
  activeLeases: 0,
  pendingPaymentsTotal: 0,
  pendingPaymentsCount: 0,
  renewalsDue: 0
};

export function TenantsListPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "applicants" ? "applicants" : "tenants";
  const isApplicants = activeTab === "applicants";

  const [page, setPage] = useState(1);
  const [showInviteCard, setShowInviteCard] = useState(false);
  const [viewApplicantId, setViewApplicantId] = useState<string | null>(null);
  const [deleteApplicant, setDeleteApplicant] = useState<TenantListItem | null>(null);
  const [deleteTenantItem, setDeleteTenantItem] = useState<TenantListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [filters, setFilters] = useState<TenantFilters>({
    q: "",
    propertyId: "ALL",
    leaseStatus: "ALL",
    paymentStatus: "ALL"
  });

  const directoryParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      q: filters.q,
      propertyId: filters.propertyId,
      leaseStatus: filters.leaseStatus,
      paymentStatus: filters.paymentStatus,
      tab: activeTab as "tenants" | "applicants"
    }),
    [page, filters, activeTab]
  );

  const directoryQuery = useTenantsDirectoryQuery(directoryParams);
  const propertyOptionsQuery = usePropertyOptionsQuery();

  const pageItems = directoryQuery.data?.items ?? [];
  const totalCount = directoryQuery.data?.totalCount ?? 0;
  const tenantMetrics = directoryQuery.data?.metrics ?? EMPTY_TENANT_METRICS;
  const applicantMetrics = directoryQuery.data?.applicantMetrics ?? computeApplicantDirectoryMetrics([]);
  const properties = propertyOptionsQuery.data ?? [];
  const loading = isInitialQueryLoad(directoryQuery);
  const refreshing = isQueryRefreshing(directoryQuery);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.propertyId, filters.leaseStatus, filters.paymentStatus, activeTab]);

  const error =
    directoryQuery.error instanceof Error
      ? directoryQuery.error.message
      : directoryQuery.error
        ? "Failed to load tenants."
        : "";

  useEffect(() => {
    if (!isApplicants) setShowInviteCard(false);
  }, [isApplicants]);

  const patchFilters = (next: Partial<TenantFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const refreshDirectory = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenantsDirectory(workspaceId) });
    }
  };

  const confirmDeleteApplicant = async () => {
    if (!deleteApplicant) return;
    setDeleteBusy(true);
    setActionError("");
    try {
      const ids =
        deleteApplicant.memberTenantIds?.length && deleteApplicant.memberTenantIds.length > 0
          ? deleteApplicant.memberTenantIds
          : [deleteApplicant.id];
      for (const tid of ids) {
        await deleteTenant(tid);
        invalidateTenantQueries({ workspaceId, tenantId: tid });
      }
      setDeleteApplicant(null);
      refreshDirectory();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to delete applicant.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmDeleteTenant = async () => {
    if (!deleteTenantItem) return;
    setDeleteBusy(true);
    setActionError("");
    try {
      await deleteTenant(deleteTenantItem.id);
      invalidateTenantQueries({ workspaceId, tenantId: deleteTenantItem.id });
      setDeleteTenantItem(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to delete tenant.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const displayError = actionError;

  return (
    <AppListPage contentClassName="pg-tenants">
      <Helmet>
        <title>{isApplicants ? "Applicants" : "Tenants"} | The Property Guy</title>
      </Helmet>

      {error ? (
        <QueryErrorCard
          message={error}
          onRetry={() => void directoryQuery.refetch()}
          retrying={directoryQuery.isFetching}
        />
      ) : null}
      {displayError ? <div className="pg-alert pg-alert-error">{displayError}</div> : null}

      <div className="pg-tenants-section-head">
        <AppSectionTabs
          ariaLabel="Tenant directory sections"
          activeId={activeTab}
          basePath="/tenants"
          style={{ marginBottom: 0 }}
          items={[
            { id: "tenants", label: "Tenants" },
            { id: "applicants", label: "Applicants" }
          ]}
        />
        <div className="pg-tenants-section-head__actions">
          <QueryRefreshingIndicator active={refreshing} />
          {isApplicants ? (
            <Button type="button" variant="soft" onClick={() => setShowInviteCard(true)}>
              Add Applicant
            </Button>
          ) : (
            <ButtonLink href="/tenants/new" variant="soft">
              Add Tenant
            </ButtonLink>
          )}
        </div>
      </div>

      {loading ? (
        <MetricCardsSkeletonRow count={4} />
      ) : isApplicants ? (
        <ApplicantMetricCards metrics={applicantMetrics} />
      ) : (
        <TenantMetricCards metrics={tenantMetrics || EMPTY_TENANT_METRICS} />
      )}

      <TenantControlsBar
        filters={filters}
        onChange={patchFilters}
        properties={properties}
        searchPlaceholder={
          isApplicants
            ? "Search applicants by name, email or property..."
            : "Search tenants by name, email or property..."
        }
      />

      {!loading && !error && totalCount === 0 ? (
        <section className="pg-tenants-empty pg-workspace-card" aria-busy={directoryQuery.isFetching}>
          <h2>{isApplicants ? "No applicants found" : "No tenants found"}</h2>
          <p>
            {totalCount === 0
              ? isApplicants
                ? "Share an application link to collect applicant details."
                : "Add your first tenant to start tracking leases and rent."
              : "Try adjusting your search or filters."}
          </p>
          {isApplicants ? (
            <Button type="button" variant="primary" onClick={() => setShowInviteCard(true)}>
              Add Applicant
            </Button>
          ) : (
            <ButtonLink href="/tenants/new" variant="primary">
              Add Tenant
            </ButtonLink>
          )}
        </section>
      ) : (
        <>
          {isApplicants ? (
            <section className="pg-tenants-list-panel pg-workspace-card pg-tenants-desktop-only" aria-busy={directoryQuery.isFetching}>
              <ApplicantDesktopTable
                items={pageItems}
                loading={loading}
                onView={(item) => setViewApplicantId(item.id)}
                onDelete={(item) => setDeleteApplicant(item)}
              />
              <TenantPagination page={page} totalItems={totalCount} onPageChange={setPage} />
            </section>
          ) : (
            <section className="pg-tenants-list-panel pg-workspace-card pg-tenants-desktop-only" aria-busy={directoryQuery.isFetching}>
              <TenantDesktopTable items={pageItems} loading={loading} onDelete={(item) => setDeleteTenantItem(item)} />
              <TenantPagination page={page} totalItems={totalCount} onPageChange={setPage} />
            </section>
          )}
          <div className="pg-tenants-mobile-only pg-workspace-card-stack" aria-busy={directoryQuery.isFetching}>
            {isApplicants ? (
              <ApplicantDesktopTable
                items={pageItems}
                loading={loading}
                onView={(item) => setViewApplicantId(item.id)}
                onDelete={(item) => setDeleteApplicant(item)}
              />
            ) : (
              <TenantMobileList items={pageItems} loading={loading} onDelete={(item) => setDeleteTenantItem(item)} />
            )}
            <section className="pg-workspace-card pg-tenants-pagination-panel">
              <TenantPagination page={page} totalItems={totalCount} onPageChange={setPage} />
            </section>
          </div>
        </>
      )}

      <ApplicantInviteModal open={showInviteCard} onOpenChange={setShowInviteCard} properties={properties} />

      <ApplicantDetailModal
        tenantId={viewApplicantId}
        open={viewApplicantId != null}
        onClose={() => setViewApplicantId(null)}
        onSaved={refreshDirectory}
      />

      <ConfirmDialog
        open={deleteApplicant != null}
        title="Delete applicant"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={deleteBusy}
        onClose={() => setDeleteApplicant(null)}
        onConfirm={() => void confirmDeleteApplicant()}
      >
        {deleteApplicant ? (
          <p className="pg-muted" style={{ margin: 0 }}>
            Permanently delete applicant {deleteApplicant.fullName}? This cannot be undone.
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteTenantItem != null}
        title="Delete tenant"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={deleteBusy}
        onClose={() => setDeleteTenantItem(null)}
        onConfirm={() => void confirmDeleteTenant()}
      >
        {deleteTenantItem ? (
          <p className="pg-muted" style={{ margin: 0 }}>
            Permanently delete {deleteTenantItem.fullName} and all related leases, invoices, documents, and
            financial records? This cannot be undone.
          </p>
        ) : null}
      </ConfirmDialog>
    </AppListPage>
  );
}
