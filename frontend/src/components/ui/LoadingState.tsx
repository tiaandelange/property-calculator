import type React from "react";
import { Spinner } from "./Spinner";

export function LoadingState({
  label = "Loading…",
  large
}: {
  label?: string;
  large?: boolean;
}) {
  return (
    <div className="pg-loading-block" role="status" aria-live="polite">
      <Spinner large={large} />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonGrid({ count = 3, columns }: { count?: number; columns?: 2 | 3 | 4 }) {
  const colClass = columns ? `pg-skeleton-grid--cols-${columns}` : "";
  return (
    <div className={["pg-skeleton-grid", colClass].filter(Boolean).join(" ")} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pg-skeleton-block" />
      ))}
    </div>
  );
}
