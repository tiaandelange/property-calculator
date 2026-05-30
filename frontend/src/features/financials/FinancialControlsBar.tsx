import { Plus, Search } from "lucide-react";
import { ButtonLink } from "../../components/ui/Button";
import type { FinancialFilters } from "./financialDirectoryTypes";
import { propertyFinancialsStatementUrl } from "./financialDirectoryUtils";

export function FinancialControlsBar({
  filters,
  onChange,
  properties
}: {
  filters: FinancialFilters;
  onChange: (next: Partial<FinancialFilters>) => void;
  properties: Array<{ id: string; name: string }>;
}) {
  const addHref =
    filters.propertyId !== "ALL"
      ? propertyFinancialsStatementUrl(filters.propertyId)
      : properties[0]
        ? propertyFinancialsStatementUrl(properties[0].id)
        : "/owned-properties/new";

  return (
    <div className="pg-fins-controls pg-workspace-filter-card pg-workspace-card">
      <div className="pg-fins-controls-row">
        <label className="pg-fins-search">
          <Search size={18} className="pg-fins-search-icon" aria-hidden />
          <input
            type="search"
            className="pg-fins-search-input"
            placeholder="Search description, type, property…"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            aria-label="Search ledger"
          />
        </label>
        <div className="pg-fins-controls-filters">
          <select
            className="pg-fins-select pg-fins-select--pill"
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
          <input
            type="month"
            className="pg-fins-select pg-fins-select--pill pg-fins-month"
            value={filters.month}
            onChange={(e) => onChange({ month: e.target.value })}
            aria-label="Calendar month"
          />
          <select
            className="pg-fins-select pg-fins-select--pill"
            value={filters.source}
            onChange={(e) => onChange({ source: e.target.value })}
            aria-label="Filter by entry type"
          >
            <option value="ALL">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="INVOICE">Invoice</option>
          </select>
        </div>
        <ButtonLink href={addHref} variant="primary" className="pg-fins-add-btn">
          <Plus size={18} aria-hidden />
          <span className="pg-fins-add-btn-label">Manage on property</span>
        </ButtonLink>
      </div>
    </div>
  );
}
