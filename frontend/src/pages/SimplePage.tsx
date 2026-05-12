import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { PageBreadcrumb } from "../components/nav/PageBreadcrumb";
import { homeThen } from "../nav/workspaceBreadcrumbs";

export function SimplePage({ title, description }: { title: string; description: string }) {
  return (
    <Section>
      <Helmet>
        <title>{title} | The Property Guy</title>
        <meta name="description" content={description} />
      </Helmet>
      <Container>
        <PageBreadcrumb items={homeThen(title)} />
        <Card>
          <h1 className="pg-h2">{title}</h1>
          <p className="pg-lead">{description}</p>
        </Card>
      </Container>
    </Section>
  );
}

