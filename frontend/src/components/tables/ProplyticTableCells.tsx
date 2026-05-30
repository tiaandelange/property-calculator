import type { ReactNode } from "react";

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
      <div className="pg-ptable-desc__main">{main}</div>
      {sub ? <div className="pg-ptable-desc__sub">{sub}</div> : null}
    </div>
  );
}
