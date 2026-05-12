/** Base URL for static homepage WebP assets (Vite public/). */
export const HOMEPAGE_ASSET_BASE = "/assets/homepage";

export const homepageBrand = {
  wordmark: `${HOMEPAGE_ASSET_BASE}/brand/brand-wordmark.webp`
} as const;

export const homepageHero = {
  property: `${HOMEPAGE_ASSET_BASE}/hero/hero-property.webp`,
  calculatorPreview: `${HOMEPAGE_ASSET_BASE}/hero/hero-calculator-preview.webp`
} as const;

export const homepageCalculatorIcons = {
  mortgage: `${HOMEPAGE_ASSET_BASE}/icons/calculators/icon-calculator-mortgage.webp`,
  affordability: `${HOMEPAGE_ASSET_BASE}/icons/calculators/icon-calculator-affordability.webp`,
  rentalYield: `${HOMEPAGE_ASSET_BASE}/icons/calculators/icon-calculator-rental-yield.webp`,
  transferCost: `${HOMEPAGE_ASSET_BASE}/icons/calculators/icon-calculator-transfer-cost.webp`,
  bondRepayment: `${HOMEPAGE_ASSET_BASE}/icons/calculators/icon-calculator-bond-repayment.webp`,
  investmentReturn: `${HOMEPAGE_ASSET_BASE}/icons/calculators/icon-calculator-investment-return.webp`
} as const;

export type HomepageCalculatorIconKey = keyof typeof homepageCalculatorIcons;

/** Map calculator slug → which bundled calculator icon file to try first. */
export const calculatorSlugToIconKey: Record<string, HomepageCalculatorIconKey> = {
  "monthly-payment": "bondRepayment",
  "ltv": "mortgage",
  "transfer-bond-costs": "transferCost",
  "cash-flow": "affordability",
  "noi": "rentalYield",
  "cap-rate": "rentalYield",
  "rent-to-cost-ratio": "rentalYield",
  "cash-on-cash-return": "investmentReturn",
  "dscr": "affordability",
  "irr": "investmentReturn",
  "dcf": "investmentReturn",
  "brrrr": "investmentReturn",
  "short-term-rental": "rentalYield",
  "70-rule": "investmentReturn",
  "flip-profit": "investmentReturn",
  "square-footage": "mortgage"
};

export function getCalculatorIconKeyForSlug(slug: string): HomepageCalculatorIconKey {
  return calculatorSlugToIconKey[slug] ?? "mortgage";
}

export function getCalculatorIconSrcForSlug(slug: string): string {
  const key = getCalculatorIconKeyForSlug(slug);
  return homepageCalculatorIcons[key];
}

export const homepageFeatureIcons = {
  accurate: `${HOMEPAGE_ASSET_BASE}/icons/features/icon-feature-accurate.webp`,
  fast: `${HOMEPAGE_ASSET_BASE}/icons/features/icon-feature-fast.webp`,
  scenarios: `${HOMEPAGE_ASSET_BASE}/icons/features/icon-feature-scenarios.webp`,
  secure: `${HOMEPAGE_ASSET_BASE}/icons/features/icon-feature-secure.webp`
} as const;

export type HomepageFeatureIconKey = keyof typeof homepageFeatureIcons;

export const homepageTestimonialAvatars = [
  `${HOMEPAGE_ASSET_BASE}/testimonials/testimonial-avatar-01.webp`,
  `${HOMEPAGE_ASSET_BASE}/testimonials/testimonial-avatar-02.webp`,
  `${HOMEPAGE_ASSET_BASE}/testimonials/testimonial-avatar-03.webp`
] as const;
