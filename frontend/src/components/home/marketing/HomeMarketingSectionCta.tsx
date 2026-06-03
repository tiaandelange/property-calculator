import { ButtonLink } from "../../ui/Button";

export function HomeMarketingSectionCta({
  primary,
  secondary,
  align = "center"
}: {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  align?: "center" | "left";
}) {
  return (
    <div className={`hm-section-cta hm-section-cta--${align}`}>
      <ButtonLink href={primary.href} variant="primary" size="lg">
        {primary.label}
      </ButtonLink>
      {secondary ? (
        <ButtonLink href={secondary.href} variant="secondary" size="lg">
          {secondary.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
