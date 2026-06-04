import {
  CALCULATOR_HUB_CATEGORIES,
  type CalculatorHubCategoryId,
  type CalculatorHubDirectoryGroup,
  type CalculatorHubDirectoryItem
} from "../data/calculatorHubDirectory";

export function normalizeCalculatorHubQuery(query: string): string {
  return query.trim().toLowerCase();
}

function categoryLabelForId(categoryId: string): string {
  return CALCULATOR_HUB_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}

function itemSearchText(
  item: CalculatorHubDirectoryItem,
  groupTitle: string,
  categoryId: string
): string {
  const categoryLabel = categoryLabelForId(categoryId);
  return `${item.name} ${item.description} ${groupTitle} ${categoryLabel}`.toLowerCase();
}

export function calculatorHubItemMatchesQuery(
  item: CalculatorHubDirectoryItem,
  groupTitle: string,
  categoryId: string,
  query: string
): boolean {
  const q = normalizeCalculatorHubQuery(query);
  if (!q) return true;
  return itemSearchText(item, groupTitle, categoryId).includes(q);
}

export function filterCalculatorDirectoryGroups(
  groups: CalculatorHubDirectoryGroup[],
  query: string
): CalculatorHubDirectoryGroup[] {
  const q = normalizeCalculatorHubQuery(query);
  if (!q) {
    return groups;
  }
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        calculatorHubItemMatchesQuery(item, group.title, group.categoryId, query)
      )
    }))
    .filter((group) => group.items.length > 0);
}

export function calculatorHubGroupMatchesCategory(
  categoryId: string,
  activeCategory: CalculatorHubCategoryId | string
): boolean {
  if (!activeCategory || activeCategory === "all") return true;
  return categoryId === activeCategory;
}
