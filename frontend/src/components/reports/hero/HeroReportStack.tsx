import { IconContainerByName } from "../../icons";
import { HeroReportCashFlowPage } from "./HeroReportCashFlowPage";
import { HeroReportFrontPage } from "./HeroReportFrontPage";
import { HeroReportPerformancePage } from "./HeroReportPerformancePage";
import { MiniReportPage } from "./MiniReportPage";
import "./heroReportStack.css";

const FLOATING_TILES = [
  { icon: "pdf" as const, className: "pg-reports-hub-landing-hero__float-tile--pdf" },
  { icon: "reports" as const, className: "pg-reports-hub-landing-hero__float-tile--chart" }
] as const;

/** Decorative stacked A4 report preview for the public Reports hero. */
export function HeroReportStack() {
  return (
    <div className="pg-reports-hub-landing-hero__visual" aria-hidden>
      {FLOATING_TILES.map((tile) => (
        <span
          key={tile.className}
          className={`pg-reports-hub-landing-hero__float-tile pg-reports-hub-landing-hero__float-tile--subtle ${tile.className}`}
        >
          <IconContainerByName icon={tile.icon} accent="purple" size="sm" />
        </span>
      ))}

      <div className="pg-reports-hub-landing-hero__stack-wrap">
        <div className="pg-reports-hub-landing-hero__stack pg-hero-report-stack">
          <MiniReportPage layer="back">
            <HeroReportPerformancePage />
          </MiniReportPage>
          <MiniReportPage layer="mid">
            <HeroReportCashFlowPage />
          </MiniReportPage>
          <MiniReportPage layer="front">
            <HeroReportFrontPage />
          </MiniReportPage>
        </div>
      </div>
    </div>
  );
}
