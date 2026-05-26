import { Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";

export type TenantFilters = {
  q: string;
  propertyId: string;
  leaseStatus: string;
  paymentStatus: string;
};

function FilterSelects({
  filters,
  onChange,
  properties,
  pill
}: {
  filters: TenantFilters;
  onChange: (next: Partial<TenantFilters>) => void;
  properties: Array<{ id: string; name: string }>;
  pill?: boolean;
}) {
  const selectClass = pill ? "pg-tenants-select pg-tenants-select--pill" : "pg-tenants-select";
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
        className={selectClass}
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
    </>
  );
}

export function TenantControlsBar({
  filters,
  onChange,
  properties
}: {
  filters: TenantFilters;
  onChange: (next: Partial<TenantFilters>) => void;
  properties: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="pg-tenants-controls">
      <div className="pg-tenants-controls-row">
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
        <div className="pg-tenants-controls-filters">
          <FilterSelects filters={filters} onChange={onChange} properties={properties} pill />
        </div>
        <Link className="pg-btn pg-btn-primary pg-tenants-add-btn" to="/tenants/new">
          <Plus size={18} aria-hidden />
          <span className="pg-tenants-add-btn-label">Add Tenant</span>
        </Link>
      </div>
    </div>
  );
}
