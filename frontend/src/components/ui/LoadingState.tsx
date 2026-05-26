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

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="pg-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}
