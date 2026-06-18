import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildReportsSampleMetrics } from "../../data/reportsSamplePreview";
import { MARKETING_SIGNUP_FREE_HREF } from "../../data/homepageMarketingContent";
import { Container } from "../ui/Container";
import { Button, ButtonLink } from "../ui/Button";
import { ReportsSampleA4Page1, ReportsSampleA4Page2, ReportsSampleA4Page3 } from "./ReportsSampleA4Pages";

const PAGE_COUNT = 3;
const PAGES = [ReportsSampleA4Page1, ReportsSampleA4Page2, ReportsSampleA4Page3] as const;

const PAGE_TURN_MS = 360;

function getPageTurnDelayMs(): number {
  if (typeof window.matchMedia !== "function") return PAGE_TURN_MS;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : PAGE_TURN_MS;
}

export function ReportsSamplePreviewSection() {
  const metrics = useMemo(() => buildReportsSampleMetrics(), []);
  const [pageIndex, setPageIndex] = useState(0);
  const [anim, setAnim] = useState<"idle" | "next" | "prev">("idle");

  const goTo = useCallback(
    (nextIndex: number, direction: "next" | "prev") => {
      if (nextIndex < 0 || nextIndex >= PAGE_COUNT || nextIndex === pageIndex || anim !== "idle") return;
      setAnim(direction);
      window.setTimeout(() => {
        setPageIndex(nextIndex);
        setAnim("idle");
      }, getPageTurnDelayMs());
    },
    [pageIndex, anim]
  );

  const PageComponent = PAGES[pageIndex];

  return (
    <section
      id="sample-report-preview"
      className="pg-home-light-section pg-reports-hub-sample"
      aria-labelledby="reports-sample-preview-heading"
    >
      <Container className="pg-container pg-container--marketing-wide">
        <header className="pg-reports-hub-sample-header">
          <h2 id="reports-sample-preview-heading" className="pg-h2">
            View a Sample Investor Report
          </h2>
          <p className="pg-lead pg-reports-hub-sample-lead pg-reports-hub-sample-lead--desktop">
            See how Proplytic turns property data into a clean, investor-ready PDF.
          </p>
          <p className="pg-lead pg-reports-hub-sample-lead pg-reports-hub-sample-lead--mobile">
            Preview how Proplytic turns property data into a clean PDF report.
          </p>
        </header>

        <div className="pg-reports-sample-preview">
          <div className="pg-reports-sample-preview__controls">
            <Button
              type="button"
              variant="ghost"
              className="pg-reports-sample-preview__nav-btn"
              onClick={() => goTo(pageIndex - 1, "prev")}
              disabled={pageIndex === 0 || anim !== "idle"}
              aria-label="Previous page"
            >
              <ChevronLeft size={20} strokeWidth={2.25} aria-hidden />
              Previous
            </Button>
            <span className="pg-reports-sample-preview__indicator" aria-live="polite">
              Page {pageIndex + 1} of {PAGE_COUNT}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="pg-reports-sample-preview__nav-btn"
              onClick={() => goTo(pageIndex + 1, "next")}
              disabled={pageIndex === PAGE_COUNT - 1 || anim !== "idle"}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={20} strokeWidth={2.25} aria-hidden />
            </Button>
          </div>

          <div className="pg-reports-sample-a4-shell">
            <div
              className={[
                "pg-reports-sample-a4",
                anim === "next" ? "pg-reports-sample-a4--turn-next" : "",
                anim === "prev" ? "pg-reports-sample-a4--turn-prev" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className="pg-reports-sample-a4__paper"
                role="document"
                aria-label={`Sample report page ${pageIndex + 1}`}
              >
                <PageComponent metrics={metrics} />
              </div>
            </div>
          </div>
        </div>

        <div className="pg-reports-hub-sample-cta">
          <ButtonLink
            href={MARKETING_SIGNUP_FREE_HREF}
            variant="primary"
            className="pg-reports-hub-sample-cta__btn"
          >
            Start Free to Create Your Own Reports
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
