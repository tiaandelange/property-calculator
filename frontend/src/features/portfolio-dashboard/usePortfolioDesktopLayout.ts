import { useEffect, useState } from "react";

export type PortfolioDesktopLayout = {
  /** Max recent property cards to render on desktop. */
  propertyLimit: number;
  /** Max activity rows on desktop. */
  activityLimit: number;
  /** Show second row of KPI cards (wide monitors). */
  showSecondaryMetrics: boolean;
  /** Layout bucket for debugging / optional class names. */
  tier: "compact" | "standard" | "wide" | "ultra";
};

const DEFAULT_LAYOUT: PortfolioDesktopLayout = {
  propertyLimit: 4,
  activityLimit: 6,
  showSecondaryMetrics: false,
  tier: "standard"
};

function layoutForWidth(width: number): PortfolioDesktopLayout {
  if (width < 768) {
    return { ...DEFAULT_LAYOUT, propertyLimit: 4, activityLimit: 6, tier: "compact" };
  }
  if (width < 1100) {
    return { propertyLimit: 4, activityLimit: 6, showSecondaryMetrics: false, tier: "compact" };
  }
  if (width < 1280) {
    return { propertyLimit: 4, activityLimit: 6, showSecondaryMetrics: false, tier: "standard" };
  }
  if (width < 1400) {
    return { propertyLimit: 4, activityLimit: 7, showSecondaryMetrics: false, tier: "standard" };
  }
  if (width < 1600) {
    return { propertyLimit: 5, activityLimit: 8, showSecondaryMetrics: true, tier: "wide" };
  }
  if (width < 1920) {
    return { propertyLimit: 6, activityLimit: 9, showSecondaryMetrics: true, tier: "wide" };
  }
  return { propertyLimit: 8, activityLimit: 10, showSecondaryMetrics: true, tier: "ultra" };
}

/** Desktop dashboard density from viewport width (resize-safe, no layout thrash). */
export function usePortfolioDesktopLayout(): PortfolioDesktopLayout {
  const [layout, setLayout] = useState<PortfolioDesktopLayout>(() =>
    typeof window !== "undefined" ? layoutForWidth(window.innerWidth) : DEFAULT_LAYOUT
  );

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setLayout(layoutForWidth(window.innerWidth));
      });
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return layout;
}
