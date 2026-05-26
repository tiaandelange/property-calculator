import { CalculatorIconDisplay } from "../icons/CalculatorIconDisplay";
import type { IconContainerSize } from "../ui/IconContainer";

export function HomeCalculatorIcon({
  slug,
  label,
  size = "lg",
  contained = true
}: {
  slug: string;
  label: string;
  /** @deprecated Ignored — icons are resolved from slug via Lucide. */
  iconSrc?: string;
  size?: IconContainerSize;
  contained?: boolean;
}) {
  return (
    <span className="pg-home-calculator-icon-slot" aria-hidden="true" title={label}>
      <CalculatorIconDisplay slug={slug} size={size} contained={contained} />
    </span>
  );
}
