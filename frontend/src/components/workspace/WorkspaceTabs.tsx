import type React from "react";
import { ButtonLink } from "../ui/Button";
import type { ButtonVariant } from "../ui/buttonStyles";

export function WorkspaceTabs({
  basePath,
  active,
  tabs,
  extraQueryForTab,
  className,
  style
}: {
  basePath: string;
  active: string;
  tabs: Array<{ key: string; label: React.ReactNode; to?: string; newTab?: boolean; variant?: ButtonVariant }>;
  /** e.g. { financials: "fin=statement" } — appended only for that tab link */
  extraQueryForTab?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 12,
        ...style
      }}
    >
      {tabs.map((t) => {
        const suffix = extraQueryForTab?.[t.key] ? `&${extraQueryForTab[t.key]}` : "";
        const href = t.to ?? `${basePath}?tab=${t.key}${suffix}`;
        const variant: ButtonVariant =
          t.variant ?? (active === t.key ? "primary" : "ghost");

        return (
          <ButtonLink
            key={t.key}
            href={href}
            variant={variant}
            target={t.newTab ? "_blank" : undefined}
            rel={t.newTab ? "noopener noreferrer" : undefined}
          >
            {t.label}
          </ButtonLink>
        );
      })}
    </div>
  );
}
