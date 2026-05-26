export type OccupancyBadgeVariant = "occupied" | "vacant" | "issue";

export function OccupancyBadge({ variant, label }: { variant: OccupancyBadgeVariant; label?: string }) {
  const text =
    label ??
    (variant === "occupied" ? "Occupied" : variant === "vacant" ? "Vacant" : "Needs attention");
  return <span className={`pg-pdash-occupancy pg-pdash-occupancy--${variant}`}>{text}</span>;
}
