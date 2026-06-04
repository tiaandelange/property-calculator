import type { HomepageMarketingStat } from "../../../data/homepageMarketingContent";

export function formatHomepageMarketingStat(
  value: number,
  stat: Pick<HomepageMarketingStat, "format" | "prefix" | "suffix">
): string {
  const rounded =
    stat.format === "percent" ? Math.round(value * 10) / 10 : Math.round(value);

  if (stat.format === "currency") {
    const formatted = rounded.toLocaleString("en-ZA");
    return `${stat.prefix ?? "R"}${formatted}`;
  }

  if (stat.format === "percent") {
    return `${rounded}${stat.suffix ?? "%"}`;
  }

  const formatted = rounded.toLocaleString("en-ZA");
  return `${stat.prefix ?? ""}${formatted}${stat.suffix ?? ""}`;
}
