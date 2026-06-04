import type { ReactNode } from "react";
import type { CalculatorToolPageMeta } from "../../../data/calculatorToolPageMeta";
import { PublicPageSeo } from "../../seo/PublicPageSeo";
import type { PublicPageSeoConfig } from "../../../lib/publicPageSeo";
import { Container } from "../../ui/Container";
import { Section } from "../../ui/Section";
import { CalculatorToolFooterDisclaimer } from "./CalculatorToolFooterDisclaimer";
import { CalculatorToolNoticeBar } from "./CalculatorToolNoticeBar";
import { CalculatorToolPageHeader } from "./CalculatorToolPageHeader";
import { CalculatorToolUnderstanding } from "./CalculatorToolUnderstanding";

type CalculatorToolPageLayoutProps = {
  slug: string;
  meta: CalculatorToolPageMeta;
  onSave: () => void;
  onShare: () => void;
  saveLoading?: boolean;
  workspace: ReactNode;
  supplementary?: ReactNode;
  stickyBar?: ReactNode;
  isMobile?: boolean;
  children?: ReactNode;
};

export function CalculatorToolPageLayout({
  slug,
  meta,
  onSave,
  onShare,
  saveLoading,
  workspace,
  supplementary,
  stickyBar,
  isMobile,
  children
}: CalculatorToolPageLayoutProps) {
  const pageSeo: PublicPageSeoConfig = {
    title: meta.seoTitle,
    description: meta.seoDescription,
    path: `/calculators/${slug}`
  };

  return (
    <Section
      className={["pg-calculator-detail-page", "pg-calc-tool-page", isMobile ? "pg-calc-tool-page--mobile" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <PublicPageSeo seo={pageSeo} />
      <Container className="pg-container pg-container--marketing-wide pg-calc-tool-page__container">
        <CalculatorToolPageHeader
          slug={slug}
          heading={meta.seoHeading}
          description={meta.pageDescription}
          onSave={onSave}
          onShare={onShare}
          saveLoading={saveLoading}
        />
        <CalculatorToolNoticeBar />
        <div className="pg-calc-tool-workspace">{workspace}</div>
        <CalculatorToolUnderstanding blocks={meta.understanding} />
        {supplementary}
        <CalculatorToolFooterDisclaimer />
        {children}
      </Container>
      {stickyBar}
    </Section>
  );
}
