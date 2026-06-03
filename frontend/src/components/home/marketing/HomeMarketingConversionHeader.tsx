export function HomeMarketingConversionHeader({
  eyebrow,
  pain,
  title,
  benefit,
  align = "center"
}: {
  eyebrow?: string;
  pain?: string;
  title: string;
  benefit?: string;
  align?: "center" | "left";
}) {
  return (
    <header className={`hm-conv-header hm-conv-header--${align}`}>
      {eyebrow ? <p className="hm-section-eyebrow">{eyebrow}</p> : null}
      {pain ? <p className="hm-conv-pain">{pain}</p> : null}
      <h2 className="hm-section-title">{title}</h2>
      {benefit ? <p className="hm-section-lead">{benefit}</p> : null}
    </header>
  );
}
