import { ProplyticTableSkeleton } from "../tables";
import { SkeletonGrid } from "./LoadingState";

export function PageHeaderSkeleton({ lines = 2 }: { lines?: 1 | 2 }) {
  return (
    <div className="pg-page-header-skeleton" aria-hidden="true">
      <div className="pg-skeleton-line pg-skeleton-line--title" />
      {lines === 2 ? <div className="pg-skeleton-line pg-skeleton-line--subtitle" /> : null}
    </div>
  );
}

export function MetricCardSkeleton() {
  return <div className="pg-metric-card-skeleton" aria-hidden="true" />;
}

export function MetricCardsSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="pg-metric-cards-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailHeroSkeleton() {
  return (
    <div className="pg-detail-hero-skeleton pg-workspace-card" aria-hidden="true">
      <div className="pg-skeleton-line pg-skeleton-line--title" />
      <div className="pg-skeleton-line pg-skeleton-line--subtitle" />
      <div className="pg-skeleton-line pg-skeleton-line--short" />
    </div>
  );
}

export function WorkspaceTabsSkeleton() {
  return (
    <div className="pg-tabs-skeleton" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="pg-tabs-skeleton__tab" />
      ))}
    </div>
  );
}

export function MobileCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="pg-mobile-card-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pg-mobile-card-skeleton" />
      ))}
    </div>
  );
}

export function PropertyCardSkeleton() {
  return <div className="pg-property-card-skeleton" aria-hidden="true" />;
}

export function PropertyCardsSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="pg-property-cards-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TabPanelSkeleton({ variant = "default" }: { variant?: "default" | "overview" | "table" }) {
  if (variant === "table") {
    return <ProplyticTableSkeleton rows={6} />;
  }
  if (variant === "overview") {
    return (
      <div className="pg-tab-panel-skeleton">
        <MetricCardsSkeletonRow count={4} />
        <SkeletonGrid count={2} columns={2} />
      </div>
    );
  }
  return (
    <div className="pg-tab-panel-skeleton">
      <SkeletonGrid count={3} columns={3} />
      <ProplyticTableSkeleton rows={4} />
    </div>
  );
}

/** Standard list-page body skeleton: optional metrics + table. */
export function ListPageBodySkeleton({ metrics = 4, tableRows = 6 }: { metrics?: number; tableRows?: number }) {
  return (
    <div className="pg-list-page-skeleton">
      {metrics > 0 ? <MetricCardsSkeletonRow count={metrics} /> : null}
      <div className="pg-skeleton-block pg-skeleton-block--toolbar" />
      <ProplyticTableSkeleton rows={tableRows} />
    </div>
  );
}
