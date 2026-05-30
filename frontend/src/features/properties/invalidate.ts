import { invalidatePortfolioQueries } from "../../lib/queryInvalidation";

/** Single browser event for cross-page property data refresh (legacy bridge). */
export const PROPERTY_DATA_INVALIDATION = "pg:property-data-invalidation";

export function invalidatePropertyWorkspace(propertyId?: number | string | null) {
  invalidatePortfolioQueries({
    propertyId: propertyId != null ? String(propertyId) : undefined
  });
  window.dispatchEvent(new CustomEvent(PROPERTY_DATA_INVALIDATION, { detail: { propertyId } }));
}
