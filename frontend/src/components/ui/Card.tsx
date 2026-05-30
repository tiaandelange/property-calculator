import React from "react";
import {
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardFooter,
  AppCardHeader,
  AppCardTitle,
  type AppCardPadding,
  type AppCardVariant
} from "./AppCard";
import { typographyClassName } from "./Typography";

export {
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardFooter,
  AppCardHeader,
  AppCardTitle,
  AppActionCard,
  AppEmptyStateCard,
  AppInfoCard,
  AppMetricCard
} from "./AppCard";

export { Typography, typographyClassName, type TypographyVariant } from "./Typography";

export {
  AppConfirmDialog,
  AppDrawer,
  AppFormModal,
  AppModal,
  AppPopover,
  AppPopoverDivider,
  AppPopoverItem,
  AppSheet
} from "./AppModal";

export function Card({
  title,
  children,
  pad = true,
  elevated = false,
  className
}: {
  title?: string;
  children: React.ReactNode;
  pad?: boolean;
  elevated?: boolean;
  className?: string;
}) {
  const padding: AppCardPadding = pad ? "md" : "none";
  const variant: AppCardVariant = elevated ? "elevated" : "default";

  return (
    <AppCard variant={variant} padding={padding} className={["pg-card", "pg-workspace-card", className].filter(Boolean).join(" ")}>
      {title ? (
        <AppCardHeader>
          <AppCardTitle className={typographyClassName("cardTitle", "pg-card-title")}>{title}</AppCardTitle>
        </AppCardHeader>
      ) : null}
      <AppCardContent>{children}</AppCardContent>
    </AppCard>
  );
}

/** Padded filter panel for directory / list pages (search, selects, view toggles). */
export function WorkspaceFilterCard({
  title = "Filters",
  children,
  className
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card title={title} className={["pg-workspace-filter-card", className].filter(Boolean).join(" ")}>
      {children}
    </Card>
  );
}
