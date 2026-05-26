import { Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import type { LeaseFilters } from "./leaseDirectoryTypes";

function FilterSelects({
  filters,
  onChange,
  properties,
  pill
}: {
  filters: LeaseFilters;
  onChange: (next: Partial<LeaseFilters>) => void;
  properties: Array<{ id: string; name: string }>;
  pill?: boolean;
}) {
  const selectClass = pill ? "pg-leases-select pg-leases-select--pill" : "pg-leases-select";
  return (
    <>
      <select
        className={selectClass}
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
        className={selectClass}
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value })}
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
        className={selectClass}
        value={filters.leaseType}
        onChange={(e) => onChange({ leaseType: e.target.value })}
        aria-label="Filter by lease type"
      >
        <option value="ALL">All Types</option>
        <option value="FIXED_TERM">Fixed term</option>
        <option value="MONTH_TO_MONTH">Month-to-month</option>
      </select>
    </>
  );
}

export function LeaseControlsBar({
  filters,
  onChange,
  properties
}: {
  filters: LeaseFilters;
  onChange: (next: Partial<LeaseFilters>) => void;
  properties: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="pg-leases-controls">
      <div className="pg-leases-controls-row">
        <label className="pg-leases-search">
          <Search size={18} className="pg-leases-search-icon" aria-hidden />
          <input
            type="search"
            className="pg-leases-search-input"
            placeholder="Search by tenant, property or email..."
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            aria-label="Search leases"
          />
        </label>
        <div className="pg-leases-controls-filters">
          <FilterSelects filters={filters} onChange={onChange} properties={properties} pill />
        </div>
        <Link className="pg-btn pg-btn-primary pg-leases-add-btn" to="/leases/new">
          <Plus size={18} aria-hidden />
          <span className="pg-leases-add-btn-label">Add Lease</span>
        </Link>
      </div>
    </div>
  );
}
