import type { FieldDef, FieldGroup } from "../data/calculators";

export type CalculatorInputSummaryRow = {
  key: string;
  label: string;
  displayValue: string;
};

function formatZar(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
}

function formatFieldValue(field: FieldDef, raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "—";

  if (field.type === "checkbox") {
    return raw ? "Yes" : "No";
  }

  if (field.type === "select") {
    const opt = field.options?.find((o) => String(o.value) === String(raw));
    return opt?.label ?? String(raw);
  }

  if (field.type === "percent") {
    const n = Number(raw);
    return Number.isFinite(n) ? `${n}%` : String(raw);
  }

  if (field.type === "money" || field.type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw);
    if (field.type === "money" || field.key.toLowerCase().includes("amount") || field.key.toLowerCase().includes("price")) {
      return formatZar(n);
    }
    if (field.key === "loanTermYears") return `${n} years`;
    return n.toLocaleString("en-ZA");
  }

  if (field.key === "annualCashFlows" || field.key === "items") {
    return "Configured";
  }

  return String(raw);
}

/** Compact label for mobile summary (strip parentheticals). */
function shortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function buildCalculatorInputSummary(
  slug: string,
  groups: FieldGroup[],
  values: Record<string, unknown>
): CalculatorInputSummaryRow[] {
  if (slug === "noi") {
    const rent = Number(values.rentalIncomeAnnual);
    const items = Array.isArray(values.expenseItems) ? values.expenseItems : [];
    const expenseTotal = items.reduce((s: number, row: { annualAmount?: number }) => s + (Number(row?.annualAmount) || 0), 0);
    return [
      {
        key: "rentalIncomeAnnual",
        label: "Rental income (annual)",
        displayValue: Number.isFinite(rent) ? formatZar(rent) : "—"
      },
      {
        key: "expenseItems",
        label: "Operating expenses",
        displayValue: `${items.length} line item${items.length === 1 ? "" : "s"} · ${formatZar(expenseTotal)}`
      },
      {
        key: "vacancyRatePercent",
        label: "Vacancy allowance",
        displayValue: formatFieldValue({ key: "vacancyRatePercent", label: "", type: "percent" }, values.vacancyRatePercent)
      },
      {
        key: "maintenancePercentOfEffectiveGross",
        label: "Maintenance",
        displayValue: formatFieldValue(
          { key: "maintenancePercentOfEffectiveGross", label: "", type: "percent" },
          values.maintenancePercentOfEffectiveGross
        )
      }
    ];
  }

  const rows: CalculatorInputSummaryRow[] = [];
  for (const group of groups) {
    for (const field of group.fields) {
      if (field.key === "scenarioName") continue;
      rows.push({
        key: field.key,
        label: shortLabel(field.label),
        displayValue: formatFieldValue(field, values[field.key])
      });
    }
  }
  return rows;
}
