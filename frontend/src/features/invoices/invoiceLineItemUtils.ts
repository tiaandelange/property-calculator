/** Shared invoice line-item model + totals — used by the canonical invoice editor. */

export type InvoiceLineItemDraft = {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  /** VAT rate as a percentage (0–100). Rent is always 0. */
  taxRate: number;
};

/** Maps user-facing labels to `app_property_income_category` enum values (tenant recoveries = income). */
export const INVOICE_LINE_CATEGORIES = [
  { value: "RENT", label: "Monthly Rent", defaultDescription: "Monthly Rent" },
  { value: "UTILITIES_RECOVERY", label: "Water Recovery", defaultDescription: "Water Recovery" },
  { value: "UTILITIES_RECOVERY", label: "Waste Recovery", defaultDescription: "Waste Recovery", slug: "WASTE" },
  { value: "UTILITIES_RECOVERY", label: "Electricity Recovery", defaultDescription: "Electricity Recovery", slug: "ELECTRICITY" },
  { value: "LATE_FEE", label: "Late Fee", defaultDescription: "Late Fee" },
  { value: "DEPOSIT", label: "Deposit", defaultDescription: "Deposit" },
  { value: "OTHER", label: "Maintenance Recovery", defaultDescription: "Maintenance Recovery", slug: "MAINTENANCE" },
  { value: "OTHER", label: "Other", defaultDescription: "Line item" }
] as const;

/** Unique select options — utility recoveries share enum value but differ by default description. */
export const INVOICE_LINE_CATEGORY_OPTIONS = [
  { value: "RENT", label: "Monthly Rent", defaultDescription: "Monthly Rent" },
  { value: "UTILITIES_RECOVERY:WATER", label: "Water Recovery", defaultDescription: "Water Recovery", category: "UTILITIES_RECOVERY" },
  { value: "UTILITIES_RECOVERY:WASTE", label: "Waste Recovery", defaultDescription: "Waste Recovery", category: "UTILITIES_RECOVERY" },
  {
    value: "UTILITIES_RECOVERY:ELECTRICITY",
    label: "Electricity Recovery",
    defaultDescription: "Electricity Recovery",
    category: "UTILITIES_RECOVERY"
  },
  { value: "LATE_FEE", label: "Late Fee", defaultDescription: "Late Fee" },
  { value: "DEPOSIT", label: "Deposit", defaultDescription: "Deposit" },
  { value: "OTHER:MAINTENANCE", label: "Maintenance Recovery", defaultDescription: "Maintenance Recovery", category: "OTHER" },
  { value: "OTHER", label: "Other", defaultDescription: "Line item" }
] as const;

export type InvoiceLineCategoryOption = (typeof INVOICE_LINE_CATEGORY_OPTIONS)[number];

export function lineItemAmount(quantity: number, unitPrice: number): number {
  const qty = Number.isFinite(quantity) ? quantity : 0;
  const up = Number.isFinite(unitPrice) ? unitPrice : 0;
  return Math.round(qty * up * 100) / 100;
}

export const INVOICE_TAX_OPTIONS = [
  { value: 0, label: "No VAT" },
  { value: 15, label: "VAT 15%" }
] as const;

export function effectiveLineTaxRate(category: string, taxRate: number): number {
  if (String(category).toUpperCase() === "RENT") return 0;
  const rate = Number(taxRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export function lineItemExVatAmount(quantity: number, unitPrice: number): number {
  return lineItemAmount(quantity, unitPrice);
}

export function lineItemVatAmount(quantity: number, unitPrice: number, category: string, taxRate: number): number {
  const exVat = lineItemExVatAmount(quantity, unitPrice);
  const rate = effectiveLineTaxRate(category, taxRate);
  if (rate <= 0) return 0;
  return Math.round(exVat * (rate / 100) * 100) / 100;
}

export function lineItemIncVatAmount(
  quantity: number,
  unitPrice: number,
  category: string,
  taxRate: number
): number {
  const exVat = lineItemExVatAmount(quantity, unitPrice);
  return Math.round((exVat + lineItemVatAmount(quantity, unitPrice, category, taxRate)) * 100) / 100;
}

export function calcInvoiceSubtotal(items: InvoiceLineItemDraft[]): number {
  return items.reduce((sum, li) => sum + lineItemExVatAmount(li.quantity, li.unitPrice), 0);
}

export function calcInvoiceTaxAmount(items: InvoiceLineItemDraft[]): number {
  return items.reduce(
    (sum, li) => sum + lineItemVatAmount(li.quantity, li.unitPrice, li.category, li.taxRate),
    0
  );
}

export function calcInvoiceTotal(items: InvoiceLineItemDraft[]): number {
  return Math.round((calcInvoiceSubtotal(items) + calcInvoiceTaxAmount(items)) * 100) / 100;
}

export function defaultTaxRateForCategory(category: string): number {
  return String(category).toUpperCase() === "RENT" ? 0 : 15;
}

export function emptyInvoiceLine(defaultRent?: number, sortOrder = 1): InvoiceLineItemDraft {
  const amt = defaultRent != null && Number.isFinite(defaultRent) ? defaultRent : 0;
  return {
    description: "Monthly Rent",
    category: "RENT",
    quantity: 1,
    unitPrice: amt,
    total: amt,
    sortOrder,
    taxRate: 0
  };
}

export function categoryOptionValue(category: string, description?: string): string {
  const desc = (description ?? "").trim().toLowerCase();
  if (category === "UTILITIES_RECOVERY") {
    if (desc.includes("waste")) return "UTILITIES_RECOVERY:WASTE";
    if (desc.includes("electric")) return "UTILITIES_RECOVERY:ELECTRICITY";
    return "UTILITIES_RECOVERY:WATER";
  }
  if (category === "OTHER" && desc.includes("maintenance")) return "OTHER:MAINTENANCE";
  return category;
}

export function categoryOptionLabel(optionValue: string): string {
  const opt = INVOICE_LINE_CATEGORY_OPTIONS.find((o) => o.value === optionValue);
  return opt?.label ?? optionValue;
}

export function resolveCategoryFromOption(optionValue: string): { category: string; defaultDescription?: string } {
  const opt = INVOICE_LINE_CATEGORY_OPTIONS.find((o) => o.value === optionValue);
  if (!opt) return { category: optionValue };
  const category = "category" in opt && opt.category ? opt.category : opt.value.split(":")[0];
  return { category, defaultDescription: opt.defaultDescription };
}

export function resolveCategoryFromOptionWithTax(optionValue: string): {
  category: string;
  defaultDescription?: string;
  taxRate: number;
} {
  const base = resolveCategoryFromOption(optionValue);
  return { ...base, taxRate: defaultTaxRateForCategory(base.category) };
}

export function patchInvoiceLineItem(
  row: InvoiceLineItemDraft,
  patch: Partial<InvoiceLineItemDraft>
): InvoiceLineItemDraft {
  const next = { ...row, ...patch };
  if (patch.category != null || patch.taxRate != null) {
    next.taxRate = effectiveLineTaxRate(next.category, next.taxRate);
  }
  next.total = lineItemIncVatAmount(next.quantity, next.unitPrice, next.category, next.taxRate);
  return next;
}

export function mapDbLineItem(row: Record<string, unknown>, index: number): InvoiceLineItemDraft {
  const category = String(row.category ?? "OTHER");
  const description = String(row.description ?? "");
  return {
    description,
    category,
    quantity: Number(row.quantity ?? 1),
    unitPrice: Number(row.unitPrice ?? row.unit_price ?? 0),
    total: Number(row.total ?? row.amount ?? 0),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? index + 1),
    taxRate: effectiveLineTaxRate(category, Number(row.taxRate ?? row.tax_rate ?? 0))
  };
}

export function sortInvoiceLineItems(items: InvoiceLineItemDraft[]): InvoiceLineItemDraft[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function reindexLineItems(items: InvoiceLineItemDraft[]): InvoiceLineItemDraft[] {
  return items.map((row, i) => ({ ...row, sortOrder: i + 1 }));
}

export function moveLineItem(items: InvoiceLineItemDraft[], fromIndex: number, toIndex: number): InvoiceLineItemDraft[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [row] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, row);
  return reindexLineItems(next);
}

/** Payload shape for `create_invoice_with_line_items` / `update_invoice_with_line_items`. */
export function invoiceLineItemsForSave(items: InvoiceLineItemDraft[]): Record<string, unknown>[] {
  return reindexLineItems(items).map((li, index) => ({
    description: li.description.trim() || "Line item",
    category: li.category,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    total: lineItemAmount(li.quantity, li.unitPrice),
    sortOrder: li.sortOrder ?? index + 1
  }));
}
