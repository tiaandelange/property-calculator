import { PROPERTY_TYPES } from "./calculatorPropertyTypes";

/** Display labels for homepage property-type cards (marketing copy). */
const MARKETING_LABELS: Partial<Record<string, string>> = {
  airbnb: "Airbnb / Short-Term Rental"
};

export const homepageCalculatorPropertyTypes = PROPERTY_TYPES.map((t) => ({
  id: t.propertyType,
  label: MARKETING_LABELS[t.propertyType] ?? t.label,
  description: t.description,
  icon: t.icon,
  category: t.calculatorCategory
}));

/** Static wizard preview — mirrors signed-in calculator UI; not interactive. */
export const homepageCalculatorsWizardPreview = {
  caption: "Signed-in workspace preview · illustrative UI (public tools live at /calculators)",
  activeStep: 1 as const,
  selectedTypeId: "duplex" as const,
  sampleQuestions: [
    { label: "Purchase price", value: "R 1,850,000" },
    { label: "Monthly rent — Unit 1", value: "R 7,200" },
    { label: "Monthly rent — Unit 2", value: "R 6,800" },
    { label: "Interest rate", value: "11.25% p.a." }
  ],
  previewMetrics: [
    { label: "Monthly cash flow", value: "R 8,420" },
    { label: "Gross yield", value: "9.1%" }
  ]
} as const;
