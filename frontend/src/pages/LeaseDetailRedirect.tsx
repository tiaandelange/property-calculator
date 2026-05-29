import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, useParams } from "react-router-dom";
import { getLease } from "../api/ownedProperties";
import { propertyLeasesPath } from "../features/leases/leaseRoutes";

/** Legacy `/leases/:id` URLs redirect to the property leases tab. */
export function LeaseDetailRedirect() {
  const { id } = useParams();
  const [target, setTarget] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const lease = await getLease(id);
        if (cancelled) return;
        const propertyId = String(lease?.propertyId ?? (lease?.property as { id?: string } | null)?.id ?? "");
        if (!propertyId) {
          setFailed(true);
          return;
        }
        setTarget(propertyLeasesPath(propertyId, id));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) {
    return <Navigate to="/leases" replace />;
  }

  if (!target) {
    return (
      <>
        <Helmet>
          <title>Opening lease… | Proplytic</title>
        </Helmet>
        <div className="pg-muted" style={{ padding: 24 }}>
          Opening lease…
        </div>
      </>
    );
  }

  return <Navigate to={target} replace />;
}
