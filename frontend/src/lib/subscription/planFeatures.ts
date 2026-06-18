import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import type { SubscriptionUsageCounts } from "../../services/subscriptionUsageSupabase";
import {
  FEATURE_KEYS,
  LIMIT_KEYS,
  type FeatureKey,
  type LimitKey,
  type PlanCode,
  PLAN_CODES,
  type PlanFeatures,
  type PlanLimits,
  type PlanPermissionsInput,
  type PlanPermissionsSnapshot
} from "./planTypes";

export { FEATURE_KEYS, LIMIT_KEYS };

export const PLAN_LIMIT_UPGRADE_MESSAGE =
  "You have reached the limit for your current plan. Upgrade to continue.";

export const DEFAULT_UPGRADE_MESSAGE =
  "Upgrade your plan to unlock this feature.";

export const PENDING_PAYMENT_BANNER_MESSAGE =
  "Complete payment to unlock your selected plan.";

const FEATURE_UPGRADE_MESSAGES: Record<FeatureKey, string> = {
  basicManagement: "Rental management is not included on your current plan.",
  basicCalculators: "Investment calculators are not included on your current plan.",
  fullAnalytics: "Full portfolio analytics requires an Investor plan or higher.",
  irr: "IRR analysis requires an Investor plan or higher.",
  graphs: "Charts and graphs require an Investor plan or higher.",
  forecasting: "Forecasting requires an Investor plan or higher.",
  portfolioDashboard: "Unlock portfolio analytics with Investor.",
  propertyComparison: "Property comparison requires an Investor plan or higher.",
  advancedReports: "Advanced reports require a Portfolio plan or higher.",
  unlimitedReports: "Unlimited reports require a Portfolio plan or higher.",
  applicationLinks: "Applicant links require an Investor plan or higher.",
  reportBranding: "Report branding requires Portfolio Pro.",
  teamAccess: "Team access requires Portfolio Pro.",
  prioritySupport: "Priority support requires a Portfolio plan or higher."
};

const LIMIT_UPGRADE_MESSAGES: Record<LimitKey, string> = {
  maxProperties: "You have reached the property limit for your plan.",
  maxReportsPerMonth: "You have reached the monthly investment report limit for your plan.",
  maxApplicationLinks: "You have reached the applicant link limit for your plan.",
  maxUnits: "You have reached the unit limit for your plan."
};

function emptyFeatures(): PlanFeatures {
  return FEATURE_KEYS.reduce(
    (acc, key) => {
      acc[key] = false;
      return acc;
    },
    {} as PlanFeatures
  );
}

function emptyLimits(): PlanLimits {
  return LIMIT_KEYS.reduce(
    (acc, key) => {
      acc[key] = null;
      return acc;
    },
    {} as PlanLimits
  );
}

function unlimitedFeatures(): PlanFeatures {
  return FEATURE_KEYS.reduce(
    (acc, key) => {
      acc[key] = true;
      return acc;
    },
    {} as PlanFeatures
  );
}

function unlimitedLimits(): PlanLimits {
  return emptyLimits();
}

function hasSubscriptionRow(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "pending_payment";
}

function emptyEntitlementMeta() {
  return {
    isPendingPayment: false,
    selectedPlanCode: null as PlanCode | null,
    selectedPlanName: null as string | null,
    selectedPlan: null as SubscriptionPlanRecord | null,
    subscriptionStatus: null as string | null
  };
}

/** Public /calculators/* tools — free while signed out; gated by plan after sign-in. */
const PUBLIC_CALCULATOR_FEATURE_KEYS: FeatureKey[] = [
  "basicCalculators",
  "irr",
  "graphs",
  "forecasting"
];

function publicGuestCalculatorFeatures(): PlanFeatures {
  const features = emptyFeatures();
  for (const key of PUBLIC_CALCULATOR_FEATURE_KEYS) {
    features[key] = true;
  }
  return features;
}

function publicGuestPermissionsSnapshot(
  usage: SubscriptionUsageCounts | null
): PlanPermissionsSnapshot {
  const usageSnapshot = {
    propertyCount: usage?.propertyCount ?? 0,
    investmentReportCount: usage?.investmentReportCount ?? 0,
    applicationLinksActive: 0,
    unitCount: 0
  };

  return {
    planCode: null,
    planName: null,
    isAdmin: false,
    isStarter: false,
    isInvestor: false,
    isPortfolio: false,
    isPro: false,
    limits: emptyLimits(),
    features: publicGuestCalculatorFeatures(),
    limitsActive: false,
    isLegacyProfile: false,
    isPublicGuest: true,
    ...emptyEntitlementMeta(),
    reportPeriodLabel: usage?.period.label ?? "This period",
    usage: usageSnapshot,
    currentPlan: null
  };
}

function featuresFromPlan(plan: SubscriptionPlanRecord | null): PlanFeatures {
  if (!plan) return emptyFeatures();
  return {
    basicManagement: plan.hasBasicManagement,
    basicCalculators: plan.hasBasicCalculators,
    fullAnalytics: plan.hasFullAnalytics,
    irr: plan.hasIrr,
    graphs: plan.hasGraphs,
    forecasting: plan.hasForecasting,
    portfolioDashboard: plan.hasPortfolioDashboard,
    propertyComparison: plan.hasPropertyComparison,
    advancedReports: plan.hasAdvancedReports,
    unlimitedReports: plan.hasUnlimitedReports,
    applicationLinks: plan.hasApplicationLinks,
    reportBranding: plan.hasReportBranding,
    teamAccess: plan.hasTeamAccess,
    prioritySupport: plan.hasPrioritySupport
  };
}

function limitsFromPlan(plan: SubscriptionPlanRecord | null): PlanLimits {
  if (!plan) return emptyLimits();
  return {
    maxProperties: plan.maxProperties ?? plan.propertyLimit ?? null,
    maxReportsPerMonth:
      plan.hasUnlimitedReports || plan.includesUnlimitedReports
        ? null
        : (plan.maxReportsPerMonth ?? plan.reportLimit ?? null),
    maxApplicationLinks: plan.maxApplicationLinks ?? null,
    maxUnits: plan.maxUnits ?? null
  };
}

function normalizePlanCode(code: string | null | undefined): PlanCode | null {
  if (!code) return null;
  const values = Object.values(PLAN_CODES) as string[];
  return values.includes(code) ? (code as PlanCode) : null;
}

/** Single source of truth for plan limits, features, and usage context. */
export function computePlanPermissions(input: PlanPermissionsInput): PlanPermissionsSnapshot {
  const usage = input.usage ?? {
    propertyCount: 0,
    investmentReportCount: 0,
    period: { start: new Date(), end: new Date(), label: "This period" }
  };

  const usageSnapshot = {
    propertyCount: usage.propertyCount,
    investmentReportCount: usage.investmentReportCount,
    applicationLinksActive: 0,
    unitCount: 0
  };

  if (input.role === "ADMIN") {
    return {
      planCode: PLAN_CODES.portfolioPro,
      planName: "Admin",
      isAdmin: true,
      isStarter: false,
      isInvestor: false,
      isPortfolio: false,
      isPro: true,
      limits: unlimitedLimits(),
      features: unlimitedFeatures(),
      limitsActive: false,
      isLegacyProfile: false,
      isPublicGuest: false,
      ...emptyEntitlementMeta(),
      reportPeriodLabel: usage.period.label,
      usage: usageSnapshot,
      currentPlan: null
    };
  }

  if (input.isAuthenticated === false) {
    return publicGuestPermissionsSnapshot(input.usage);
  }

  if (!input.subscription || !hasSubscriptionRow(input.subscription.status)) {
    if (input.isAuthenticated !== false) {
      const starterPlan = input.plans.find((p) => p.code === PLAN_CODES.starter) ?? null;
      const effectiveCode = PLAN_CODES.starter;

      return {
        planCode: effectiveCode,
        planName: starterPlan?.name ?? "Free",
        isAdmin: false,
        isStarter: true,
        isInvestor: false,
        isPortfolio: false,
        isPro: false,
        limits: limitsFromPlan(starterPlan),
        features: featuresFromPlan(starterPlan),
        limitsActive: true,
        isLegacyProfile: false,
        isPublicGuest: false,
        ...emptyEntitlementMeta(),
        reportPeriodLabel: usage.period.label,
        usage: usageSnapshot,
        currentPlan: starterPlan
      };
    }

    const legacyReportCap =
      input.freeUsesRemaining != null && Number.isFinite(input.freeUsesRemaining)
        ? Math.max(0, input.freeUsesRemaining)
        : null;

    const legacyLimits = emptyLimits();
    if (legacyReportCap != null) {
      legacyLimits.maxReportsPerMonth = legacyReportCap;
    }

    const legacyFeatures = emptyFeatures();
    legacyFeatures.basicManagement = true;
    legacyFeatures.basicCalculators = true;

    return {
      planCode: null,
      planName: null,
      isAdmin: false,
      isStarter: false,
      isInvestor: false,
      isPortfolio: false,
      isPro: false,
      limits: legacyLimits,
      features: legacyFeatures,
      limitsActive: legacyReportCap != null,
      isLegacyProfile: true,
      isPublicGuest: false,
      ...emptyEntitlementMeta(),
      reportPeriodLabel:
        legacyReportCap != null ? "Free calculator reports remaining" : usage.period.label,
      usage: usageSnapshot,
      currentPlan: null
    };
  }

  const selectedPlan =
    input.plans.find((p) => p.code === input.subscription!.planCode) ?? null;
  const selectedPlanCode = normalizePlanCode(input.subscription.planCode);
  const subscriptionStatus = input.subscription.status;

  if (subscriptionStatus === "pending_payment") {
    const starterPlan = input.plans.find((p) => p.code === PLAN_CODES.starter) ?? null;
    const effectiveCode = PLAN_CODES.starter;

    return {
      planCode: effectiveCode,
      planName: starterPlan?.name ?? "Starter",
      isAdmin: false,
      isStarter: true,
      isInvestor: false,
      isPortfolio: false,
      isPro: false,
      limits: limitsFromPlan(starterPlan),
      features: featuresFromPlan(starterPlan),
      limitsActive: true,
      isLegacyProfile: false,
      isPublicGuest: false,
      isPendingPayment: true,
      selectedPlanCode,
      selectedPlanName: selectedPlan?.name ?? input.subscription.planCode,
      selectedPlan,
      subscriptionStatus,
      reportPeriodLabel: usage.period.label,
      usage: usageSnapshot,
      currentPlan: starterPlan
    };
  }

  const plan = selectedPlan;
  const planCode = selectedPlanCode;

  return {
    planCode,
    planName: plan?.name ?? input.subscription.planCode,
    isAdmin: false,
    isStarter: planCode === PLAN_CODES.starter,
    isInvestor: planCode === PLAN_CODES.investor,
    isPortfolio: planCode === PLAN_CODES.portfolio,
    isPro: planCode === PLAN_CODES.portfolioPro,
    limits: limitsFromPlan(plan),
    features: featuresFromPlan(plan),
    limitsActive: true,
    isLegacyProfile: false,
    isPublicGuest: false,
    isPendingPayment: false,
    selectedPlanCode: planCode,
    selectedPlanName: plan?.name ?? input.subscription.planCode,
    selectedPlan: plan,
    subscriptionStatus,
    reportPeriodLabel: usage.period.label,
    usage: usageSnapshot,
    currentPlan: plan
  };
}

export function getLimitFromSnapshot(
  snapshot: PlanPermissionsSnapshot,
  limitKey: LimitKey
): number | null {
  if (snapshot.isAdmin) return null;
  return snapshot.limits[limitKey];
}

export function hasReachedLimitFromSnapshot(
  snapshot: PlanPermissionsSnapshot,
  limitKey: LimitKey,
  currentUsage: number
): boolean {
  if (snapshot.isAdmin) return false;
  if (!snapshot.limitsActive) return false;

  if (limitKey === "maxReportsPerMonth" && snapshot.features.unlimitedReports) {
    return false;
  }

  const cap = snapshot.limits[limitKey];
  if (cap == null) return false;
  return currentUsage >= cap;
}

export function canUseFeatureFromSnapshot(
  snapshot: PlanPermissionsSnapshot,
  featureKey: FeatureKey
): boolean {
  if (snapshot.isAdmin) return true;
  if (snapshot.isLegacyProfile) {
    return snapshot.features[featureKey] ?? false;
  }
  return snapshot.features[featureKey] ?? false;
}

export function upgradeMessageForFeature(featureKey: FeatureKey): string {
  return FEATURE_UPGRADE_MESSAGES[featureKey] ?? DEFAULT_UPGRADE_MESSAGE;
}

export function upgradeMessageForLimit(limitKey: LimitKey): string {
  return LIMIT_UPGRADE_MESSAGES[limitKey] ?? PLAN_LIMIT_UPGRADE_MESSAGE;
}

export function upgradeMessageFor(
  snapshot: PlanPermissionsSnapshot,
  featureKey?: FeatureKey,
  limitKey?: LimitKey
): string {
  if (snapshot.isAdmin) return "";
  if (snapshot.isPendingPayment) {
    const planLabel = snapshot.selectedPlanName ?? "your selected plan";
    if (limitKey) {
      return `${PENDING_PAYMENT_BANNER_MESSAGE} You currently have Starter access until ${planLabel} is paid.`;
    }
    if (featureKey) {
      return `${PENDING_PAYMENT_BANNER_MESSAGE} This feature unlocks on ${planLabel} after payment.`;
    }
    return `${PENDING_PAYMENT_BANNER_MESSAGE} (${planLabel})`;
  }
  if (limitKey) return upgradeMessageForLimit(limitKey);
  if (featureKey) return upgradeMessageForFeature(featureKey);
  return snapshot.planName
    ? `${DEFAULT_UPGRADE_MESSAGE} (current plan: ${snapshot.planName})`
    : DEFAULT_UPGRADE_MESSAGE;
}

export class PlanPermissionError extends Error {
  readonly featureKey?: FeatureKey;
  readonly limitKey?: LimitKey;

  constructor(message: string, opts?: { featureKey?: FeatureKey; limitKey?: LimitKey }) {
    super(message);
    this.name = "PlanPermissionError";
    this.featureKey = opts?.featureKey;
    this.limitKey = opts?.limitKey;
  }
}

export function requireFeatureFromSnapshot(
  snapshot: PlanPermissionsSnapshot,
  featureKey: FeatureKey
): void {
  if (canUseFeatureFromSnapshot(snapshot, featureKey)) return;
  throw new PlanPermissionError(upgradeMessageForFeature(featureKey), { featureKey });
}

export function defaultUsageForLimit(
  snapshot: PlanPermissionsSnapshot,
  limitKey: LimitKey
): number {
  switch (limitKey) {
    case "maxProperties":
      return snapshot.usage.propertyCount;
    case "maxReportsPerMonth":
      return snapshot.usage.investmentReportCount;
    case "maxApplicationLinks":
      return snapshot.usage.applicationLinksActive;
    case "maxUnits":
      return snapshot.usage.unitCount;
    default:
      return 0;
  }
}

export type ComputedSubscriptionLimits = ReturnType<typeof computeSubscriptionLimitsImpl>;

/** @deprecated Use computePlanPermissions — kept for existing limit helpers/tests. */
function computeSubscriptionLimitsImpl(input: PlanPermissionsInput) {
  const snapshot = computePlanPermissions(input);
  const propertyLimit = snapshot.limits.maxProperties;
  const reportLimit = snapshot.limits.maxReportsPerMonth;

  return {
    currentPlan: snapshot.currentPlan,
    planName: snapshot.planName,
    propertyLimit,
    reportLimit,
    currentPropertyCount: snapshot.usage.propertyCount,
    currentReportCount: snapshot.usage.investmentReportCount,
    canCreateProperty: !hasReachedLimitFromSnapshot(
      snapshot,
      "maxProperties",
      snapshot.usage.propertyCount
    ),
    canGenerateReport: !hasReachedLimitFromSnapshot(
      snapshot,
      "maxReportsPerMonth",
      snapshot.usage.investmentReportCount
    ),
    upgradeMessage:
      hasReachedLimitFromSnapshot(snapshot, "maxProperties", snapshot.usage.propertyCount) ||
      hasReachedLimitFromSnapshot(
        snapshot,
        "maxReportsPerMonth",
        snapshot.usage.investmentReportCount
      )
        ? PLAN_LIMIT_UPGRADE_MESSAGE
        : null,
    isLegacyProfile: snapshot.isLegacyProfile,
    limitsActive: snapshot.limitsActive,
    reportPeriodLabel: snapshot.reportPeriodLabel
  };
}

export function computeSubscriptionLimits(
  input: PlanPermissionsInput
): ComputedSubscriptionLimits {
  return computeSubscriptionLimitsImpl(input);
}

export function formatPropertyLimitUsage(current: number, limit: number | null): string {
  if (limit == null) return `${current} properties · unlimited plan`;
  return `${current} / ${limit} properties`;
}

export function formatReportLimitUsage(
  current: number,
  limit: number | null,
  periodLabel: string
): string {
  if (limit == null) return `${current} reports (${periodLabel}) · unlimited`;
  return `${current} / ${limit} reports per month (${periodLabel})`;
}
