/** Static marketing copy for /pricing (plan limits still come from subscription_plans). */

export const pricingHero = {
  title: "Choose the plan that fits your property portfolio.",
  lead: "Start with property analytics, calculators, invoices, statements and investor-ready reports — then scale as your portfolio grows.",
  trustLine: "Built for owner-managers and small portfolio investors.",
  paymentNote:
    "Online card payments are not live yet. Choose a plan to sign up — billing will be connected later."
} as const;

export const pricingValueChips = [
  { id: "properties", label: "Properties", detail: "How many properties you can track" },
  { id: "reports", label: "Reports", detail: "Monthly investment PDF allowance" },
  { id: "analytics", label: "Analytics depth", detail: "Portfolio metrics and projections" }
] as const;

export const pricingValueStripLead = "Plans are based on portfolio size and report usage.";

export const pricingRecommendations = [
  {
    plan: "Starter",
    body: "You want to test Proplytic with a small portfolio."
  },
  {
    plan: "Investor",
    body: "You own or manage a small portfolio and want reports, calculators, invoices and statements."
  },
  {
    plan: "Portfolio",
    body: "You manage a growing portfolio and need unlimited reporting."
  },
  {
    plan: "Portfolio Pro",
    body: "You have a larger portfolio and want priority support and advanced reporting depth."
  }
] as const;

export const pricingFaq = [
  {
    q: "Is Proplytic for estate agents or property owners?",
    a: "Proplytic is primarily built for owner-managers and small portfolio investors. It includes management tools, but the core value is analytics and investor reporting."
  },
  {
    q: "Can I start without paying?",
    a: "Yes. The Starter plan includes a 14-day free trial, then continues at R99/month unless you change plans. Online billing is not connected yet — sign up to get started."
  },
  {
    q: "Does Proplytic collect rent or process payments?",
    a: "Payment processing is not included yet. Proplytic currently focuses on property analytics, invoices, statements, reports and owner-management workflows."
  },
  {
    q: "What counts as a property?",
    a: "Each property record in your portfolio counts toward your plan limit — including multi-unit buildings as one property unless you split them in your workspace."
  },
  {
    q: "What happens when I reach my property or report limit?",
    a: "You will be prompted to upgrade before adding more properties or generating more investment reports."
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Plan changes are available from your subscription settings. Payment processing will be connected later."
  },
  {
    q: "Are reports included?",
    a: "Yes. Investment reports are included according to the limits of each plan."
  }
] as const;

export const pricingFinalCta = {
  title: "Start analysing your portfolio with better numbers.",
  lead: "Try Proplytic free, then choose the plan that fits your portfolio.",
  primary: { label: "Start free trial", href: "/signup?plan=starter" },
  secondary: { label: "Compare plans", href: "#pricing-compare" }
} as const;

/** Display-only post-trial price when Starter is stored as free in plan config. */
export const STARTER_POST_TRIAL_PRICE_LABEL = "R99/month";
