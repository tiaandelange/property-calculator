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
  queryKeys,
  useInvoicesDirectoryQuery,
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

  const directoryParams = useMemo(
    () => ({
      page,
      pageSize: 20,
      q: filters.q,
      propertyId: filters.propertyId,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    }),
    [page, filters]
  );

  const directoryQuery = useInvoicesDirectoryQuery(directoryParams);

  const pageItems = directoryQuery.data?.items ?? [];
  const totalCount = directoryQuery.data?.totalCount ?? 0;
  const metrics = directoryQuery.data?.metrics ?? EMPTY_METRICS;
  const properties = directoryQuery.data?.properties ?? [];
  const loading = isInitialQueryLoad(directoryQuery);
  const error = directoryQuery.error ? propertyApiErrorMessage(directoryQuery.error) : "";

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.propertyId, filters.status, filters.dateFrom, filters.dateTo]);

  const refreshDirectory = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoicesDirectory(workspaceId) });
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
              <Button onClick={refreshDirectory} loading={directoryQuery.isFetching && !loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          <InvoiceMetricCards metrics={metrics} loading={loading} />

          <InvoiceControlsBar filters={filters} onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))} properties={properties} />

          {!loading && totalCount === 0 ? (
            <section className="pg-invoices-empty pg-workspace-card" aria-busy={directoryQuery.isFetching}>
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
