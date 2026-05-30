import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes
} from "react";
import {
  proplyticTableCellAlign,
  proplyticTableColumnClass,
  type ProplyticTableColumnType
} from "./proplyticTableColumnTypes";

export type ProplyticTableVariant = "standard" | "financial" | "compact" | "editable";
export type ProplyticTableLayout = "standard" | "wide";

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
  tableLayout = "standard",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  responsive?: boolean;
  /** @deprecated Prefer tableLayout="wide" */
  scrollX?: boolean;
  tableLayout?: ProplyticTableLayout;
}) {
  const wide = tableLayout === "wide" || scrollX;

  return (
    <div
      className={cn(
        "pg-ptable-wrap",
        responsive && "pg-ptable-wrap--responsive",
        wide && "pg-ptable-wrap--scroll-x",
        wide && "pg-ptable-wrap--wide",
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

type ProplyticTableCellProps = {
  align?: CellAlign;
  columnType?: ProplyticTableColumnType;
  /** @deprecated Use columnType="currency" | "number" */
  numeric?: boolean;
  /** @deprecated Use columnType="actions" */
  actions?: boolean;
  /** @deprecated Use columnType="compact" | "date" | "status" | "reference" */
  compact?: boolean;
  /** @deprecated Use columnType="text" explicitly with flex={false} to opt out */
  flex?: boolean;
};

function resolveCellClass(props: ProplyticTableCellProps) {
  return proplyticTableColumnClass(props.columnType, {
    numeric: props.numeric,
    actions: props.actions,
    compact: props.compact,
    flex: props.flex
  });
}

function resolveCellAlign(props: ProplyticTableCellProps) {
  const resolved = proplyticTableCellAlign(props.columnType, props.align, props.numeric);
  if (resolved === "right") return "pg-ptable-col--align-right";
  if (resolved === "center") return "pg-ptable-col--align-center";
  return undefined;
}

export function ProplyticTableHeadCell({
  children,
  className,
  align,
  columnType,
  numeric,
  actions,
  compact,
  flex,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & ProplyticTableCellProps) {
  const cellProps = { align, columnType, numeric, actions, compact, flex };

  return (
    <th
      scope="col"
      className={cn(resolveCellClass(cellProps), resolveCellAlign(cellProps), className)}
      {...props}
    >
      {actions || columnType === "actions" ? (children ?? "Actions") : children}
    </th>
  );
}

export function ProplyticTableCell({
  children,
  className,
  align,
  columnType,
  numeric,
  actions,
  compact,
  flex,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & ProplyticTableCellProps) {
  const cellProps = { align, columnType, numeric, actions, compact, flex };

  return (
    <td
      className={cn(resolveCellClass(cellProps), resolveCellAlign(cellProps), className)}
      {...props}
    >
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

export type { ProplyticTableColumnType } from "./proplyticTableColumnTypes";
