/**
 * Global PDF template system — reusable across invoices, statements, reports, and leases.
 * Server-side only (Vercel functions + pdfmake).
 */

export { buildGlobalPdfTheme, validateHexColor, accentPrimaryHex, type GlobalPdfTheme, type PdfThemeInput } from "./globalPdfTheme.js";
export {
  PDF_PAGE_MARGINS,
  PDF_SPACING,
  pdfMargin,
  pdfDivider,
  buildDefaultPdfStyles,
  brandedHeader,
  reportHeader,
  recipientBlock,
  documentSummaryStrip,
  detailsTable,
  dataTable,
  metricCard,
  sectionCard,
  chartCard,
  totalsBlock,
  bankingDetailsBlock,
  notesBlock,
  buildPdfFooter,
  buildReportFooter,
  emptyChartState,
  EMPTY_CHART_MESSAGE,
  type PdfDocumentKind
} from "./globalPdfLayout.js";
export {
  CALCULATOR_FIELD_LABELS,
  buildCalculatorPropertyInformationRows,
  buildCalculatorIncomeExpenseRows,
  buildCalculatorLoanAssumptionRows,
  formatReportFieldValue,
  getReportFieldLabel
} from "./reportDisplayMapper.js";
export { buildInvoicePdfDocumentDefinition } from "./invoicePdfTemplate.js";
export { mapToInvoicePdfDocument, type InvoicePdfBuildContext } from "./invoicePdfDataMapper.js";
export type { InvoicePdfDocumentData } from "./invoicePdfTypes.js";
export { loadProplyticLogoDataUrl } from "./pdfLogoAsset.js";
export { formatPdfZar, formatPdfDate } from "./pdfFormat.js";
