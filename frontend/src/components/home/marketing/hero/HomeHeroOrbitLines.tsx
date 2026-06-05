/** Decorative curved orbit paths behind the hero dashboard mockup. */
export function HomeHeroOrbitLines() {
  return (
    <svg className="hm-hero-orbit" viewBox="0 0 640 520" aria-hidden preserveAspectRatio="xMidYMid meet">
      <ellipse cx="420" cy="260" rx="280" ry="190" className="hm-hero-orbit__path hm-hero-orbit__path--outer" />
      <ellipse cx="400" cy="280" rx="210" ry="150" className="hm-hero-orbit__path hm-hero-orbit__path--inner" />
    </svg>
  );
}
