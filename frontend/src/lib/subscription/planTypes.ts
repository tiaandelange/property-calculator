import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import type { SubscriptionUsageCounts } from "../../services/subscriptionUsageSupabase";
import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";

/** Sellable plan codes from subscription_plans.code */
export const PLAN_CODES = {
  starter: "starter",
  investor: "investor",
  portfolio: "portfolio",
  portfolioPro: "portfolio_pro"
} as const;

export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];

export type FeatureKey =
  | "basicManagement"
  | "basicCalculators"
  | "fullAnalytics"
  | "irr"
  | "graphs"
  | "forecasting"
  | "portfolioDashboard"
  | "propertyComparison"
  | "advancedReports"
  | "unlimitedReports"
  | "applicationLinks"
  | "reportBranding"
  | "teamAccess"
  | "prioritySupport";

export type LimitKey =
  | "maxProperties"
  | "maxReportsPerMonth"
  | "maxApplicationLinks"
  | "maxUnits";

export type PlanLimits = Record<LimitKey, number | null>;

export type PlanFeatures = Record<FeatureKey, boolean>;

export type PlanPermissionsInput = {
  plans: SubscriptionPlanRecord[];
  subscription: UserSubscriptionRecord | null;
  usage: SubscriptionUsageCounts | null;
  freeUsesRemaining?: number | null;
  role?: string | null;
  /** When false, public marketing calculators are fully usable (IRR, charts, projections). */
  isAuthenticated?: boolean;
};

export const FEATURE_KEYS = [
  "basicManagement",
  "basicCalculators",
  "fullAnalytics",
  "irr",
  "graphs",
  "forecasting",
  "portfolioDashboard",
  "propertyComparison",
  "advancedReports",
  "unlimitedReports",
  "applicationLinks",
  "reportBranding",
  "teamAccess",
  "prioritySupport"
] as const satisfies readonly FeatureKey[];

export const LIMIT_KEYS = [
  "maxProperties",
  "maxReportsPerMonth",
  "maxApplicationLinks",
  "maxUnits"
] as const satisfies readonly LimitKey[];

export type PlanPermissionsSnapshot = {
  /** Effective plan used for feature gates and limits. */
  planCode: PlanCode | null;
  planName: string | null;
  isAdmin: boolean;
  isStarter: boolean;
  isInvestor: boolean;
  isPortfolio: boolean;
  isPro: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
  limitsActive: boolean;
  isLegacyProfile: boolean;
  /** Signed-out visitor on public calculator/marketing surfaces — no plan gates. */
  isPublicGuest: boolean;
  /** Paid plan chosen at signup; entitlements stay on Starter until payment confirms. */
  isPendingPayment: boolean;
  selectedPlanCode: PlanCode | null;
  selectedPlanName: string | null;
  selectedPlan: SubscriptionPlanRecord | null;
  subscriptionStatus: string | null;
  reportPeriodLabel: string;
  usage: {
    propertyCount: number;
    investmentReportCount: number;
    applicationLinksActive: number;
    unitCount: number;
  };
  /** Effective plan record (Starter when pending_payment). */
  currentPlan: SubscriptionPlanRecord | null;
};
