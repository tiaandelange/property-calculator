import type { PropertyFormValues } from "./propertyFormConstants";

export type PropertyFormSectionId =
  | "basic"
  | "location"
  | "details"
  | "financial"
  | "media"
  | "description"
  | "owner";

export const PROPERTY_FORM_SECTIONS: { id: PropertyFormSectionId; label: string }[] = [
  { id: "basic", label: "Basic information" },
  { id: "location", label: "Location" },
  { id: "details", label: "Property details" },
  { id: "financial", label: "Financial details" },
  { id: "media", label: "Media uploaded" },
  { id: "description", label: "Description & amenities" },
  { id: "owner", label: "Owner info" }
];

function hasText(v: unknown): boolean {
  return String(v ?? "").trim().length > 0;
}

function hasNumber(v: unknown): boolean {
  if (v === "" || v == null) return false;
  return Number.isFinite(Number(v));
}

export function isPropertyFormSectionComplete(
  id: PropertyFormSectionId,
  form: PropertyFormValues,
  mediaCount: number
): boolean {
  switch (id) {
    case "basic":
      return hasText(form.name) && hasText(form.investmentType);
    case "location":
      return hasText(form.addressLine1) && hasText(form.city) && hasText(form.province);
    case "details":
      return (
        hasNumber(form.bedrooms) ||
        hasNumber(form.bathrooms) ||
        hasNumber(form.sizeSqm) ||
        hasText(form.erfNumber) ||
        hasNumber(form.parkingBays)
      );
    case "financial":
      return hasNumber(form.purchasePrice);
    case "media":
      return mediaCount > 0;
    case "description":
      return hasText(form.notes);
    case "owner":
      return true;
    default:
      return false;
  }
}

export function propertyFormProgress(mediaCount: number, form: PropertyFormValues) {
  const completed = PROPERTY_FORM_SECTIONS.filter((s) =>
    isPropertyFormSectionComplete(s.id, form, mediaCount)
  ).length;
  const total = PROPERTY_FORM_SECTIONS.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, pct };
}
