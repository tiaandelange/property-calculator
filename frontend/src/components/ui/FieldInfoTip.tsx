import { Info } from "lucide-react";

/** Hover/focus tooltip beside a field label — keeps forms aligned without inline help text. */
export function FieldInfoTip({ label, text }: { label: string; text?: string | null }) {
  const tip = text?.trim();
  if (!tip) return null;

  return (
    <span className="pg-field-info" tabIndex={0} role="note" aria-label={`${label}: ${tip}`}>
      <Info size={14} strokeWidth={2.25} className="pg-field-info__icon" aria-hidden />
      <span className="pg-field-info__tooltip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}
