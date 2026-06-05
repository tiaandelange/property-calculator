import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { ButtonLink } from "../components/ui/Button";
import { PageBrandMark } from "../components/brand/PageBrandMark";

/**
 * @deprecated Legacy R99 Stripe landing page. Route redirects to Settings → Subscription.
 * Remove this file after Paystack checkout is confirmed live.
 */
export function SubscriptionPage() {
  return (
    <Section>
      <Helmet>
        <title>Subscription | Proplytic</title>
        <meta name="description" content="View paid plans for unlimited calculator usage and portfolio tools." />
      </Helmet>
      <Container>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <PageBrandMark linkToHome />
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              Subscription
            </h1>
            <p className="pg-lead">
              Proplytic plans are managed from Settings. Compare tiers on the pricing page — Starter is
              free, and paid plans complete checkout from your account.
            </p>

            <GridRow />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ButtonLink href="/settings?section=subscription" variant="primary">
                Manage subscription
              </ButtonLink>
              <ButtonLink href="/pricing" variant="ghost">
                View plans
              </ButtonLink>
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  );
}

function GridRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, margin: "16px 0 20px" }}>
      {[
        { label: "Plan tiers", desc: "Starter, Investor, Portfolio, and Portfolio Pro." },
        { label: "Usage limits", desc: "Properties, reports, and applicant links by plan." },
        { label: "Secure checkout", desc: "Complete payment from Settings when you are ready." }
      ].map((x) => (
        <div key={x.label} className="pg-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 900 }}>{x.label}</div>
          <div className="pg-muted">{x.desc}</div>
        </div>
      ))}
    </div>
  );
}
