import { Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

export type TenantFilters = {
  q: string;
  propertyId: string;
  leaseStatus: string;
  paymentStatus: string;
};

export function TenantControlsBar({
  filters,
  onChange,
  properties,
  filtersOpen,
  onToggleFilters,
  mobile
}: {
  filters: TenantFilters;
  onChange: (next: Partial<TenantFilters>) => void;
  properties: Array<{ id: string; name: string }>;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  mobile?: boolean;
}) {
  return (
    <div className={`pg-tenants-controls ${mobile ? "pg-tenants-controls--mobile" : ""}`}>
      <div className="pg-tenants-controls-search-row">
        <label className="pg-tenants-search">
          <Search size={18} className="pg-tenants-search-icon" aria-hidden />
          <input
            type="search"
            className="pg-tenants-search-input"
            placeholder="Search tenants by name, email or property..."
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            aria-label="Search tenants"
          />
        </label>
        <button
          type="button"
          className={`pg-tenants-filter-btn ${filtersOpen ? "pg-tenants-filter-btn--active" : ""}`}
          onClick={onToggleFilters}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={18} aria-hidden />
          <span>Filters</span>
        </button>
        {!mobile ? (
          <Link className="pg-btn pg-btn-primary pg-tenants-add-btn" to="/tenants/new">
            <Plus size={18} aria-hidden />
            Add Tenant
          </Link>
        ) : null}
      </div>

      {filtersOpen && mobile ? (
        <div className="pg-tenants-filters-panel">
          <label className="pg-tenants-filter-field">
            <span>Property</span>
            <select
              className="pg-tenants-select"
              value={filters.propertyId}
              onChange={(e) => onChange({ propertyId: e.target.value })}
            >
              <option value="ALL">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pg-tenants-filter-field">
            <span>Lease status</span>
            <select
              className="pg-tenants-select"
              value={filters.leaseStatus}
              onChange={(e) => onChange({ leaseStatus: e.target.value })}
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="ending_soon">Ending Soon</option>
              <option value="notice">Notice</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="pg-tenants-filter-field">
            <span>Payment status</span>
            <select
              className="pg-tenants-select"
              value={filters.paymentStatus}
              onChange={(e) => onChange({ paymentStatus: e.target.value })}
            >
              <option value="ALL">All Payment Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <button
            type="button"
            className="pg-btn pg-btn-ghost pg-tenants-clear-filters"
            onClick={() =>
              onChange({ q: "", propertyId: "ALL", leaseStatus: "ALL", paymentStatus: "ALL" })
            }
          >
            <Filter size={16} aria-hidden />
            Clear filters
          </button>
        </div>
      ) : null}

      {!mobile ? (
        <div className="pg-tenants-controls-desktop-filters">
          <select
            className="pg-tenants-select pg-tenants-select--pill"
            value={filters.propertyId}
            onChange={(e) => onChange({ propertyId: e.target.value })}
            aria-label="Filter by property"
          >
            <option value="ALL">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="pg-tenants-select pg-tenants-select--pill"
            value={filters.leaseStatus}
            onChange={(e) => onChange({ leaseStatus: e.target.value })}
            aria-label="Filter by lease status"
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active</option>
            <option value="ending_soon">Ending Soon</option>
            <option value="notice">Notice</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="pg-tenants-select pg-tenants-select--pill"
            value={filters.paymentStatus}
            onChange={(e) => onChange({ paymentStatus: e.target.value })}
            aria-label="Filter by payment status"
          >
            <option value="ALL">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="unknown">Unknown</option>
          </select>
          <button
            type="button"
            className="pg-tenants-filter-btn"
            onClick={onToggleFilters}
            aria-label="More filters"
          >
            <SlidersHorizontal size={18} aria-hidden />
            Filters
          </button>
        </div>
      ) : null}

      {mobile ? (
        <Link className="pg-btn pg-btn-primary pg-tenants-add-btn pg-tenants-add-btn--mobile" to="/tenants/new">
          <Plus size={18} aria-hidden />
          Add Tenant
        </Link>
      ) : null}
    </div>
  );
}
