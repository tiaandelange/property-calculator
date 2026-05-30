import { Search } from "lucide-react";
import { INVOICE_STATUS_FILTER_OPTIONS, invoiceStatusFilterLabel } from "./InvoiceStatusBadge";
import type { InvoiceDirectoryFilters } from "./invoiceDirectoryTypes";

export function InvoiceControlsBar({
  filters,
  onChange,
  properties
}: {
  filters: InvoiceDirectoryFilters;
  onChange: (next: Partial<InvoiceDirectoryFilters>) => void;
  properties: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="pg-invoices-controls pg-workspace-filter-card pg-workspace-card">
      <div className="pg-invoices-controls-row">
        <label className="pg-invoices-search">
          <Search size={18} className="pg-invoices-search-icon" aria-hidden />
          <input
            type="search"
            className="pg-invoices-search-input"
            placeholder="Search invoice #, reference, tenant…"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            aria-label="Search invoices"
          />
        </label>
        <div className="pg-invoices-controls-filters">
          <select
            className="pg-invoices-select pg-invoices-select--pill"
            value={filters.propertyId}
            onChange={(e) => onChange({ propertyId: e.target.value })}
            aria-label="Filter by property"
          >
            <option value="ALL">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="pg-invoices-select pg-invoices-select--pill"
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
            aria-label="Filter by status"
          >
            {INVOICE_STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {invoiceStatusFilterLabel(s)}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="pg-invoices-select pg-invoices-select--pill"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            aria-label="Due date from"
          />
          <input
            type="date"
            className="pg-invoices-select pg-invoices-select--pill"
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            aria-label="Due date to"
          />
        </div>
      </div>
    </div>
  );
}
