import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { fmtZar } from "./portfolioDashboardUtils";
import { OccupancyBadge, type OccupancyBadgeVariant } from "./OccupancyBadge";

export type RecentPropertyCard = {
  id: string;
  name: string;
  address: string;
  monthlyRent: number | null;
  status: OccupancyBadgeVariant;
  statusLabel?: string;
};

function PropertyCard({ property }: { property: RecentPropertyCard }) {
  return (
    <Link to={`/owned-properties/${property.id}`} className="pg-pdash-property-card">
      <div className="pg-pdash-property-thumb" aria-hidden>
        <Home size={22} />
      </div>
      <div className="pg-pdash-property-body">
        <div className="pg-pdash-property-head">
          <h3 className="pg-pdash-property-name">{property.name}</h3>
          <OccupancyBadge variant={property.status} label={property.statusLabel} />
        </div>
        <p className="pg-pdash-property-address">{property.address}</p>
        <p className="pg-pdash-property-rent">
          {property.monthlyRent != null ? (
            <>
              <strong>{fmtZar(property.monthlyRent)}</strong>
              <span className="pg-pdash-property-rent-suffix"> / month</span>
            </>
          ) : (
            <span className="pg-pdash-property-rent-muted">Rent not set</span>
          )}
        </p>
      </div>
    </Link>
  );
}

export function RecentPropertiesSection({
  properties,
  loading,
  limit = 4
}: {
  properties: RecentPropertyCard[];
  loading?: boolean;
  /** Desktop: scales with viewport (4–8). Mobile always shows up to 4. */
  limit?: number;
}) {
  const visible = useMemo(() => properties.slice(0, Math.max(1, limit)), [properties, limit]);
  const skeletonCount = Math.min(Math.max(limit, 4), 8);

  return (
    <section className="pg-pdash-properties-section">
      <div className="pg-pdash-section-head">
        <h2 className="pg-pdash-panel-title">Recent Properties</h2>
        <Link to="/owned-properties/my-properties" className="pg-pdash-view-all">
          View all
        </Link>
      </div>
      {loading ? (
        <div className="pg-pdash-properties-grid pg-pdash-properties-grid--loading">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div key={i} className="pg-pdash-property-card pg-pdash-property-card--skeleton" aria-hidden />
          ))}
        </div>
      ) : visible.length ? (
        <div className="pg-pdash-properties-grid">
          {visible.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      ) : (
        <p className="pg-pdash-empty-inline">No properties yet.</p>
      )}
    </section>
  );
}
