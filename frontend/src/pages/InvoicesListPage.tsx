import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  generateInvoicePdf,
  hardDeleteInvoice,
  propertyApiErrorMessage
} from "../api/ownedProperties";
import { openInvoicePdfExport } from "../features/invoices/invoicePdfExport";
import {
  invalidateInvoiceQueries,
  isInitialQueryLoad,
  isQueryRefreshing,
  queryKeys,
  useInvoiceMetricsQuery,
  useInvoicesListQuery,
  usePropertyOptionsQuery,
  useWorkspaceId
} from "../features/queries";
import { InvoiceControlsBar } from "../features/invoices/InvoiceControlsBar";
import { InvoiceDesktopTable } from "../features/invoices/InvoiceDesktopTable";
import { InvoiceMetricCards } from "../features/invoices/InvoiceMetricCards";
import { InvoicePagination } from "../features/invoices/InvoicePagination";
import type { InvoiceDirectoryFilters, InvoiceDirectoryMetrics, InvoiceDirectoryRow } from "../features/invoices/invoiceDirectoryTypes";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { AppListPage } from "../components/ui/AppPage";
import { Button, ButtonLink } from "../components/ui/Button";
import { MetricCardsSkeletonRow } from "../components/ui/PageSkeletons";
import { QueryErrorCard, QueryRefreshingIndicator } from "../components/ui/QueryState";
import { listWarmHandlers, prefetchInvoiceDetail } from "../lib/routePrefetch";

const EMPTY_METRICS: InvoiceDirectoryMetrics = {
  totalOutstanding: 0,
  dueThisMonth: 0,
  overdue: 0,
  paidThisMonth: 0
};

export function InvoicesListPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InvoiceDirectoryRow | null>(null);
  const [filters, setFilters] = useState<InvoiceDirectoryFilters>(() => ({
    q: "",
    propertyId: searchParams.get("propertyId")?.trim() || "ALL",
    status: "ALL",
    dateFrom: "",
    dateTo: ""
  }));

  const filterParams = useMemo(
    () => ({
      q: filters.q,
      propertyId: filters.propertyId,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    }),
    [filters]
  );

  const listParams = useMemo(
    () => ({
      page,
      pageSize: 20,
      ...filterParams
    }),
    [page, filterParams]
  );

  const metricsQuery = useInvoiceMetricsQuery(filterParams);
  const listQuery = useInvoicesListQuery(listParams);
  const propertyOptionsQuery = usePropertyOptionsQuery();

  const pageItems = listQuery.data?.items ?? [];
  const totalCount = listQuery.data?.totalCount ?? 0;
  const metrics = metricsQuery.data ?? EMPTY_METRICS;
  const properties = propertyOptionsQuery.data ?? [];
  const loading = isInitialQueryLoad(listQuery);
  const metricsLoading = isInitialQueryLoad(metricsQuery);
  const refreshing = isQueryRefreshing(listQuery) || isQueryRefreshing(metricsQuery);
  const error = listQuery.error
    ? propertyApiErrorMessage(listQuery.error)
    : metricsQuery.error
      ? propertyApiErrorMessage(metricsQuery.error)
      : "";

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.propertyId, filters.status, filters.dateFrom, filters.dateTo]);

  const refreshDirectory = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoiceMetrics(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoicesList(workspaceId) });
    }
  };

  async function exportPdf(row: InvoiceDirectoryRow) {
    setBusyId(row.id);
    try {
      const gen = await generateInvoicePdf(row.id);
      await openInvoicePdfExport(gen);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Could not export invoice PDF.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmInvoiceDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await hardDeleteInvoice(confirmDelete.id);
      invalidateInvoiceQueries({
        workspaceId,
        invoiceId: confirmDelete.id,
        propertyId: confirmDelete.propertyId,
        tenantId: confirmDelete.tenantId
      });
      setConfirmDelete(null);
    } catch (e: unknown) {
      window.alert(propertyApiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AppListPage contentClassName="pg-invoices">
        <Helmet>
          <title>Invoices | The Property Guy</title>
        </Helmet>
          <div className="pg-invoices-toolbar">
            <div>
              <p className="pg-muted" style={{ marginTop: 6, maxWidth: 560 }}>
                All invoices across your portfolio. PDFs are generated on demand from invoice data — nothing is stored
                until you export.
              </p>
            </div>
            <div className="pg-invoices-toolbar-actions pg-invoices-desktop-only">
              <QueryRefreshingIndicator active={refreshing} />
              <Button onClick={refreshDirectory} loading={(listQuery.isFetching || metricsQuery.isFetching) && !loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? (
            <QueryErrorCard
              message={error}
              onRetry={() => {
                void listQuery.refetch();
                void metricsQuery.refetch();
              }}
              retrying={listQuery.isFetching || metricsQuery.isFetching}
            />
          ) : null}

          {metricsLoading ? <MetricCardsSkeletonRow count={4} /> : <InvoiceMetricCards metrics={metrics} />}

          <InvoiceControlsBar filters={filters} onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))} properties={properties} />

          {!loading && !error && totalCount === 0 ? (
            <section className="pg-invoices-empty pg-workspace-card" aria-busy={listQuery.isFetching}>
              <h2>No invoices found</h2>
              <p>
                {!filters.q && filters.propertyId === "ALL" && filters.status === "ALL"
                  ? "Invoices from active leases are generated automatically, or create one from a property lease."
                  : "Try adjusting your search or filters."}
              </p>
              <ButtonLink href="/leases" variant="primary">
                View leases
              </ButtonLink>
            </section>
          ) : (
            <>
              <InvoiceDesktopTable
                items={pageItems}
                loading={loading}
                busyId={busyId}
                onExportPdf={(row) => void exportPdf(row)}
                onDelete={(row) => setConfirmDelete(row)}
                rowWarmProps={(row) =>
                  listWarmHandlers(() =>
                    prefetchInvoiceDetail(row.id, queryClient, workspaceId ?? null, Boolean(workspaceId))
                  )
                }
              />
              <InvoicePagination page={page} totalItems={totalCount} onPageChange={setPage} />
            </>
          )}
      </AppListPage>

      <ConfirmDialog
        open={confirmDelete != null}
        title="Delete invoice"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={busyId != null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void confirmInvoiceDelete()}
      >
        {confirmDelete ? (
          <p className="pg-muted" style={{ margin: 0 }}>
            Permanently delete invoice {confirmDelete.invoiceNumber}
            {confirmDelete.leaseReference ? ` (${confirmDelete.leaseReference})` : ""}? This cannot be undone.
            {["SENT", "DUE", "OVERDUE", "PARTIALLY_PAID", "PAID"].includes(String(confirmDelete.status).toUpperCase())
              ? " Any payment history linked to this invoice will be removed."
              : null}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
