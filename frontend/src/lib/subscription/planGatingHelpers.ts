import type { FeatureKey, PlanPermissionsSnapshot } from "./planTypes";
import {
  canUseFeatureFromSnapshot,
  getLimitFromSnapshot,
  hasReachedLimitFromSnapshot
} from "./planFeatures";

/** Calculators that require Investor+ (whole-tool gate). */
export function getCalculatorPlanGateFeature(slug: string): FeatureKey | null {
  if (slug === "irr") return "irr";
  if (slug === "dcf" || slug === "grm") return "forecasting";
  return null;
}

/**
 * Applicant invite links: Investor+ when `has_application_links`, otherwise allow up to
 * `max_application_links` when the plan sets a non-zero cap (e.g. Starter = 1).
 */
export function canCreateApplicationLinkFromSnapshot(snapshot: PlanPermissionsSnapshot): boolean {
  if (snapshot.isAdmin) return true;
  if (!snapshot.limitsActive) return false;

  if (canUseFeatureFromSnapshot(snapshot, "applicationLinks")) {
    const cap = getLimitFromSnapshot(snapshot, "maxApplicationLinks");
    if (cap == null) return true;
    return !hasReachedLimitFromSnapshot(
      snapshot,
      "maxApplicationLinks",
      snapshot.usage.applicationLinksActive
    );
  }

  const cap = getLimitFromSnapshot(snapshot, "maxApplicationLinks");
  if (cap == null || cap <= 0) return false;
  return !hasReachedLimitFromSnapshot(
    snapshot,
    "maxApplicationLinks",
    snapshot.usage.applicationLinksActive
  );
}
