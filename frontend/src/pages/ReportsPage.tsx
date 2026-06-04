import { useState } from "react";
import { ReportsDirectorySection } from "../components/reports/ReportsDirectorySection";
import { PublicPageSeo } from "../components/seo/PublicPageSeo";
import { REPORTS_PAGE_SEO } from "../lib/publicPageSeo";
import { ReportsExplainSection } from "../components/reports/ReportsExplainSection";
import { ReportsBenefitsStrip } from "../components/reports/ReportsBenefitsStrip";
import { ReportsLandingHero } from "../components/reports/ReportsLandingHero";
import { ReportsSamplePreviewSection } from "../components/reports/ReportsSamplePreviewSection";
import type { ReportsHubCategoryId } from "../data/reportsHubDirectory";
import { Section } from "../components/ui/Section";

export function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ReportsHubCategoryId>("all");

  const resetFilters = () => {
    setSearchQuery("");
    setActiveCategory("all");
  };

  return (
    <Section className="pg-reports-hub-page pg-reports-hub-page--public">
      <PublicPageSeo seo={REPORTS_PAGE_SEO} />

      <ReportsLandingHero />

      <ReportsDirectorySection
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onResetFilters={resetFilters}
      />

      <ReportsSamplePreviewSection />

      <ReportsBenefitsStrip />

      <ReportsExplainSection />
    </Section>
  );
}
