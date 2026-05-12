/** Single browser event for cross-page property data refresh (no React Query in this project). */
export const PROPERTY_DATA_INVALIDATION = "pg:property-data-invalidation";

export function invalidatePropertyWorkspace(propertyId?: number | string | null) {
  window.dispatchEvent(new CustomEvent(PROPERTY_DATA_INVALIDATION, { detail: { propertyId } }));
}
