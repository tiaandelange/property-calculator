import type { ReactNode } from "react";

type Layer = "front" | "mid" | "back";

type Props = {
  layer: Layer;
  children: ReactNode;
  className?: string;
};

/** A4-style decorative report page shell for the hero stack. */
export function MiniReportPage({ layer, children, className }: Props) {
  return (
    <article
      className={[
        "pg-hero-report-page",
        `pg-hero-report-page--${layer}`,
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pg-hero-report-page__inner">{children}</div>
    </article>
  );
}
