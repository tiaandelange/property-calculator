type Column = { key: string; label: string; align?: "left" | "right" };

type Props<T extends Record<string, string>> = {
  columns: readonly Column[];
  rows: readonly T[];
  compact?: boolean;
};

/** Decorative mini table for hero report previews. */
export function MiniReportTable<T extends Record<string, string>>({
  columns,
  rows,
  compact
}: Props<T>) {
  return (
    <table
      className={`pg-hero-report-table${compact ? " pg-hero-report-table--compact" : ""}`}
    >
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col" className={col.align === "right" ? "pg-hero-report-table__num" : undefined}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            {columns.map((col) => (
              <td key={col.key} className={col.align === "right" ? "pg-hero-report-table__num" : undefined}>
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
