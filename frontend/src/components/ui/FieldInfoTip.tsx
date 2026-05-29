import { AppIcon } from "../icons";

/** Hover/focus tooltip beside a field label — keeps forms aligned without inline help text. */
export function FieldInfoTip({ label, text }: { label: string; text?: string | null }) {
  const tip = text?.trim();
  if (!tip) return null;

  return (
    <span className="pg-field-info" tabIndex={0} role="note" aria-label={`${label}: ${tip}`}>
      <AppIcon name="info" size="xs" strokeWidth={2.25} className="pg-field-info__icon" />
      <span className="pg-field-info__tooltip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}
