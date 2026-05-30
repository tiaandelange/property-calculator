import { AppListPage } from "./AppPage";
import { SkeletonGrid } from "./LoadingState";

/** Shown while lazy route chunks load — app shell stays visible; page body shows skeleton. */
export function RouteFallback() {
  return (
    <AppListPage contentClassName="pg-route-fallback">
      <SkeletonGrid count={4} columns={2} />
    </AppListPage>
  );
}
