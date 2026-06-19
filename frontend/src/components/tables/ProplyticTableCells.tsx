import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatTableLeaseTerm, formatTablePropertyAddress } from "./tableCellFormatters";

export type ProplyticAmountTone =
  | "neutral"
  | "debit"
  | "credit-paid"
  | "credit-due"
  | "credit-overdue"
  | "balance";

export function ProplyticAmountCell({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: ProplyticAmountTone;
}) {
  return <span className={`pg-ptable-amount pg-ptable-amount--${tone}`}>{children}</span>;
}

export function ProplyticDateCell({ children }: { children: ReactNode }) {
  return <span className="pg-ptable-date">{children}</span>;
}

export function ProplyticTruncateCell({
  children,
  title
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className="pg-ptable-truncate" title={title}>
      {children}
    </span>
  );
}

export function ProplyticDescriptionCell({
  main,
  sub,
  title
}: {
  main: ReactNode;
  sub?: ReactNode;
  title?: string;
}) {
  return (
    <div className="pg-ptable-desc" title={title}>
      <div className="pg-ptable-desc__main pg-ptable-desc__main--clamp">{main}</div>
      {sub ? <div className="pg-ptable-desc__sub pg-ptable-desc__sub--clamp">{sub}</div> : null}
    </div>
  );
}

export function ProplyticPropertyCell({
  name,
  address,
  href
}: {
  name: string | null | undefined;
  address?: string | null;
  href?: string;
}) {
  const formatted = formatTablePropertyAddress(name, address);
  const primary = href ? (
    <Link className="pg-ptable-entity-link" to={href}>
      {formatted.primary}
    </Link>
  ) : (
    <span className="pg-ptable-entity-link pg-ptable-entity-link--plain">{formatted.primary}</span>
  );

  return (
    <ProplyticDescriptionCell
      main={primary}
      sub={formatted.secondary ? <ProplyticTruncateCell title={formatted.fullTitle}>{formatted.secondary}</ProplyticTruncateCell> : undefined}
      title={formatted.fullTitle}
    />
  );
}

export function ProplyticTenantCell({
  name,
  sub,
  href,
  avatar
}: {
  name: string;
  sub?: ReactNode;
  href?: string;
  avatar?: ReactNode;
}) {
  const nameNode = href ? (
    <Link className="pg-ptable-entity-link" to={href}>
      {name}
    </Link>
  ) : (
    <span className="pg-ptable-entity-link pg-ptable-entity-link--plain">{name}</span>
  );

  return (
    <div className="pg-ptable-tenant-cell">
      {avatar ? <span className="pg-ptable-tenant-cell__avatar">{avatar}</span> : null}
      <div className="pg-ptable-tenant-cell__text">
        <div className="pg-ptable-desc__main">
          <ProplyticTruncateCell>{nameNode}</ProplyticTruncateCell>
        </div>
        {sub ? <div className="pg-ptable-desc__sub pg-ptable-desc__sub--single">{sub}</div> : null}
      </div>
    </div>
  );
}

export function ProplyticLeaseTermCell({
  start,
  end,
  endFallback
}: {
  start: string | null | undefined;
  end: string | null | undefined;
  endFallback?: string;
}) {
  const term = formatTableLeaseTerm(start, end, endFallback);
  if (!term) return <span className="pg-ptable-muted">—</span>;

  return (
    <div className="pg-ptable-lease-term" title={term.fullTitle}>
      <span className="pg-ptable-lease-term__start">{term.startLabel}</span>
      <span className="pg-ptable-lease-term__arrow" aria-hidden>
        →
      </span>
      <span className="pg-ptable-lease-term__end">{term.endLabel}</span>
    </div>
  );
}
