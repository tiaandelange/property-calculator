import { useCallback, useState } from "react";
import { homepageBrand } from "../../data/homepageAssets";

function BrandTextLogo() {
  return (
    <span className="pg-home-brand-text-logo">
      <svg className="pg-home-brand-text-logo-icon" viewBox="0 0 32 32" width={28} height={28} aria-hidden="true">
        <path
          d="M6 14 L16 6 L26 14 V26 H6 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <rect x="11" y="26" width="10" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <rect x="19" y="10" width="7" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.15" />
        <path d="M20 13h5M20 15.5h3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <span className="pg-home-brand-text-logo-text">PROPERTY CALCULATED</span>
    </span>
  );
}

export function HomeBrandWordmark({ alt }: { alt: string }) {
  const [usePlaceholder, setUsePlaceholder] = useState(false);
  const onError = useCallback(() => setUsePlaceholder(true), []);
  const decorative = !alt.trim();

  if (usePlaceholder) {
    return (
      <div
        className="pg-home-brand-text-logo-wrap"
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative ? true : undefined}
      >
        <BrandTextLogo />
      </div>
    );
  }

  return (
    <img
      className="pg-home-brand-wordmark"
      src={homepageBrand.wordmark}
      alt={alt}
      width={220}
      height={40}
      decoding="async"
      loading="eager"
      onError={onError}
    />
  );
}
