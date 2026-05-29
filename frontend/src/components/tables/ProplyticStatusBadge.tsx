import { proplyticStatusLabel, proplyticStatusVariant } from "./tableStatusMap";

export function ProplyticStatusBadge({
  status,
  label
}: {
  status: unknown;
  label?: string;
}) {
  const variant = proplyticStatusVariant(status);
  const text = label ?? proplyticStatusLabel(status);
  return <span className={`pg-ptable-badge pg-ptable-badge--${variant}`}>{text}</span>;
}
