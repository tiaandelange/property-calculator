import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes
} from "react";

export type ProplyticTableVariant = "standard" | "financial" | "compact" | "editable";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function variantClass(variant: ProplyticTableVariant) {
  return `pg-ptable--${variant}`;
}

export function ProplyticTableShell({
  title,
  actions,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("pg-ptable-shell", className)} {...props}>
      {title || actions ? (
        <header className="pg-ptable-shell__header">
          {title ? <h2 className="pg-ptable-shell__title">{title}</h2> : null}
          {actions ? (
            <div
              className="pg-ptable-shell__actions"
              style={!title ? { marginLeft: "auto" } : undefined}
            >
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  );
}

export function ProplyticTableWrap({
  children,
  className,
  responsive,
  scrollX,
  ...props
}: HTMLAttributes<HTMLDivElement> & { responsive?: boolean; scrollX?: boolean }) {
  return (
    <div
      className={cn(
        "pg-ptable-wrap",
        responsive && "pg-ptable-wrap--responsive",
        scrollX && "pg-ptable-wrap--scroll-x",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ProplyticTable({
  children,
  className,
  variant = "standard",
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { variant?: ProplyticTableVariant }) {
  return (
    <table className={cn("pg-ptable", variantClass(variant), className)} {...props}>
      {children}
    </table>
  );
}

export function ProplyticTableHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("pg-ptable__head", className)} {...props}>
      {children}
    </thead>
  );
}

export function ProplyticTableBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("pg-ptable__body", className)} {...props}>
      {children}
    </tbody>
  );
}

export function ProplyticTableRow({
  children,
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr className={cn(interactive && "pg-ptable__row--interactive", className)} {...props}>
      {children}
    </tr>
  );
}

type CellAlign = "left" | "right" | "center";

function cellAlignClass(align?: CellAlign, numeric?: boolean, actions?: boolean) {
  if (actions) return "pg-ptable__actions";
  if (numeric || align === "right") return "pg-ptable__num";
  if (align === "center") return "pg-ptable__center";
  return undefined;
}

export function ProplyticTableHeadCell({
  children,
  className,
  align,
  numeric,
  actions,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  align?: CellAlign;
  numeric?: boolean;
  actions?: boolean;
}) {
  return (
    <th scope="col" className={cn(cellAlignClass(align, numeric, actions), className)} {...props}>
      {children}
    </th>
  );
}

export function ProplyticTableCell({
  children,
  className,
  align,
  numeric,
  actions,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: CellAlign;
  numeric?: boolean;
  actions?: boolean;
}) {
  return (
    <td className={cn(cellAlignClass(align, numeric, actions), className)} {...props}>
      {children}
    </td>
  );
}

export function ProplyticTableActions({
  children,
  className,
  onClick
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn("pg-ptable-actions", className)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      role="presentation"
    >
      {children}
    </div>
  );
}

export function ProplyticTableEmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pg-ptable-empty" role="status">
      <p className="pg-ptable-empty__title">{title}</p>
      {description ? <p className="pg-ptable-empty__desc">{description}</p> : null}
      {action}
    </div>
  );
}

export function ProplyticTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ProplyticTableWrap aria-hidden>
      <div className="pg-ptable-skeleton">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="pg-ptable-skeleton__row" />
        ))}
      </div>
    </ProplyticTableWrap>
  );
}

export function stopTableRowEvent(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}
