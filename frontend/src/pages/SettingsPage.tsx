import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { fetchMe } from "../api/user";
import { useEffect, useState } from "react";

export function SettingsPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) setRole(me.role ?? null);
      } catch {
        if (!cancelled) setRole(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = role === "ADMIN";

  return (
    <Section>
      <Helmet>
        <title>Settings | The Property Guy</title>
      </Helmet>
      <Container>
        <h1 className="pg-h2" style={{ margin: "8px 0 0" }}>
          Settings
        </h1>
        <p className="pg-muted" style={{ marginTop: 8 }}>
          Account preferences and workspace configuration.
        </p>

        <div style={{ marginTop: 24, display: "grid", gap: 14, maxWidth: 560 }}>
          <Card title="Profile">
            <p className="pg-muted" style={{ marginTop: 0 }}>
              Invoice banking details and email on file.
            </p>
            <Link className="pg-btn pg-btn-secondary" to="/account">
              Open account
            </Link>
          </Card>

          <Card title="Workspace">
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              <li style={{ marginBottom: 8 }}>
                <Link className="pg-link" to="/settings/security">
                  Security
                </Link>
              </li>
              <li>
                <Link className="pg-link" to="/settings/notifications">
                  Notifications
                </Link>
              </li>
            </ul>
          </Card>

          {isAdmin ? (
            <Card title="Admin">
              <p className="pg-muted" style={{ marginTop: 0 }}>
                Portfolio projection defaults used for IRR (rental income and expense growth assumptions).
              </p>
              <Link className="pg-btn pg-btn-primary" to="/admin">
                Open admin metrics panel
              </Link>
            </Card>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
