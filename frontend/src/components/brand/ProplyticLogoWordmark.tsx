import type { HTMLAttributes } from "react";
import { ProplyticLogoIcon } from "./ProplyticLogoIcon";

export type ProplyticLogoWordmarkProps = HTMLAttributes<HTMLSpanElement> & {
  iconSize?: number;
  compact?: boolean;
};

/** Full Proplytic wordmark — house icon + text with purple dot on the “i”. */
export function ProplyticLogoWordmark({
  className,
  iconSize,
  compact = false,
  ...props
}: ProplyticLogoWordmarkProps) {
  const size = iconSize ?? (compact ? 28 : 34);

  return (
    <span className={["proplytic-logo-wordmark", compact ? "proplytic-logo-wordmark--compact" : "", className].filter(Boolean).join(" ")} {...props}>
      <ProplyticLogoIcon
        className="proplytic-logo-wordmark__icon"
        width={size}
        height={size}
        gradientId={compact ? "proplytic-wordmark-gradient-compact" : "proplytic-wordmark-gradient"}
        aria-hidden
        role="presentation"
        focusable="false"
      />
      <span className="proplytic-logo-wordmark__text" aria-hidden>
        Proplyt
        <span className="proplytic-logo-wordmark__i">
          <span className="proplytic-logo-wordmark__i-dot" />
          <span className="proplytic-logo-wordmark__i-stem">i</span>
        </span>
        c
      </span>
    </span>
  );
}
