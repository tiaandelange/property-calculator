/** Base URL for static homepage WebP assets (Vite public/). Content images only — UI icons use Lucide. */
export const HOMEPAGE_ASSET_BASE = "/assets/homepage";

export const homepageHero = {
  property: `${HOMEPAGE_ASSET_BASE}/hero/hero-property.webp`,
  calculatorPreview: `${HOMEPAGE_ASSET_BASE}/hero/hero-calculator-preview.webp`
} as const;

export const homepageTestimonialAvatars = [
  `${HOMEPAGE_ASSET_BASE}/testimonials/testimonial-avatar-01.webp`,
  `${HOMEPAGE_ASSET_BASE}/testimonials/testimonial-avatar-02.webp`,
  `${HOMEPAGE_ASSET_BASE}/testimonials/testimonial-avatar-03.webp`
] as const;
