import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { propertyApiErrorMessage } from "../api/ownedProperties";
import { asArray } from "../lib/asArray";
import {
  isInitialQueryLoad,
  isQueryRefreshing,
  queryKeys,
  useFinancialsDirectoryQuery,
  useWorkspaceId
} from "../features/queries";
import { FinancialControlsBar } from "../features/financials/FinancialControlsBar";
import type { FinancialStatementRow } from "../features/financials/financialDirectoryTypes";
import { FinancialPagination } from "../features/financials/FinancialPagination";
import { FinancialStatementTable } from "../features/financials/FinancialStatementTable";
import { FinancialYtdSummary } from "../features/financials/FinancialYtdSummary";
import type { FinancialFilters } from "../features/financials/financialDirectoryTypes";
import { FINANCIALS_PAGE_SIZE, localCalendarMonth } from "../features/financials/financialDirectoryUtils";
import { AppListPage } from "../components/ui/AppPage";
import { Button, ButtonLink } from "../components/ui/Button";
import { AddPropertyButton } from "../features/subscription/AddPropertyButton";
import { QueryErrorCard, QueryRefreshingIndicator } from "../components/ui/QueryState";

function parsePropertyIdFromSearch(search: string): string {
  const raw = new URLSearchParams(search).get("propertyId");
  return raw?.trim() ? raw.trim() : "ALL";
}

export function FinancialsListPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { search } = useLocation();
  const [, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FinancialFilters>(() => ({
    q: "",
    propertyId: parsePropertyIdFromSearch(search),
    month: localCalendarMonth(),
    source: "ALL"
  }));

  const directoryParams = useMemo(
    () => ({
      month: filters.month,
      propertyId: filters.propertyId === "ALL" ? null : filters.propertyId,
      page,
      pageSize: FINANCIALS_PAGE_SIZE,
      q: filters.q,
      source: filters.source
    }),
    [filters.month, filters.propertyId, filters.q, filters.source, page]
  );

  const directoryQuery = useFinancialsDirectoryQuery(directoryParams);
  const pageItems = asArray<FinancialStatementRow>(directoryQuery.data?.items);
  const totalCount = directoryQuery.data?.totalCount ?? 0;
  const properties = asArray<{ id: string; name: string }>(directoryQuery.data?.properties);
  const ytd = directoryQuery.data?.ytd ?? {
    year: new Date().getFullYear(),
    revenue: 0,
    expenses: 0,
    net: 0,
    periodLabel: ""
  };
  const loading = isInitialQueryLoad(directoryQuery);
  const refreshing = isQueryRefreshing(directoryQuery);
  const error = directoryQuery.error ? propertyApiErrorMessage(directoryQuery.error) : "";

  useEffect(() => {
    const pid = parsePropertyIdFromSearch(search);
    if (pid !== filters.propertyId) {
      setFilters((prev) => ({ ...prev, propertyId: pid }));
    }
  }, [search, filters.propertyId]);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.month, filters.source, filters.propertyId]);

  const patchFilters = (next: Partial<FinancialFilters>) => {
    setFilters((prev) => {
      const merged = { ...prev, ...next };
      if (next.propertyId != null) {
        const params = new URLSearchParams();
        if (merged.propertyId !== "ALL") params.set("propertyId", merged.propertyId);
        setSearchParams(params, { replace: true });
      }
      return merged;
    });
  };

  const refreshDirectory = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.financialsDirectory(workspaceId, directoryParams)
      });
    }
  };

  const showRunningBalance = filters.propertyId !== "ALL";

  return (
    <AppListPage contentClassName="pg-fins">
      <Helmet>
        <title>Financials | The Property Guy</title>
      </Helmet>
          <div className="pg-fins-toolbar">
            <div>
              <p className="pg-muted" style={{ marginTop: 6, maxWidth: 560 }}>
                Portfolio income and expenses in the same statement layout as each property. Add, edit, or delete entries on
                the property&apos;s Financials tab.
              </p>
            </div>
            <div className="pg-fins-toolbar-actions pg-fins-desktop-only">
              <QueryRefreshingIndicator active={refreshing} />
              <Button onClick={refreshDirectory} loading={directoryQuery.isFetching && !loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? (
            <QueryErrorCard
              message={error}
              onRetry={() => void directoryQuery.refetch()}
              retrying={directoryQuery.isFetching}
            />
          ) : null}

          <FinancialControlsBar filters={filters} onChange={patchFilters} properties={properties} />

          <section className="pg-workspace-card pg-fins-statement-panel">
            <div className="pg-fins-panel-head">
              <h2 className="pg-fins-panel-title">Statement</h2>
              <span className="pg-muted" style={{ fontSize: 13 }}>
                {filters.month}
                {filters.propertyId !== "ALL"
                  ? ` · ${properties.find((p) => p.id === filters.propertyId)?.name ?? "Property"}`
                  : " · All properties"}
              </span>
            </div>

            <FinancialYtdSummary
              year={ytd.year}
              periodLabel={ytd.periodLabel}
              revenue={ytd.revenue}
              expenses={ytd.expenses}
              cashFlow={ytd.net}
            />

            {!loading && !error && totalCount === 0 ? (
              <div className="pg-fins-empty">
                <h2>No ledger entries</h2>
                <p>
                  {properties.length === 0
                    ? "Add properties and record income or expenses on a property workspace."
                    : "Try another month, property, or search term."}
                </p>
                {properties[0] ? (
                  <ButtonLink href={`/owned-properties/${properties[0].id}?tab=financials&fin=statement`} variant="primary">
                    Open property financials
                  </ButtonLink>
                ) : (
                  <AddPropertyButton variant="primary">Add property</AddPropertyButton>
                )}
              </div>
            ) : (
              <>
                <FinancialStatementTable items={pageItems} loading={loading} showRunningBalance={showRunningBalance} />
                <FinancialPagination page={page} totalItems={totalCount} onPageChange={setPage} />
              </>
            )}
          </section>
    </AppListPage>
  );
}
