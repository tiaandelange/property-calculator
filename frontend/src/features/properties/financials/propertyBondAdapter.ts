import { computePropertyBondFinance } from "../../../../api/lib/bondHelpers";

export type BondPaymentDisplayItem = {
  id: string;
  name: string;
  termLabel: string;
  interestRateLabel: string;
  monthlyPayment: number;
  monthlyPaymentHint: string | null;
  outstandingBalance: number;
  status: "active" | "incomplete" | "none";
  statusLabel: string;
};

function bondPropertyInput(property: Record<string, unknown>) {
  return {
    outstandingBondBalance: property.outstandingBondBalance as number | null | undefined,
    monthlyBondPayment: property.monthlyBondPayment as number | null | undefined,
    bondAnnualInterestRatePercent: property.bondAnnualInterestRatePercent as number | null | undefined,
    bondTermYears: property.bondTermYears as number | null | undefined,
    bondStartDate: property.bondStartDate as string | Date | null | undefined,
    bondRemainingTermMonths: property.bondRemainingTermMonths as number | null | undefined,
    bondInterestPortionOverride: property.bondInterestPortionOverride as number | null | undefined,
    bondPrincipalPortionOverride: property.bondPrincipalPortionOverride as number | null | undefined
  };
}

function termLabelFromFinance(finance: ReturnType<typeof computePropertyBondFinance>): string {
  if (
    finance.bondTermYears != null &&
    finance.remainingTermMonths != null &&
    finance.remainingFromSchedule
  ) {
    return `${finance.bondTermYears} years · ${finance.remainingTermMonths} months left`;
  }
  if (finance.remainingTermMonths != null && finance.remainingTermMonths > 0) {
    return `${finance.remainingTermMonths} months remaining`;
  }
  if (finance.bondTermYears != null) {
    return `${finance.bondTermYears} years`;
  }
  if (finance.totalBondTermMonths != null && finance.totalBondTermMonths > 0) {
    return `${finance.totalBondTermMonths} months total`;
  }
  return "—";
}

function bondStatus(finance: ReturnType<typeof computePropertyBondFinance>, balance: number): {
  status: BondPaymentDisplayItem["status"];
  statusLabel: string;
} {
  if (!(balance > 0)) {
    return { status: "none", statusLabel: "No bond" };
  }
  const hasRate = finance.annualInterestRatePercent != null && finance.annualInterestRatePercent > 0;
  const hasTerm = finance.remainingTermMonths != null && finance.remainingTermMonths > 0;
  const hasPayment = finance.paymentThisMonth > 0;
  if (!hasRate || !hasTerm || !hasPayment) {
    return { status: "incomplete", statusLabel: "Incomplete" };
  }
  return { status: "active", statusLabel: "Active" };
}

/** One bond row derived from property profile fields (Add / Edit property). */
export function mapPropertyBondPayment(
  property: Record<string, unknown> | null,
  propertyName: string,
  asOf = new Date()
): BondPaymentDisplayItem[] {
  if (!property) return [];

  const balance = Math.max(0, Number(property.outstandingBondBalance ?? 0));
  if (!(balance > 0)) return [];

  const finance = computePropertyBondFinance(bondPropertyInput(property), asOf);
  const { status, statusLabel } = bondStatus(finance, balance);

  const rate = finance.annualInterestRatePercent;
  const interestRateLabel = rate != null && rate > 0 ? `${rate.toFixed(2)}% p.a.` : "—";

  let monthlyPaymentHint: string | null = null;
  if (finance.monthlyBondPaymentStored != null && finance.calculatedMonthlyPayment != null) {
    const stored = Math.round(Number(finance.monthlyBondPaymentStored) * 100);
    const calc = Math.round(Number(finance.calculatedMonthlyPayment) * 100);
    if (stored !== calc) {
      monthlyPaymentHint = `Calculated ${formatZar(finance.calculatedMonthlyPayment)}`;
    }
  } else if (finance.monthlyBondPaymentStored == null && finance.calculatedMonthlyPayment != null) {
    monthlyPaymentHint = "From amortisation";
  }

  const label = propertyName.trim() ? `${propertyName.trim()} bond` : "Home loan bond";

  return [
    {
      id: "property-bond",
      name: label,
      termLabel: termLabelFromFinance(finance),
      interestRateLabel,
      monthlyPayment: finance.paymentThisMonth,
      monthlyPaymentHint,
      outstandingBalance: finance.outstandingBalance,
      status,
      statusLabel
    }
  ];
}

function formatZar(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}
