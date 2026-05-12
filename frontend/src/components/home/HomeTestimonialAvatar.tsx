import { useCallback, useState } from "react";

export function HomeTestimonialAvatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const initials = name
    .split(/[—\-–]|\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

  if (failed) {
    return (
      <span className="pg-home-ph-avatar" role="img" aria-label={name}>
        <span className="pg-home-ph-avatar-initials">{initials}</span>
      </span>
    );
  }

  return (
    <img
      className="pg-home-testimonial-avatar"
      src={src}
      alt=""
      width={44}
      height={44}
      decoding="async"
      loading="lazy"
      onError={onError}
    />
  );
}
