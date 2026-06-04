import { useState } from "react";
import { CalculatorHubLandingHero } from "../components/calculators/CalculatorHubLandingHero";
import { PublicPageSeo } from "../components/seo/PublicPageSeo";
import { CALCULATORS_HUB_PAGE_SEO } from "../lib/publicPageSeo";
import { CalculatorHubDirectorySection } from "../components/calculators/CalculatorHubDirectorySection";
import type { CalculatorHubCategoryId } from "../data/calculatorHubDirectory";
import { Section } from "../components/ui/Section";

export function CalculatorHubPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CalculatorHubCategoryId>("all");

  const resetFilters = () => {
    setSearchQuery("");
    setActiveCategory("all");
  };

  return (
    <Section className="pg-calc-hub-page">
      <PublicPageSeo seo={CALCULATORS_HUB_PAGE_SEO} />

      <CalculatorHubLandingHero searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} />

      <CalculatorHubDirectorySection
        searchQuery={searchQuery}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onResetFilters={resetFilters}
      />
    </Section>
  );
}
