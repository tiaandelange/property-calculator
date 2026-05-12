import { useCallback, useState } from "react";
import { homepageHero } from "../../data/homepageAssets";

type HeroKind = "property" | "calculatorPreview";

const srcByKind: Record<HeroKind, string> = {
  property: homepageHero.property,
  calculatorPreview: homepageHero.calculatorPreview
};

export function HomeHeroImage({
  kind,
  alt,
  decorative = false,
  className,
  width,
  height,
  fetchPriority,
  loading
}: {
  kind: HeroKind;
  alt: string;
  decorative?: boolean;
  className?: string;
  width: number;
  height: number;
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
}) {
  const [usePlaceholder, setUsePlaceholder] = useState(false);
  const onError = useCallback(() => setUsePlaceholder(true), []);

  const phClass =
    kind === "property" ? "pg-home-ph-hero pg-home-ph-hero--property" : "pg-home-ph-hero pg-home-ph-hero--calculator";

  if (usePlaceholder) {
    return (
      <div
        className={`${phClass}${className ? ` ${className}` : ""}`}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative ? true : undefined}
      />
    );
  }

  return (
    <img
      className={className}
      src={srcByKind[kind]}
      alt={decorative ? "" : alt}
      width={width}
      height={height}
      decoding="async"
      fetchPriority={fetchPriority}
      loading={loading}
      onError={onError}
    />
  );
}
