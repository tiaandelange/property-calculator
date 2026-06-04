import { FileText, PieChart } from "lucide-react";
import { IconContainerByName } from "../icons";

const FLOATING_TILES = [
  { icon: "pdf" as const, className: "pg-reports-hub-landing-hero__float-tile--pdf" },
  { icon: "reports" as const, className: "pg-reports-hub-landing-hero__float-tile--chart" },
  { icon: "income" as const, className: "pg-reports-hub-landing-hero__float-tile--pie" },
  { icon: "document" as const, className: "pg-reports-hub-landing-hero__float-tile--doc" }
] as const;

/** Decorative stacked PDF pages (not interactive). */
export function ReportsLandingHeroMockup() {
  return (
    <div className="pg-reports-hub-landing-hero__visual" aria-hidden>
      {FLOATING_TILES.map((tile) => (
        <span key={tile.className} className={`pg-reports-hub-landing-hero__float-tile ${tile.className}`}>
          <IconContainerByName icon={tile.icon} accent="purple" size="sm" />
        </span>
      ))}
      <span className="pg-reports-hub-landing-hero__float-tile pg-reports-hub-landing-hero__float-tile--share">
        <IconContainerByName icon="open" accent="purple" size="sm" />
      </span>

      <div className="pg-reports-hub-landing-hero__stack-wrap">
        <div className="pg-reports-hub-landing-hero__stack">
          <article className="pg-reports-hub-landing-hero__page pg-reports-hub-landing-hero__page--back">
            <div className="pg-reports-hub-landing-hero__page-chart" />
            <div className="pg-reports-hub-landing-hero__page-table">
              <span />
              <span />
              <span />
            </div>
          </article>
          <article className="pg-reports-hub-landing-hero__page pg-reports-hub-landing-hero__page--mid">
            <p className="pg-reports-hub-landing-hero__page-kicker">Section</p>
            <h3 className="pg-reports-hub-landing-hero__page-heading">Executive Summary</h3>
            <ul className="pg-reports-hub-landing-hero__page-bullets">
              <li />
              <li />
              <li />
            </ul>
            <div className="pg-reports-hub-landing-hero__page-metrics">
              <span />
              <span />
              <span />
            </div>
          </article>
          <article className="pg-reports-hub-landing-hero__page pg-reports-hub-landing-hero__page--front">
            <div className="pg-reports-hub-landing-hero__page-brand">
              <FileText size={18} strokeWidth={2} aria-hidden />
              <span>Proplytic</span>
            </div>
            <h3 className="pg-reports-hub-landing-hero__page-cover-title">Portfolio Report</h3>
            <p className="pg-reports-hub-landing-hero__page-cover-meta">Q2 2026 · 4 properties</p>
            <div className="pg-reports-hub-landing-hero__page-cover-band" />
            <PieChart size={28} strokeWidth={1.75} className="pg-reports-hub-landing-hero__page-cover-icon" aria-hidden />
          </article>
        </div>
      </div>
    </div>
  );
}
