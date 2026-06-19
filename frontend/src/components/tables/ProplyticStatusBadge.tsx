import { proplyticStatusLabel, proplyticStatusVariant } from "./tableStatusMap";

export function ProplyticStatusBadge({
  status,
  label,
  size = "sm"
}: {
  status: unknown;
  label?: string;
  size?: "sm" | "md";
}) {
  const variant = proplyticStatusVariant(status);
  const text = label ?? proplyticStatusLabel(status);
  return (
    <span
      className={`pg-ptable-badge pg-ptable-badge--${variant}${size === "sm" ? " pg-ptable-badge--sm" : ""}`}
    >
      {text}
    </span>
  );
}

export function ProplyticStatusBadgeGroup({ children }: { children: React.ReactNode }) {
  return <div className="pg-ptable-status-stack">{children}</div>;
}
