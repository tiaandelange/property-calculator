import {
  REPORTS_HUB_CATEGORIES,
  type ReportsHubCategoryId,
  type ReportsHubDirectoryItem
} from "../data/reportsHubDirectory";

export function normalizeReportsHubQuery(query: string): string {
  return query.trim().toLowerCase();
}

function categoryLabelForId(categoryId: string): string {
  return REPORTS_HUB_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}

function itemSearchText(item: ReportsHubDirectoryItem): string {
  const categoryLabels = item.categories.map((id) => categoryLabelForId(id)).join(" ");
  return `${item.title} ${item.description} ${item.descriptionMobile} ${item.usefulFor} ${categoryLabels}`.toLowerCase();
}

export function reportsHubItemMatchesCategory(
  item: ReportsHubDirectoryItem,
  activeCategory: ReportsHubCategoryId
): boolean {
  if (!activeCategory || activeCategory === "all") return true;
  return item.categories.includes(activeCategory);
}

export function reportsHubItemMatchesQuery(item: ReportsHubDirectoryItem, query: string): boolean {
  const q = normalizeReportsHubQuery(query);
  if (!q) return true;
  return itemSearchText(item).includes(q);
}

export function filterReportsHubItems(
  items: ReportsHubDirectoryItem[],
  query: string,
  activeCategory: ReportsHubCategoryId
): ReportsHubDirectoryItem[] {
  return items.filter(
    (item) => reportsHubItemMatchesCategory(item, activeCategory) && reportsHubItemMatchesQuery(item, query)
  );
}
