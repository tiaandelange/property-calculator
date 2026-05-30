import { AppListPage } from "./AppPage";
import { ListPageBodySkeleton, PageHeaderSkeleton } from "./PageSkeletons";

/** Shown while lazy route chunks load — app shell stays visible; page body shows skeleton. */
export function RouteFallback() {
  return (
    <AppListPage contentClassName="pg-route-fallback">
      <PageHeaderSkeleton />
      <ListPageBodySkeleton metrics={4} tableRows={6} />
    </AppListPage>
  );
}
