import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { ExternalLink, List } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import { generateReportViaVercel } from "../services/reportsVercel";

export function PropertyReportPage() {
  const { id } = useParams();
  const propertyId = String(id ?? "").trim();
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [reportId, setReportId] = useState<string>("");
  const [error, setError] = useState("");
  const fileName = useMemo(() => `property-report-${propertyId || "property"}.pdf`, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const gen = await generateReportViaVercel({ reportType: "PROPERTY_SUMMARY", propertyId });
        if (cancelled) return;
        if (!gen.downloadUrl) throw new Error(gen.error ?? "Report could not be generated.");
        setDownloadUrl(gen.downloadUrl);
        setReportId(gen.reportId || "");
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to generate report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return (
    <Section>
      <Helmet>
        <title>Property report | PropLytic</title>
      </Helmet>
      <Container>
        {error ? (
          <div className="pg-alert pg-alert-error" role="alert">
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="pg-h2" style={{ margin: 0 }}>
              Property report
            </div>
            <div className="pg-muted" style={{ marginTop: 4 }}>
              {loading ? "Generating PDF…" : downloadUrl ? "Saved to Reports. You can export or revisit it later." : "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => (downloadUrl ? window.open(downloadUrl, "_blank", "noopener,noreferrer") : null)}
              disabled={!downloadUrl}
            >
              <ExternalLink size={16} style={{ marginRight: 6 }} aria-hidden />
              View / Download
            </Button>
            <ButtonLink
              href="/owned-properties/reports"
              variant="primary"
              disabled={!downloadUrl}
              title={reportId ? `Report id: ${reportId}` : undefined}
            >
              <List size={16} style={{ marginRight: 6 }} aria-hidden />
              Open Reports
            </ButtonLink>
          </div>
        </div>

        <div style={{ height: 12 }} />

        <Card title="Preview">
          {downloadUrl ? (
            <iframe
              title="Property report PDF"
              src={downloadUrl}
              style={{ width: "100%", height: "75vh", border: "1px solid var(--border-soft)", borderRadius: 12 }}
            />
          ) : (
            <div className="pg-muted">{loading ? "Generating preview…" : "No preview available."}</div>
          )}
        </Card>
      </Container>
    </Section>
  );
}

