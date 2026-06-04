import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { CalculatorHubLandingHero } from "../components/calculators/CalculatorHubLandingHero";
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
      <Helmet>
        <title>Property investment calculators | Proplytic</title>
        <meta
          name="description"
          content="Run quick property calculations before building your full portfolio report — bond payment, transfer costs, cash flow, cap rate, IRR and more. No sign-in required."
        />
      </Helmet>

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
