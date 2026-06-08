/**
 * Transparent investment rating for Property Investment Report PDFs.
 * Server-side only — not used by dashboard UI.
 */

export type PdfInvestmentRatingLabel =
  | "Strong"
  | "Good"
  | "Needs Review"
  | "Weak"
  | "Insufficient Data";

export type PdfInvestmentRating = {
  label: PdfInvestmentRatingLabel;
  summary: string;
  advancedMetricsComplete: boolean;
  warnings: string[];
};

export function derivePdfInvestmentRating(opts: {
  monthlyGrossIncome: number | null;
  monthlyCashFlow: number | null;
  monthlyOperatingExpenses: number | null;
  monthlyLoanPayment: number | null;
  grossYield: number | null;
  twoPercentRule: number | null;
  cashOnCashRoi: number | null;
  internalRateOfReturn: number | null;
  cashInvested: number | null;
  purchasePrice: number | null;
  meetsFiftyPercentOperating: boolean | null;
  ruleCashFlow: number | null;
}): PdfInvestmentRating {
  const warnings: string[] = [];

  const income = opts.monthlyGrossIncome;
  const purchase = opts.purchasePrice;
  const cashInvested = opts.cashInvested;

  if (income == null || income <= 0) {
    warnings.push("Monthly gross rent is missing or zero.");
  }
  if (purchase == null || purchase <= 0) {
    warnings.push("Purchase price is not set.");
  }
  if (cashInvested == null || cashInvested <= 0) {
    warnings.push("Cash invested / deposit is not recorded — cash-on-cash ROI cannot be calculated.");
  }

  const irrAvailable = opts.internalRateOfReturn != null && Number.isFinite(opts.internalRateOfReturn);
  const cocAvailable = opts.cashOnCashRoi != null && Number.isFinite(opts.cashOnCashRoi);
  const advancedMetricsComplete = irrAvailable && (cocAvailable || cashInvested == null || cashInvested <= 0);

  if (!irrAvailable) {
    warnings.push("IRR could not be calculated reliably for this scenario.");
  }

  const criticalGaps =
    income == null ||
    income <= 0 ||
    purchase == null ||
    purchase <= 0 ||
    opts.monthlyOperatingExpenses == null;

  if (criticalGaps) {
    return {
      label: "Insufficient Data",
      summary:
        "Key property or income inputs are missing. Complete purchase price, rent, and expense assumptions before relying on this rating.",
      advancedMetricsComplete: false,
      warnings
    };
  }

  const cf = opts.monthlyCashFlow ?? 0;
  const meets50Operating = opts.meetsFiftyPercentOperating === true;
  const ruleCf = opts.ruleCashFlow;
  const meets50Overall =
    meets50Operating && (ruleCf == null || ruleCf >= 0);

  const twoPct = opts.twoPercentRule;
  const grossYield = opts.grossYield;

  if (!advancedMetricsComplete && warnings.length > 0) {
    const label: PdfInvestmentRatingLabel = meets50Overall && cf > 0 ? "Needs Review" : "Needs Review";
    return {
      label,
      summary: buildSummary(label, cf, meets50Overall, twoPct, grossYield, cocAvailable, irrAvailable),
      advancedMetricsComplete,
      warnings
    };
  }

  let score = 0;

  if (cf > 0) score += 2;
  else if (cf < 0) score -= 2;

  if (meets50Overall) score += 2;
  else if (opts.meetsFiftyPercentOperating === false) score -= 2;
  else if (ruleCf != null && ruleCf < 0) score -= 1;

  if (twoPct != null && twoPct >= 2) score += 1;
  else if (twoPct != null && twoPct < 1) score -= 1;

  if (grossYield != null && grossYield >= 8) score += 1;
  else if (grossYield != null && grossYield < 5) score -= 1;

  if (cocAvailable && (opts.cashOnCashRoi ?? 0) >= 8) score += 1;
  else if (cocAvailable && (opts.cashOnCashRoi ?? 0) < 3) score -= 1;

  if (irrAvailable && (opts.internalRateOfReturn ?? 0) >= 10) score += 1;

  let label: PdfInvestmentRatingLabel;
  if (score >= 5) label = "Strong";
  else if (score >= 2) label = "Good";
  else if (score >= 0) label = "Needs Review";
  else label = "Weak";

  if (!irrAvailable || (!cocAvailable && cashInvested != null && cashInvested > 0)) {
    if (label === "Weak") label = "Needs Review";
    else if (label === "Strong") label = "Good";
  }

  return {
    label,
    summary: buildSummary(label, cf, meets50Overall, twoPct, grossYield, cocAvailable, irrAvailable),
    advancedMetricsComplete,
    warnings
  };
}

function buildSummary(
  label: PdfInvestmentRatingLabel,
  cashFlow: number,
  meets50: boolean,
  twoPct: number | null,
  grossYield: number | null,
  cocAvailable: boolean,
  irrAvailable: boolean
): string {
  const parts: string[] = [];
  parts.push(`Overall rating: ${label}.`);
  parts.push(cashFlow > 0 ? "Monthly cash flow is positive." : cashFlow < 0 ? "Monthly cash flow is negative." : "Monthly cash flow is break-even.");
  parts.push(meets50 ? "Operating costs meet the 50% rule after debt service." : "Operating costs or rule cash flow do not fully meet the 50% rule.");
  if (twoPct != null) parts.push(`2% rule: ${twoPct.toFixed(2)}% of purchase price.`);
  if (grossYield != null) parts.push(`Gross yield: ${grossYield.toFixed(2)}%.`);
  if (!cocAvailable) parts.push("Cash-on-cash ROI requires a recorded cash investment.");
  if (!irrAvailable) parts.push("IRR requires review or additional inputs.");
  return parts.join(" ");
}

export function buildExecutiveSummary(rating: PdfInvestmentRating): string[] {
  const paragraphs: string[] = [
    `Investment rating: ${rating.label}. ${rating.summary}`
  ];
  if (!rating.advancedMetricsComplete) {
    paragraphs.push(
      "Advanced metrics (IRR and/or cash-on-cash ROI) are incomplete or require review before making investment decisions."
    );
  }
  if (rating.warnings.length > 0) {
    paragraphs.push(`Data note: ${rating.warnings[0]}`);
  }
  return paragraphs;
}
