/** Mobile-friendly label/value rows (replaces wide tables on narrow screens). */
export function CalculatorToolBreakdownList({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; value: string; variant?: "detail" | "subtotal" }>;
}) {
  return (
    <div className="pg-calc-tool-panel pg-calc-tool-panel--table pg-calc-tool-breakdown-list">
      <h3 className="pg-calc-tool-breakdown-list__title">{title}</h3>
      <ul className="pg-calc-tool-breakdown-list__rows">
        {rows.map((row) => (
          <li
            key={row.label}
            className="pg-calc-tool-breakdown-list__row"
            data-variant={row.variant ?? "detail"}
          >
            <span className="pg-calc-tool-breakdown-list__label">{row.label}</span>
            <span className="pg-calc-tool-breakdown-list__value">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
