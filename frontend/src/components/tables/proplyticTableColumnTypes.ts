export type ProplyticTableColumnType =
  | "text"
  | "description"
  | "currency"
  | "number"
  | "date"
  | "status"
  | "reference"
  | "icon"
  | "actions"
  | "compact";

export type ProplyticTableColumnMeta = {
  columnType?: ProplyticTableColumnType;
  minWidth?: number;
  maxWidth?: number;
  nowrap?: boolean;
  align?: "left" | "right" | "center";
};

type LegacyCellProps = {
  numeric?: boolean;
  actions?: boolean;
  compact?: boolean;
  flex?: boolean;
};

const COLUMN_TYPE_CLASS: Record<ProplyticTableColumnType, string> = {
  text: "pg-ptable-col--text",
  description: "pg-ptable-col--description",
  currency: "pg-ptable-col--currency",
  number: "pg-ptable-col--number",
  date: "pg-ptable-col--date",
  status: "pg-ptable-col--status",
  reference: "pg-ptable-col--reference",
  icon: "pg-ptable-col--icon",
  actions: "pg-ptable-col--actions",
  compact: "pg-ptable-col--compact"
};

/** Maps columnType (or legacy boolean props) to a single layout class. */
export function proplyticTableColumnClass(
  columnType?: ProplyticTableColumnType,
  legacy?: LegacyCellProps
): string | undefined {
  if (columnType) return COLUMN_TYPE_CLASS[columnType];

  if (legacy?.actions) return COLUMN_TYPE_CLASS.actions;
  if (legacy?.numeric) return COLUMN_TYPE_CLASS.currency;
  if (legacy?.compact) return COLUMN_TYPE_CLASS.compact;
  if (legacy?.flex === false) return undefined;
  return COLUMN_TYPE_CLASS.text;
}

export function proplyticTableCellAlign(
  columnType?: ProplyticTableColumnType,
  align?: "left" | "right" | "center",
  legacyNumeric?: boolean
): "left" | "right" | "center" | undefined {
  if (align) return align;
  if (columnType === "currency" || columnType === "number") return "right";
  if (legacyNumeric) return "right";
  if (columnType === "actions") return "right";
  if (columnType === "icon") return "center";
  return undefined;
}
