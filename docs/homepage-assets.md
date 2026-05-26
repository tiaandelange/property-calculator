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

## UI icons (Lucide)

Calculator, feature, and trust-strip icons are **code-based** (`lucide-react` inside `IconContainer`). Slug → icon mapping lives in `frontend/src/icons/calculatorIcons.ts`, `featureIcons.ts`, and `trustIcons.ts`. No raster icon files under `public/assets/homepage/icons/`.

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
| `HomeCalculatorIcon` | Lucide icon in `IconContainer` via `CalculatorIconDisplay` (slug from `calculatorIcons.ts`). |
| `HomeFeatureIcon` | Lucide icon in `IconContainer` via `featureIcons.ts`. |
| `HomeTestimonialAvatar` | Tries WebP; on error → initials badge. |
