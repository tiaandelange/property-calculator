import React from "react";
import { Container } from "../../ui/Container";
import { Section } from "../../ui/Section";

type HomeMarketingSectionProps = {
  id?: string;
  className?: string;
  tone?: "default" | "muted" | "accent";
  children: React.ReactNode;
};

export function HomeMarketingSection({
  id,
  className = "",
  tone = "default",
  children
}: HomeMarketingSectionProps) {
  return (
    <Section id={id} className={`hm-section hm-section--${tone} ${className}`.trim()}>
      <Container className="pg-container--marketing-wide">
        <div className="hm-section__inner">{children}</div>
      </Container>
    </Section>
  );
}

export function HomeMarketingSectionHeader({
  title,
  lead,
  align = "center"
}: {
  title: string;
  lead?: string;
  align?: "center" | "left";
}) {
  return (
    <header className={`hm-section-header hm-section-header--${align}`}>
      <h2 className="hm-section-title">{title}</h2>
      {lead ? <p className="hm-section-lead">{lead}</p> : null}
    </header>
  );
}
