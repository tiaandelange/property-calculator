import { homepageTrustStats, type HomepageTrustStatIcon } from "../../data/homepageTrustStats";
import { Container } from "../ui/Container";

function TrustStatIcon({ variant }: { variant: HomepageTrustStatIcon }) {
  const common = {
    className: "pg-home-trust-strip-icon-svg",
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    "aria-hidden": true as const
  };

  switch (variant) {
    case "activity":
      return (
        <svg {...common}>
          <path
            d="M4 16v2M8 12v6M12 8v10M16 5v13M20 9v9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "tools":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M14 14h5M14 17h5M14 20h3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path
            d="M12 4.5l1.9 4.7 5.1.4-3.9 3.4 1.2 5-4.3-2.6-4.3 2.6 1.2-5-3.9-3.4 5.1-.4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "percent":
      return (
        <svg {...common}>
          <path
            d="M6 18L18 6M8.5 7.5a1.5 1.5 0 1 1 0 .01M15.5 16.5a1.5 1.5 0 1 1 0 .01"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path
            d="M12 4.5 6.5 6.4v5.4c0 3.1 2.1 6 5 7.2l.5.2.5-.2c2.9-1.2 5-4.1 5-7.2V6.4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function HomeTrustStatsStrip() {
  return (
    <section className="pg-home-trust-strip" aria-label="Trust and product highlights">
      <Container>
        <div className="pg-home-trust-strip-panel">
          <ul className="pg-home-trust-strip-grid">
            {homepageTrustStats.map((s) => (
              <li key={s.id} className="pg-home-trust-strip-cell">
                <div className="pg-home-trust-strip-item">
                  <span className="pg-home-trust-strip-icon" aria-hidden="true">
                    <TrustStatIcon variant={s.icon} />
                  </span>
                  <div className="pg-home-trust-strip-value">{s.value}</div>
                  <div className="pg-home-trust-strip-hint">{s.hint}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
