import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { AppPage, AppPageContent, AppPageHeader, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { ButtonLink } from "../components/ui/Button";
import { openPropertyInvestmentReport } from "../services/propertyReportOpen";

/** Generates the property PDF and opens it in the browser viewer (no in-app iframe). */
export function PropertyReportPage() {
  const { id } = useParams();
  const propertyId = String(id ?? "").trim();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    void (async () => {
      try {
        await openPropertyInvestmentReport(propertyId);
        if (!cancelled) setError("");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to generate report.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return (
    <AppPage variant="report">
      <Helmet>
        <title>Property report | Proplytic</title>
      </Helmet>
      <AppPageContent>
        {error ? (
          <div className="pg-alert pg-alert-error" role="alert">
            {error}
          </div>
        ) : (
          <p className="pg-muted" role="status">
            Opening property report in a new tab…
          </p>
        )}

        <AppPageHeader>
          <div className="pg-app-page-header__main">
            <AppPageTitle as="h2">Property report</AppPageTitle>
            <AppPageSubtitle>
              {error
                ? "Generation failed. Try again from the property workspace."
                : "The report should open in a new browser tab."}
            </AppPageSubtitle>
          </div>
        </AppPageHeader>

        {propertyId ? (
          <ButtonLink href={`/owned-properties/${propertyId}?tab=financials`} variant="soft">
            Back to property
          </ButtonLink>
        ) : (
          <ButtonLink href="/owned-properties" variant="soft">
            Back to properties
          </ButtonLink>
        )}
        {error && propertyId ? (
          <p style={{ marginTop: 12 }}>
            <Link to={`/owned-properties/${propertyId}/report`}>Retry opening report</Link>
          </p>
        ) : null}
      </AppPageContent>
    </AppPage>
  );
}
