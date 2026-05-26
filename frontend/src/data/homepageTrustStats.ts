/**
 * Homepage trust / stats strip — DISPLAY COPY ONLY.
 *
 * PLACEHOLDER: These figures are marketing placeholders. Replace with verified,
 * supportable product metrics (or remove claims) before production if they are not
 * accurate — e.g. wire to analytics, billing, or app-store ratings as appropriate.
 */

import type { HomepageTrustStatIcon } from "../icons/trustIcons";

export type { HomepageTrustStatIcon };

export type HomepageTrustStat = {
  id: string;
  value: string;
  hint: string;
  icon: HomepageTrustStatIcon;
};

export const homepageTrustStats: readonly HomepageTrustStat[] = [
  { id: "calculations-run", value: "25,000+", hint: "Calculations run", icon: "activity" },
  { id: "powerful-calculators", value: "12+", hint: "Powerful calculators", icon: "tools" },
  { id: "ux-rating", value: "4.9/5", hint: "User experience rating", icon: "star" },
  { id: "free-tools", value: "100%", hint: "Free tools to start", icon: "percent" },
  { id: "private-secure", value: "Private & Secure", hint: "Your data stays safe", icon: "shield" }
] as const;
