import { useMemo } from "react";
import {
  CALCULATOR_HUB_CATEGORIES,
  calculatorHubDirectoryGroups,
  calculatorHubPopularGroup,
  type CalculatorHubCategoryId
} from "../../data/calculatorHubDirectory";
import {
  calculatorHubGroupMatchesCategory,
  filterCalculatorDirectoryGroups,
  normalizeCalculatorHubQuery
} from "../../utils/calculatorHubFilter";
import { IconContainerByName } from "../icons";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { CalculatorHubDirectoryCard } from "./CalculatorHubDirectoryCard";

type CalculatorHubDirectorySectionProps = {
  searchQuery: string;
  activeCategory: CalculatorHubCategoryId;
  onCategoryChange: (category: CalculatorHubCategoryId) => void;
  onResetFilters: () => void;
};

export function CalculatorHubDirectorySection({
  searchQuery,
  activeCategory,
  onCategoryChange,
  onResetFilters
}: CalculatorHubDirectorySectionProps) {
  const filteredGroups = useMemo(() => {
    const baseGroups =
      activeCategory === "popular"
        ? [calculatorHubPopularGroup()]
        : calculatorHubDirectoryGroups.filter((group) =>
            calculatorHubGroupMatchesCategory(group.categoryId, activeCategory)
          );
    return filterCalculatorDirectoryGroups(baseGroups, searchQuery);
  }, [searchQuery, activeCategory]);

  const isEmpty = filteredGroups.length === 0;
  const hasActiveFilters =
    normalizeCalculatorHubQuery(searchQuery).length > 0 || activeCategory !== "all";

  return (
    <div className="pg-home-light-section pg-calc-hub-light">
      <Container className="pg-container pg-container--marketing-wide">
        <header className="pg-calc-hub-light-header">
          <h2 className="pg-h2 pg-calc-hub-light-title">All Calculators</h2>
          <p className="pg-lead pg-calc-hub-light-lead">
            From purchase analysis to cash flow and ROI — everything you need in one place.
          </p>
        </header>

        <div
          className="pg-calc-hub-filters"
          role="tablist"
          aria-label="Filter calculators by category"
        >
          {CALCULATOR_HUB_CATEGORIES.map((cat) => (
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

        <div id="all-calculators" className="pg-calc-hub-directory">
          {isEmpty ? (
            <div className="pg-calc-hub-empty-state" role="status">
              <h3 className="pg-calc-hub-empty-state__title">No calculators found</h3>
              <p className="pg-calc-hub-empty-state__text">
                Try a different keyword or choose another category.
              </p>
              {hasActiveFilters ? (
                <Button type="button" variant="primary" onClick={onResetFilters}>
                  View all calculators
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="pg-calc-hub-groups">
              {filteredGroups.map((group) => (
                <section key={group.categoryId} className="pg-calc-hub-group" aria-labelledby={`calc-hub-${group.categoryId}`}>
                  <h3 id={`calc-hub-${group.categoryId}`} className="pg-calc-hub-group-title">
                    {group.title}
                  </h3>
                  <div className="pg-calc-hub-dir-grid">
                    {group.items.map((item) => (
                      <CalculatorHubDirectoryCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
