import type { HomepageFeatureIconKey } from "../icons/featureIcons";

/** Homepage “Why us” feature tiles — copy and icon keys only. */
export type HomepageFeatureBenefit = {
  id: string;
  title: string;
  body: string;
  iconKey: HomepageFeatureIconKey;
};

export const homepageFeatureBenefits: readonly HomepageFeatureBenefit[] = [
  {
    id: "accurate-inputs",
    title: "Accurate inputs",
    body: "Use clear assumptions and editable values so every result can be checked properly.",
    iconKey: "accurate"
  },
  {
    id: "fast-comparisons",
    title: "Fast comparisons",
    body: "Compare buying, renting, repayments and investment scenarios without starting from scratch.",
    iconKey: "fast"
  },
  {
    id: "useful-outputs",
    title: "Useful outputs",
    body: "See the headline answer first, then open the deeper breakdown when you need it.",
    iconKey: "scenarios"
  },
  {
    id: "built-to-scale",
    title: "Built to scale",
    body: "A consistent calculator system that can grow with more tools, properties and users.",
    iconKey: "secure"
  }
] as const;
