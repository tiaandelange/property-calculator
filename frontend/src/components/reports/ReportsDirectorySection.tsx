import { useMemo } from "react";
import {
  REPORTS_HUB_CATEGORIES,
  reportsHubDirectoryItems,
  type ReportsHubCategoryId
} from "../../data/reportsHubDirectory";
import { filterReportsHubItems, normalizeReportsHubQuery } from "../../utils/reportsHubFilter";
import { IconContainerByName } from "../icons";
import { Container } from "../ui/Container";
import { MarketingSearchInput } from "../ui/MarketingSearchInput";
import { Button } from "../ui/Button";
import { ReportsDirectoryCard } from "./ReportsDirectoryCard";

type ReportsDirectorySectionProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeCategory: ReportsHubCategoryId;
  onCategoryChange: (category: ReportsHubCategoryId) => void;
  onResetFilters: () => void;
};

export function ReportsDirectorySection({
  searchQuery,
  onSearchQueryChange,
  activeCategory,
  onCategoryChange,
  onResetFilters
}: ReportsDirectorySectionProps) {
  const filteredItems = useMemo(
    () => filterReportsHubItems(reportsHubDirectoryItems, searchQuery, activeCategory),
    [searchQuery, activeCategory]
  );

  const isEmpty = filteredItems.length === 0;
  const hasActiveFilters =
    normalizeReportsHubQuery(searchQuery).length > 0 || activeCategory !== "all";

  return (
    <div className="pg-home-light-section pg-reports-hub-light">
      <Container className="pg-container pg-container--marketing-wide">
        <header className="pg-reports-hub-light-header">
          <h2 className="pg-h2 pg-reports-hub-light-title">All Report Types</h2>
          <p className="pg-lead pg-reports-hub-light-lead">
            From portfolio summaries to tenant statements — create the right PDF for every property decision.
          </p>
          <MarketingSearchInput
            id="reports-hub-search"
            variant="light-section"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search report types..."
            aria-label="Search report types"
            autoComplete="off"
          />
        </header>

        <div
          className="pg-calc-hub-filters pg-reports-hub-filters"
          role="tablist"
          aria-label="Filter report types by category"
        >
          {REPORTS_HUB_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.id}
              className="pg-calc-hub-filter-pill"
              data-active={activeCategory === cat.id ? "true" : "false"}
              onClick={() => onCategoryChange(cat.id)}
            >
              <IconContainerByName icon={cat.icon} accent="purple" size="sm" className="pg-calc-hub-filter-pill__icon" />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        <div className="pg-reports-hub-directory">
          {isEmpty ? (
            <div className="pg-reports-hub-empty-state" role="status">
              <h3 className="pg-reports-hub-empty-state__title">No report types found</h3>
              <p className="pg-reports-hub-empty-state__text">
                Try a different keyword or choose another category.
              </p>
              {hasActiveFilters ? (
                <Button type="button" variant="primary" onClick={onResetFilters}>
                  View all report types
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="pg-reports-hub-dir-grid">
              {filteredItems.map((item) => (
                <ReportsDirectoryCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
