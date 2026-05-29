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
