import { getCalculatorIconConfig } from "../../icons/calculatorIcons";
import type { IconContainerSize } from "./iconSizes";
import { IconContainer } from "./IconContainer";

/**
 * Calculator slug → semantic icon in a coloured container (replaces WebP calculator icons).
 */
export function CalculatorIconDisplay({
  slug,
  size = "lg",
  className,
  contained = true
}: {
  slug: string;
  size?: IconContainerSize;
  className?: string;
  /** When false, renders icon only (e.g. compact mega menu). */
  contained?: boolean;
}) {
  const { icon: Icon, accent } = getCalculatorIconConfig(slug);
  if (!contained) {
    return <Icon size={size === "sm" ? 18 : size === "md" ? 20 : 22} className={className} aria-hidden />;
  }
  return <IconContainer icon={Icon} accent={accent} size={size} className={className} />;
}
