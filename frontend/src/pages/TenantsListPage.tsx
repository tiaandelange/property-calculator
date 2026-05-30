import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { AppListPage } from "../components/ui/AppPage";
import { AppSectionTabs } from "../components/ui/AppSectionTabs";
import { Button, ButtonLink } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { deleteTenant, getProperties, getTenantsDirectory } from "../api/ownedProperties";
import { PROPERTY_DATA_INVALIDATION } from "../features/properties/invalidate";
import { ApplicantDetailModal } from "../features/applicants/ApplicantDetailModal";
import { ApplicantDesktopTable } from "../features/applicants/ApplicantDesktopTable";
import { ApplicantInviteCard } from "../features/applicants/ApplicantInviteCard";
import {
  computeApplicantDirectoryMetrics,
  computeTenantDirectoryMetrics,
  isApplicantListItem
} from "../features/tenants/tenantDirectoryAdapter";
import { ApplicantMetricCards, TenantMetricCards } from "../features/tenants/TenantMetricCards";
import { TenantControlsBar, type TenantFilters } from "../features/tenants/TenantControlsBar";
import { TenantDesktopTable } from "../features/tenants/TenantDesktopTable";
import { TenantMobileList } from "../features/tenants/TenantMobileCard";
import { TenantPagination } from "../features/tenants/TenantPagination";
import type { TenantDirectoryMetrics, TenantListItem } from "../features/tenants/tenantDirectoryTypes";
import { PAGE_SIZE, paginate } from "../features/tenants/tenantDirectoryUtils";

const EMPTY_TENANT_METRICS: TenantDirectoryMetrics = {
  totalTenants: 0,
  activeLeases: 0,
  pendingPaymentsTotal: 0,
  pendingPaymentsCount: 0,
  renewalsDue: 0
};

function matchesFilters(item: TenantListItem, filters: TenantFilters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const hay = `${item.fullName} ${item.email ?? ""} ${item.phone ?? ""} ${item.propertyName ?? ""} ${item.propertyAddress ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.propertyId !== "ALL" && item.propertyId !== filters.propertyId) return false;
  if (filters.leaseStatus !== "ALL" && item.leaseStatus !== filters.leaseStatus) return false;
  if (filters.paymentStatus !== "ALL" && item.paymentStatus !== filters.paymentStatus) return false;
  return true;
}

export function TenantsListPage() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "applicants" ? "applicants" : "tenants";
  const isApplicants = activeTab === "applicants";

  const [items, setItems] = useState<TenantListItem[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [showInviteCard, setShowInviteCard] = useState(false);
  const [viewApplicantId, setViewApplicantId] = useState<string | null>(null);
  const [deleteApplicant, setDeleteApplicant] = useState<TenantListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [filters, setFilters] = useState<TenantFilters>({
    q: "",
    propertyId: "ALL",
    leaseStatus: "ALL",
    paymentStatus: "ALL"
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [directory, props] = await Promise.all([
        getTenantsDirectory(),
        getProperties().catch(() => [])
      ]);
      setItems(directory.items);
      setProperties(
        (props as Array<Record<string, unknown>>).map((p) => ({
          id: String(p.id),
          name: String(p.name ?? "Property")
        }))
      );
    } catch (e: unknown) {
      console.error("[TenantsList] Load failed", e);
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message ?? err?.message ?? "Failed to load tenants.");
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
  }, [filters.q, filters.propertyId, filters.leaseStatus, filters.paymentStatus, activeTab]);

  useEffect(() => {
    if (!isApplicants) setShowInviteCard(false);
  }, [isApplicants]);

  const scopedItems = useMemo(
    () => items.filter((item) => (isApplicants ? isApplicantListItem(item) : !isApplicantListItem(item))),
    [items, isApplicants]
  );

  const tenantMetrics = useMemo(
    () => computeTenantDirectoryMetrics(items.filter((item) => !isApplicantListItem(item))),
    [items]
  );

  const applicantMetrics = useMemo(() => computeApplicantDirectoryMetrics(items), [items]);

  const filtered = useMemo(
    () => scopedItems.filter((t) => matchesFilters(t, filters)).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [scopedItems, filters]
  );

  const { slice: pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, PAGE_SIZE),
    [filtered, page]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const patchFilters = (next: Partial<TenantFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const confirmDeleteApplicant = async () => {
    if (!deleteApplicant) return;
    setDeleteBusy(true);
    setError("");
    try {
      await deleteTenant(deleteApplicant.id);
      setDeleteApplicant(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete applicant.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <AppListPage contentClassName="pg-tenants">
      <Helmet>
        <title>{isApplicants ? "Applicants" : "Tenants"} | The Property Guy</title>
      </Helmet>

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

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
          {isApplicants ? (
            <Button type="button" variant="soft" onClick={() => setShowInviteCard((v) => !v)}>
              {showInviteCard ? "Hide invite form" : "Add Applicant"}
            </Button>
          ) : (
            <ButtonLink href="/tenants/new" variant="soft">
              Add Tenant
            </ButtonLink>
          )}
        </div>
      </div>

      {isApplicants ? (
        <ApplicantMetricCards metrics={applicantMetrics} loading={loading && !items.length} />
      ) : (
        <TenantMetricCards metrics={tenantMetrics || EMPTY_TENANT_METRICS} loading={loading && !items.length} />
      )}

      {isApplicants && showInviteCard ? (
        <ApplicantInviteCard properties={properties} onClose={() => setShowInviteCard(false)} />
      ) : null}

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

      {!loading && filtered.length === 0 ? (
        <section className="pg-tenants-empty pg-workspace-card" aria-busy={loading}>
          <h2>{isApplicants ? "No applicants found" : "No tenants found"}</h2>
          <p>
            {scopedItems.length === 0
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
            <section className="pg-tenants-list-panel pg-workspace-card pg-tenants-desktop-only" aria-busy={loading}>
              <ApplicantDesktopTable
                items={pageItems}
                loading={loading}
                onView={(item) => setViewApplicantId(item.id)}
                onDelete={(item) => setDeleteApplicant(item)}
              />
              <TenantPagination page={page} totalItems={filtered.length} onPageChange={setPage} />
            </section>
          ) : (
            <section className="pg-tenants-list-panel pg-workspace-card pg-tenants-desktop-only" aria-busy={loading}>
              <TenantDesktopTable items={pageItems} loading={loading} />
              <TenantPagination page={page} totalItems={filtered.length} onPageChange={setPage} />
            </section>
          )}
          <div className="pg-tenants-mobile-only pg-workspace-card-stack" aria-busy={loading}>
            <TenantMobileList items={pageItems} loading={loading} />
            <section className="pg-workspace-card pg-tenants-pagination-panel">
              <TenantPagination page={page} totalItems={filtered.length} onPageChange={setPage} />
            </section>
          </div>
        </>
      )}

      <ApplicantDetailModal
        tenantId={viewApplicantId}
        open={viewApplicantId != null}
        onClose={() => setViewApplicantId(null)}
        onSaved={() => void load()}
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
    </AppListPage>
  );
}
