import { useId, useState } from "react";

const TABS = ["Buy", "Rent", "Invest", "Sell"] as const;

const POPULAR = ["Pretoria", "Cape Town", "Johannesburg", "Durban"] as const;

/**
 * TODO: Wire suburb/city/postcode search to calculator routing or site search when backend + UX spec exist.
 * Tabs and chips are visual/intent placeholders only for now.
 */
export function HomeHeroSearchPanel() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Buy");
  const panelId = useId();

  return (
    <div className="pg-home-hero-search" role="region" aria-labelledby={panelId}>
      <p id={panelId} className="pg-visually-hidden">
        Search calculators by area — preview interface
      </p>
      <div className="pg-home-hero-search-tabs" role="tablist" aria-label="Calculator intent">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`pg-home-hero-search-tab${activeTab === tab ? " pg-home-hero-search-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="pg-home-hero-search-row">
        <label className="pg-visually-hidden" htmlFor="pg-home-hero-search-input">
          Search by suburb, city or postcode
        </label>
        <input
          id="pg-home-hero-search-input"
          type="search"
          className="pg-home-hero-search-input"
          placeholder="Search by suburb, city or postcode"
          autoComplete="off"
          readOnly
          aria-readonly="true"
          title="Search coming soon"
        />
        <button type="button" className="pg-home-hero-search-submit" aria-label="Search (coming soon)">
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" className="pg-home-hero-search-icon">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0 0 4 4"
            />
          </svg>
        </button>
      </div>
      <div className="pg-home-hero-search-popular">
        <span className="pg-home-hero-search-popular-label">Popular:</span>
        <div className="pg-home-hero-search-chips" role="list">
          {POPULAR.map((city) => (
            <button key={city} type="button" className="pg-home-hero-search-chip" role="listitem">
              {city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
