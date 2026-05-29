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

export type NormalizedPropertyBondFields = {
  outstandingBondBalance: number | null;
  monthlyBondPayment: number | null;
  bondAnnualInterestRatePercent: number | null;
  bondTermYears: number | null;
  bondStartDate: string | Date | null;
  bondRemainingTermMonths: number | null;
  bondInterestPortionOverride: number | null;
  bondPrincipalPortionOverride: number | null;
};

export type MapPropertyBondPaymentOptions = {
  asOf?: Date;
  statementBondFinance?: Record<string, unknown> | null;
};

function pickNum(source: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const raw = source[key];
    if (raw === "" || raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickDate(source: Record<string, unknown>, ...keys: string[]): string | Date | null {
  for (const key of keys) {
    const raw = source[key];
    if (raw == null || raw === "") continue;
    return raw as string | Date;
  }
  return null;
}

/** Reads bond profile fields from camelCase or snake_case property rows. */
export function normalizePropertyBondFields(source: Record<string, unknown> | null): NormalizedPropertyBondFields {
  const s = source ?? {};
  return {
    outstandingBondBalance: pickNum(s, "outstandingBondBalance", "outstanding_bond_balance"),
    monthlyBondPayment: pickNum(s, "monthlyBondPayment", "monthly_bond_payment"),
    bondAnnualInterestRatePercent: pickNum(s, "bondAnnualInterestRatePercent", "bond_annual_interest_rate_percent"),
    bondTermYears: pickNum(s, "bondTermYears", "bond_term_years"),
    bondStartDate: pickDate(s, "bondStartDate", "bond_start_date"),
    bondRemainingTermMonths: pickNum(s, "bondRemainingTermMonths", "bond_remaining_term_months"),
    bondInterestPortionOverride: pickNum(s, "bondInterestPortionOverride", "bond_interest_portion_override"),
    bondPrincipalPortionOverride: pickNum(s, "bondPrincipalPortionOverride", "bond_principal_portion_override")
  };
}

/** True when any bond profile field is set on the property (same signals as Add / Edit property). */
export function propertyHasBondProfile(fields: NormalizedPropertyBondFields): boolean {
  if ((fields.outstandingBondBalance ?? 0) > 0) return true;
  if ((fields.monthlyBondPayment ?? 0) > 0) return true;
  if ((fields.bondAnnualInterestRatePercent ?? 0) > 0) return true;
  if (fields.bondTermYears != null && fields.bondTermYears > 0) return true;
  if (fields.bondRemainingTermMonths != null && fields.bondRemainingTermMonths > 0) return true;
  const sd = fields.bondStartDate;
  return sd != null && String(sd).trim() !== "";
}

/** Fill gaps from statement RPC bondFinance when the property row is partial. */
export function mergeBondFieldsFromStatement(
  fields: NormalizedPropertyBondFields,
  bondFinance: Record<string, unknown> | null | undefined
): NormalizedPropertyBondFields {
  if (!bondFinance) return fields;
  const next = { ...fields };

  if (!(next.outstandingBondBalance != null && next.outstandingBondBalance > 0)) {
    const bal = pickNum(bondFinance, "outstandingBalance");
    if (bal != null && bal > 0) next.outstandingBondBalance = bal;
  }
  if (!(next.monthlyBondPayment != null && next.monthlyBondPayment > 0)) {
    const pmt = pickNum(bondFinance, "monthlyBondPaymentStored", "paymentThisMonth");
    if (pmt != null && pmt > 0) next.monthlyBondPayment = pmt;
  }
  if (!(next.bondAnnualInterestRatePercent != null && next.bondAnnualInterestRatePercent > 0)) {
    const rate = pickNum(bondFinance, "annualInterestRatePercent");
    if (rate != null && rate > 0) next.bondAnnualInterestRatePercent = rate;
  }
  if (!(next.bondTermYears != null && next.bondTermYears > 0)) {
    const ty = pickNum(bondFinance, "bondTermYears");
    if (ty != null && ty > 0) next.bondTermYears = ty;
  }
  if (next.bondStartDate == null || String(next.bondStartDate).trim() === "") {
    const sd = pickDate(bondFinance, "bondStartDate");
    if (sd != null) next.bondStartDate = sd;
  }
  if (!(next.bondRemainingTermMonths != null && next.bondRemainingTermMonths > 0)) {
    const rem = pickNum(bondFinance, "remainingTermMonths");
    if (rem != null && rem > 0) next.bondRemainingTermMonths = rem;
  }

  return next;
}

function resolveMapOptions(third?: MapPropertyBondPaymentOptions | Date): MapPropertyBondPaymentOptions {
  if (third instanceof Date) return { asOf: third };
  return third ?? {};
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

function bondStatus(
  finance: ReturnType<typeof computePropertyBondFinance>,
  balance: number
): {
  status: BondPaymentDisplayItem["status"];
  statusLabel: string;
} {
  const hasPaymentSignal = finance.paymentThisMonth > 0 || (finance.monthlyBondPaymentStored ?? 0) > 0;
  if (!(balance > 0) && !hasPaymentSignal) {
    return { status: "incomplete", statusLabel: "Incomplete" };
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
  options?: MapPropertyBondPaymentOptions | Date
): BondPaymentDisplayItem[] {
  const { asOf = new Date(), statementBondFinance = null } = resolveMapOptions(options);

  let fields = normalizePropertyBondFields(property);
  fields = mergeBondFieldsFromStatement(fields, statementBondFinance);

  if (!propertyHasBondProfile(fields)) return [];

  const finance = computePropertyBondFinance(fields, asOf);
  const balance = Math.max(0, Number(fields.outstandingBondBalance ?? finance.outstandingBalance ?? 0));
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
      outstandingBalance: balance > 0 ? balance : finance.outstandingBalance,
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
