import type React from "react";

export function TableWrap({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={["pg-table-wrap", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function Table({
  children,
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={["pg-table", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </table>
  );
}
