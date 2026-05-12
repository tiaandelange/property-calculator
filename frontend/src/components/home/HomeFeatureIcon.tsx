import { useCallback, useState } from "react";
import type { HomepageFeatureIconKey } from "../../data/homepageAssets";
import { homepageFeatureIcons } from "../../data/homepageAssets";

function FeatureIconOutline() {
  return (
    <svg className="pg-home-ph-feature-icon-svg" viewBox="0 0 48 48" width={48} height={48} aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 16v10l7 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeFeatureIcon({ iconKey, label }: { iconKey: HomepageFeatureIconKey; label: string }) {
  const [failed, setFailed] = useState(false);
  const src = homepageFeatureIcons[iconKey];
  const onError = useCallback(() => setFailed(true), []);

  return (
    <span className="pg-home-feature-icon-slot" aria-hidden="true" title={label}>
      {failed ? <FeatureIconOutline /> : null}
      {!failed ? (
        <img
          className="pg-home-feature-icon-img"
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
