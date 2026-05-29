import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import {
  generateInvoicePdf,
  getInvoicesDirectory,
  hardDeleteInvoice,
  propertyApiErrorMessage
} from "../api/ownedProperties";
import { openInvoicePdfExport } from "../features/invoices/invoicePdfExport";
import { PROPERTY_DATA_INVALIDATION } from "../features/properties/invalidate";
import { InvoiceControlsBar } from "../features/invoices/InvoiceControlsBar";
import { InvoiceDesktopTable } from "../features/invoices/InvoiceDesktopTable";
import { InvoiceMetricCards } from "../features/invoices/InvoiceMetricCards";
import { InvoicePagination } from "../features/invoices/InvoicePagination";
import type { InvoiceDirectoryFilters, InvoiceDirectoryMetrics, InvoiceDirectoryRow } from "../features/invoices/invoiceDirectoryTypes";
import {
  computeInvoiceMetrics,
  matchesInvoiceFilters,
  paginate
} from "../features/invoices/invoiceDirectoryUtils";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";

const EMPTY_METRICS: InvoiceDirectoryMetrics = {
  totalOutstanding: 0,
  dueThisMonth: 0,
  overdue: 0,
  paidThisMonth: 0
};

export function InvoicesListPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<InvoiceDirectoryRow[]>([]);
  const [metrics, setMetrics] = useState<InvoiceDirectoryMetrics>(EMPTY_METRICS);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInvoicesDirectory();
      setItems(res.items);
      setMetrics(res.metrics);
      setProperties(res.properties);
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e));
      setItems([]);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener(PROPERTY_DATA_INVALIDATION, handler);
    return () => window.removeEventListener(PROPERTY_DATA_INVALIDATION, handler);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.propertyId, filters.status, filters.dateFrom, filters.dateTo]);

  const filtered = useMemo(() => items.filter((row) => matchesInvoiceFilters(row, filters)), [items, filters]);
  const filteredMetrics = useMemo(() => computeInvoiceMetrics(filtered), [filtered]);
  const { slice: pageItems, totalPages } = useMemo(() => paginate(filtered, page), [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    setError("");
    try {
      await hardDeleteInvoice(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const hasActiveFilters =
    filters.q.trim() !== "" ||
    filters.propertyId !== "ALL" ||
    filters.status !== "ALL" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  return (
    <Section>
      <Helmet>
        <title>Invoices | The Property Guy</title>
      </Helmet>
      <Container className="pg-container--invoices-dashboard">
        <div className="pg-invoices pg-workspace-page">
          <div className="pg-invoices-toolbar">
            <div>
              <p className="pg-muted" style={{ marginTop: 6, maxWidth: 560 }}>
                All invoices across your portfolio. PDFs are generated on demand from invoice data — nothing is stored
                until you export.
              </p>
            </div>
            <div className="pg-invoices-toolbar-actions pg-invoices-desktop-only">
              <Button onClick={() => void load()} loading={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          <InvoiceMetricCards metrics={!hasActiveFilters ? metrics : filteredMetrics} loading={loading && !items.length} />

          <InvoiceControlsBar filters={filters} onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))} properties={properties} />

          {!loading && filtered.length === 0 ? (
            <section className="pg-invoices-empty pg-workspace-card" aria-busy={loading}>
              <h2>No invoices found</h2>
              <p>
                {items.length === 0
                  ? "Invoices from active leases are generated automatically, or create one from a property lease."
                  : "Try adjusting your search or filters."}
              </p>
              <Link className="pg-btn pg-btn-primary" to="/leases">
                View leases
              </Link>
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
              <InvoicePagination page={page} totalItems={filtered.length} onPageChange={setPage} />
            </>
          )}
        </div>
      </Container>

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
    </Section>
  );
}
