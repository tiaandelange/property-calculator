import { Fragment, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { AppIcon, IconButton } from "../../../components/icons";
import { invoiceDetailPath } from "../../invoices/invoiceRoutes";
import {
  canEditStatementRow,
  invoiceStatementDisplayType,
  invoiceIdFromStatementRow,
  invoiceStatementCreditClass
} from "../../invoices/invoiceStatementUtils";
import {
  invalidatePropertyQueries,
  usePropertyStatementRangeQuery,
  useSettingsQuery,
  useWorkspaceId
} from "../../queries";
import { statementFilterToPreset } from "../../settings/settingsDefaults";
import { resolveStatementPeriodRange, type StatementPeriodPreset } from "./statementPeriodRange";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { AppConfirmDialog, AppFormModal } from "../../../components/ui/AppModal";
import { Button } from "../../../components/ui/Button";
import {
  createPropertyExpense,
  createCurrentInvoiceFromLease,
  deletePropertyExpense,
  deletePropertyIncome,
  hardDeleteInvoice,
  updatePropertyExpense,
  updatePropertyIncome
} from "../../../api/ownedProperties";
import { MetricCard } from "../../../components/ui/DashboardKit";

type StatementSource = "EXPENSE" | "INCOME" | "INVOICE";

type StatementDraft = {
  rowKey: string;
  source: StatementSource;
  id: string;
  date: string;
  description: string;
  type: string;
  debit: string;
  credit: string;
  reference: string;
};

const INVOICE_STATUS_UI = [
  { value: "DRAFT", label: "Draft", api: "DRAFT" },
  { value: "GENERATED", label: "Generated", api: "GENERATED" },
  { value: "SENT", label: "Sent", api: "SENT" },
  { value: "DUE", label: "Due", api: "DUE" },
  { value: "UNPAID", label: "Unpaid", api: "SENT" },
  { value: "PARTIALLY_PAID", label: "Partially Paid", api: "PARTIALLY_PAID" },
  { value: "PAID", label: "Paid", api: "PAID" },
  { value: "OVERDUE", label: "Overdue", api: "OVERDUE" },
  { value: "CANCELLED", label: "Cancelled", api: "CANCELLED" }
] as const;

const INCOME_STATUS_UI = [
  { value: "EXPECTED", label: "Due", api: "EXPECTED" },
  { value: "RECEIVED", label: "Paid", api: "RECEIVED" },
  { value: "CANCELLED", label: "Cancelled", api: "CANCELLED" }
] as const;

function stopRowEvent(e: MouseEvent) {
  e.stopPropagation();
}

function statementRowKey(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}

function rowSourceId(r: Record<string, unknown>): string {
  return r.sourceId != null ? String(r.sourceId) : "";
}

function isExpectedRentRow(r: Record<string, unknown>): boolean {
  return (
    r.source === "INCOME" &&
    String(r.status ?? "").toUpperCase() === "EXPECTED" &&
    String(r.incomeCategory ?? "").toUpperCase() === "RENT" &&
    String(r.leaseId ?? "").trim() !== ""
  );
}

function isAmountLocked(r: Record<string, unknown>): boolean {
  if (r.source === "INVOICE") return false;
  if (r.source === "EXPENSE") {
    const cat = String(r.expenseCategory ?? "").toUpperCase();
    const typ = String(r.type ?? "").toLowerCase();
    if (cat === "BOND_PAYMENT") return true;
    if (typ.includes("recurring")) return true;
  }
  return false;
}

function canEditRow(r: Record<string, unknown>): boolean {
  return canEditStatementRow(r);
}

function invoiceUiStatus(raw: string): string {
  const s = String(raw ?? "").toUpperCase();
  if (s === "PAID") return "PAID";
  if (s === "OVERDUE") return "OVERDUE";
  if (s === "CANCELLED") return "CANCELLED";
  if (s === "DRAFT") return "DRAFT";
  if (s === "GENERATED") return "GENERATED";
  if (s === "DUE") return "DUE";
  if (s === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  return "SENT";
}

function invoiceApiStatus(uiValue: string): string {
  const hit = INVOICE_STATUS_UI.find((o) => o.value === uiValue);
  return hit?.api ?? uiValue;
}

function incomeUiStatus(raw: string): string {
  const s = String(raw ?? "").toUpperCase();
  if (s === "RECEIVED") return "RECEIVED";
  if (s === "CANCELLED") return "CANCELLED";
  return "EXPECTED";
}

function rowToDraft(r: Record<string, unknown>): StatementDraft {
  const source = r.source as StatementSource;
  const id = rowSourceId(r);
  const isExpectedIncome = source === "INCOME" && String(r.status ?? "").toUpperCase() === "EXPECTED";
  return {
    rowKey: statementRowKey(String(r.source), id),
    source,
    id,
    date: String(r.date ?? "").slice(0, 10),
    description:
      source === "INCOME"
        ? String(r.incomeDescriptionPlain ?? r.description ?? "")
        : source === "INVOICE"
          ? String(r.invoiceNotes ?? "").trim() || String(r.description ?? "")
          : String(r.description ?? ""),
    type:
      source === "EXPENSE"
        ? String(r.expenseCategory ?? "OTHER")
        : source === "INCOME"
          ? String(r.incomeCategory ?? "RENT")
          : String(r.type ?? ""),
    debit: isExpectedIncome ? String(r.debit ?? "") : source === "EXPENSE" ? String(r.debit ?? "") : "",
    credit:
      source === "INVOICE"
        ? String(r.credit ?? "")
        : source === "INCOME" && !isExpectedIncome
          ? String(r.credit ?? r.debit ?? "")
          : "",
    reference: source === "INVOICE" ? String(r.invoiceNumber ?? "") : ""
  };
}

function pfinStatusBadgeClass(source: string, statusRaw: string, uiValue?: string): string {
  const s = String(statusRaw ?? "").toUpperCase();
  const ui =
    uiValue ??
    (source === "INVOICE" ? invoiceUiStatus(s) : source === "INCOME" ? incomeUiStatus(s) : s);
  if (source === "EXPENSE") {
    if (s === "PAID" || s === "ACTIVE") return "pg-pfin-badge pg-pfin-badge--success";
    if (s === "OVERDUE") return "pg-pfin-badge pg-pfin-badge--danger";
    return "pg-pfin-badge pg-pfin-badge--muted";
  }
  if (source === "INVOICE") {
    if (ui === "PAID") return "pg-pfin-badge pg-pfin-badge--success";
    if (ui === "OVERDUE") return "pg-pfin-badge pg-pfin-badge--danger";
    if (ui === "CANCELLED" || ui === "DRAFT") return "pg-pfin-badge pg-pfin-badge--muted";
    return "pg-pfin-badge pg-pfin-badge--warning";
  }
  if (source === "INCOME") {
    if (ui === "RECEIVED") return "pg-pfin-badge pg-pfin-badge--success";
    if (ui === "CANCELLED") return "pg-pfin-badge pg-pfin-badge--muted";
    return "pg-pfin-badge pg-pfin-badge--warning";
  }
  return "pg-pfin-badge pg-pfin-badge--muted";
}

function statusLabelForRow(source: string, statusRaw: string, uiValue: string): string {
  if (source === "INVOICE") {
    return INVOICE_STATUS_UI.find((o) => o.value === uiValue)?.label ?? statusRaw;
  }
  if (source === "INCOME") {
    return INCOME_STATUS_UI.find((o) => o.value === uiValue)?.label ?? statusRaw;
  }
  const raw = String(statusRaw ?? "");
  if (raw.toUpperCase() === "ACTIVE") return "Active";
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}

function StatementStatusPicker({
  label,
  badgeClass,
  options,
  uiValue,
  disabled,
  busy,
  menuOpen,
  onToggleMenu,
  onPick
}: {
  label: string;
  badgeClass: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  uiValue: string;
  disabled?: boolean;
  busy?: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onPick: (value: string) => void;
}) {
  return (
    <div className="pg-pfin-status-picker" onClick={stopRowEvent}>
      <span className={badgeClass}>{label}</span>
      {!disabled ? (
        <>
          <button
            type="button"
            className="pg-pfin-status-picker__chev"
            aria-label="Change status"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            disabled={busy}
            onClick={(e) => {
              stopRowEvent(e);
              onToggleMenu();
            }}
          >
            <ChevronDown size={14} aria-hidden />
          </button>
          {menuOpen ? (
            <ul className="pg-pfin-status-picker__menu" role="listbox" aria-label="Status options">
              {options.map((opt) => (
                <li key={opt.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === uiValue}
                    className={`pg-pfin-status-picker__option${opt.value === uiValue ? " is-selected" : ""}`}
                    onClick={(e) => {
                      stopRowEvent(e);
                      onPick(opt.value);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function fmtZar(n: unknown): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return `R ${v.toLocaleString()}`;
}

export function WorkspaceStatementTab({
  propertyId,
}: {
  propertyId: string;
}) {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const settingsQuery = useSettingsQuery();
  const [preset, setPreset] = useState<StatementPeriodPreset>("SIX_MONTHS");
  const [presetReady, setPresetReady] = useState(false);
  const [year, setYear] = useState<number>(() => new Date().getUTCFullYear());
  const [actionError, setActionError] = useState("");
  const [showAddOnceOff, setShowAddOnceOff] = useState(false);
  const [onceOffSaving, setOnceOffSaving] = useState(false);
  const [onceOffForm, setOnceOffForm] = useState<{
    expenseDate: string;
    category: string;
    description: string;
    amount: string;
  }>(() => ({
    expenseDate: new Date().toISOString().slice(0, 10),
    category: "OTHER",
    description: "",
    amount: ""
  }));
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [draftRow, setDraftRow] = useState<StatementDraft | null>(null);
  const [rowEditError, setRowEditError] = useState("");
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [statusUpdatingRowId, setStatusUpdatingRowId] = useState<string | null>(null);
  const [statusMenuKey, setStatusMenuKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const periodRange = useMemo(() => resolveStatementPeriodRange(preset, year), [preset, year]);
  const statementQuery = usePropertyStatementRangeQuery(
    propertyId,
    { ...periodRange, includeExpected: true },
    { enabled: presetReady }
  );
  const rows = (statementQuery.data?.statementRows as Record<string, unknown>[] | undefined) ?? [];
  const loading = !presetReady || statementQuery.isLoading;
  const error =
    actionError ||
    (statementQuery.error instanceof Error
      ? statementQuery.error.message
      : statementQuery.error
        ? "Failed to load statement."
        : "");

  useEffect(() => {
    if (settingsQuery.data) {
      setPreset(statementFilterToPreset(settingsQuery.data.statementDefaultFilter) as StatementPeriodPreset);
    }
    if (!settingsQuery.isLoading) {
      setPresetReady(true);
    }
  }, [settingsQuery.data, settingsQuery.isLoading]);

  useEffect(() => {
    if (!statusMenuKey) return;
    const close = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".pg-pfin-status-picker")) return;
      setStatusMenuKey(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [statusMenuKey]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const r of rows) {
      const d = Number(r.debit ?? 0);
      const c = Number(r.credit ?? 0);
      if (Number.isFinite(d)) debit += d;
      // match existing statement behavior: unpaid invoice credits are shown but excluded from balance
      const isUnpaidInvoice = r.source === "INVOICE" && String(r.status ?? "") !== "PAID";
      if (!isUnpaidInvoice && Number.isFinite(c)) credit += c;
    }
    return { debit, credit, net: credit - debit };
  }, [rows]);

  const periodTotals = totals;

  const reload = () => {
    setActionError("");
    invalidatePropertyQueries({
      workspaceId: workspaceId ?? undefined,
      propertyId
    });
  };

  async function addOnceOffExpense() {
    const amount = Number(String(onceOffForm.amount ?? "").trim());
    if (!onceOffForm.description.trim()) {
      setActionError("Description is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Enter a valid amount.");
      return;
    }
    setOnceOffSaving(true);
    setActionError("");
    try {
      await createPropertyExpense(propertyId, {
        category: onceOffForm.category,
        description: onceOffForm.description.trim(),
        amount,
        expenseDate: onceOffForm.expenseDate
      });
      setShowAddOnceOff(false);
      setOnceOffForm({
        expenseDate: new Date().toISOString().slice(0, 10),
        category: "OTHER",
        description: "",
        amount: ""
      });
      await reload();
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to add expense.");
    } finally {
      setOnceOffSaving(false);
    }
  }

  async function performDeleteExpense(expenseId: string) {
    setDeletingRowId(expenseId);
    setActionError("");
    try {
      await deletePropertyExpense(expenseId);
      setConfirmDelete(null);
      await reload();
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to delete expense.");
    } finally {
      setDeletingRowId(null);
    }
  }

  function beginRowEdit(r: Record<string, unknown>) {
    const sourceId = rowSourceId(r);
    if (!sourceId || !canEditRow(r)) return;
    const draft = rowToDraft(r);
    if (editingRowKey && editingRowKey !== draft.rowKey) {
      cancelRowEdit();
    }
    setRowEditError("");
    setEditingRowKey(draft.rowKey);
    setDraftRow(draft);
  }

  function cancelRowEdit() {
    setEditingRowKey(null);
    setDraftRow(null);
    setRowEditError("");
  }

  async function saveRowEdit() {
    if (!draftRow?.id) return;
    if (!String(draftRow.description ?? "").trim()) {
      setRowEditError("Description is required.");
      return;
    }

    const debitNum = Number(String(draftRow.debit ?? "").trim());
    const creditNum = Number(String(draftRow.credit ?? "").trim());
    const hasDebit = String(draftRow.debit ?? "").trim() !== "";
    const hasCredit = String(draftRow.credit ?? "").trim() !== "";
    if (hasDebit && hasCredit && debitNum > 0 && creditNum > 0) {
      setRowEditError("Enter either a debit or a credit amount, not both.");
      return;
    }
    if (hasDebit && debitNum < 0) {
      setRowEditError("Debit cannot be negative.");
      return;
    }
    if (hasCredit && creditNum < 0) {
      setRowEditError("Credit cannot be negative.");
      return;
    }

    setSavingRowId(draftRow.id);
    setRowEditError("");
    setActionError("");
    try {
      if (draftRow.source === "EXPENSE") {
        const amount = debitNum;
        if (!Number.isFinite(amount) || amount <= 0) {
          setRowEditError("Enter a valid debit amount.");
          return;
        }
        await updatePropertyExpense(String(draftRow.id), {
          description: String(draftRow.description).trim(),
          amount,
          expenseDate: String(draftRow.date ?? "").trim() || undefined,
          category: String(draftRow.type ?? "OTHER")
        });
      } else if (draftRow.source === "INCOME") {
        const amount = hasDebit ? debitNum : creditNum;
        if (!Number.isFinite(amount) || amount < 0) {
          setRowEditError("Enter a valid amount.");
          return;
        }
        await updatePropertyIncome(String(draftRow.id), {
          description: String(draftRow.description).trim(),
          amount,
          incomeDate: String(draftRow.date ?? "").trim() || undefined,
          category: String(draftRow.type ?? "RENT")
        });
      } else {
        setRowEditError("This line must be edited on the invoice page.");
        return;
      }
      cancelRowEdit();
      await reload();
    } catch (e: any) {
      setRowEditError(e?.message ?? "Failed to save line item.");
    } finally {
      setSavingRowId(null);
    }
  }

  async function applyRowStatus(source: "INCOME", id: string, uiStatus: string) {
    setStatusUpdatingRowId(id);
    setActionError("");
    try {
      const mapped = INCOME_STATUS_UI.find((o) => o.value === uiStatus)?.api ?? uiStatus;
      await updatePropertyIncome(String(id), { status: mapped });
      await reload();
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to update status.");
      throw e;
    } finally {
      setStatusUpdatingRowId(null);
    }
  }

  async function openInvoiceForRow(r: Record<string, unknown>) {
    setActionError("");
    try {
      if (r.source === "INVOICE" && rowSourceId(r)) {
        navigate(invoiceDetailPath(invoiceIdFromStatementRow(r)));
        return;
      }
      if (isExpectedRentRow(r)) {
        const leaseId = String(r.leaseId).trim();
        const created = await createCurrentInvoiceFromLease(propertyId, leaseId);
        const invoiceId = String((created as { invoiceId?: string }).invoiceId ?? "");
        if (!invoiceId) throw new Error("Invoice could not be created.");
        navigate(invoiceDetailPath(invoiceId));
        return;
      }
      throw new Error("Invoice is not available for this line.");
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not open invoice.");
    }
  }

  function deleteActionEnabled(r: Record<string, unknown>): boolean {
    return !!rowSourceId(r) && (r.source === "EXPENSE" || r.source === "INCOME" || r.source === "INVOICE");
  }

  return (
    <div className="pg-workspace-inset-list">
      {error ? (
        <div className="pg-alert pg-alert-error" role="alert">
          {error}
        </div>
      ) : null}

      <div
        className="pg-metric-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          ["--workspace-card-pad" as any]: "clamp(12px, 1vw, 16px)"
        }}
      >
        <MetricCard title="Income received" value={fmtZar(totals.credit)} subtitle="Paid credits only" iconPreset="monthly-income" />
        <MetricCard title="Expenses" value={fmtZar(totals.debit)} subtitle="Debits" iconPreset="expenses" />
        <MetricCard title="Net position" value={fmtZar(totals.net)} subtitle="Paid credits − debits" iconPreset="cash-flow" />
      </div>

      {(rows?.length ?? 0) === 0 && !loading ? <div className="pg-muted">No statement lines found.</div> : null}
      {(rows?.length ?? 0) > 0 ? (
        <section className="pg-pfin-section" aria-label="Statement">
          <header className="pg-pfin-section__head pg-pfin-section__head--row">
            <div>
              <h2 className="pg-pfin-section__title">Statement</h2>
              <p className="pg-pfin-section__desc">Accounting-style ledger lines (income, expenses, invoices).</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
              <select className="pg-input" value={preset} onChange={(e) => setPreset(e.target.value as StatementPeriodPreset)} aria-label="Statement period">
                <option value="LAST_MONTH">Last month</option>
                <option value="SIX_MONTHS">6 months (default)</option>
                <option value="YTD">Year to date</option>
                <option value="TWELVE_MONTHS">12 months</option>
                <option value="PER_YEAR">Per year</option>
                <option value="FOREVER">Forever</option>
              </select>
              {preset === "PER_YEAR" ? (
                <select className="pg-input" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const y = new Date().getUTCFullYear() - i;
                    return (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              ) : null}
              <Button
                type="button"
                iconLeft="add"
                style={{ minWidth: 152, justifyContent: "center", whiteSpace: "nowrap" }}
                onClick={() => setShowAddOnceOff(true)}
              >
                Add Expense
              </Button>
              <Button
                type="button"
                variant="soft"
                iconLeft="pdf"
                style={{ minWidth: 140, justifyContent: "center", whiteSpace: "nowrap" }}
                disabled
                title="Coming next: Statement PDF export"
              >
                Export PDF
              </Button>
            </div>
          </header>
          <div className="pg-ptable-wrap pg-ptable-wrap--responsive">
            <table className="pg-ptable pg-ptable--financial pg-pfin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Debit</th>
                  <th style={{ textAlign: "right" }}>Credit</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th className="pg-statement-table__actions">
                    <span className="pg-fins-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: Record<string, unknown>) => {
                const creditClass =
                  r.source === "INVOICE" ? invoiceStatementCreditClass(String(r.status ?? "")) : "";
                const sourceId = rowSourceId(r);
                const rowKey = r.id != null ? String(r.id) : `${String(r.source)}-${String(r.date)}-${String(r.description)}`;
                const editKey = sourceId ? statementRowKey(String(r.source), sourceId) : "";
                const isEditing = editingRowKey != null && editingRowKey === editKey && draftRow != null;
                const draft = isEditing ? draftRow : null;
                const amountLocked = isAmountLocked(r);
                const isExpectedIncome =
                  r.source === "INCOME" && String(r.status ?? "").toUpperCase() === "EXPECTED";
                const statusUiValue =
                  r.source === "INVOICE"
                    ? invoiceUiStatus(String(r.status ?? ""))
                    : r.source === "INCOME"
                      ? incomeUiStatus(String(r.status ?? ""))
                      : String(r.status ?? "");
                const rowSaving = savingRowId === sourceId;
                const rowBusy = deletingRowId === sourceId;
                const rowStatusBusy = statusUpdatingRowId === sourceId;

                return (
                  <Fragment key={rowKey}>
                  <tr>
                    <td style={{ verticalAlign: "middle" }}>
                      {isEditing && draft ? (
                        <Input
                          type="date"
                          value={draft.date}
                          onChange={(e) => setDraftRow((s) => (s ? { ...s, date: e.target.value } : s))}
                          style={{ height: 34 }}
                          onClick={stopRowEvent}
                        />
                      ) : (
                        String(r.date ?? "")
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle", minWidth: 180 }}>
                      {isEditing && draft ? (
                        <Input
                          value={draft.description}
                          onChange={(e) => setDraftRow((s) => (s ? { ...s, description: e.target.value } : s))}
                          style={{ height: 34 }}
                          onClick={stopRowEvent}
                        />
                      ) : (
                        <div>
                          <div>{String(r.description ?? "")}</div>
                          {r.source === "INVOICE" && r.invoiceNumber ? (
                            <div className="pg-caption" style={{ marginTop: 2 }}>
                              Ref: {String(r.invoiceNumber)}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle", minWidth: 140 }}>
                      {isEditing && draft && draft.source !== "INVOICE" ? (
                        <Select
                          value={draft.type}
                          onChange={(e) => setDraftRow((s) => (s ? { ...s, type: e.target.value } : s))}
                          style={{ height: 34 }}
                          onClick={stopRowEvent}
                        >
                          {draft.source === "EXPENSE" ? (
                            <>
                              <option value="OTHER">Other</option>
                              <option value="MAINTENANCE">Maintenance</option>
                              <option value="RATES_TAXES">Rates &amp; Taxes</option>
                              <option value="LEVIES">Levies</option>
                              <option value="INSURANCE">Insurance</option>
                              <option value="ELECTRICITY">Electricity</option>
                              <option value="WATER_SEWER">Water &amp; Sewer</option>
                              <option value="SECURITY">Security</option>
                              <option value="WIFI">Wi-Fi</option>
                            </>
                          ) : (
                            <>
                              <option value="RENT">Rent</option>
                              <option value="OTHER">Other</option>
                            </>
                          )}
                        </Select>
                      ) : (
                        invoiceStatementDisplayType(r)
                      )}
                    </td>
                    <td className="pg-pfin-table__amount" style={{ textAlign: "right" }}>
                      {isEditing && draft && (draft.source === "EXPENSE" || (draft.source === "INCOME" && isExpectedIncome)) ? (
                        amountLocked ? (
                          <span title="Edit the source record to change this amount.">{fmtZar(r.debit)}</span>
                        ) : (
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={draft.debit}
                            onChange={(e) => setDraftRow((s) => (s ? { ...s, debit: e.target.value, credit: "" } : s))}
                            style={{ height: 34, textAlign: "right" }}
                            onClick={stopRowEvent}
                          />
                        )
                      ) : r.debit != null ? (
                        fmtZar(r.debit)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`pg-pfin-table__amount ${creditClass}`} style={{ textAlign: "right" }}>
                      {isEditing && draft && (draft.source === "INVOICE" || (draft.source === "INCOME" && !isExpectedIncome)) ? (
                        amountLocked ? (
                          <span title="Edit the source record to change this amount.">{fmtZar(r.credit)}</span>
                        ) : (
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={draft.credit}
                            onChange={(e) => setDraftRow((s) => (s ? { ...s, credit: e.target.value, debit: "" } : s))}
                            style={{ height: 34, textAlign: "right" }}
                            onClick={stopRowEvent}
                          />
                        )
                      ) : r.credit != null ? (
                        fmtZar(r.credit)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      {r.source === "INVOICE" && sourceId ? (
                        <span className={pfinStatusBadgeClass("INVOICE", String(r.status ?? ""), statusUiValue)}>
                          {statusLabelForRow("INVOICE", String(r.status ?? ""), statusUiValue)}
                        </span>
                      ) : r.source === "INCOME" && sourceId ? (
                        <StatementStatusPicker
                          label={statusLabelForRow("INCOME", String(r.status ?? ""), statusUiValue)}
                          badgeClass={pfinStatusBadgeClass("INCOME", String(r.status ?? ""), statusUiValue)}
                          options={INCOME_STATUS_UI}
                          uiValue={statusUiValue}
                          disabled={isEditing}
                          busy={rowStatusBusy}
                          menuOpen={statusMenuKey === editKey}
                          onToggleMenu={() => setStatusMenuKey((k) => (k === editKey ? null : editKey))}
                          onPick={(v) => {
                            setStatusMenuKey(null);
                            void applyRowStatus("INCOME", sourceId, v).catch(() => undefined);
                          }}
                        />
                      ) : (
                        <span className={pfinStatusBadgeClass(String(r.source ?? ""), String(r.status ?? ""))}>
                          {statusLabelForRow(String(r.source ?? ""), String(r.status ?? ""), statusUiValue)}
                        </span>
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle" }}>{String(r.source ?? "")}</td>
                    <td className="pg-statement-table__actions" style={{ verticalAlign: "middle" }}>
                      <div className="pg-statement-row-actions" onClick={stopRowEvent}>
                      {isEditing ? (
                            <>
                              <IconButton
                                icon="save"
                                aria-label="Save"
                                variant="primary"
                                disabled={rowSaving}
                                onClick={(e) => {
                                  stopRowEvent(e);
                                  void saveRowEdit();
                                }}
                              />
                              <IconButton
                                icon="cancel"
                                aria-label="Cancel"
                                variant="danger"
                                disabled={rowSaving}
                                onClick={(e) => {
                                  stopRowEvent(e);
                                  cancelRowEdit();
                                }}
                              />
                            </>
                          ) : (
                            <>
                              {isExpectedRentRow(r) ? (
                                <IconButton
                                  icon="add"
                                  aria-label="Create invoice"
                                  disabled={rowBusy}
                                  onClick={(e) => {
                                    stopRowEvent(e);
                                    void openInvoiceForRow(r);
                                  }}
                                />
                              ) : null}
                              {r.source === "INVOICE" && sourceId ? (
                                <IconButton
                                  icon="open"
                                  aria-label="View invoice"
                                  disabled={rowBusy}
                                  href={invoiceDetailPath(invoiceIdFromStatementRow(r))}
                                  onClick={stopRowEvent}
                                />
                              ) : null}
                              {canEditRow(r) ? (
                                <IconButton
                                  icon="edit"
                                  aria-label="Edit"
                                  disabled={rowSaving || rowBusy}
                                  onClick={(e) => {
                                    stopRowEvent(e);
                                    if (editingRowKey && editingRowKey !== editKey) cancelRowEdit();
                                    beginRowEdit(r);
                                  }}
                                />
                              ) : null}
                              <IconButton
                                icon="delete"
                                aria-label="Delete"
                                variant="danger"
                                disabled={!deleteActionEnabled(r) || rowBusy}
                                onClick={(e) => {
                                  stopRowEvent(e);
                                  if (r.source === "INVOICE") {
                                    setConfirmDelete({
                                      kind: "invoice_hard",
                                      id: sourceId,
                                      description: String(r.description ?? "this invoice line item")
                                    });
                                    return;
                                  }
                                  if (r.source === "INCOME") {
                                    setConfirmDelete({
                                      kind: "income",
                                      id: sourceId,
                                      description: String(r.description ?? "")
                                    });
                                    return;
                                  }
                                  setConfirmDelete({
                                    kind: "expense",
                                    id: sourceId,
                                    description: String(r.description ?? "")
                                  });
                                }}
                              />
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                  {isEditing && rowEditError ? (
                    <tr key={`${rowKey}-error`} className="pg-statement-row-error">
                      <td colSpan={8}>
                        <p className="pg-statement-row-error-msg" role="alert">
                          {rowEditError}
                        </p>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 800 }}>
                    Totals
                  </td>
                  <td className="pg-pfin-table__amount" style={{ textAlign: "right", fontWeight: 800 }}>
                    {fmtZar(periodTotals.debit)}
                  </td>
                  <td className="pg-pfin-table__amount" style={{ textAlign: "right", fontWeight: 800 }}>
                    {fmtZar(periodTotals.credit)}
                  </td>
                  <td colSpan={3} className="pg-text-helper">
                    Net: {fmtZar(periodTotals.net)} (paid credits − debits)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <AppFormModal
        open={showAddOnceOff}
        onOpenChange={(next) => {
          if (!next && !onceOffSaving) setShowAddOnceOff(false);
        }}
        title="Add once-off expense"
        size="md"
        loading={onceOffSaving}
        closeOnOverlayClick={!onceOffSaving}
        footer={
          <div className="pg-app-modal-actions">
            <Button type="button" variant="soft" disabled={onceOffSaving} onClick={() => setShowAddOnceOff(false)}>
              Cancel
            </Button>
            <Button type="button" loading={onceOffSaving} disabled={onceOffSaving} onClick={() => void addOnceOffExpense()}>
              Add
            </Button>
          </div>
        }
      >
        <label className="pg-text-label">
          Date
          <Input type="date" value={onceOffForm.expenseDate} onChange={(e) => setOnceOffForm({ ...onceOffForm, expenseDate: e.target.value })} />
        </label>
        <label className="pg-text-label">
          Category
          <select className="pg-input" value={onceOffForm.category} onChange={(e) => setOnceOffForm({ ...onceOffForm, category: e.target.value })}>
            <option value="OTHER">Other</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RATES_TAXES">Rates &amp; Taxes</option>
            <option value="LEVIES">Levies</option>
            <option value="INSURANCE">Insurance</option>
            <option value="ELECTRICITY">Electricity</option>
            <option value="WATER_SEWER">Water &amp; Sewer</option>
            <option value="SECURITY">Security</option>
            <option value="WIFI">Wi-Fi</option>
          </select>
        </label>
        <label className="pg-text-label">
          Description
          <Input value={onceOffForm.description} onChange={(e) => setOnceOffForm({ ...onceOffForm, description: e.target.value })} placeholder="e.g. Plumber callout" />
        </label>
        <label className="pg-text-label">
          Amount
          <Input type="number" step="any" min={0} value={onceOffForm.amount} onChange={(e) => setOnceOffForm({ ...onceOffForm, amount: e.target.value })} />
        </label>
      </AppFormModal>

      <AppConfirmDialog
        open={confirmDelete != null}
        title="Delete item"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          const kind = String(confirmDelete.kind ?? "expense");
          if (kind === "income") {
            void (async () => {
              const id = String(confirmDelete.id);
              setDeletingRowId(id);
              setActionError("");
              try {
                await deletePropertyIncome(id);
                setConfirmDelete(null);
                await reload();
              } catch (e: any) {
                setActionError(e?.message ?? "Failed to delete income.");
              } finally {
                setDeletingRowId(null);
              }
            })();
            return;
          }
          if (kind === "invoice_hard") {
            void (async () => {
              const id = String(confirmDelete.id);
              setDeletingRowId(id);
              setActionError("");
              try {
                await hardDeleteInvoice(id);
                setConfirmDelete(null);
                await reload();
              } catch (e: any) {
                setActionError(e?.message ?? "Failed to delete invoice.");
              } finally {
                setDeletingRowId(null);
              }
            })();
            return;
          }
          void performDeleteExpense(String(confirmDelete.id));
        }}
      >
        {String(confirmDelete?.kind ?? "") === "invoice_hard" ? (
          <p style={{ margin: 0 }}>Are you sure you want to permanently delete line item?</p>
        ) : (
          <p style={{ margin: 0 }}>
            Delete <strong>{confirmDelete?.description || "this expense"}</strong>?
          </p>
        )}
      </AppConfirmDialog>
    </div>
  );
}

