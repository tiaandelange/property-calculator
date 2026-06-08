/**
 * Transparent investment rating for Property Investment Report PDFs.
 * Server-side only — not used by dashboard UI.
 */

import { formatPdfZar } from "./pdf/pdfFormat.js";

export type PdfInvestmentRatingLabel =
  | "Strong"
  | "Good"
  | "Needs Review"
  | "Weak"
  | "Insufficient Data";

export type PdfInvestmentRating = {
  label: PdfInvestmentRatingLabel;
  summary: string;
  reasons: string[];
  advancedMetricsComplete: boolean;
  warnings: string[];
  totalCashInvestedResolved: boolean;
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
  totalCashInvested: number | null;
  purchasePrice: number | null;
  meetsFiftyPercentBond: boolean | null;
}): PdfInvestmentRating {
  const warnings: string[] = [];

  const income = opts.monthlyGrossIncome;
  const purchase = opts.purchasePrice;
  const totalCashInvested = opts.totalCashInvested;
  const totalCashInvestedResolved = totalCashInvested != null && totalCashInvested > 0;

  if (income == null || income <= 0) {
    warnings.push("Monthly gross rent is missing or zero.");
  }
  if (purchase == null || purchase <= 0) {
    warnings.push("Purchase price is not set.");
  }
  if (!totalCashInvestedResolved) {
    warnings.push(
      "Cash-on-cash ROI requires deposit, transfer/bond costs, closing costs or other upfront cash investment."
    );
  }

  const irrAvailable = opts.internalRateOfReturn != null && Number.isFinite(opts.internalRateOfReturn);
  const cocAvailable = opts.cashOnCashRoi != null && Number.isFinite(opts.cashOnCashRoi);
  const advancedMetricsComplete = irrAvailable && (cocAvailable || !totalCashInvestedResolved);

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
      reasons: [
        "Key property or income inputs are missing.",
        "Complete purchase price, rent, and expense assumptions before relying on this rating."
      ],
      advancedMetricsComplete: false,
      warnings,
      totalCashInvestedResolved
    };
  }

  const cf = opts.monthlyCashFlow ?? 0;
  const meets50Bond = opts.meetsFiftyPercentBond === true;
  const twoPct = opts.twoPercentRule;
  const grossYield = opts.grossYield;
  const bondPayment = opts.monthlyLoanPayment ?? 0;

  const reasons = buildReasons({
    cashFlow: cf,
    grossYield,
    cashOnCashRoi: opts.cashOnCashRoi,
    cocAvailable,
    twoPct,
    meets50Bond,
    bondPayment,
    monthlyIncome: income
  });

  if (!advancedMetricsComplete && warnings.length > 0) {
    const label: PdfInvestmentRatingLabel = cf > 0 ? "Needs Review" : "Needs Review";
    return {
      label,
      summary: buildSummaryParagraph(label, cf, grossYield, opts.cashOnCashRoi, cocAvailable, twoPct, meets50Bond),
      reasons,
      advancedMetricsComplete,
      warnings,
      totalCashInvestedResolved
    };
  }

  let score = 0;

  if (cf > 0) score += 2;
  else if (cf < 0) score -= 2;

  if (meets50Bond) score += 2;
  else if (opts.meetsFiftyPercentBond === false) score -= 2;

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

  if (!irrAvailable || (!cocAvailable && totalCashInvestedResolved)) {
    if (label === "Weak") label = "Needs Review";
    else if (label === "Strong") label = "Good";
  }

  return {
    label,
    summary: buildSummaryParagraph(label, cf, grossYield, opts.cashOnCashRoi, cocAvailable, twoPct, meets50Bond),
    reasons,
    advancedMetricsComplete,
    warnings,
    totalCashInvestedResolved
  };
}

function buildReasons(opts: {
  cashFlow: number;
  grossYield: number | null;
  cashOnCashRoi: number | null;
  cocAvailable: boolean;
  twoPct: number | null;
  meets50Bond: boolean;
  bondPayment: number;
  monthlyIncome: number;
}): string[] {
  const reasons: string[] = [];

  if (opts.cashFlow > 0) {
    reasons.push(`Monthly cash flow is positive at ${formatPdfZar(opts.cashFlow)}.`);
  } else if (opts.cashFlow < 0) {
    reasons.push(`Monthly cash flow is negative at ${formatPdfZar(opts.cashFlow)}.`);
  } else {
    reasons.push("Monthly cash flow is break-even.");
  }

  if (opts.grossYield != null) {
    reasons.push(`Gross yield is ${opts.grossYield >= 8 ? "strong" : "moderate"} at ${opts.grossYield.toFixed(2)}%.`);
  }

  if (opts.cocAvailable && opts.cashOnCashRoi != null) {
    reasons.push(
      `CoC ROI is ${opts.cashOnCashRoi >= 8 ? "strong" : "moderate"} at ${opts.cashOnCashRoi.toFixed(2)}%.`
    );
  }

  if (opts.twoPct != null) {
    if (opts.twoPct >= 2) {
      reasons.push(`2% rule is met at ${opts.twoPct.toFixed(2)}%.`);
    } else {
      reasons.push(`2% rule is below target at ${opts.twoPct.toFixed(2)}%.`);
    }
  }

  if (opts.bondPayment > 0 && opts.monthlyIncome > 0) {
    if (opts.meets50Bond) {
      reasons.push("50% rule is achieved because 50% of monthly income exceeds the bond payment.");
    } else {
      reasons.push(
        "50% rule is not achieved because 50% of monthly income is below the bond payment."
      );
    }
  }

  return reasons;
}

function buildSummaryParagraph(
  label: PdfInvestmentRatingLabel,
  cashFlow: number,
  grossYield: number | null,
  cashOnCashRoi: number | null,
  cocAvailable: boolean,
  twoPct: number | null,
  meets50Bond: boolean
): string {
  const parts: string[] = [`Investment rating: ${label}.`];

  if (cashFlow > 0) {
    parts.push(`Monthly cash flow is positive at ${formatPdfZar(cashFlow)}.`);
  } else if (cashFlow < 0) {
    parts.push(`Monthly cash flow is negative at ${formatPdfZar(cashFlow)}.`);
  } else {
    parts.push("Monthly cash flow is break-even.");
  }

  if (grossYield != null) {
    parts.push(`Gross yield is ${grossYield.toFixed(2)}%`);
  }
  if (cocAvailable && cashOnCashRoi != null) {
    parts.push(`and CoC ROI is ${cashOnCashRoi.toFixed(2)}%.`);
  } else if (grossYield != null) {
    parts.push(".");
  }

  if (twoPct != null) {
    if (twoPct >= 2) {
      parts.push(`The 2% rule is met at ${twoPct.toFixed(2)}%.`);
    } else {
      parts.push(`The 2% rule is below target at ${twoPct.toFixed(2)}%.`);
    }
  }

  if (meets50Bond) {
    parts.push("The 50% rule is achieved because 50% of monthly income exceeds the bond payment.");
  } else {
    parts.push(
      "The 50% rule is not achieved because 50% of monthly income is below the bond payment."
    );
  }

  return parts.join(" ");
}

export function buildExecutiveSummary(rating: PdfInvestmentRating): string[] {
  const paragraphs: string[] = [rating.summary];
  if (!rating.advancedMetricsComplete) {
    paragraphs.push(
      "Advanced metrics (IRR and/or cash-on-cash ROI) are incomplete or require review before making investment decisions."
    );
  }
  if (rating.totalCashInvestedResolved) {
    paragraphs.push(
      "Cash-on-cash ROI is calculated using total upfront cash invested, including recorded transaction costs."
    );
  } else if (rating.warnings.some((w) => /cash-on-cash/i.test(w))) {
    paragraphs.push(
      "Cash-on-cash ROI requires deposit, transfer/bond costs, closing costs or other upfront cash investment."
    );
  } else if (rating.warnings.length > 0) {
    paragraphs.push(`Data note: ${rating.warnings[0]}`);
  }
  return paragraphs;
}
