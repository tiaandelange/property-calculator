# Homepage assets (`property-home-v1`)

All homepage raster assets are **WebP only**, under `frontend/public/assets/homepage/`. Paths are referenced from `frontend/src/data/homepageAssets.ts` and rendered through placeholder-aware components in `frontend/src/components/home/`.

If a file is missing or fails to load, the UI shows a **CSS gradient / SVG outline** fallback so the page still looks finished.

---

## Brand

| Filename | Folder | Purpose | Recommended size | Decorative / informative | Alt text |
| --- | --- | --- | --- | --- | --- |
| `brand-wordmark.webp` | `public/assets/homepage/brand/` | Logo / wordmark beside the hero eyebrow | **~440×72** (2× export ~880×144), transparent background | **Informative** (identifies the product) | **Required** meaningful `alt` (e.g. product name + “wordmark”) |

---

## Hero

| Filename | Folder | Purpose | Recommended size | Decorative / informative | Alt text |
| --- | --- | --- | --- | --- | --- |
| `hero-property.webp` | `public/assets/homepage/hero/` | Primary hero visual (property / lifestyle) | **~1600×1000** (crop 4:3 safe) | **Informative** if it conveys scene; otherwise treat as mood and mark decorative | **Required** if informative; empty `alt` only if purely decorative |
| `hero-calculator-preview.webp` | `public/assets/homepage/hero/` | Secondary inset (UI / dashboard preview) | **~800×600** | Often **decorative** when duplicated by text | Prefer **empty `alt`** when decorative |

---

## Calculator icons

Used in the hero launcher, search results, and “Popular calculators”. Filenames are fixed; calculator **slug → icon** mapping is in `homepageAssets.ts`.

| Filename | Folder | Purpose | Recommended size | Decorative / informative | Alt text |
| --- | --- | --- | --- | --- | --- |
| `icon-calculator-mortgage.webp` | `public/assets/homepage/icons/calculators/` | Loan / mortgage metaphor | **96×96** (display ~28–48px) | **Decorative** (label is in the card link) | **Empty** — card text carries meaning |
| `icon-calculator-affordability.webp` | `public/assets/homepage/icons/calculators/` | Affordability / cash-flow metaphor | **96×96** | **Decorative** | **Empty** |
| `icon-calculator-rental-yield.webp` | `public/assets/homepage/icons/calculators/` | Yield / NOI metaphor | **96×96** | **Decorative** | **Empty** |
| `icon-calculator-transfer-cost.webp` | `public/assets/homepage/icons/calculators/` | Transfer & bond costs metaphor | **96×96** | **Decorative** | **Empty** |
| `icon-calculator-bond-repayment.webp` | `public/assets/homepage/icons/calculators/` | Repayment / amortisation metaphor | **96×96** | **Decorative** | **Empty** |
| `icon-calculator-investment-return.webp` | `public/assets/homepage/icons/calculators/` | Returns / IRR metaphor | **96×96** | **Decorative** | **Empty** |

---

## Feature icons

| Filename | Folder | Purpose | Recommended size | Decorative / informative | Alt text |
| --- | --- | --- | --- | --- | --- |
| `icon-feature-accurate.webp` | `public/assets/homepage/icons/features/` | “Accurate” benefit | **96×96** | **Decorative** | **Empty** |
| `icon-feature-fast.webp` | `public/assets/homepage/icons/features/` | “Fast / easy” benefit | **96×96** | **Decorative** | **Empty** |
| `icon-feature-scenarios.webp` | `public/assets/homepage/icons/features/` | “Scenarios / save” benefit | **96×96** | **Decorative** | **Empty** |
| `icon-feature-secure.webp` | `public/assets/homepage/icons/features/` | “Secure / expert” benefit | **96×96** | **Decorative** | **Empty** |

---

## Testimonials

| Filename | Folder | Purpose | Recommended size | Decorative / informative | Alt text |
| --- | --- | --- | --- | --- | --- |
| `testimonial-avatar-01.webp` | `public/assets/homepage/testimonials/` | Avatar card 1 | **128×128** (round crop) | **Decorative** next to visible name | **Empty** — name + quote are visible |
| `testimonial-avatar-02.webp` | `public/assets/homepage/testimonials/` | Avatar card 2 | **128×128** | **Decorative** | **Empty** |
| `testimonial-avatar-03.webp` | `public/assets/homepage/testimonials/` | Avatar card 3 | **128×128** | **Decorative** | **Empty** |

If the image fails, a **gradient circle with initials** is shown with an accessible `aria-label` derived from the visible name.

---

## Components

| Component | Behaviour |
| --- | --- |
| `HomeHeroImage` | Tries WebP; on error → premium gradient placeholder (property vs calculator art). |
| `HomeBrandWordmark` | Tries WebP; on error → two-line shimmer block. |
| `HomeCalculatorIcon` | Tries WebP; on error → rounded outline calculator SVG. |
| `HomeFeatureIcon` | Tries WebP; on error → rounded outline clock SVG. |
| `HomeTestimonialAvatar` | Tries WebP; on error → initials badge. |
