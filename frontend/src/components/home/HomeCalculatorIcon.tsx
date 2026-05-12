import { useCallback, useState } from "react";
import { getCalculatorIconSrcForSlug } from "../../data/homepageAssets";

function CalculatorIconOutline() {
  return (
    <svg className="pg-home-ph-calc-icon-svg" viewBox="0 0 48 48" width={48} height={48} aria-hidden="true">
      <rect x="10" y="8" width="28" height="32" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15" y="14" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <rect x="25" y="14" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <rect x="15" y="23" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <rect x="25" y="23" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M15 32h18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function HomeCalculatorIcon({
  slug,
  label,
  iconSrc
}: {
  slug: string;
  label: string;
  /** When set (e.g. from `homepageCalculators`), this image is used instead of slug-based resolution. */
  iconSrc?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = iconSrc ?? getCalculatorIconSrcForSlug(slug);
  const onError = useCallback(() => setFailed(true), []);

  return (
    <span className="pg-home-calculator-icon-slot" aria-hidden="true" title={label}>
      {failed ? <CalculatorIconOutline /> : null}
      {!failed ? (
        <img
          className="pg-home-calculator-icon-img"
          src={src}
          alt=""
          width={48}
          height={48}
          decoding="async"
          loading="lazy"
          onError={onError}
        />
      ) : null}
    </span>
  );
}
