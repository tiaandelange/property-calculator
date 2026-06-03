import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  HomeMarketingCalculatorPreview,
  HomeMarketingInvoicePreview,
  HomeMarketingPortfolioPreview,
  HomeMarketingPropertyPreview,
  HomeMarketingStatementPreview
} from "./HomeMarketingModulePreviews";
import { HomeMarketingReportPreviewMock } from "./HomeMarketingReportPreviewMock";

const AUTOPLAY_MS = 6500;

type StackPosition = "active" | "next1" | "next2" | "hidden";

type PreviewSlide = {
  id: string;
  title: string;
  render: () => ReactNode;
};

const PREVIEW_SLIDES: readonly PreviewSlide[] = [
  {
    id: "portfolio",
    title: "Portfolio Analytics",
    render: () => <HomeMarketingPortfolioPreview showLabel={false} />
  },
  {
    id: "property",
    title: "Property Overview",
    render: () => <HomeMarketingPropertyPreview showLabel={false} />
  },
  {
    id: "statement",
    title: "Statement",
    render: () => <HomeMarketingStatementPreview showLabel={false} />
  },
  {
    id: "invoice",
    title: "Invoice",
    render: () => <HomeMarketingInvoicePreview showLabel={false} />
  },
  {
    id: "report",
    title: "Investment Report",
    render: () => <HomeMarketingReportPreviewMock />
  },
  {
    id: "calculator",
    title: "Bond Calculator",
    render: () => <HomeMarketingCalculatorPreview showLabel={false} />
  }
] as const;

function stackPosition(index: number, activeIndex: number, total: number): StackPosition {
  const offset = (index - activeIndex + total) % total;
  if (offset === 0) return "active";
  if (offset === 1) return "next1";
  if (offset === 2) return "next2";
  return "hidden";
}

export function MarketingStackedPreviewCarousel() {
  const rootId = useId();
  const regionLabelId = `${rootId}-label`;
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const total = PREVIEW_SLIDES.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % total) + total) % total);
    },
    [total]
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (autoplayPaused || reducedMotion) return;
    const timer = window.setInterval(goNext, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [autoplayPaused, reducedMotion, goNext]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!root.contains(target)) return;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;

      event.preventDefault();
      if (event.key === "ArrowLeft") goPrev();
      else goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  const pauseAutoplay = () => setAutoplayPaused(true);
  const resumeAutoplay = () => setAutoplayPaused(false);

  return (
    <div
      ref={rootRef}
      className="hm-stack-carousel"
      onMouseEnter={pauseAutoplay}
      onMouseLeave={resumeAutoplay}
      onFocusCapture={pauseAutoplay}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          resumeAutoplay();
        }
      }}
    >
      <div
        className="hm-stack-carousel__stage-wrap"
        role="region"
        aria-roledescription="carousel"
        aria-labelledby={regionLabelId}
      >
        <p id={regionLabelId} className="hm-stack-carousel__sr-title">
          Product preview carousel
        </p>
        <div className="hm-stack-carousel__glow" aria-hidden />
        <div className="hm-stack-carousel__stage">
          {PREVIEW_SLIDES.map((slide, index) => {
            const position = stackPosition(index, activeIndex, total);
            const isActive = position === "active";

            return (
              <article
                key={slide.id}
                className={`hm-stack-carousel__card hm-stack-carousel__card--${position}${
                  reducedMotion ? " hm-stack-carousel__card--reduced-motion" : ""
                }`}
                aria-hidden={!isActive}
                aria-label={isActive ? `${slide.title} preview` : undefined}
                data-slide-title={slide.title}
              >
                <div className="hm-stack-carousel__card-surface">{slide.render()}</div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="hm-stack-carousel__controls">
        <button
          type="button"
          className="hm-stack-carousel__nav-btn"
          onClick={goPrev}
          aria-label="Previous preview"
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden />
        </button>

        <div className="hm-stack-carousel__dots" role="tablist" aria-label="Preview slides">
          {PREVIEW_SLIDES.map((slide, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                className={`hm-stack-carousel__dot${selected ? " hm-stack-carousel__dot--active" : ""}`}
                aria-selected={selected}
                aria-label={`Go to preview ${index + 1} of ${total}`}
                onClick={() => goTo(index)}
              />
            );
          })}
        </div>

        <button
          type="button"
          className="hm-stack-carousel__nav-btn"
          onClick={goNext}
          aria-label="Next preview"
        >
          <ChevronRight size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <p className="hm-stack-carousel__caption" aria-live="polite">
        <span className="hm-stack-carousel__caption-label">{PREVIEW_SLIDES[activeIndex].title}</span>
        <span className="hm-stack-carousel__caption-meta">
          {activeIndex + 1} of {total}
        </span>
      </p>
    </div>
  );
}
