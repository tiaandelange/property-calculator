import type React from "react";
import { createElement } from "react";

export type TypographyVariant =
  | "pageTitle"
  | "pageSubtitle"
  | "sectionTitle"
  | "cardTitle"
  | "cardDescription"
  | "body"
  | "bodySm"
  | "label"
  | "helper"
  | "error"
  | "tableHeader"
  | "tableCell"
  | "metricLabel"
  | "metricValue"
  | "navLabel"
  | "button"
  | "badge"
  | "caption";

const VARIANT_CLASS: Record<TypographyVariant, string> = {
  pageTitle: "pg-text-page-title",
  pageSubtitle: "pg-text-page-subtitle",
  sectionTitle: "pg-text-section-title",
  cardTitle: "pg-text-card-title",
  cardDescription: "pg-text-card-description",
  body: "pg-text-body",
  bodySm: "pg-text-body-sm",
  label: "pg-text-label",
  helper: "pg-text-helper",
  error: "pg-text-error",
  tableHeader: "pg-text-table-header",
  tableCell: "pg-text-table-cell",
  metricLabel: "pg-text-metric-label",
  metricValue: "pg-text-metric-value",
  navLabel: "pg-text-nav-label",
  button: "pg-text-button",
  badge: "pg-text-badge",
  caption: "pg-caption"
};

const DEFAULT_ELEMENT: Record<TypographyVariant, keyof React.JSX.IntrinsicElements> = {
  pageTitle: "h1",
  pageSubtitle: "p",
  sectionTitle: "h2",
  cardTitle: "h3",
  cardDescription: "p",
  body: "p",
  bodySm: "p",
  label: "span",
  helper: "p",
  error: "p",
  tableHeader: "span",
  tableCell: "span",
  metricLabel: "span",
  metricValue: "span",
  navLabel: "span",
  button: "span",
  badge: "span",
  caption: "span"
};

export function typographyClassName(variant: TypographyVariant, className?: string): string {
  return [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
}

export function Typography({
  variant,
  as,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  variant: TypographyVariant;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const Tag = as ?? DEFAULT_ELEMENT[variant];
  return createElement(Tag, { className: typographyClassName(variant, className), ...props }, children);
}
