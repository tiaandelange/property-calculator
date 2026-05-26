import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getFinancialsDirectory, propertyApiErrorMessage } from "../api/ownedProperties";
import { PROPERTY_DATA_INVALIDATION } from "../features/properties/invalidate";
import { FinancialControlsBar } from "../features/financials/FinancialControlsBar";
import { FinancialMetricCards } from "../features/financials/FinancialMetricCards";
import { FinancialPagination } from "../features/financials/FinancialPagination";
import { FinancialStatementTable } from "../features/financials/FinancialStatementTable";
import { FinancialYtdSummary } from "../features/financials/FinancialYtdSummary";
import type { FinancialDirectoryMetrics, FinancialFilters, FinancialStatementRow } from "../features/financials/financialDirectoryTypes";
import {
  computeYtdTotals,
  localCalendarMonth,
  matchesFinancialFilters,
  paginate
} from "../features/financials/financialDirectoryUtils";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";

const EMPTY_METRICS: FinancialDirectoryMetrics = {
  receivedThisMonth: 0,
  expectedThisMonth: 0,
  expensesThisMonth: 0,
  bondThisMonth: 0,
  netCashFlow: 0,
  propertyCount: 0
};

function parsePropertyIdFromSearch(search: string): string {
  const raw = new URLSearchParams(search).get("propertyId");
  return raw?.trim() ? raw.trim() : "ALL";
}

export function FinancialsListPage() {
  const { search } = useLocation();
  const [, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<FinancialStatementRow[]>([]);
  const [metrics, setMetrics] = useState<FinancialDirectoryMetrics>(EMPTY_METRICS);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FinancialFilters>(() => ({
    q: "",
    propertyId: parsePropertyIdFromSearch(search),
    month: localCalendarMonth(),
    source: "ALL"
  }));

  const load = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const res = await getFinancialsDirectory({
        month: nextFilters.month,
        propertyId: nextFilters.propertyId === "ALL" ? null : nextFilters.propertyId
      });
      setItems(res.items);
      setMetrics(res.metrics);
      setProperties(res.properties);
    } catch (e: unknown) {
      console.error("[FinancialsList] load failed", e);
      setError(propertyApiErrorMessage(e));
      setItems([]);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [filters.month, filters.propertyId]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener(PROPERTY_DATA_INVALIDATION, handler);
    return () => window.removeEventListener(PROPERTY_DATA_INVALIDATION, handler);
  }, [load]);

  useEffect(() => {
    const pid = parsePropertyIdFromSearch(search);
    if (pid !== filters.propertyId) {
      setFilters((prev) => ({ ...prev, propertyId: pid }));
    }
  }, [search]);

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

  const filtered = useMemo(
    () => items.filter((row) => matchesFinancialFilters(row, filters)),
    [items, filters]
  );

  const ytd = useMemo(() => {
    const scope =
      filters.propertyId === "ALL" ? filtered : filtered.filter((r) => r.propertyId === filters.propertyId);
    return computeYtdTotals(scope);
  }, [filtered, filters.propertyId]);

  const { slice: pageItems, totalPages } = useMemo(() => paginate(filtered, page), [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const showRunningBalance = filters.propertyId !== "ALL";

  return (
    <Section>
      <Helmet>
        <title>Financials | The Property Guy</title>
      </Helmet>
      <Container className="pg-container--financials-dashboard">
        <div className="pg-fins pg-workspace-page">
          <div className="pg-fins-toolbar">
            <div>
              <h1 className="pg-h2 pg-fins-desktop-only" style={{ margin: 0 }}>
                Financials
              </h1>
              <p className="pg-muted" style={{ marginTop: 6, maxWidth: 560 }}>
                Portfolio income and expenses in the same statement layout as each property. Add, edit, or delete entries on
                the property&apos;s Financials tab.
              </p>
            </div>
            <div className="pg-fins-toolbar-actions pg-fins-desktop-only">
              <Button onClick={() => void load()} loading={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          <FinancialMetricCards metrics={metrics} loading={loading && !items.length} propertyId={filters.propertyId} />

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
              cashFlow={ytd.cashFlow}
            />

            {!loading && filtered.length === 0 ? (
              <div className="pg-fins-empty">
                <h2>No ledger entries</h2>
                <p>
                  {items.length === 0
                    ? "Add properties and record income or expenses on a property workspace."
                    : "Try another month, property, or search term."}
                </p>
                {properties[0] ? (
                  <Link className="pg-btn pg-btn-primary" to={`/owned-properties/${properties[0].id}?tab=financials&fin=statement`}>
                    Open property financials
                  </Link>
                ) : (
                  <Link className="pg-btn pg-btn-primary" to="/owned-properties/new">
                    Add property
                  </Link>
                )}
              </div>
            ) : (
              <>
                <FinancialStatementTable items={pageItems} loading={loading} showRunningBalance={showRunningBalance} />
                <FinancialPagination page={page} totalItems={filtered.length} onPageChange={setPage} />
              </>
            )}
          </section>
        </div>
      </Container>
    </Section>
  );
}
