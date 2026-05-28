import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chart as ChartJS, ArcElement, Legend, Tooltip } from "chart.js";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import {
  buildPropertyFinancialOverview,
  mapRecurringCharges,
  type RecurringExpenseDisplayItem
} from "../financials/propertyFinancialsAdapter";
import { PropertyFinancialMetricCards } from "../financials/PropertyFinancialMetricCards";
import {
  PropertyFinancialDetailsForm,
  type FinancialDetailsFormState
} from "../financials/PropertyFinancialDetailsForm";
import { RecurringExpensesSection } from "../financials/RecurringExpensesSection";
import { PropertyFinancialSummaryPanel } from "../financials/PropertyFinancialSummaryPanel";
import { ExpenseCategoriesCard } from "../financials/ExpenseCategoriesCard";
import { RecurringExpenseModal } from "../financials/RecurringExpenseModal";
import { propertyFinancialsStatementUrl } from "../../financials/financialDirectoryUtils";

ChartJS.register(ArcElement, Tooltip, Legend);
import { Card } from "../../../components/ui/Card";
import { Field, Input } from "../../../components/ui/Input";
import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab } from "../../../api/pdfBlob";
import { isSupabaseConfigured } from "../../../lib/supabaseClient";
import { generateReportViaVercel } from "../../../services/reportsVercel";
import {
  backfillBondStatementRows,
  createCurrentInvoiceFromLease,
  generateInvoicePdf,
  createPropertyExpense,
  deletePropertyExpense,
  hardDeleteInvoice,
  hardDeletePropertyExpense,
  hardDeletePropertyIncome,
  postBondStatementRow,
  propertyApiErrorMessage,
  updateInvoice,
  updateLease,
  updateProperty,
  updatePropertyExpense,
  updatePropertyIncome
} from "../../../api/ownedProperties";

const PROPERTY_EXPENSE_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "RATES_TAXES", label: "Rates and Taxes" },
  { value: "WATER", label: "Water" },
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "LEVIES", label: "Levies" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "REPAIRS", label: "Repairs" },
  { value: "MANAGEMENT_FEES", label: "Management Fees" },
  { value: "BOND_PAYMENT", label: "Bond Payment" },
  { value: "ACCOUNTING", label: "Accounting" },
  { value: "OTHER", label: "Other" }
];

/** Recurring schedules: bond is managed under Financials → Bond payment. */
const RECURRING_SCHEDULE_CATEGORY_OPTIONS = PROPERTY_EXPENSE_CATEGORY_OPTIONS.filter((o) => o.value !== "BOND_PAYMENT");

const BOND_TERM_YEAR_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

type ScheduleEditorState = {
  id: number;
  category: string;
  description: string;
  amount: string;
  recurringStartDate: string;
  recurringEndDate: string;
  recurringOpenEnded: boolean;
  recurringMonthAnchor: "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH";
  recurringDayOfMonth: number;
};

const RECURRING_ANCHOR_OPTIONS: Array<{ value: "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH"; label: string }> = [
  { value: "FIRST_OF_MONTH", label: "1st of the month" },
  { value: "LAST_OF_MONTH", label: "Last day of the month" },
  { value: "DAY_OF_MONTH", label: "Specific calendar day" }
];

/** Stable YYYY-MM-DD for `<input type="date">` carrying a day-of-month (month clamps short months). */
function ymdCarrierForDayDom(day: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const d = Math.min(Math.max(1, Math.floor(day)), dim);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDomFromYmd(ymd: string): number {
  const p = ymd.split("-");
  const dom = Number(p[2]);
  return Number.isFinite(dom) ? Math.min(31, Math.max(1, Math.floor(dom))) : 15;
}

function expenseCategoryLabel(value: string) {
  return PROPERTY_EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function recurringAnchorLabel(value: string, dayDom?: number | null) {
  if (value === "DAY_OF_MONTH" && typeof dayDom === "number" && dayDom >= 1 && dayDom <= 31) {
    return `Day ${dayDom} each month`;
  }
  return RECURRING_ANCHOR_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatIsoDateShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Hide tenant rent / invoice-style rows from landlord charge tabs (legacy API payloads or mistaken expense rows). */
function isTenantFacingChargeForecast(row: {
  description?: unknown;
  label?: unknown;
  kind?: unknown;
  invoiceDescription?: unknown;
}): boolean {
  const kind = String(row.kind ?? "");
  if (["LEASE_RENT", "RECURRING_INVOICE_RULE", "RECURRING_INCOME_RULE"].includes(kind)) return true;
  const text = String(row.description ?? row.label ?? row.invoiceDescription ?? "").trim();
  const tl = text.toLowerCase();
  if (/^expected\s+rent\b/.test(tl)) return true;
  if (/\brecurring\s+income\s+rule\b/.test(tl)) return true;
  if (/^recurring\s+invoice\b/.test(tl)) return true;
  if (/^invoice\s+line\b/.test(tl)) return true;
  if (/^monthly\s+rent\s*$/i.test(text)) return true;
  return false;
}

const PROPERTY_INCOME_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "RENT", label: "Rent" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "LATE_FEE", label: "Late fee" },
  { value: "UTILITIES_RECOVERY", label: "Utilities recovery" },
  { value: "OTHER", label: "Other" }
];

const INCOME_STATUS_OPTIONS = ["EXPECTED", "RECEIVED", "CANCELLED"] as const;

const INVOICE_STATUS_OPTIONS = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;

function IconStatementSave() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block", pointerEvents: "none" }}>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconStatementDiscard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block", pointerEvents: "none" }}>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  propertyId: string;
  finSub: string;
  statement: any | null;
  loading: boolean;
  onReload: () => Promise<void>;
  currentLeases?: any[];
  propertyInvoices?: any[];
  /** Latest property row from workspace detail — bond tab edits PATCH this record. */
  propertyDetail?: Record<string, unknown> | null;
};

export function WorkspaceFinancialsTab({
  propertyId,
  finSub,
  statement,
  loading,
  onReload,
  currentLeases = [],
  propertyInvoices = [],
  propertyDetail = null
}: Props) {
  const navigate = useNavigate();
  const [depositModal, setDepositModal] = useState<{
    leaseId: string | number;
    tenantLabel: string;
    amount: string;
    annualPct: string;
  } | null>(null);
  const [depositSaving, setDepositSaving] = useState(false);
  const defaultExpenseCategory = "ELECTRICITY";
  const todayYmd = () => new Date().toISOString().slice(0, 10);
  /** First calendar day strictly after today (UTC) — aligns with server checks and Future charges list. */
  function nextUtcCalendarDayYmd(): string {
    const d = new Date();
    const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
    return n.toISOString().slice(0, 10);
  }
  const [expenseForm, setExpenseForm] = useState({
    expenseDate: todayYmd(),
    category: defaultExpenseCategory,
    description: expenseCategoryLabel(defaultExpenseCategory),
    amount: ""
  });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [futureExpenseForm, setFutureExpenseForm] = useState(() => {
    const d = new Date();
    const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
    return {
      expenseDate: n.toISOString().slice(0, 10),
      category: defaultExpenseCategory,
      description: expenseCategoryLabel(defaultExpenseCategory),
      amount: ""
    };
  });
  const [futureExpenseSaving, setFutureExpenseSaving] = useState(false);
  const [recurringScheduleForm, setRecurringScheduleForm] = useState({
    recurringStartDate: todayYmd(),
    recurringEndDate: "",
    recurringOpenEnded: true,
    recurringMonthAnchor: "FIRST_OF_MONTH" as "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH",
    recurringDayOfMonth: 15,
    category: defaultExpenseCategory,
    description: expenseCategoryLabel(defaultExpenseCategory),
    amount: ""
  });
  const [recurringScheduleSaving, setRecurringScheduleSaving] = useState(false);
  const [bondSaving, setBondSaving] = useState(false);
  const [bondSaveToStatement, setBondSaveToStatement] = useState(false);
  const [bondStatementDueDate, setBondStatementDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bondBackfillOpen, setBondBackfillOpen] = useState(false);
  const [bondBackfillStart, setBondBackfillStart] = useState("");
  const [bondBackfillEnd, setBondBackfillEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [bondBackfillBusy, setBondBackfillBusy] = useState(false);
  const [bondForm, setBondForm] = useState({
    outstandingBondBalance: "",
    monthlyBondPayment: "",
    bondAnnualInterestRatePercent: "",
    bondTermYears: "",
    bondStartDate: "",
    bondInterestPortionOverride: "",
    bondPrincipalPortionOverride: ""
  });
  const [scheduleEditor, setScheduleEditor] = useState<ScheduleEditorState | null>(null);
  const [scheduleBusyId, setScheduleBusyId] = useState<number | null>(null);
  const [statementEditingRowId, setStatementEditingRowId] = useState<string | null>(null);
  const [statementDraft, setStatementDraft] = useState<Record<string, unknown> | null>(null);
  const statementDraftRef = useRef<Record<string, unknown> | null>(null);
  const statementEditingRowIdRef = useRef<string | null>(null);
  const [statementConfirm, setStatementConfirm] = useState<null | { kind: "save" | "delete"; row: any }>(null);
  const [statementConfirmBusy, setStatementConfirmBusy] = useState(false);
  const [statementFeedback, setStatementFeedback] = useState<string | null>(null);
  const [summaryPdfBusy, setSummaryPdfBusy] = useState(false);
  const [invoicePdfBusyId, setInvoicePdfBusyId] = useState<string | number | null>(null);
  const [invoicePdfBanner, setInvoicePdfBanner] = useState<string | null>(null);
  const [financialDetailsSaving, setFinancialDetailsSaving] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    statementDraftRef.current = statementDraft;
  }, [statementDraft]);
  useEffect(() => {
    statementEditingRowIdRef.current = statementEditingRowId;
  }, [statementEditingRowId]);

  useEffect(() => {
    const legacyFin = ["statement", "invoice", "expenses", "deposits", "future", "recurring", "bond"];
    if (!legacyFin.includes(finSub)) return;
    const idMap: Record<string, string> = {
      statement: "pf-tools-statement",
      invoice: "pf-tools-invoice",
      expenses: "pf-tools-expenses",
      deposits: "pf-tools-deposits",
      future: "pf-tools-future",
      recurring: "pf-tools-recurring",
      bond: "pf-tools-bond"
    };
    const el = document.getElementById(idMap[finSub]);
    if (el && el.tagName === "DETAILS") {
      (el as HTMLDetailsElement).open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [finSub]);

  useEffect(() => {
    if (!propertyDetail) return;
    const pf = propertyDetail as Record<string, unknown>;
    const pvs = (v: unknown) => (v == null || v === "" ? "" : String(v));
    setBondForm({
      outstandingBondBalance: pvs(pf.outstandingBondBalance),
      monthlyBondPayment: pvs(pf.monthlyBondPayment),
      bondAnnualInterestRatePercent: pvs(pf.bondAnnualInterestRatePercent),
      bondTermYears: pvs(pf.bondTermYears),
      bondStartDate:
        pf.bondStartDate != null && String(pf.bondStartDate).trim() !== ""
          ? String(pf.bondStartDate).slice(0, 10)
          : "",
      bondInterestPortionOverride: pvs(pf.bondInterestPortionOverride),
      bondPrincipalPortionOverride: pvs(pf.bondPrincipalPortionOverride)
    });
  }, [propertyDetail]);

  const depositProjectedNextStep = useMemo(() => {
    if (!depositModal) return null;
    const amt = Number(depositModal.amount);
    const pct = Number(depositModal.annualPct);
    if (Number.isNaN(amt) || amt < 0 || Number.isNaN(pct) || pct <= 0) return null;
    return Math.round(amt * (1 + pct / 100 / 12) * 100) / 100;
  }, [depositModal]);

  async function submitDepositModal(e: FormEvent) {
    e.preventDefault();
    if (!depositModal) return;
    const amt = Number(depositModal.amount);
    if (Number.isNaN(amt) || amt < 0) {
      window.alert("Enter a valid deposit amount.");
      return;
    }
    const pctRaw = depositModal.annualPct.trim();
    let depositAnnualGrowthPercent: number | null;
    if (pctRaw === "") depositAnnualGrowthPercent = null;
    else {
      const p = Number(pctRaw);
      if (Number.isNaN(p) || p < 0 || p > 100) {
        window.alert("Annual growth must be between 0 and 100, or leave blank.");
        return;
      }
      depositAnnualGrowthPercent = p === 0 ? null : p;
    }
    setDepositSaving(true);
    try {
      await updateLease(depositModal.leaseId, {
        depositAmount: amt,
        depositAnnualGrowthPercent
      });
      setDepositModal(null);
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? "Could not update deposit.");
    } finally {
      setDepositSaving(false);
    }
  }

  async function createInvoiceForLease(leaseId: string | number) {
    try {
      await createCurrentInvoiceFromLease(propertyId, leaseId);
      await onReload();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Could not create invoice.";
      window.alert(msg);
    }
  }

  async function viewInvoicePdf(invoiceId: string | number) {
    setInvoicePdfBusyId(invoiceId);
    setInvoicePdfBanner(null);
    try {
      const gen = await generateInvoicePdf(invoiceId);
      const downloadUrl = gen.downloadUrl;
      if (!downloadUrl) throw new Error(gen.error ?? "No download URL returned.");
      if (isAbsoluteHttpUrl(downloadUrl)) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        const blob = await fetchPdfBlob(downloadUrl);
        openPdfBlobInNewTab(blob);
      }
      setInvoicePdfBanner("Invoice PDF opened in a new tab. Use your browser save or print controls to download if needed.");
    } catch (e: unknown) {
      const apiMsg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      window.alert(
        typeof apiMsg === "string" && apiMsg.trim()
          ? apiMsg
          : e instanceof Error
            ? e.message
            : "Could not generate or open invoice PDF."
      );
    } finally {
      setInvoicePdfBusyId(null);
    }
  }

  async function submitWorkspaceExpense(e: FormEvent) {
    e.preventDefault();
    const amt = Number(expenseForm.amount);
    if (!expenseForm.description.trim()) {
      window.alert("Enter a description.");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      window.alert("Enter a valid amount.");
      return;
    }
    setExpenseSaving(true);
    try {
      await createPropertyExpense(propertyId, {
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount: amt,
        expenseDate: expenseForm.expenseDate,
        isRecurring: false
      });
      const now = todayYmd();
      setExpenseForm((prev) => ({
        ...prev,
        expenseDate: now,
        amount: ""
      }));
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? "Could not save expense.");
    } finally {
      setExpenseSaving(false);
    }
  }

  async function submitFutureExpense(e: FormEvent) {
    e.preventDefault();
    const amt = Number(futureExpenseForm.amount);
    if (!futureExpenseForm.description.trim()) {
      window.alert("Enter a description.");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      window.alert("Enter a valid amount.");
      return;
    }
    const todayUtc = todayYmd();
    if (futureExpenseForm.expenseDate <= todayUtc) {
      window.alert("Payment date must be strictly after today (UTC calendar date).");
      return;
    }
    setFutureExpenseSaving(true);
    try {
      await createPropertyExpense(propertyId, {
        category: futureExpenseForm.category,
        description: futureExpenseForm.description.trim(),
        amount: amt,
        expenseDate: futureExpenseForm.expenseDate,
        isRecurring: false,
        futureExpense: true
      });
      setFutureExpenseForm((prev) => ({
        ...prev,
        expenseDate: nextUtcCalendarDayYmd(),
        amount: ""
      }));
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? "Could not save future expense.");
    } finally {
      setFutureExpenseSaving(false);
    }
  }

  async function submitRecurringSchedule(e: FormEvent) {
    e.preventDefault();
    const amt = Number(recurringScheduleForm.amount);
    if (!recurringScheduleForm.description.trim()) {
      window.alert("Enter a description.");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      window.alert("Enter a valid amount.");
      return;
    }
    if (!recurringScheduleForm.recurringStartDate) {
      window.alert("Choose a schedule start date.");
      return;
    }
    if (!recurringScheduleForm.recurringOpenEnded) {
      if (!recurringScheduleForm.recurringEndDate) {
        window.alert("Choose an end date, or tick “No end date”.");
        return;
      }
      if (recurringScheduleForm.recurringEndDate < recurringScheduleForm.recurringStartDate) {
        window.alert("End date must be on or after the start date.");
        return;
      }
    }
    if (
      recurringScheduleForm.recurringMonthAnchor === "DAY_OF_MONTH" &&
      (recurringScheduleForm.recurringDayOfMonth < 1 || recurringScheduleForm.recurringDayOfMonth > 31)
    ) {
      window.alert("Choose a calendar day between 1 and 31.");
      return;
    }
    setRecurringScheduleSaving(true);
    try {
      await createPropertyExpense(propertyId, {
        category: recurringScheduleForm.category,
        description: recurringScheduleForm.description.trim(),
        amount: amt,
        recurringSchedule: true,
        recurringStartDate: recurringScheduleForm.recurringStartDate,
        recurringEndDate: recurringScheduleForm.recurringOpenEnded ? null : recurringScheduleForm.recurringEndDate || null,
        recurringOpenEnded: recurringScheduleForm.recurringOpenEnded,
        recurringMonthAnchor: recurringScheduleForm.recurringMonthAnchor,
        ...(recurringScheduleForm.recurringMonthAnchor === "DAY_OF_MONTH"
          ? { recurringDayOfMonth: recurringScheduleForm.recurringDayOfMonth }
          : {})
      });
      const now = todayYmd();
      setRecurringScheduleForm({
        recurringStartDate: now,
        recurringEndDate: "",
        recurringOpenEnded: true,
        recurringMonthAnchor: "FIRST_OF_MONTH",
        recurringDayOfMonth: 15,
        category: defaultExpenseCategory,
        description: expenseCategoryLabel(defaultExpenseCategory),
        amount: ""
      });
      setShowAddRecurring(false);
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? "Could not save schedule.");
    } finally {
      setRecurringScheduleSaving(false);
    }
  }
  const rows = statement?.statementRows ?? [];
  const deposits = statement?.deposits ?? [];
  const futureCharges = statement?.futureCharges ?? [];
  const recurringCharges = statement?.recurringCharges ?? [];

  const futureChargesLandlord = useMemo(
    () => (futureCharges as any[]).filter((fc) => !isTenantFacingChargeForecast(fc)),
    [futureCharges]
  );
  const recurringChargesLandlord = useMemo(
    () =>
      (recurringCharges as any[]).filter(
        (rc) => !isTenantFacingChargeForecast(rc) && String(rc.category ?? "") !== "BOND_PAYMENT"
      ),
    [recurringCharges]
  );

  const setSub = (key: string) => navigate(`/owned-properties/${propertyId}?tab=financials&fin=${key}`, { replace: true });

  const primaryLease = useMemo(() => {
    const active = (currentLeases as Record<string, unknown>[]).filter((l) =>
      ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? ""))
    );
    return active[0] ?? (currentLeases[0] as Record<string, unknown> | undefined) ?? null;
  }, [currentLeases]);

  const depositHeldTotal = useMemo(
    () => (deposits as Record<string, unknown>[]).reduce((a, d) => a + Number(d.amount ?? 0), 0),
    [deposits]
  );

  const financialOverview = useMemo(
    () =>
      buildPropertyFinancialOverview({
        propertyId,
        propertyDetail: propertyDetail as Record<string, unknown> | null,
        currentLeases,
        recurringChargesLandlord,
        statement: statement as Record<string, unknown> | null,
        deposits
      }),
    [propertyId, propertyDetail, currentLeases, recurringChargesLandlord, statement, deposits]
  );

  const recurringDisplayItems = useMemo(
    () => mapRecurringCharges(recurringChargesLandlord),
    [recurringChargesLandlord]
  );

  async function saveFinancialDetails(state: FinancialDetailsFormState) {
    setFinancialDetailsSaving(true);
    try {
      const parseOpt = (s: string) => {
        const t = String(s ?? "").trim();
        if (t === "") return null;
        const x = Number(t);
        return Number.isFinite(x) ? x : null;
      };
      const maintenancePercent = parseOpt(state.maintenancePercent);
      const derivedMaintenanceMonthly =
        maintenancePercent == null
          ? null
          : Math.max(0, (Number(maintenancePercent) / 100) * Math.max(0, Number(combinedMonthlyRent ?? 0)));
      const payload: Record<string, unknown> = {
        leviesMonthly: parseOpt(state.leviesMonthly),
        ratesAndTaxesMonthly: parseOpt(state.ratesAndTaxesMonthly),
        maintenanceMonthly: derivedMaintenanceMonthly,
        expectedMonthlyExpenses: parseOpt(state.expectedMonthlyExpenses),
        notes: state.notes.trim() || null
      };
      await updateProperty(propertyId, payload);
      await onReload();
    } catch (err: unknown) {
      window.alert(propertyApiErrorMessage(err) || "Could not save financial details.");
    } finally {
      setFinancialDetailsSaving(false);
    }
  }

  function handleRecurringEdit(item: RecurringExpenseDisplayItem) {
    setShowAddRecurring(false);
    openScheduleEditor(item.raw);
  }

  function closeRecurringModal() {
    setShowAddRecurring(false);
    closeScheduleEditor();
  }

  const recurringModalOpen = showAddRecurring || scheduleEditor != null;
  const recurringModalSaving = scheduleEditor
    ? scheduleBusyId === scheduleEditor.id
    : recurringScheduleSaving;

  const downloadPropertySummaryPdf = async () => {
    setSummaryPdfBusy(true);
    setStatementFeedback(null);
    try {
      const gen = await generateReportViaVercel({ reportType: "PROPERTY_SUMMARY", propertyId });
      const downloadUrl = gen.downloadUrl;
      if (!downloadUrl) throw new Error(gen.error ?? "No download URL returned.");
      if (isAbsoluteHttpUrl(downloadUrl)) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        const blob = await fetchPdfBlob(downloadUrl);
        openPdfBlobInNewTab(blob);
      }
    } catch (e: unknown) {
      setStatementFeedback(e instanceof Error ? e.message : String(e));
    } finally {
      setSummaryPdfBusy(false);
    }
  };

  const fmt = (n: number | null | undefined) =>
    n == null || Number.isNaN(Number(n)) ? "—" : `R ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  async function saveBondFields(ev: FormEvent) {
    ev.preventDefault();
    setBondSaving(true);
    try {
      const parseOpt = (s: string) => {
        const t = String(s ?? "").trim();
        if (t === "") return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      };
      const tyRaw = String(bondForm.bondTermYears ?? "").trim();
      const allowedYears = BOND_TERM_YEAR_OPTIONS as unknown as number[];
      const bondTermYears = tyRaw === "" ? null : allowedYears.includes(Number(tyRaw)) ? Number(tyRaw) : null;
      if (tyRaw !== "" && bondTermYears == null) {
        window.alert("Bond duration must be 5, 10, 15, 20, 25, or 30 years.");
        setBondSaving(false);
        return;
      }
      const sdRaw = String(bondForm.bondStartDate ?? "").trim();
      const bondStartDate = /^\d{4}-\d{2}-\d{2}$/.test(sdRaw) ? sdRaw : null;

      const payload: Record<string, unknown> = {
        outstandingBondBalance: parseOpt(bondForm.outstandingBondBalance),
        monthlyBondPayment: parseOpt(bondForm.monthlyBondPayment),
        bondAnnualInterestRatePercent: parseOpt(bondForm.bondAnnualInterestRatePercent),
        bondTermYears,
        bondStartDate,
        bondInterestPortionOverride: parseOpt(bondForm.bondInterestPortionOverride),
        bondPrincipalPortionOverride: parseOpt(bondForm.bondPrincipalPortionOverride)
      };
      if (bondTermYears != null && bondStartDate != null) {
        payload.bondRemainingTermMonths = null;
      }
      await updateProperty(propertyId, payload);
      if (bondSaveToStatement) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bondStatementDueDate)) {
          window.alert("Choose a valid statement debit date.");
          await onReload();
          return;
        }
        try {
          await postBondStatementRow(propertyId, bondStatementDueDate);
        } catch (postErr: any) {
          const st = postErr?.response?.status;
          const msg = postErr?.response?.data?.message;
          if (st === 409) {
            window.alert(
              msg ??
                "Bond profile was saved. This calendar month already has a bond payment on the statement — open the Statement tab and edit it there."
            );
          } else {
            window.alert(
              typeof msg === "string"
                ? `Bond profile was saved, but the statement row was not added: ${msg}`
                : postErr?.message ?? "Bond profile was saved, but the statement row could not be added."
            );
          }
          await onReload();
          return;
        }
      }
      await onReload();
    } catch (err: unknown) {
      window.alert(propertyApiErrorMessage(err) || "Could not save bond details.");
    } finally {
      setBondSaving(false);
    }
  }

  function openBondBackfillModal() {
    const pf = propertyDetail as Record<string, unknown> | undefined;
    const bd =
      pf?.bondStartDate != null && String(pf.bondStartDate).trim() !== ""
        ? String(pf.bondStartDate).slice(0, 10)
        : `${new Date().getFullYear()}-01-01`;
    setBondBackfillStart(bd);
    setBondBackfillEnd(new Date().toISOString().slice(0, 10));
    setBondBackfillOpen(true);
  }

  async function submitBondBackfill(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bondBackfillStart) || !/^\d{4}-\d{2}-\d{2}$/.test(bondBackfillEnd)) {
      window.alert("Use valid start and end dates (YYYY-MM-DD).");
      return;
    }
    setBondBackfillBusy(true);
    try {
      const res = await backfillBondStatementRows(propertyId, bondBackfillStart, bondBackfillEnd);
      const skippedDup = res.skipped.filter((s) => s.reason === "already_has_bond_expense").length;
      const skippedAmt = res.skipped.filter((s) => s.reason === "no_derivable_amount").length;
      window.alert(
        `Created ${res.createdCount} bond payment${res.createdCount === 1 ? "" : "s"}. Skipped ${res.skipped.length} month(s): ${skippedDup} already on the statement, ${skippedAmt} could not derive an amount from the bond profile (check balance, rate, and term). Historical rows use today’s outstanding balance — update the balance over time if you need tighter accuracy.`
      );
      setBondBackfillOpen(false);
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? err?.message ?? "Backfill failed.");
    } finally {
      setBondBackfillBusy(false);
    }
  }

  function closeScheduleEditor() {
    setScheduleEditor(null);
  }

  function openScheduleEditor(rc: any) {
    const anchorRaw = String(rc.recurringMonthAnchor ?? "FIRST_OF_MONTH");
    const anchor: ScheduleEditorState["recurringMonthAnchor"] =
      anchorRaw === "LAST_OF_MONTH" ? "LAST_OF_MONTH" : anchorRaw === "DAY_OF_MONTH" ? "DAY_OF_MONTH" : "FIRST_OF_MONTH";
    const start =
      rc.recurringStartDate != null
        ? String(rc.recurringStartDate).slice(0, 10)
        : rc.expenseDate != null
          ? String(rc.expenseDate).slice(0, 10)
          : todayYmd();
    setScheduleEditor({
      id: Number(rc.id),
      category: String(rc.category ?? "OTHER"),
      description: String(rc.description ?? ""),
      amount: String(rc.amount ?? ""),
      recurringStartDate: start,
      recurringEndDate: rc.recurringEndDate != null ? String(rc.recurringEndDate).slice(0, 10) : "",
      recurringOpenEnded: Boolean(rc.recurringOpenEnded),
      recurringMonthAnchor: anchor,
      recurringDayOfMonth:
        rc.recurringDayOfMonth != null && Number.isFinite(Number(rc.recurringDayOfMonth))
          ? Math.min(31, Math.max(1, Math.floor(Number(rc.recurringDayOfMonth))))
          : 15
    });
  }

  async function archiveSchedule(rc: any) {
    if (
      !window.confirm(
        "Stop this schedule? It will be archived — no new charges will post. Lines already posted to the statement stay as history."
      )
    )
      return;
    const sid = Number(rc.id);
    setScheduleBusyId(sid);
    try {
      await deletePropertyExpense(sid);
      closeScheduleEditor();
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? "Could not stop schedule.");
    } finally {
      setScheduleBusyId(null);
    }
  }

  async function hardDeleteSchedule(rc: any) {
    if (
      !window.confirm(
        "Permanently delete this schedule and every automated expense line created from it? Those rows are removed from the statement. This cannot be undone."
      )
    )
      return;
    const sid = Number(rc.id);
    setScheduleBusyId(sid);
    try {
      await hardDeletePropertyExpense(sid);
      closeScheduleEditor();
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? "Could not delete schedule.");
    } finally {
      setScheduleBusyId(null);
    }
  }

  async function submitScheduleEditor(e: FormEvent) {
    e.preventDefault();
    if (!scheduleEditor) return;
    const amt = Number(scheduleEditor.amount);
    if (!scheduleEditor.description.trim()) {
      window.alert("Enter a description.");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      window.alert("Enter a valid amount.");
      return;
    }
    if (!scheduleEditor.recurringOpenEnded) {
      if (!scheduleEditor.recurringEndDate) {
        window.alert("Choose an end date, or tick “No end date”.");
        return;
      }
      if (scheduleEditor.recurringEndDate < scheduleEditor.recurringStartDate) {
        window.alert("End date must be on or after the start date.");
        return;
      }
    }
    if (
      scheduleEditor.recurringMonthAnchor === "DAY_OF_MONTH" &&
      (scheduleEditor.recurringDayOfMonth < 1 || scheduleEditor.recurringDayOfMonth > 31)
    ) {
      window.alert("Choose a calendar day between 1 and 31.");
      return;
    }
    const sid = scheduleEditor.id;
    setScheduleBusyId(sid);
    try {
      const payload: Record<string, unknown> = {
        category: scheduleEditor.category,
        description: scheduleEditor.description.trim(),
        amount: amt,
        recurringStartDate: scheduleEditor.recurringStartDate,
        recurringOpenEnded: scheduleEditor.recurringOpenEnded,
        recurringEndDate: scheduleEditor.recurringOpenEnded ? null : scheduleEditor.recurringEndDate || null,
        recurringMonthAnchor: scheduleEditor.recurringMonthAnchor
      };
      if (scheduleEditor.recurringMonthAnchor === "DAY_OF_MONTH") {
        payload.recurringDayOfMonth = scheduleEditor.recurringDayOfMonth;
      }
      await updatePropertyExpense(sid, payload);
      closeScheduleEditor();
      await onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? "Could not update schedule.");
    } finally {
      setScheduleBusyId(null);
    }
  }

  function beginStatementEdit(row: any) {
    setStatementFeedback(null);
    statementEditingRowIdRef.current = row.id;
    setStatementEditingRowId(row.id);
    if (row.source === "INCOME") {
      const amt = row.credit != null ? row.credit : row.debit;
      const draft = {
        source: "INCOME",
        date: row.date,
        category: row.incomeCategory ?? "RENT",
        description: row.incomeDescriptionPlain ?? "",
        amount: String(amt ?? ""),
        status: row.status ?? "RECEIVED"
      };
      statementDraftRef.current = draft;
      setStatementDraft(draft);
      return;
    }
    if (row.source === "EXPENSE") {
      const draft = {
        source: "EXPENSE",
        date: row.date,
        category: row.expenseCategory ?? "OTHER",
        description: row.description ?? "",
        amount: String(row.debit ?? ""),
        bondInterestAmount:
          row.expenseCategory === "BOND_PAYMENT" && row.bondInterestAmount != null ? String(row.bondInterestAmount) : "",
        bondPrincipalAmount:
          row.expenseCategory === "BOND_PAYMENT" && row.bondPrincipalAmount != null ? String(row.bondPrincipalAmount) : ""
      };
      statementDraftRef.current = draft;
      setStatementDraft(draft);
      return;
    }
    if (row.source === "INVOICE") {
      const draft = {
        source: "INVOICE",
        date: row.date,
        total: String(row.credit ?? ""),
        status: row.status ?? "DRAFT",
        notes: row.invoiceNotes ?? ""
      };
      statementDraftRef.current = draft;
      setStatementDraft(draft);
    }
  }

  function discardStatementEdit() {
    statementDraftRef.current = null;
    statementEditingRowIdRef.current = null;
    setStatementEditingRowId(null);
    setStatementDraft(null);
  }

  /** Validates + saves using refs so Save always sees the latest draft (avoids stale closures). Returns true if saved. */
  async function performStatementSave(row: any): Promise<boolean> {
    const draft = statementDraftRef.current;
    const editingId = statementEditingRowIdRef.current;
    if (!draft || editingId !== row.id) {
      setStatementFeedback("Could not save — edit session mismatch. Discard and open Edit again.");
      return false;
    }
    if (row.source === "INCOME" && draft.source === "INCOME") {
      const amount = Number(draft.amount);
      if (Number.isNaN(amount) || amount < 0) {
        setStatementFeedback("Enter a valid amount.");
        return false;
      }
      const desc = String(draft.description ?? "").trim();
      if (!desc) {
        setStatementFeedback("Description is required.");
        return false;
      }
      await updatePropertyIncome(row.sourceId, {
        incomeDate: draft.date,
        category: draft.category,
        description: desc,
        amount,
        status: draft.status
      });
    } else if (row.source === "EXPENSE" && draft.source === "EXPENSE") {
      const amount = Number(draft.amount);
      if (Number.isNaN(amount) || amount < 0) {
        setStatementFeedback("Enter a valid amount.");
        return false;
      }
      const desc = String(draft.description ?? "").trim();
      if (!desc) {
        setStatementFeedback("Description is required.");
        return false;
      }
      const expensePayload: Record<string, unknown> = {
        expenseDate: draft.date,
        category: draft.category,
        description: desc,
        amount
      };
      if (draft.category === "BOND_PAYMENT") {
        const bi = String(draft.bondInterestAmount ?? "").trim();
        const bp = String(draft.bondPrincipalAmount ?? "").trim();
        expensePayload.bondInterestAmount = bi === "" ? null : Number(bi);
        expensePayload.bondPrincipalAmount = bp === "" ? null : Number(bp);
      }
      await updatePropertyExpense(row.sourceId, expensePayload);
    } else if (row.source === "INVOICE" && draft.source === "INVOICE") {
      const total = Number(draft.total);
      if (Number.isNaN(total) || total < 0) {
        setStatementFeedback("Enter a valid total.");
        return false;
      }
      const notesRaw = String(draft.notes ?? "");
      await updateInvoice(row.sourceId, {
        invoiceDate: draft.date,
        total,
        status: draft.status,
        notes: notesRaw.trim() === "" ? null : notesRaw.trim()
      });
    } else {
      setStatementFeedback("Unsupported row type for save.");
      return false;
    }
    setStatementFeedback(null);
    discardStatementEdit();
    await onReload();
    return true;
  }

  async function performStatementDelete(row: any) {
    if (row.source === "EXPENSE") await hardDeletePropertyExpense(row.sourceId);
    else if (row.source === "INCOME") await hardDeletePropertyIncome(row.sourceId);
    else if (row.source === "INVOICE") await hardDeleteInvoice(row.sourceId);
    else throw new Error("Unsupported row type for delete.");
    if (statementEditingRowIdRef.current === row.id) discardStatementEdit();
    setStatementFeedback(null);
    await onReload();
  }

  async function runStatementConfirm() {
    const pending = statementConfirm;
    if (!pending) return;
    setStatementConfirmBusy(true);
    setStatementFeedback(null);
    try {
      if (pending.kind === "save") {
        const ok = await performStatementSave(pending.row);
        if (ok) setStatementConfirm(null);
      } else {
        await performStatementDelete(pending.row);
        setStatementConfirm(null);
      }
    } catch (e: any) {
      setStatementFeedback(e?.response?.data?.message ?? e?.message ?? "Request failed.");
    } finally {
      setStatementConfirmBusy(false);
    }
  }

  const invoiceThisMonthByLeaseId = useMemo(() => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const me = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const map = new Map<string, any>();
    for (const inv of propertyInvoices) {
      if (inv.status === "CANCELLED") continue;
      const lid = inv.leaseId;
      if (lid == null) continue;
      const t = new Date(inv.invoiceDate).getTime();
      if (Number.isNaN(t) || t < ms || t >= me) continue;
      const key = String(lid);
      const prev = map.get(key);
      const prevTs = prev ? new Date(prev.createdAt ?? prev.invoiceDate).getTime() : -1;
      const curTs = new Date(inv.createdAt ?? inv.invoiceDate).getTime();
      if (!prev || curTs >= prevTs) map.set(key, inv);
    }
    return map;
  }, [propertyInvoices]);

  const ytdCalendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayLocal = `${year}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const ytdStart = `${year}-01-01`;

    let revenue = 0;
    let expenses = 0;
    let latestInRange = "";

    for (const r of rows as Array<{ date: string; source: string; status: string; credit: number | null; debit: number | null }>) {
      if (!r.date || r.date < ytdStart || r.date > todayLocal) continue;
      if (r.date > latestInRange) latestInRange = r.date;

      if (r.source === "INCOME" && r.status === "RECEIVED" && r.credit != null) revenue += Number(r.credit);
      else if (r.source === "INVOICE" && r.status === "PAID" && r.credit != null) revenue += Number(r.credit);
      else if (r.source === "EXPENSE" && r.status === "ACTIVE" && r.debit != null) expenses += Number(r.debit);
    }

    const periodEnd = latestInRange || todayLocal;
    const cashFlow = revenue - expenses;

    const fmtPeriod = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      if (!y || !m || !d) return iso;
      return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    };

    return {
      year,
      periodLabel: `${fmtPeriod(ytdStart)} – ${fmtPeriod(periodEnd)}`,
      revenue,
      expenses,
      cashFlow
    };
  }, [rows]);

  const propertyDisplayName = String((propertyDetail as Record<string, unknown> | null)?.name ?? financialOverview.propertyName);
  const unitLabel = financialOverview.unitLabel;
  const combinedMonthlyRent = (currentLeases as any[]).reduce((a, l) => a + Number(l.monthlyRent ?? 0), 0);
  const combinedDepositHeld = (currentLeases as any[]).reduce((a, l) => a + Number(l.depositAmount ?? 0), 0);
  const purchasePrice = Number((propertyDetail as any)?.purchasePrice ?? 0);
  const marketValue = Number((propertyDetail as any)?.currentEstimatedValue ?? 0);

  return (
    <div className="pg-pfin-page">
      <p className="pg-muted" style={{ margin: "8px 0 16px" }}>
        {propertyDisplayName}
        {unitLabel ? ` · Unit ${unitLabel}` : null}
      </p>

      {loading ? (
        <div className="pg-pfin-metrics pg-pfin-metrics--compact">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="pg-pfin-metric-card pg-muted" style={{ minHeight: 76 }}>
              Loading…
            </div>
          ))}
        </div>
      ) : (
        <PropertyFinancialMetricCards overview={financialOverview} compact={isMobile} />
      )}

      <div className="pg-pfin-layout">
        <div className="pg-pfin-main">
          {isMobile ? (
            <PropertyFinancialDetailsForm
              formId="pfin-details-form"
              propertyDetail={propertyDetail as Record<string, unknown> | null}
              primaryLease={primaryLease}
              depositHeldTotal={depositHeldTotal}
              combinedMonthlyRent={combinedMonthlyRent}
              combinedDepositHeld={combinedDepositHeld}
              purchasePrice={purchasePrice}
              marketValue={marketValue}
              compact
              saving={financialDetailsSaving}
              onSubmit={saveFinancialDetails}
            />
          ) : null}

          {!isMobile ? (
            <PropertyFinancialDetailsForm
              formId="pfin-details-form"
              propertyDetail={propertyDetail as Record<string, unknown> | null}
              primaryLease={primaryLease}
              depositHeldTotal={depositHeldTotal}
              combinedMonthlyRent={combinedMonthlyRent}
              combinedDepositHeld={combinedDepositHeld}
              purchasePrice={purchasePrice}
              marketValue={marketValue}
              saving={financialDetailsSaving}
              onSubmit={saveFinancialDetails}
            />
          ) : null}

          <RecurringExpensesSection
            items={recurringDisplayItems}
            loading={loading}
            isMobile={isMobile}
            onAdd={() => {
              closeScheduleEditor();
              setShowAddRecurring(true);
            }}
            onEdit={handleRecurringEdit}
            onStop={(item) => void archiveSchedule(item.raw)}
            onDelete={(item) => void hardDeleteSchedule(item.raw)}
          />

          {isMobile ? <ExpenseCategoriesCard overview={financialOverview} /> : null}

          <div className="pg-pfin-sticky-save">
            <button
              type="submit"
              form="pfin-details-form"
              className="pg-btn pg-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={financialDetailsSaving}
            >
              {financialDetailsSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>

          {false ? (
            <div className="pg-pfin-tools">
            <p className="pg-muted" style={{ fontSize: 13, margin: "0 0 4px" }}>
              YTD ({ytdCalendar.year}): revenue {fmt(ytdCalendar.revenue)} · expenses {fmt(ytdCalendar.expenses)} · cash flow{" "}
              <span style={{ color: ytdCalendar.cashFlow >= 0 ? "var(--success)" : "var(--danger)" }}>{fmt(ytdCalendar.cashFlow)}</span>
            </p>

            {loading ? <div className="pg-muted">Loading ledger…</div> : null}

            <details id="pf-tools-statement" className="pg-pfin-tools__item" open={finSub === "statement"}>
              <summary>Transaction ledger (statement)</summary>
              {!loading ? (
          <div>
          {statementFeedback ? (
            <div className="pg-alert pg-alert-error" role="alert" style={{ marginBottom: 12 }}>
              {statementFeedback}
            </div>
          ) : null}
          {isSupabaseConfigured ? (
            <div style={{ marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="pg-btn pg-btn-secondary"
                disabled={summaryPdfBusy}
                onClick={() => void downloadPropertySummaryPdf()}
              >
                {summaryPdfBusy ? "Generating…" : "Property summary PDF"}
              </button>
              <span className="pg-muted" style={{ fontSize: 12 }}>
                Current UTC month via serverless PDF (Supabase Storage).
              </span>
            </div>
          ) : null}
          {(rows?.length ?? 0) === 0 ? (
            <div className="pg-muted">No financial history yet.</div>
          ) : null}
          {(rows?.length ?? 0) > 0 ? (
            <div className="pg-statement-wrap">
              <table className="pg-statement-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th className="pg-statement-num">Debit</th>
                    <th className="pg-statement-num">Credit</th>
                    <th className="pg-statement-num">Balance</th>
                    <th>Source</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const isEditing = statementEditingRowId === r.id;
                    const d = isEditing ? statementDraft : null;
                    const patchDraft = (partial: Record<string, unknown>) => {
                      setStatementDraft((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev, ...partial };
                        statementDraftRef.current = next;
                        return next;
                      });
                    };

                    let dateCell: ReactNode = r.date;
                    let descCell: ReactNode = r.description;
                    let typeCell: ReactNode = r.type;
                    let debitCell: ReactNode = r.debit != null ? fmt(r.debit) : "—";
                    let creditCell: ReactNode = r.credit != null ? fmt(r.credit) : "—";
                    const creditClass =
                      r.source === "INVOICE" && r.status !== "PAID" && !isEditing ? " pg-statement-credit-unpaid" : "";
                    let balanceCell: ReactNode = fmt(r.balance);

                    const rowYm = String(r.date ?? "").slice(0, 7);
                    const thisYm = new Date().toISOString().slice(0, 7);

                    if (!isEditing && r.source === "EXPENSE" && r.expenseCategory === "BOND_PAYMENT") {
                      descCell = (
                        <>
                          <div>{r.description}</div>
                          {r.bondInterestAmount != null || r.bondPrincipalAmount != null ? (
                            <div className="pg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Interest {fmt(r.bondInterestAmount)} · Principal {fmt(r.bondPrincipalAmount)}
                            </div>
                          ) : statement?.bondFinance && rowYm === thisYm ? (
                            <div className="pg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Profile estimate: Interest {fmt(statement.bondFinance.interestThisMonth)} · Principal{" "}
                              {fmt(statement.bondFinance.principalThisMonth)}
                            </div>
                          ) : null}
                        </>
                      );
                    }

                    if (isEditing && d?.source === "INCOME") {
                      dateCell = (
                        <Input type="date" value={String(d.date ?? "")} onChange={(e) => patchDraft({ date: e.target.value })} />
                      );
                      descCell = <Input value={String(d.description ?? "")} onChange={(e) => patchDraft({ description: e.target.value })} />;
                      typeCell = (
                        <div style={{ display: "grid", gap: 8 }}>
                          <select className="pg-input" value={String(d.category ?? "RENT")} onChange={(e) => patchDraft({ category: e.target.value })}>
                            {PROPERTY_INCOME_CATEGORY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <select className="pg-input" value={String(d.status ?? "RECEIVED")} onChange={(e) => patchDraft({ status: e.target.value })}>
                            {INCOME_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s === "EXPECTED" ? "Expected" : s === "RECEIVED" ? "Received" : "Cancelled"}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                      const st = String(d.status ?? "");
                      const amtInput = (
                        <Input type="number" step="any" min={0} value={String(d.amount ?? "")} onChange={(e) => patchDraft({ amount: e.target.value })} />
                      );
                      debitCell = st === "EXPECTED" ? amtInput : "—";
                      creditCell = st === "RECEIVED" ? amtInput : "—";
                      balanceCell = "—";
                    } else if (isEditing && d?.source === "EXPENSE") {
                      dateCell = (
                        <Input type="date" value={String(d.date ?? "")} onChange={(e) => patchDraft({ date: e.target.value })} />
                      );
                      descCell = (
                        <div style={{ display: "grid", gap: 8 }}>
                          <Input value={String(d.description ?? "")} onChange={(e) => patchDraft({ description: e.target.value })} />
                          {String(d.category ?? "") === "BOND_PAYMENT" ? (
                            <>
                              <Input
                                type="number"
                                step="any"
                                min={0}
                                placeholder="Interest portion (optional)"
                                value={String(d.bondInterestAmount ?? "")}
                                onChange={(e) => patchDraft({ bondInterestAmount: e.target.value })}
                              />
                              <Input
                                type="number"
                                step="any"
                                min={0}
                                placeholder="Principal portion (optional)"
                                value={String(d.bondPrincipalAmount ?? "")}
                                onChange={(e) => patchDraft({ bondPrincipalAmount: e.target.value })}
                              />
                              <span className="pg-muted" style={{ fontSize: 11 }}>
                                Leave blank to clear stored split; debit total is the Amount column.
                              </span>
                            </>
                          ) : null}
                        </div>
                      );
                      typeCell = (
                        <select className="pg-input" value={String(d.category ?? "OTHER")} onChange={(e) => patchDraft({ category: e.target.value })}>
                          {PROPERTY_EXPENSE_CATEGORY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      );
                      debitCell = (
                        <Input type="number" step="any" min={0} value={String(d.amount ?? "")} onChange={(e) => patchDraft({ amount: e.target.value })} />
                      );
                      creditCell = "—";
                      balanceCell = "—";
                    } else if (isEditing && d?.source === "INVOICE") {
                      dateCell = (
                        <Input type="date" value={String(d.date ?? "")} onChange={(e) => patchDraft({ date: e.target.value })} />
                      );
                      descCell = (
                        <div style={{ display: "grid", gap: 6 }}>
                          {r.invoiceNumber ? (
                            <span className="pg-muted" style={{ fontSize: 12 }}>
                              Invoice {r.invoiceNumber}
                            </span>
                          ) : null}
                          <Input
                            value={String(d.notes ?? "")}
                            onChange={(e) => patchDraft({ notes: e.target.value })}
                            placeholder="Notes / description"
                          />
                        </div>
                      );
                      typeCell = (
                        <select className="pg-input" value={String(d.status ?? "DRAFT")} onChange={(e) => patchDraft({ status: e.target.value })}>
                          {INVOICE_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      );
                      debitCell = "—";
                      creditCell = (
                        <Input type="number" step="any" min={0} value={String(d.total ?? "")} onChange={(e) => patchDraft({ total: e.target.value })} />
                      );
                      balanceCell = "—";
                    }

                    return (
                      <tr key={r.id}>
                        <td style={{ verticalAlign: "top" }}>{dateCell}</td>
                        <td style={{ verticalAlign: "top", minWidth: 160 }}>{descCell}</td>
                        <td style={{ verticalAlign: "top", minWidth: 140 }}>{typeCell}</td>
                        <td className="pg-statement-num" style={{ verticalAlign: "top" }}>
                          {debitCell}
                        </td>
                        <td
                          className={`pg-statement-num${creditClass}`}
                          style={{ verticalAlign: "top" }}
                          title={
                            r.source === "INVOICE" && r.status !== "PAID" && !isEditing
                              ? "Unpaid — shown as credit but excluded from balance until marked paid"
                              : undefined
                          }
                        >
                          {creditCell}
                        </td>
                        <td className="pg-statement-num" style={{ verticalAlign: "top" }}>
                          {balanceCell}
                        </td>
                        <td style={{ verticalAlign: "top" }}>{r.source}</td>
                        <td style={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                          <div className="pg-statement-row-actions">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="pg-statement-icon-save"
                                  aria-label="Save"
                                  title="Save"
                                  onClick={() => {
                                    setStatementFeedback(null);
                                    setStatementConfirm({ kind: "save", row: r });
                                  }}
                                >
                                  <IconStatementSave />
                                </button>
                                <button type="button" className="pg-statement-icon-discard" aria-label="Discard" title="Discard" onClick={discardStatementEdit}>
                                  <IconStatementDiscard />
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="pg-btn pg-btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => beginStatementEdit(r)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="pg-btn pg-btn-ghost"
                                  style={{ fontSize: 12, padding: "4px 10px" }}
                                  onClick={() => {
                                    setStatementFeedback(null);
                                    setStatementConfirm({ kind: "delete", row: r });
                                  }}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          </div>
              ) : null}
            </details>

            <details id="pf-tools-invoice" open={finSub === "invoice"}>
              <summary>Lease invoices</summary>
        <Card title="Lease invoices (this calendar month)">
          {invoicePdfBanner ? (
            <div className="pg-alert" style={{ marginBottom: 12 }}>
              {invoicePdfBanner}
            </div>
          ) : null}
          <div className="pg-muted" style={{ marginBottom: 14 }}>
            Generate a draft per lease; unpaid amounts appear on <strong>Statement</strong> as a red credit until <strong>Mark paid</strong>.
          </div>
          {(currentLeases?.length ?? 0) === 0 ? (
            <div className="pg-muted">No active lease on this property. Add a lease first.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {currentLeases.map((lease: any) => {
                const tn = lease.tenant;
                const label = tn ? `${tn.firstName ?? ""} ${tn.lastName ?? ""}`.trim() : `Lease #${lease.id}`;
                const inv = invoiceThisMonthByLeaseId.get(String(lease.id));
                return (
                  <div
                    key={lease.id}
                    className="pg-workspace-inset"
                    style={{ display: "grid", gap: 10 }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{label}</div>
                        <div className="pg-muted" style={{ fontSize: 13 }}>
                          Rent R {Number(lease.monthlyRent ?? 0).toLocaleString()}/mo · Due day {lease.rentDueDay ?? "—"}
                        </div>
                      </div>
                      {!inv ? (
                        <button className="pg-btn pg-btn-primary" type="button" onClick={() => void createInvoiceForLease(String(lease.id))}>
                          Generate invoice
                        </button>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <span className="pg-muted">{inv.invoiceNumber}</span>
                          <span className={inv.status === "PAID" ? "pg-muted" : "pg-statement-credit-unpaid"} style={{ fontWeight: 600 }}>
                            {inv.status}
                          </span>
                          <span>{fmt(inv.total)}</span>
                          <button
                            className="pg-btn pg-btn-secondary"
                            type="button"
                            disabled={invoicePdfBusyId === inv.id || invoicePdfBusyId === String(inv.id)}
                            onClick={() => void viewInvoicePdf(String(inv.id))}
                          >
                            {invoicePdfBusyId === inv.id || invoicePdfBusyId === String(inv.id)
                              ? "Working…"
                              : "View Invoice"}
                          </button>
                          <button className="pg-btn pg-btn-ghost" type="button" disabled title="Coming soon">
                            Send Invoice
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="pg-btn pg-btn-ghost" to="/financials">
              Create custom invoice
            </Link>
            <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setSub("expenses")}>
              Expenses
            </button>
          </div>
        </Card>
            </details>

            <details id="pf-tools-expenses" open={finSub === "expenses"}>
              <summary>One-off expenses</summary>
        <Card title="Expenses">
          <div className="pg-muted" style={{ marginBottom: 14 }}>
            One-off property costs only — each line posts once on the payment date and appears on the{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("statement")}>
              Statement
            </button>
            . For repeating landlord costs (rates, levies, bond debit orders, etc.), use{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("recurring")}>
              Recurring charges
            </button>
            .
          </div>
          <form onSubmit={(ev) => void submitWorkspaceExpense(ev)} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <Field label="Payment date">
              <Input
                type="date"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Type" help="Same categories as elsewhere on the ledger (rates, water, levies, repairs, bond payment, etc.).">
              <select
                className="pg-input"
                value={expenseForm.category}
                onChange={(e) => {
                  const v = e.target.value;
                  setExpenseForm({
                    ...expenseForm,
                    category: v,
                    description: expenseCategoryLabel(v)
                  });
                }}
              >
                {PROPERTY_EXPENSE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" help="Defaults to the type label; edit freely.">
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                required
              />
            </Field>
            <Field label="Amount (R)">
              <Input
                type="number"
                step="any"
                min={0}
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0"
                required
              />
            </Field>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="pg-btn pg-btn-primary" type="submit" disabled={expenseSaving}>
                {expenseSaving ? "Saving…" : "Add to statement"}
              </button>
              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setSub("statement")}>
                View statement
              </button>
              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setSub("recurring")}>
                Recurring charges
              </button>
              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setSub("invoice")}>
                Lease invoices
              </button>
            </div>
          </form>
        </Card>
            </details>

            <details id="pf-tools-deposits" open={finSub === "deposits"}>
              <summary>Deposits held</summary>
        <Card title="Deposits held">
          {(deposits?.length ?? 0) === 0 ? <div className="pg-muted">No active lease deposits.</div> : null}
          <div style={{ display: "grid", gap: 8 }}>
            {deposits.map((d: any) => {
              const growth = d.depositAnnualGrowthPercent != null ? Number(d.depositAnnualGrowthPercent) : null;
              const monthlyNominal = growth != null && growth > 0 ? growth / 12 : null;
              return (
                <div key={d.leaseId} className="pg-workspace-inset">
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{d.tenantName ?? "Tenant"}</div>
                      <div style={{ marginTop: 6 }}>
                        Balance <strong>{fmt(d.amount)}</strong>
                      </div>
                      {growth != null && growth > 0 ? (
                        <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>
                          Auto growth ~{growth}%/yr (~{monthlyNominal != null ? monthlyNominal.toFixed(3) : "—"}% per month compound)
                        </div>
                      ) : (
                        <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>
                          Manual balance — add an annual % to compound monthly (annual ÷ 12).
                        </div>
                      )}
                      {d.depositGrowthLastAppliedMonth ? (
                        <div className="pg-muted" style={{ fontSize: 11, marginTop: 4 }}>
                          Growth anchored through {d.depositGrowthLastAppliedMonth}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="pg-btn pg-btn-secondary"
                      onClick={() =>
                        setDepositModal({
                          leaseId: d.leaseId,
                          tenantLabel: d.tenantName ?? "Tenant",
                          amount: String(d.amount ?? ""),
                          annualPct: growth != null && growth > 0 ? String(growth) : ""
                        })
                      }
                    >
                      Update deposit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
            </details>

            <details id="pf-tools-future" open={finSub === "future"}>
              <summary>Future charges</summary>
        <Card title="Future charges">
          <div className="pg-muted" style={{ marginBottom: 14 }}>
            <strong>Charges</strong> are <strong>money you owe on the property</strong> (rates, levies, repairs, bond payments, etc.) with a{" "}
            <strong>due date strictly after today</strong> (UTC calendar date). Each entry is saved on the property ledger and{" "}
            <strong>shows on the Statement in date order</strong>; once that date arrives it behaves like any other expense for balances and history.
            Past or today&apos;s payments belong under{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("expenses")}>
              Expenses
            </button>
            . <strong>Expected rent and recurring income rules are not charges</strong> — tenants are billed under{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("invoice")}>
              Lease invoices
            </button>
            .
          </div>
          <form
            onSubmit={(e) => void submitFutureExpense(e)}
            style={{
              display: "grid",
              gap: 12,
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: "1px solid rgba(255,255,255,.08)",
              maxWidth: 520
            }}
          >
            <div className="pg-card-title" style={{ margin: 0 }}>
              Add future expense
            </div>
            <Field label="Payment due date" help="Must be after today (UTC). Stored as-is on your ledger and appears on the Statement for that date.">
              <Input
                type="date"
                min={nextUtcCalendarDayYmd()}
                value={futureExpenseForm.expenseDate}
                onChange={(e) => {
                  const v = e.target.value;
                  const minD = nextUtcCalendarDayYmd();
                  if (v && v < minD) return;
                  setFutureExpenseForm({ ...futureExpenseForm, expenseDate: v });
                }}
              />
            </Field>
            <Field label="Type" help="Same categories as elsewhere on the ledger (rates, water, levies, repairs, bond payment, etc.).">
              <select
                className="pg-input"
                value={futureExpenseForm.category}
                onChange={(e) =>
                  setFutureExpenseForm({
                    ...futureExpenseForm,
                    category: e.target.value,
                    description: expenseCategoryLabel(e.target.value)
                  })
                }
              >
                {PROPERTY_EXPENSE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <Input
                value={futureExpenseForm.description}
                onChange={(e) => setFutureExpenseForm({ ...futureExpenseForm, description: e.target.value })}
                placeholder="e.g. Estimated repairs — contractor quote"
              />
            </Field>
            <Field label="Amount (R)">
              <Input
                type="number"
                step="any"
                min={0}
                value={futureExpenseForm.amount}
                onChange={(e) => setFutureExpenseForm({ ...futureExpenseForm, amount: e.target.value })}
              />
            </Field>
            <button type="submit" className="pg-btn pg-btn-primary" disabled={futureExpenseSaving}>
              {futureExpenseSaving ? "Saving…" : "Save future expense"}
            </button>
          </form>
          {(futureChargesLandlord?.length ?? 0) === 0 ? (
            <div className="pg-muted">No scheduled one-off charges after today yet.</div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {futureChargesLandlord.map((fc: any, i: number) => (
              <div key={`${fc.source}-${i}`} className="pg-workspace-inset">
                <div className="pg-muted" style={{ fontSize: 13 }}>
                  {expenseCategoryLabel(String(fc.category ?? ""))}
                </div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>{String(fc.description ?? fc.label ?? "")}</div>
                <div style={{ marginTop: 8 }}>
                  <strong>{fmt(fc.amount)}</strong>
                  <span className="pg-muted" style={{ marginLeft: 8 }}>
                    Due {fc.dueDate ? formatIsoDateShort(String(fc.dueDate)) : fc.dueMonth ?? "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
            </details>

            <details id="pf-tools-recurring" open={finSub === "recurring" || showAddRecurring}>
              <summary>Recurring charge schedules (add / edit)</summary>
        <Card title="Recurring charges">
          <div className="pg-muted" style={{ marginBottom: 14 }}>
            <strong>Monthly schedules</strong> are separate from one-off{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("expenses")}>
              Expenses
            </button>
            . Define start date, whether charges fall on the <strong>1st</strong>, <strong>last day</strong>, or a <strong>chosen calendar day</strong> each month, and an optional end date. Each due date,
            an expense line is posted automatically to the{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("statement")}>
              Statement
            </button>
            .{" "}
            <strong>Tenant rent and invoicing do not belong here</strong> — use{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("invoice")}>
              Lease invoices
            </button>{" "}
            or workspace <strong>Recurring invoices</strong>.{" "}
            <strong>Bond instalments</strong> belong under{" "}
            <button type="button" className="pg-fin-pipe-link" style={{ display: "inline", padding: "0 4px" }} onClick={() => setSub("bond")}>
              Bond payment
            </button>
            , not here.
          </div>

          <div className="pg-card-title" style={{ marginTop: 8 }}>
            New monthly schedule
          </div>
          <form onSubmit={(ev) => void submitRecurringSchedule(ev)} style={{ display: "grid", gap: 12, maxWidth: 520, marginBottom: 24 }}>
            <Field label="Schedule starts">
              <Input
                type="date"
                value={recurringScheduleForm.recurringStartDate}
                onChange={(e) => setRecurringScheduleForm({ ...recurringScheduleForm, recurringStartDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Due each month">
              <select
                className="pg-input"
                value={recurringScheduleForm.recurringMonthAnchor}
                onChange={(e) =>
                  setRecurringScheduleForm({
                    ...recurringScheduleForm,
                    recurringMonthAnchor: e.target.value as "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH"
                  })
                }
              >
                {RECURRING_ANCHOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            {recurringScheduleForm.recurringMonthAnchor === "DAY_OF_MONTH" ? (
              <Field
                label="Calendar day"
                help="Use the calendar picker — only the day number repeats each month (e.g. the 14th). Short months use the last valid day."
              >
                <Input
                  type="date"
                  value={ymdCarrierForDayDom(recurringScheduleForm.recurringDayOfMonth)}
                  onChange={(e) =>
                    setRecurringScheduleForm({
                      ...recurringScheduleForm,
                      recurringDayOfMonth: parseDomFromYmd(e.target.value)
                    })
                  }
                  required
                />
              </Field>
            ) : null}
            <label className="pg-pill" style={{ cursor: "pointer", justifyContent: "flex-start" }}>
              <input
                type="checkbox"
                checked={recurringScheduleForm.recurringOpenEnded}
                onChange={(e) =>
                  setRecurringScheduleForm({
                    ...recurringScheduleForm,
                    recurringOpenEnded: e.target.checked,
                    recurringEndDate: e.target.checked ? "" : recurringScheduleForm.recurringEndDate
                  })
                }
              />{" "}
              No end date
            </label>
            {!recurringScheduleForm.recurringOpenEnded ? (
              <Field label="Schedule ends">
                <Input
                  type="date"
                  value={recurringScheduleForm.recurringEndDate}
                  onChange={(e) => setRecurringScheduleForm({ ...recurringScheduleForm, recurringEndDate: e.target.value })}
                  required={!recurringScheduleForm.recurringOpenEnded}
                />
              </Field>
            ) : null}
            <Field
              label="Type"
              help="Examples — municipal rates, insurance debit order, levies. Bond instalments belong under Bond payment (not here)."
            >
              <select
                className="pg-input"
                value={recurringScheduleForm.category}
                onChange={(e) => {
                  const v = e.target.value;
                  setRecurringScheduleForm({
                    ...recurringScheduleForm,
                    category: v,
                    description: expenseCategoryLabel(v)
                  });
                }}
              >
                {RECURRING_SCHEDULE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" help="Defaults to the type label; edit freely.">
              <Input
                value={recurringScheduleForm.description}
                onChange={(e) => setRecurringScheduleForm({ ...recurringScheduleForm, description: e.target.value })}
                required
              />
            </Field>
            <Field label="Amount (R)">
              <Input
                type="number"
                step="any"
                min={0}
                value={recurringScheduleForm.amount}
                onChange={(e) => setRecurringScheduleForm({ ...recurringScheduleForm, amount: e.target.value })}
                placeholder="0"
                required
              />
            </Field>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="pg-btn pg-btn-primary" type="submit" disabled={recurringScheduleSaving}>
                {recurringScheduleSaving ? "Saving…" : "Save monthly schedule"}
              </button>
              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setSub("statement")}>
                View statement
              </button>
              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setSub("expenses")}>
                One-off expenses
              </button>
            </div>
          </form>

          <div className="pg-card-title">Saved schedules</div>
          <div className="pg-muted" style={{ marginBottom: 10, fontSize: 13 }}>
            Edit amounts or dates; <strong>Stop</strong> archives the schedule (no future postings — existing statement lines stay).{" "}
            <strong>Delete…</strong> removes the schedule and all lines the system posted from it.
          </div>
          {(recurringChargesLandlord?.length ?? 0) === 0 ? (
            <div className="pg-muted">No schedules yet — use the form above.</div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {recurringChargesLandlord.map((rc: any) => {
              const sid = Number(rc.id);
              const editing = scheduleEditor != null && scheduleEditor.id === sid;
              const rowBusy = scheduleBusyId === sid;
              const uiLocked = scheduleBusyId != null;
              return (
                <div key={String(rc.id)} className="pg-workspace-inset">
                  {!editing ? (
                    <>
                      <div className="pg-muted" style={{ fontSize: 13 }}>
                        {expenseCategoryLabel(String(rc.category ?? ""))} ·{" "}
                        {(String(rc.frequency ?? "MONTHLY")).replace(/_/g, " ").toLowerCase()}
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 600 }}>{String(rc.description ?? "")}</div>
                      <div style={{ marginTop: 8 }}>
                        <strong>{fmt(rc.amount)}</strong>
                        {rc.expenseDate ? (
                          <span className="pg-muted" style={{ marginLeft: 8 }}>
                            Template anchor {formatIsoDateShort(String(rc.expenseDate))}
                          </span>
                        ) : null}
                      </div>
                      <div className="pg-muted" style={{ marginTop: 6, fontSize: 12 }}>
                        {rc.recurringMonthAnchor ? (
                          <span>{recurringAnchorLabel(String(rc.recurringMonthAnchor), rc.recurringDayOfMonth ?? null)}</span>
                        ) : null}
                        {rc.recurringStartDate ? (
                          <span>
                            {" "}
                            · starts {formatIsoDateShort(String(rc.recurringStartDate))}
                          </span>
                        ) : null}
                        {rc.recurringOpenEnded ? (
                          <span> · open-ended</span>
                        ) : rc.recurringEndDate ? (
                          <span> · ends {formatIsoDateShort(String(rc.recurringEndDate))}</span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        <button
                          type="button"
                          className="pg-btn pg-btn-ghost"
                          disabled={uiLocked}
                          onClick={() => openScheduleEditor(rc)}
                        >
                          Edit
                        </button>
                        <button type="button" className="pg-btn pg-btn-ghost" disabled={uiLocked} onClick={() => void archiveSchedule(rc)}>
                          Stop
                        </button>
                        <button type="button" className="pg-btn pg-btn-ghost" disabled={uiLocked} onClick={() => void hardDeleteSchedule(rc)}>
                          Delete…
                        </button>
                      </div>
                    </>
                  ) : (
                    scheduleEditor && (
                      <form onSubmit={(ev) => void submitScheduleEditor(ev)} style={{ display: "grid", gap: 10, marginTop: 4 }}>
                        <Field label="Type">
                          <select
                            className="pg-input"
                            value={scheduleEditor.category}
                            onChange={(e) => setScheduleEditor({ ...scheduleEditor, category: e.target.value })}
                          >
                            {RECURRING_SCHEDULE_CATEGORY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Description">
                          <Input
                            value={scheduleEditor.description}
                            onChange={(e) => setScheduleEditor({ ...scheduleEditor, description: e.target.value })}
                            required
                          />
                        </Field>
                        <Field label="Amount (R)">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={scheduleEditor.amount}
                            onChange={(e) => setScheduleEditor({ ...scheduleEditor, amount: e.target.value })}
                            required
                          />
                        </Field>
                        <Field label="Schedule starts">
                          <Input
                            type="date"
                            value={scheduleEditor.recurringStartDate}
                            onChange={(e) => setScheduleEditor({ ...scheduleEditor, recurringStartDate: e.target.value })}
                            required
                          />
                        </Field>
                        <Field label="Due each month">
                          <select
                            className="pg-input"
                            value={scheduleEditor.recurringMonthAnchor}
                            onChange={(e) =>
                              setScheduleEditor({
                                ...scheduleEditor,
                                recurringMonthAnchor: e.target.value as ScheduleEditorState["recurringMonthAnchor"]
                              })
                            }
                          >
                            {RECURRING_ANCHOR_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {scheduleEditor.recurringMonthAnchor === "DAY_OF_MONTH" ? (
                          <Field
                            label="Calendar day"
                            help="Only the day number repeats each month."
                          >
                            <Input
                              type="date"
                              value={ymdCarrierForDayDom(scheduleEditor.recurringDayOfMonth)}
                              onChange={(e) =>
                                setScheduleEditor({
                                  ...scheduleEditor,
                                  recurringDayOfMonth: parseDomFromYmd(e.target.value)
                                })
                              }
                              required
                            />
                          </Field>
                        ) : null}
                        <label className="pg-pill" style={{ cursor: "pointer", justifyContent: "flex-start" }}>
                          <input
                            type="checkbox"
                            checked={scheduleEditor.recurringOpenEnded}
                            onChange={(e) =>
                              setScheduleEditor({
                                ...scheduleEditor,
                                recurringOpenEnded: e.target.checked,
                                recurringEndDate: e.target.checked ? "" : scheduleEditor.recurringEndDate
                              })
                            }
                          />{" "}
                          No end date
                        </label>
                        {!scheduleEditor.recurringOpenEnded ? (
                          <Field label="Schedule ends">
                            <Input
                              type="date"
                              value={scheduleEditor.recurringEndDate}
                              onChange={(e) => setScheduleEditor({ ...scheduleEditor, recurringEndDate: e.target.value })}
                              required={!scheduleEditor.recurringOpenEnded}
                            />
                          </Field>
                        ) : null}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="submit" className="pg-btn pg-btn-primary" disabled={rowBusy}>
                            {rowBusy ? "Saving…" : "Save changes"}
                          </button>
                          <button type="button" className="pg-btn pg-btn-ghost" disabled={rowBusy} onClick={closeScheduleEditor}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </Card>
            </details>

            <details id="pf-tools-bond" open={finSub === "bond"}>
              <summary>Bond payment profile</summary>
        <Card title="Bond payment">
          <div className="pg-muted" style={{ marginBottom: 16 }}>
            Linked to this property&apos;s bond fields (same as Add / Edit property). Home-loan schedules are kept here —{" "}
            <strong>not</strong> under Recurring charges. Update your outstanding balance periodically so interest estimates stay realistic.
          </div>

          {!propertyDetail ? (
            <div className="pg-muted">Loading property…</div>
          ) : (
            <form onSubmit={(ev) => void saveBondFields(ev)} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
              <Field label="Outstanding bond balance (principal now)" help="Update when your bond statement shows a new balance.">
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={bondForm.outstandingBondBalance}
                  onChange={(e) => setBondForm({ ...bondForm, outstandingBondBalance: e.target.value })}
                />
              </Field>
              <Field
                label="Bond interest rate (% p.a.)"
                help="Nominal annual rate on the loan — used with remaining months to estimate payment and interest portion."
              >
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={bondForm.bondAnnualInterestRatePercent}
                  onChange={(e) => setBondForm({ ...bondForm, bondAnnualInterestRatePercent: e.target.value })}
                />
              </Field>
              <Field label="Bond duration (years)" help="Original registered term (5-year steps up to 30 years). ">
                <select
                  className="pg-input"
                  value={bondForm.bondTermYears}
                  onChange={(e) => setBondForm({ ...bondForm, bondTermYears: e.target.value })}
                >
                  <option value="">Not specified</option>
                  {BOND_TERM_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y} years
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bond start date" help="Registration / bond start — together with duration, remaining months are calculated automatically.">
                <Input type="date" value={bondForm.bondStartDate} onChange={(e) => setBondForm({ ...bondForm, bondStartDate: e.target.value })} />
              </Field>
              <Field
                label="Monthly bond payment (actual debit)"
                help="Optional if you rely on the calculated figure — enter what the bank deducts when it differs."
              >
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={bondForm.monthlyBondPayment}
                  onChange={(e) => setBondForm({ ...bondForm, monthlyBondPayment: e.target.value })}
                />
              </Field>
              <Field
                label="Interest portion override"
                help="When the bank’s interest differs from the estimate — leave blank to use calculated interest."
              >
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={bondForm.bondInterestPortionOverride}
                  onChange={(e) => setBondForm({ ...bondForm, bondInterestPortionOverride: e.target.value })}
                />
              </Field>
              <Field label="Principal portion override" help="Optional — paired with overrides above when splits don’t tie out.">
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={bondForm.bondPrincipalPortionOverride}
                  onChange={(e) => setBondForm({ ...bondForm, bondPrincipalPortionOverride: e.target.value })}
                />
              </Field>

              {statement?.bondFinance ? (
                <div className="pg-workspace-inset" style={{ marginTop: 4, display: "grid", gap: 10, maxWidth: 560 }}>
                  <div className="pg-card-title" style={{ margin: 0 }}>
                    Calculated this period (from profile)
                  </div>
                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    {statement.bondFinance.remainingFromSchedule &&
                    statement.bondFinance.bondTermYears != null &&
                    statement.bondFinance.bondStartDate ? (
                      <div className="pg-muted" style={{ fontSize: 13 }}>
                        {statement.bondFinance.bondTermYears}-year bond · started{" "}
                        {formatIsoDateShort(String(statement.bondFinance.bondStartDate))} ·{" "}
                        {statement.bondFinance.monthsElapsedOnBond ?? 0} months elapsed →{" "}
                        <strong>{statement.bondFinance.remainingTermMonths ?? 0}</strong> months left
                      </div>
                    ) : statement.bondFinance.remainingTermMonths != null ? (
                      <div className="pg-muted" style={{ fontSize: 13 }}>
                        <strong>{statement.bondFinance.remainingTermMonths}</strong> months remaining (manual / legacy profile)
                      </div>
                    ) : (
                      <div className="pg-muted" style={{ fontSize: 13 }}>
                        Set bond duration and start date above to derive months remaining automatically.
                      </div>
                    )}
                    <div>
                      <span className="pg-muted">Monthly debit (profile) </span>
                      <strong>{fmt(statement.bondFinance.paymentThisMonth)}</strong>
                    </div>
                    {statement.bondFinance.calculatedMonthlyPayment != null &&
                    Number(statement.bondFinance.calculatedMonthlyPayment) > 0 ? (
                      <div className="pg-muted" style={{ fontSize: 13 }}>
                        Formula amortisation {fmt(statement.bondFinance.calculatedMonthlyPayment)}
                        {statement.bondFinance.monthlyBondPaymentStored != null &&
                        Number(statement.bondFinance.monthlyBondPaymentStored) > 0 &&
                        Math.round(Number(statement.bondFinance.calculatedMonthlyPayment) * 100) !==
                          Math.round(Number(statement.bondFinance.monthlyBondPaymentStored) * 100) ? (
                          <span> — differs from profile debit above</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div>
                      <span className="pg-muted">Interest (estimated) </span>
                      <strong>{fmt(statement.bondFinance.interestThisMonth)}</strong>
                      <span className="pg-muted" style={{ marginLeft: 8 }}>
                        · Principal <strong>{fmt(statement.bondFinance.principalThisMonth)}</strong>
                      </span>
                    </div>
                    <div className="pg-muted" style={{ fontSize: 13 }}>
                      Balance after principal (not applied to ledger automatically):{" "}
                      {fmt(statement.bondFinance.projectedBalanceAfterPayment)}
                    </div>
                  </div>
                </div>
              ) : null}

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={bondSaveToStatement}
                  onChange={(e) => setBondSaveToStatement(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>Save to statement</strong>
                  <span className="pg-muted" style={{ display: "block", fontSize: 13, marginTop: 4 }}>
                    After saving the bond profile, add one bond payment line for the calendar month of the debit date below (skipped if that month already has a bond payment).
                  </span>
                </span>
              </label>
              {bondSaveToStatement ? (
                <Field label="Statement debit date" help="Appears on the ledger for that month; remaining term follows bond start vs this date.">
                  <Input type="date" value={bondStatementDueDate} onChange={(e) => setBondStatementDueDate(e.target.value)} />
                </Field>
              ) : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button type="submit" className="pg-btn pg-btn-primary" disabled={bondSaving}>
                  {bondSaving ? "Saving…" : "Save bond profile"}
                </button>
                <button type="button" className="pg-btn pg-btn-ghost" disabled={bondSaving || bondBackfillBusy} onClick={() => openBondBackfillModal()}>
                  Add multiple payments
                </button>
              </div>
            </form>
          )}
        </Card>
            </details>
            </div>
          ) : null}
        </div>

        {!isMobile ? (
          <div className="pg-pfin-right">
            <PropertyFinancialSummaryPanel
              overview={financialOverview}
              propertyName={propertyDisplayName}
              unitLabel={unitLabel}
              addressLine={financialOverview.addressLine}
            />
            <ExpenseCategoriesCard overview={financialOverview} />
          </div>
        ) : null}
      </div>

      <RecurringExpenseModal
        open={recurringModalOpen}
        mode={scheduleEditor ? "edit" : "add"}
        form={scheduleEditor ?? recurringScheduleForm}
        onPatch={(patch) => {
          if (scheduleEditor) {
            setScheduleEditor({ ...scheduleEditor, ...patch });
          } else {
            setRecurringScheduleForm({ ...recurringScheduleForm, ...patch });
          }
        }}
        onSubmit={(e) => {
          if (scheduleEditor) {
            void submitScheduleEditor(e);
          } else {
            void submitRecurringSchedule(e);
          }
        }}
        onClose={closeRecurringModal}
        saving={recurringModalSaving}
        categoryOptions={RECURRING_SCHEDULE_CATEGORY_OPTIONS}
      />

      {bondBackfillOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 88,
            padding: 16
          }}
          role="presentation"
          onMouseDown={(ev) => {
            if (!bondBackfillBusy && ev.target === ev.currentTarget) setBondBackfillOpen(false);
          }}
        >
          <Card title="Add multiple bond payments">
            <p className="pg-muted" style={{ marginTop: 0, fontSize: 14 }}>
              Creates one bond payment per calendar month in the range, only where the statement doesn&apos;t already have a bond line for that month.
              Each month uses the same <strong>day-of-month</strong> as your start date (short months are clamped). Amounts follow your bond profile and
              remaining term as of each date; the outstanding balance on the property is shared across months — update the balance over time if you need
              historical accuracy.
            </p>
            <form onSubmit={(e) => void submitBondBackfill(e)} style={{ display: "grid", gap: 12, maxWidth: 400 }}>
              <Field label="From (first month includes this date)">
                <Input type="date" value={bondBackfillStart} onChange={(e) => setBondBackfillStart(e.target.value)} required />
              </Field>
              <Field label="Through (last month includes this date)">
                <Input type="date" value={bondBackfillEnd} onChange={(e) => setBondBackfillEnd(e.target.value)} required />
              </Field>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="submit" className="pg-btn pg-btn-primary" disabled={bondBackfillBusy}>
                  {bondBackfillBusy ? "Working…" : "Create missing rows"}
                </button>
                <button type="button" className="pg-btn pg-btn-ghost" disabled={bondBackfillBusy} onClick={() => setBondBackfillOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {statementConfirm ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
            padding: 16
          }}
          role="presentation"
          onMouseDown={(ev) => {
            if (!statementConfirmBusy && ev.target === ev.currentTarget) setStatementConfirm(null);
          }}
        >
          <Card title={statementConfirm.kind === "save" ? "Overwrite saved data?" : "Delete line item?"}>
            <p className="pg-lead" style={{ marginTop: 0, marginBottom: 16 }}>
              {statementConfirm.kind === "save"
                ? "Are you sure you want to overwrite the existing data?"
                : "Are you sure you want to delete this line item? One-off rows are removed; bond / recurring charges posted automatically are archived so they do not reappear when you reopen the statement."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="pg-btn pg-btn-primary" disabled={statementConfirmBusy} onClick={() => void runStatementConfirm()}>
                {statementConfirmBusy ? "Working…" : "Yes"}
              </button>
              <button type="button" className="pg-btn pg-btn-ghost" disabled={statementConfirmBusy} onClick={() => setStatementConfirm(null)}>
                No
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {depositModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80,
            padding: 16
          }}
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setDepositModal(null);
          }}
        >
          <Card title={`Deposit — ${depositModal.tenantLabel}`}>
            <form onSubmit={(e) => void submitDepositModal(e)} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
              <div>
                <label className="pg-muted" style={{ display: "block", marginBottom: 6 }}>
                  Deposit balance (R)
                </label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={depositModal.amount}
                  onChange={(e) => setDepositModal({ ...depositModal, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="pg-muted" style={{ display: "block", marginBottom: 6 }}>
                  Annual growth % (optional)
                </label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  max={100}
                  placeholder="e.g. 6 — monthly compound using annual ÷ 12"
                  value={depositModal.annualPct}
                  onChange={(e) => setDepositModal({ ...depositModal, annualPct: e.target.value })}
                />
                <p className="pg-muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                  Each calendar month the balance is multiplied by <strong>(1 + annual% ÷ 12)</strong>. Leave blank to disable automation and edit manually only.
                </p>
                {depositProjectedNextStep != null ? (
                  <p className="pg-muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Example next monthly step at current balance: <strong>{fmt(depositProjectedNextStep)}</strong>
                  </p>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="pg-btn pg-btn-primary" type="submit" disabled={depositSaving}>
                  {depositSaving ? "Saving…" : "Save"}
                </button>
                <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setDepositModal(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
