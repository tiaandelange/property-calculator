import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { db } from "../../config/db.js";
import type { CalculatorResult, ChartData } from "../../utils/calculatorTypes.js";

const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 400, backgroundColour: "white" });

const m = (l: number, t: number, r: number, b: number) => [l, t, r, b] as [number, number, number, number];

const TRANSFER_BOND_DISCLAIMER =
  "This is an estimate and not legal, tax or financial advice. Confirm costs with your conveyancer, bank and SARS.";

function formatZar(n: number): string {
  const v = Math.round((Number(n) || 0) + Number.EPSILON);
  return `R ${v.toLocaleString("en-ZA")}`;
}

function kvTable(rows: [string, string][]): Content {
  return {
    table: { widths: ["38%", "*"], body: rows.map(([k, v]) => [k, v]) },
    layout: "lightHorizontalLines",
    margin: m(0, 0, 0, 8)
  };
}

function buildTransferBondPdfSections(
  input: Record<string, unknown>,
  breakdown: Record<string, unknown>,
  assumptionsUsed: Record<string, unknown>
): Content[] {
  const inp = breakdown.input as Record<string, unknown> | undefined;
  const tc = breakdown.transferCosts as Record<string, unknown> | undefined;
  const bc = breakdown.bondCosts as Record<string, unknown> | undefined;
  const totals = breakdown.totals as Record<string, unknown> | undefined;
  if (!inp || !tc || !bc || !totals) return [];

  const assumptions = Array.isArray(assumptionsUsed?.assumptions) ? (assumptionsUsed.assumptions as string[]) : [];

  const inputRows: [string, string][] = [
    ["Purchase price", formatZar(Number(input.purchasePrice))],
    ["Market value (if supplied)", input.marketValue != null ? formatZar(Number(input.marketValue)) : "—"],
    ["Property value used for duty / Deeds transfer", formatZar(Number(inp.propertyValueUsed))],
    ["Bond amount", formatZar(Number(inp.bondAmount))],
    ["Deposit amount", formatZar(Number(inp.depositAmount))],
    ["Transaction type", String(inp.transactionType ?? "")],
    ["Buyer type", String(inp.buyerType ?? "")],
    ["Include bond registration", inp.includeBondRegistration === true ? "Yes" : "No"],
    ["Attorney fee mode", String(inp.attorneyFeeMode ?? "")],
    ["Fee year (Deeds Office table)", String(inp.feeYear ?? assumptionsUsed.feeYear ?? "")],
    ["VAT rate (%)", String(assumptionsUsed.vatRatePercent ?? input.vatRate ?? "—")],
    ["Include deposit in cash-required total", inp.includeDepositInCashRequired === true ? "Yes" : "No"]
  ];
  if (input.province) inputRows.push(["Province", String(input.province)]);
  if (input.municipality) inputRows.push(["Municipality", String(input.municipality)]);

  return [
    { text: "Input summary", style: "subheader", margin: m(0, 8, 0, 0) },
    kvTable(inputRows),

    { text: "Transfer duty", style: "subheader" },
    {
      text: `Based on property value used (${formatZar(Number(inp.propertyValueUsed))}) and transaction type ${String(inp.transactionType)}.`,
      margin: m(0, 0, 0, 4)
    },
    { text: `Transfer duty (estimate): ${formatZar(Number(tc.transferDuty))}`, bold: true, margin: m(0, 0, 0, 10) },

    { text: "Transfer cost breakdown", style: "subheader" },
    kvTable([
      ["Transfer duty", formatZar(Number(tc.transferDuty))],
      ["Transfer attorney fee (ex VAT)", formatZar(Number(tc.transferAttorneyFee))],
      ["VAT on transfer attorney fee", formatZar(Number(tc.transferAttorneyFeeVat))],
      ["Deeds Office transfer fee", formatZar(Number(tc.deedsOfficeTransferFee))],
      ["Municipal / rates clearance provision", formatZar(Number(tc.municipalRatesClearanceProvision))],
      ["Postages & petties (estimate)", formatZar(Number(tc.postagesAndPettiesEstimate))],
      ["FICA fee (estimate)", formatZar(Number(tc.ficaFeeEstimate))],
      ["Deeds search fee (estimate)", formatZar(Number(tc.deedsSearchFeeEstimate))],
      ["Electronic instruction fee (estimate)", formatZar(Number(tc.electronicInstructionFeeEstimate))],
      ["Transfer subtotal", formatZar(Number(tc.transferSubtotal))]
    ]),

    { text: "Bond registration cost breakdown", style: "subheader", margin: m(0, 10, 0, 0) },
    kvTable([
      ["Bond attorney fee (ex VAT)", formatZar(Number(bc.bondAttorneyFee))],
      ["VAT on bond attorney fee", formatZar(Number(bc.bondAttorneyFeeVat))],
      ["Deeds Office bond registration fee", formatZar(Number(bc.deedsOfficeBondFee))],
      ["Bond admin fees", formatZar(Number(bc.bondAdminFees))],
      ["Bond subtotal", formatZar(Number(bc.bondSubtotal))]
    ]),

    { text: "Totals", style: "subheader", margin: m(0, 10, 0, 0) },
    kvTable([
      ["Total transfer costs", formatZar(Number(totals.totalTransferCosts))],
      ["Total bond registration costs", formatZar(Number(totals.totalBondRegistrationCosts))],
      ["Total transfer and bond costs", formatZar(Number(totals.totalTransferAndBondCosts))],
      ["Deposit (reference)", formatZar(Number(totals.depositAmount))],
      ["Total cash required (excl. deposit)", formatZar(Number(totals.totalCashRequiredExcludingDeposit))],
      ["Total cash required (incl. deposit if enabled)", formatZar(Number(totals.totalCashRequiredIncludingDeposit))],
      ["Total acquisition cost (purchase + costs)", formatZar(Number(totals.totalAcquisitionCost))]
    ]),

    ...(assumptions.length
      ? [
          { text: "Assumptions", style: "subheader", margin: m(0, 10, 0, 0) },
          { ul: assumptions, margin: m(0, 0, 0, 8) }
        ]
      : [])
  ];
}

export async function buildCalculationReportPdfDefinition(opts: {
  calculationId: number;
  userId: number;
  scenarioNameOverride?: string | null;
}): Promise<{ ok: true; definition: TDocumentDefinitions; scenarioName: string | null } | { ok: false; status: 404; message: string }> {
  const calc = await db.calculation.findFirst({
    where: { id: opts.calculationId, user_id: opts.userId }
  });
  if (!calc) return { ok: false, status: 404, message: "Not found" };

  const input = JSON.parse(calc.input_json) as Record<string, unknown>;
  const result = JSON.parse(calc.result_json) as CalculatorResult | Record<string, unknown>;

  const asCalc = (result as any)?.calculator ? (result as CalculatorResult) : null;
  const scenarioName = opts.scenarioNameOverride ?? asCalc?.scenarioName ?? (input as any)?.scenarioName ?? null;
  const interpretationText = asCalc?.interpretation?.text ?? "No interpretation available.";
  const warnings = asCalc?.interpretation?.warnings ?? [];
  const assumptionsUsed = asCalc?.assumptionsUsed ?? {};
  const breakdown = asCalc?.breakdown ?? result;

  const isTransferBond = calc.type === "transfer-bond-costs";
  const transferBondSections = isTransferBond
    ? buildTransferBondPdfSections(input, breakdown as Record<string, unknown>, assumptionsUsed as Record<string, unknown>)
    : [];

  const firstChart: ChartData | null = asCalc?.chartData?.[0] ?? null;
  const chartImage = firstChart
    ? await chartCanvas.renderToDataURL({
        type: firstChart.chartType,
        data: firstChart.data as any,
        options: firstChart.options as any
      })
    : await chartCanvas.renderToDataURL({
        type: "bar",
        data: {
          labels: ["No chart data"],
          datasets: [{ label: "N/A", data: [1], backgroundColor: "#007acc" }]
        }
      });

  const user = await db.user.findUnique({
    where: { id: opts.userId },
    select: { name: true, email: true }
  });

  const disclaimerText = isTransferBond
    ? TRANSFER_BOND_DISCLAIMER
    : "This report is an estimate for educational purposes and is not financial, tax or legal advice.";

  const definition: TDocumentDefinitions = {
    info: { title: `PropLytics Report — ${calc.type}` },
    content: [
      { text: "PropLytics", style: "brand" },
      { text: "(logo placeholder — replace with asset under backend/assets/images)", style: "muted", margin: m(0, 0, 0, 8) },
      { text: "South African Property Investment Report", style: "tagline" },
      { text: `Report calculation ID: ${calc.id}`, margin: m(0, 8, 0, 0) },
      { text: `Generated: ${new Date().toISOString()}` },
      { text: `Prepared for: ${user?.name ?? user?.email ?? "Member"}` },
      { text: `Calculator: ${calc.type}`, margin: m(0, 8, 0, 0) },
      { text: `Scenario: ${scenarioName ?? "Untitled scenario"}`, margin: m(0, 4, 0, 8) },
      ...(isTransferBond && transferBondSections.length
        ? transferBondSections
        : [
            { text: "Inputs", style: "subheader" },
            { text: JSON.stringify(input, null, 2), style: "code" },
            { text: "Detailed breakdown (intermediate calculations)", style: "subheader", margin: m(0, 10, 0, 0) },
            { text: JSON.stringify(breakdown, null, 2), style: "code" }
          ]),
      { text: "Outputs (summary metrics)", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: JSON.stringify(asCalc?.summary ?? result, null, 2), style: "code" },
      { text: "Interpretation", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: interpretationText },
      ...(warnings.length
        ? [{ text: "Warnings", style: "subheader", margin: m(0, 10, 0, 0) }, { text: warnings.map((w: string) => `- ${w}`).join("\n") }]
        : []),
      ...(isTransferBond
        ? []
        : [
            { text: "Assumptions (raw)", style: "subheader", margin: m(0, 10, 0, 0) },
            { text: JSON.stringify(assumptionsUsed, null, 2), style: "code" }
          ]),
      { text: "Chart Summary", style: "subheader", margin: m(0, 10, 0, 4) },
      { image: chartImage, width: 480 },
      {
        text: `Disclaimer: ${disclaimerText}`,
        margin: m(0, 16, 0, 0)
      }
    ],
    styles: {
      brand: { fontSize: 22, bold: true, color: "#1a56db" },
      muted: { fontSize: 9, color: "#666666" },
      tagline: { fontSize: 12, color: "#333333" },
      subheader: { fontSize: 14, bold: true, margin: [0, 12, 0, 6] },
      code: { fontSize: 9 }
    },
    defaultStyle: { font: "Roboto" }
  };

  return { ok: true, definition, scenarioName };
}
