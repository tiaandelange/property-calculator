/** Read a CSS custom property from `:root` (theme-aware). */
export function getCssToken(name: string, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Resolved chart / status colours for Chart.js (reads current theme tokens). */
export function getChartSemanticColors() {
  return {
    primary: getCssToken("--primary", "#8b5cf6"),
    info: getCssToken("--info", "#2563eb"),
    warning: getCssToken("--warning", "#f59e0b"),
    success: getCssToken("--success", "#22c55e"),
    danger: getCssToken("--danger", "#f87171"),
    muted: getCssToken("--text-muted", "#64748b"),
    line: getCssToken("--chart-line", "#8b5cf6"),
    fill: getCssToken("--chart-fill", "rgba(139, 92, 246, 0.22)"),
    successSoft: getCssToken("--success-soft", "rgba(34, 197, 94, 0.16)"),
    warningSoft: getCssToken("--warning-soft", "rgba(245, 158, 11, 0.16)"),
    dangerSoft: getCssToken("--danger-soft", "rgba(248, 113, 113, 0.16)")
  };
}

export function getChartCategoryPalette(): string[] {
  const c = getChartSemanticColors();
  return [c.info, c.warning, c.success, c.danger, c.muted, c.primary, c.muted, c.primary];
}
