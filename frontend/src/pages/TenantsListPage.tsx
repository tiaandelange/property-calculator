import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button, ButtonLink } from "../components/ui/Button";
import { getProperties, getTenantsDirectory } from "../api/ownedProperties";
import { PROPERTY_DATA_INVALIDATION } from "../features/properties/invalidate";
import { TenantMetricCards } from "../features/tenants/TenantMetricCards";
import { TenantControlsBar, type TenantFilters } from "../features/tenants/TenantControlsBar";
import { TenantDesktopTable } from "../features/tenants/TenantDesktopTable";
import { TenantMobileList } from "../features/tenants/TenantMobileCard";
import { TenantPagination } from "../features/tenants/TenantPagination";
import type { TenantDirectoryMetrics, TenantListItem } from "../features/tenants/tenantDirectoryTypes";
import { PAGE_SIZE, paginate } from "../features/tenants/tenantDirectoryUtils";

const EMPTY_METRICS: TenantDirectoryMetrics = {
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
  const [items, setItems] = useState<TenantListItem[]>([]);
  const [metrics, setMetrics] = useState<TenantDirectoryMetrics>(EMPTY_METRICS);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
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
      setMetrics(directory.metrics);
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
  }, [filters.q, filters.propertyId, filters.leaseStatus, filters.paymentStatus]);

  const filtered = useMemo(
    () => items.filter((t) => matchesFilters(t, filters)).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [items, filters]
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

  return (
    <Section>
      <Helmet>
        <title>Tenants | The Property Guy</title>
      </Helmet>
      <Container className="pg-container--tenants-dashboard">
        <div className="pg-tenants pg-workspace-page">
          <div className="pg-tenants-toolbar">
            <div className="pg-tenants-toolbar-actions pg-tenants-desktop-only">
              <Button onClick={() => load()} loading={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          <TenantMetricCards metrics={metrics} loading={loading && !items.length} />

          <TenantControlsBar filters={filters} onChange={patchFilters} properties={properties} />

          {!loading && filtered.length === 0 ? (
            <section className="pg-tenants-empty pg-workspace-card" aria-busy={loading}>
              <h2>No tenants found</h2>
              <p>
                {items.length === 0
                  ? "Add your first tenant to start tracking leases and rent."
                  : "Try adjusting your search or filters."}
              </p>
              <ButtonLink href="/tenants/new" variant="primary">
                Add Tenant
              </ButtonLink>
            </section>
          ) : (
            <>
              <section className="pg-tenants-list-panel pg-workspace-card pg-tenants-desktop-only" aria-busy={loading}>
                <TenantDesktopTable items={pageItems} loading={loading} />
                <TenantPagination page={page} totalItems={filtered.length} onPageChange={setPage} />
              </section>
              <div className="pg-tenants-mobile-only pg-workspace-card-stack" aria-busy={loading}>
                <TenantMobileList items={pageItems} loading={loading} />
                <section className="pg-workspace-card pg-tenants-pagination-panel">
                  <TenantPagination page={page} totalItems={filtered.length} onPageChange={setPage} />
                </section>
              </div>
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}
