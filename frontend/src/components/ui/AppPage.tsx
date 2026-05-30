import type React from "react";
import { typographyClassName } from "./Typography";

export type AppPageVariant = "list" | "detail" | "editor" | "financial" | "report" | "settings";

function pageClassName(variant: AppPageVariant, className?: string) {
  return ["pg-app-page", `pg-app-page--${variant}`, className].filter(Boolean).join(" ");
}

export function AppPage({
  variant = "list",
  className,
  children
}: {
  variant?: AppPageVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={pageClassName(variant, className)}>{children}</div>;
}

export function AppPageContent({
  className,
  children,
  style
}: {
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={["pg-app-page__inner", "pg-workspace-page", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

export function AppPageHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={["pg-app-page-header", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AppPageTitle({
  className,
  children,
  as: Tag = "h1"
}: {
  className?: string;
  children: React.ReactNode;
  as?: "h1" | "h2";
}) {
  const cls = typographyClassName("pageTitle", ["pg-app-page-title", className].filter(Boolean).join(" "));
  return <Tag className={cls}>{children}</Tag>;
}

export function AppPageSubtitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={typographyClassName("pageSubtitle", ["pg-app-page-subtitle", className].filter(Boolean).join(" "))}>
      {children}
    </p>
  );
}

export function AppPageActions({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={["pg-app-page-actions", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AppPageToolbar({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={["pg-app-page-toolbar", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AppPageSection({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={["pg-app-page-section", className].filter(Boolean).join(" ")}>{children}</section>;
}

export function AppPageGrid({
  className,
  children,
  columns = 2
}: {
  className?: string;
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
}) {
  return (
    <div className={["pg-app-page-grid", `pg-app-page-grid--cols-${columns}`, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export function AppPageMobileHeader({
  title,
  actions,
  className
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["pg-app-page-mobile-header", className].filter(Boolean).join(" ")}>
      <div className="pg-app-page-mobile-header__title">{title}</div>
      {actions ? <div className="pg-app-page-mobile-header__actions">{actions}</div> : null}
    </div>
  );
}

export function AppListPage({
  className,
  contentClassName,
  children
}: {
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <AppPage variant="list" className={className}>
      <AppPageContent className={contentClassName}>{children}</AppPageContent>
    </AppPage>
  );
}

export function AppDetailPage({
  className,
  contentClassName,
  children
}: {
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <AppPage variant="detail" className={className}>
      <AppPageContent className={contentClassName}>{children}</AppPageContent>
    </AppPage>
  );
}

export function AppFormPage({
  className,
  contentClassName,
  children
}: {
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <AppPage variant="editor" className={className}>
      <AppPageContent className={contentClassName}>{children}</AppPageContent>
    </AppPage>
  );
}

export function AppEditorPage(props: React.ComponentProps<typeof AppFormPage>) {
  return <AppFormPage {...props} />;
}

export function AppFinancialPage({
  className,
  contentClassName,
  children
}: {
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <AppPage variant="financial" className={className}>
      <AppPageContent className={contentClassName}>{children}</AppPageContent>
    </AppPage>
  );
}
