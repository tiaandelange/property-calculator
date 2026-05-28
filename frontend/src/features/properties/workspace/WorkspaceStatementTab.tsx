import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Check, ChevronDown, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { getPropertyStatement } from "../../../api/ownedProperties";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { ModalOverlay, ModalPanel } from "../../../components/ui/Modal";
import {
  createPropertyExpense,
  createCurrentInvoiceFromLease,
  deletePropertyExpense,
  deletePropertyIncome,
  getInvoice,
  hardDeleteInvoice,
  markInvoicePaid,
  updateInvoice,
  updatePropertyExpense,
  updatePropertyIncome
} from "../../../api/ownedProperties";
import { MetricCard } from "../../../components/ui/DashboardKit";

type PeriodPreset = "LAST_MONTH" | "SIX_MONTHS" | "YTD" | "TWELVE_MONTHS" | "PER_YEAR" | "FOREVER";
const INCOME_STATUS_OPTIONS = ["EXPECTED", "RECEIVED", "CANCELLED"] as const;
const INVOICE_STATUS_PICKER_OPTIONS = ["DRAFT", "SENT", "UNPAID", "PAID", "OVERDUE", "CANCELLED"] as const;

function monthIdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthSequenceUtc(start: Date, endInclusive: Date): string[] {
  const out: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const end = new Date(Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth(), 1));
  while (cur <= end) {
    out.push(monthIdUtc(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

function utcStartOfYear(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
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
  const [preset, setPreset] = useState<PeriodPreset>("SIX_MONTHS");
  const [year, setYear] = useState<number>(() => new Date().getUTCFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
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
  const [inlineEdit, setInlineEdit] = useState<null | {
    source: "EXPENSE" | "INCOME";
    id: string;
    date: string;
    description: string;
    type: string;
    debit: string;
    credit: string;
  }>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [statusPick, setStatusPick] = useState<null | { source: "INVOICE" | "INCOME"; id: string; status: string }>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const monthIds = useMemo(() => {
    const now = new Date();
    if (preset === "FOREVER") return null;

    if (preset === "PER_YEAR") {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year, 11, 1));
      return monthSequenceUtc(start, end);
    }

    if (preset === "YTD") {
      return monthSequenceUtc(utcStartOfYear(now), now);
    }

    if (preset === "LAST_MONTH") {
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return [monthIdUtc(last)];
    }

    if (preset === "TWELVE_MONTHS" || preset === "SIX_MONTHS") {
      const back = preset === "TWELVE_MONTHS" ? 11 : 5;
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      return monthSequenceUtc(start, now);
    }

    return monthSequenceUtc(now, now);
  }, [preset, year]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        // FOREVER is intentionally limited to 12 months for safety until a range RPC exists.
        const ids =
          monthIds ??
          monthSequenceUtc(
            new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1)),
            new Date()
          );

        const stmts = await Promise.all(
          ids.map((m) => getPropertyStatement(propertyId, { month: m, includeExpected: true, bustCache: true }).catch(() => null))
        );

        if (cancelled) return;
        const mergedRaw = stmts
          .flatMap((s) => (s ? ((s as any).statementRows ?? []) : []))
          .filter(Boolean);

        // Dedupe across months: some RPC views can repeat open invoices/rows when you query multiple months.
        const byKey = new Map<string, any>();
        for (const r of mergedRaw) {
          const key =
            r?.id != null && String(r.id).trim() !== ""
              ? `id:${String(r.id)}`
              : `row:${String(r.source ?? "")}|${String(r.type ?? "")}|${String(r.date ?? "")}|${String(r.description ?? "")}|${String(
                  r.debit ?? ""
                )}|${String(r.credit ?? "")}`;
          if (!byKey.has(key)) byKey.set(key, r);
        }
        const merged = Array.from(byKey.values());
        merged.sort(
          (a: any, b: any) =>
            String(a.date ?? "").localeCompare(String(b.date ?? "")) || String(a.id ?? "").localeCompare(String(b.id ?? ""))
        );
        setRows(merged);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load statement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, monthIds, reloadKey]);

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

  const reload = async () => {
    setReloadKey((k) => k + 1);
  };

  async function addOnceOffExpense() {
    const amount = Number(String(onceOffForm.amount ?? "").trim());
    if (!onceOffForm.description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setOnceOffSaving(true);
    setError("");
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
      setError(e?.message ?? "Failed to add expense.");
    } finally {
      setOnceOffSaving(false);
    }
  }

  async function saveExpenseEdit() {
    // Deprecated: inline edit only.
  }

  async function performDeleteExpense(expenseId: string) {
    setError("");
    try {
      await deletePropertyExpense(expenseId);
      setConfirmDelete(null);
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete expense.");
    }
  }

  async function saveIncomeEdit() {
    // Deprecated: inline edit only.
  }

  async function saveInlineEdit() {
    if (!inlineEdit?.id) return;
    if (!String(inlineEdit.description ?? "").trim()) {
      setError("Description is required.");
      return;
    }

    setInlineSaving(true);
    setError("");
    try {
      if (inlineEdit.source === "EXPENSE") {
        const amount = Number(String(inlineEdit.debit ?? "").trim());
        if (!Number.isFinite(amount) || amount <= 0) {
          setError("Enter a valid debit amount.");
          return;
        }
        await updatePropertyExpense(String(inlineEdit.id), {
          description: String(inlineEdit.description).trim(),
          amount,
          expenseDate: String(inlineEdit.date ?? "").trim() || undefined,
          category: String(inlineEdit.type ?? "OTHER")
        });
      } else {
        const amount = Number(String(inlineEdit.credit ?? "").trim());
        if (!Number.isFinite(amount) || amount < 0) {
          setError("Enter a valid credit amount.");
          return;
        }
        await updatePropertyIncome(String(inlineEdit.id), {
          description: String(inlineEdit.description).trim(),
          amount,
          incomeDate: String(inlineEdit.date ?? "").trim() || undefined,
          category: String(inlineEdit.type ?? "RENT")
        });
      }
      setInlineEdit(null);
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save line item.");
    } finally {
      setInlineSaving(false);
    }
  }

  async function setRowStatus(source: "INVOICE" | "INCOME", id: string, status: string) {
    setStatusSaving(true);
    setError("");
    try {
      if (source === "INVOICE") {
        const mapped = status === "UNPAID" ? "SENT" : status;
        if (mapped === "PAID") {
          await markInvoicePaid(String(id));
        } else {
          await updateInvoice(String(id), { status: mapped });
        }
      } else {
        await updatePropertyIncome(String(id), { status });
      }
      setStatusPick(null);
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update status.");
    } finally {
      setStatusSaving(false);
    }
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
        <div className="pg-statement-wrap">
          <div className="pg-statement-topbar">
            <div className="pg-statement-topbar__title">Statement</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
              <select className="pg-input" value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)} aria-label="Statement period">
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
              <button
                type="button"
                className="pg-btn pg-btn-primary"
                style={{ minWidth: 152, justifyContent: "center", whiteSpace: "nowrap" }}
                onClick={() => setShowAddOnceOff(true)}
              >
                <Plus size={16} style={{ marginRight: 6 }} aria-hidden />
                Add Expense
              </button>
              <button
                type="button"
                className="pg-btn pg-btn-secondary"
                style={{ minWidth: 140, justifyContent: "center", whiteSpace: "nowrap" }}
                disabled
                title="Coming next: Statement PDF export"
              >
                <ExternalLink size={16} style={{ marginRight: 6 }} aria-hidden />
                Export PDF
              </button>
            </div>
          </div>
          <table className="pg-statement-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th className="pg-statement-num">Debit</th>
                <th className="pg-statement-num">Credit</th>
                <th>Status</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const creditClass = r.source === "INVOICE" && r.status !== "PAID" ? " pg-statement-credit-unpaid" : "";
                const sourceId = r.sourceId != null ? String(r.sourceId) : "";
                const canEditExpense = r.source === "EXPENSE" && sourceId;
                const canEditIncome = r.source === "INCOME" && sourceId;
                const canEditInvoice = r.source === "INVOICE" && sourceId;
                const isEditing = inlineEdit != null && inlineEdit.id === sourceId && inlineEdit.source === r.source;
                const isExpectedRent =
                  r.source === "INCOME" &&
                  String(r.status ?? "").toUpperCase() === "EXPECTED" &&
                  String(r.incomeCategory ?? "").toUpperCase() === "RENT" &&
                  String(r.leaseId ?? "").trim() !== "";
                return (
                  <tr key={r.id ?? `${r.source}-${r.date}-${r.description}`}>
                    <td style={{ verticalAlign: "middle" }}>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={inlineEdit?.date ?? ""}
                          onChange={(e) => setInlineEdit((s) => (s ? { ...s, date: e.target.value } : s))}
                          style={{ height: 34 }}
                        />
                      ) : (
                        String(r.date ?? "")
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle", minWidth: 180 }}>
                      {isEditing ? (
                        <Input
                          value={inlineEdit?.description ?? ""}
                          onChange={(e) => setInlineEdit((s) => (s ? { ...s, description: e.target.value } : s))}
                          style={{ height: 34 }}
                        />
                      ) : (
                        String(r.description ?? "")
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle", minWidth: 140 }}>
                      {isEditing ? (
                        <select
                          className="pg-input"
                          value={String(inlineEdit?.type ?? "")}
                          onChange={(e) => setInlineEdit((s) => (s ? { ...s, type: e.target.value } : s))}
                          style={{ height: 34 }}
                        >
                          {inlineEdit?.source === "EXPENSE" ? (
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
                        </select>
                      ) : (
                        String(r.type ?? "")
                      )}
                    </td>
                    <td className="pg-statement-num" style={{ verticalAlign: "middle" }}>
                      {isEditing && inlineEdit?.source === "EXPENSE" ? (
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={inlineEdit?.debit ?? ""}
                          onChange={(e) => setInlineEdit((s) => (s ? { ...s, debit: e.target.value } : s))}
                          style={{ height: 34, textAlign: "right" }}
                        />
                      ) : r.debit != null ? (
                        fmtZar(r.debit)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`pg-statement-num${creditClass}`} style={{ verticalAlign: "middle" }}>
                      {isEditing && inlineEdit?.source === "INCOME" ? (
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={inlineEdit?.credit ?? ""}
                          onChange={(e) => setInlineEdit((s) => (s ? { ...s, credit: e.target.value } : s))}
                          style={{ height: 34, textAlign: "right" }}
                        />
                      ) : r.credit != null ? (
                        fmtZar(r.credit)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {statusPick && statusPick.id === sourceId && statusPick.source === r.source ? (
                          <select
                            className="pg-input"
                            value={String(statusPick.status ?? "")}
                            onChange={(e) => {
                              const v = e.target.value;
                              setStatusPick((s) => (s ? { ...s, status: v } : s));
                              void setRowStatus(statusPick.source, sourceId, v);
                            }}
                            disabled={statusSaving}
                            style={{ height: 34 }}
                          >
                            {statusPick.source === "INVOICE"
                              ? INVOICE_STATUS_PICKER_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))
                              : INCOME_STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {s === "EXPECTED" ? "UNPAID" : s === "RECEIVED" ? "PAID" : "CANCELLED"}
                                  </option>
                                ))}
                          </select>
                        ) : (
                          <>
                            <span>{String(r.status ?? "")}</span>
                          </>
                        )}
                        {(canEditInvoice || canEditIncome) && sourceId ? (
                          <button
                            type="button"
                            className="pg-btn pg-btn-ghost"
                            style={{ padding: 4, width: 26, height: 26, display: "grid", placeItems: "center" }}
                            onClick={() =>
                              setStatusPick({
                                source: canEditInvoice ? "INVOICE" : "INCOME",
                                id: sourceId,
                                status: String(r.status ?? "")
                              })
                            }
                            aria-label="Change status"
                            title="Change status"
                          >
                            <ChevronDown size={16} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td style={{ verticalAlign: "middle" }}>{String(r.source ?? "")}</td>
                    <td style={{ verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      {canEditExpense ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "nowrap", alignItems: "center" }}>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="pg-btn pg-btn-ghost"
                                style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center" }}
                                onClick={() => void saveInlineEdit()}
                                aria-label="Save"
                                title="Save"
                                disabled={inlineSaving}
                              >
                                <Check size={16} aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="pg-btn pg-btn-ghost"
                                style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center" }}
                                onClick={() => setInlineEdit(null)}
                                aria-label="Cancel"
                                title="Cancel"
                                disabled={inlineSaving}
                              >
                                <X size={16} aria-hidden />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="pg-btn pg-btn-ghost"
                              style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center" }}
                              onClick={() =>
                                setInlineEdit({
                                  source: "EXPENSE",
                                  id: sourceId,
                                  date: String(r.date ?? "").slice(0, 10),
                                  description: String(r.description ?? ""),
                                  type: String(r.expenseCategory ?? "OTHER"),
                                  debit: String(r.debit ?? ""),
                                  credit: ""
                                })
                              }
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Pencil size={16} aria-hidden />
                            </button>
                          )}
                          <button
                            type="button"
                            className="pg-btn pg-btn-ghost"
                            style={{
                              padding: 6,
                              width: 32,
                              height: 32,
                              display: "grid",
                              placeItems: "center",
                              color: "var(--danger)"
                            }}
                            onClick={() => setConfirmDelete({ kind: "expense", id: sourceId, description: String(r.description ?? "") })}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      ) : canEditIncome ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "nowrap", alignItems: "center" }}>
                          {isExpectedRent ? (
                            <button
                              type="button"
                              className="pg-btn pg-btn-secondary"
                              style={{
                                padding: 6,
                                width: 32,
                                height: 32,
                                display: "grid",
                                placeItems: "center",
                                color: "var(--primary)"
                              }}
                              onClick={async () => {
                                setError("");
                                try {
                                  const leaseId = String(r.leaseId).trim();
                                  const created = await createCurrentInvoiceFromLease(propertyId, leaseId);
                                  const invoiceId = String(created.invoiceId ?? "");
                                  if (!invoiceId) throw new Error("Invoice could not be created.");
                                  const inv = await getInvoice(invoiceId);
                                  const invAny = inv as any;
                                  const invoiceAny = (invAny?.invoice ?? invAny) as any;
                                  const tenantId = String(
                                    invoiceAny?.tenantId ??
                                      invoiceAny?.tenant_id ??
                                      invAny?.tenantId ??
                                      invAny?.tenant_id ??
                                      ""
                                  );
                                  if (!tenantId) throw new Error("Invoice created, but tenant id was missing.");
                                  navigate(`/tenants/${tenantId}/invoices/${invoiceId}`);
                                } catch (e: any) {
                                  setError(e?.message ?? "Could not generate invoice.");
                                }
                              }}
                              aria-label="Create Invoice"
                              title="Create Invoice"
                            >
                              <BookOpen size={16} aria-hidden />
                            </button>
                          ) : null}
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="pg-btn pg-btn-ghost"
                                style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center" }}
                                onClick={() => void saveInlineEdit()}
                                aria-label="Save"
                                title="Save"
                                disabled={inlineSaving}
                              >
                                <Check size={16} aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="pg-btn pg-btn-ghost"
                                style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center" }}
                                onClick={() => setInlineEdit(null)}
                                aria-label="Cancel"
                                title="Cancel"
                                disabled={inlineSaving}
                              >
                                <X size={16} aria-hidden />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="pg-btn pg-btn-ghost"
                              style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center" }}
                              onClick={() =>
                                setInlineEdit({
                                  source: "INCOME",
                                  id: sourceId,
                                  date: String(r.date ?? "").slice(0, 10),
                                  description: String(r.incomeDescriptionPlain ?? r.description ?? ""),
                                  type: String(r.incomeCategory ?? "RENT"),
                                  debit: "",
                                  credit: String(r.credit ?? r.debit ?? "")
                                })
                              }
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Pencil size={16} aria-hidden />
                            </button>
                          )}
                          <button
                            type="button"
                            className="pg-btn pg-btn-ghost"
                            style={{
                              padding: 6,
                              width: 32,
                              height: 32,
                              display: "grid",
                              placeItems: "center",
                              color: "var(--danger)"
                            }}
                            onClick={() => setConfirmDelete({ kind: "income", id: sourceId, description: String(r.description ?? "") })}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      ) : canEditInvoice ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "nowrap", alignItems: "center" }}>
                          <button
                            type="button"
                            className="pg-btn pg-btn-ghost"
                            style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center", color: "var(--primary)" }}
                            onClick={async () => {
                              setError("");
                              try {
                                const inv = await getInvoice(sourceId);
                                const invAny = inv as any;
                                const invoiceAny = (invAny?.invoice ?? invAny) as any;
                                const invoiceId = String(invoiceAny?.id ?? sourceId);
                                const tenantId = String(
                                  invoiceAny?.tenantId ??
                                    invoiceAny?.tenant_id ??
                                    invAny?.tenantId ??
                                    invAny?.tenant_id ??
                                    ""
                                );
                                if (!tenantId) throw new Error("Tenant id was missing for this invoice.");
                                navigate(`/tenants/${tenantId}/invoices/${invoiceId}`);
                              } catch (e: any) {
                                setError(e?.message ?? "Could not open invoice.");
                              }
                            }}
                            aria-label="Open invoice"
                            title="Open invoice"
                          >
                            <BookOpen size={16} aria-hidden />
                          </button>
                          {String(r.status ?? "") !== "PAID" ? (
                            <button
                              type="button"
                              className="pg-btn pg-btn-ghost"
                              style={{ fontSize: 12, padding: "4px 10px", height: 32 }}
                              onClick={async () => {
                                setError("");
                                try {
                                  await markInvoicePaid(sourceId);
                                  // Immediate UI update: the previous reload trigger was a no-op.
                                  await reload();
                                } catch (e: any) {
                                  setError(e?.message ?? "Failed to mark invoice paid.");
                                }
                              }}
                            >
                              Mark paid
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="pg-btn pg-btn-ghost"
                            style={{ padding: 6, width: 32, height: 32, display: "grid", placeItems: "center", color: "var(--danger)" }}
                            onClick={() =>
                              setConfirmDelete({
                                kind: "invoice_hard",
                                id: sourceId,
                                description: "this invoice line item"
                              })
                            }
                            aria-label="Permanently delete invoice"
                            title="Permanently delete invoice"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <span className="pg-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ fontWeight: 800 }}>
                  Totals
                </td>
                <td className="pg-statement-num" style={{ fontWeight: 800 }}>
                  {fmtZar(periodTotals.debit)}
                </td>
                <td className="pg-statement-num" style={{ fontWeight: 800 }}>
                  {fmtZar(periodTotals.credit)}
                </td>
                <td colSpan={3} className="pg-muted" style={{ fontSize: 12 }}>
                  Net: {fmtZar(periodTotals.net)} (paid credits − debits)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {showAddOnceOff ? (
        <>
          <ModalOverlay open onClose={() => (!onceOffSaving ? setShowAddOnceOff(false) : null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel
              title="Add once-off expense"
              onClose={() => (!onceOffSaving ? setShowAddOnceOff(false) : null)}
              actions={
                <button className="pg-btn pg-btn-primary" type="button" disabled={onceOffSaving} onClick={() => void addOnceOffExpense()}>
                  {onceOffSaving ? "Saving…" : "Add"}
                </button>
              }
            >
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Date
                  <Input type="date" value={onceOffForm.expenseDate} onChange={(e) => setOnceOffForm({ ...onceOffForm, expenseDate: e.target.value })} />
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
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
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Description
                  <Input value={onceOffForm.description} onChange={(e) => setOnceOffForm({ ...onceOffForm, description: e.target.value })} placeholder="e.g. Plumber callout" />
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Amount
                  <Input type="number" step="any" min={0} value={onceOffForm.amount} onChange={(e) => setOnceOffForm({ ...onceOffForm, amount: e.target.value })} />
                </label>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}

      {editIncome ? (
        <>
          <ModalOverlay open onClose={() => (!editSaving ? setEditIncome(null) : null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel
              title="Edit line item"
              onClose={() => (!editSaving ? setEditIncome(null) : null)}
              actions={
                <button className="pg-btn pg-btn-primary" type="button" disabled={editSaving} onClick={() => void saveIncomeEdit()}>
                  {editSaving ? "Saving…" : "Save"}
                </button>
              }
            >
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Date
                  <Input type="date" value={String(editIncome.date ?? "")} onChange={(e) => setEditIncome({ ...editIncome, date: e.target.value })} />
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Type
                  <select className="pg-input" value={String(editIncome.category ?? "RENT")} onChange={(e) => setEditIncome({ ...editIncome, category: e.target.value })}>
                    <option value="RENT">Rent</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Description
                  <Input value={String(editIncome.description ?? "")} onChange={(e) => setEditIncome({ ...editIncome, description: e.target.value })} />
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Credit
                  <Input type="number" step="any" min={0} value={String(editIncome.amount ?? "")} onChange={(e) => setEditIncome({ ...editIncome, amount: e.target.value })} />
                </label>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}

      {editInvoice ? (
        <>
          <ModalOverlay open onClose={() => (!editSaving ? setEditInvoice(null) : null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel
              title="Edit line item"
              onClose={() => (!editSaving ? setEditInvoice(null) : null)}
              actions={
                <button className="pg-btn pg-btn-primary" type="button" disabled={editSaving} onClick={() => void saveInvoiceEdit()}>
                  {editSaving ? "Saving…" : "Save"}
                </button>
              }
            >
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Date
                  <Input type="date" value={String(editInvoice.date ?? "")} onChange={(e) => setEditInvoice({ ...editInvoice, date: e.target.value })} />
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Notes
                  <Input value={String(editInvoice.notes ?? "")} onChange={(e) => setEditInvoice({ ...editInvoice, notes: e.target.value })} placeholder="Optional" />
                </label>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}

      {editExpense ? (
        <>
          <ModalOverlay open onClose={() => (!editSaving ? setEditExpense(null) : null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel
              title="Edit line item"
              onClose={() => (!editSaving ? setEditExpense(null) : null)}
              actions={
                <button className="pg-btn pg-btn-primary" type="button" disabled={editSaving} onClick={() => void saveExpenseEdit()}>
                  {editSaving ? "Saving…" : "Save"}
                </button>
              }
            >
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Date
                  <Input type="date" value={String(editExpense.date ?? "")} onChange={(e) => setEditExpense({ ...editExpense, date: e.target.value })} />
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Type
                  <select className="pg-input" value={String(editExpense.category ?? "OTHER")} onChange={(e) => setEditExpense({ ...editExpense, category: e.target.value })}>
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
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Description
                  <Input value={String(editExpense.description ?? "")} onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })} />
                </label>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Debit
                  <Input type="number" step="any" min={0} value={String(editExpense.amount ?? "")} onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })} />
                </label>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}

      {editStatus ? (
        <>
          <ModalOverlay open onClose={() => (!editStatusSaving ? setEditStatus(null) : null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel
              title="Change status"
              onClose={() => (!editStatusSaving ? setEditStatus(null) : null)}
              actions={
                <button
                  className="pg-btn pg-btn-primary"
                  type="button"
                  disabled={editStatusSaving}
                  onClick={() => {
                    void (async () => {
                      if (!editStatus?.id) return;
                      setEditStatusSaving(true);
                      setError("");
                      try {
                        const src = String(editStatus.source ?? "");
                        const chosen = String(editStatus.status ?? "");

                        if (src === "INVOICE") {
                          const mapped = chosen === "UNPAID" ? "SENT" : chosen;
                          if (mapped === "PAID") {
                            await markInvoicePaid(String(editStatus.id));
                          } else {
                            await updateInvoice(String(editStatus.id), { status: mapped });
                          }
                          setEditStatus(null);
                          await reload();
                          return;
                        }

                        if (src === "INCOME") {
                          // Income supports EXPECTED/RECEIVED/CANCELLED (no draft/sent).
                          await updatePropertyIncome(String(editStatus.id), { status: chosen });
                          setEditStatus(null);
                          await reload();
                          return;
                        }

                        setEditStatus(null);
                      } catch (e: any) {
                        setError(e?.message ?? "Failed to update status.");
                      } finally {
                        setEditStatusSaving(false);
                      }
                    })();
                  }}
                >
                  {editStatusSaving ? "Saving…" : "Save"}
                </button>
              }
            >
              <div style={{ padding: 14, display: "grid", gap: 10, minWidth: 320 }}>
                <label className="pg-muted" style={{ fontSize: 12 }}>
                  Status
                  {String(editStatus.source ?? "") === "INVOICE" ? (
                    <select
                      className="pg-input"
                      value={String(editStatus.status ?? "SENT")}
                      onChange={(e) => setEditStatus({ ...editStatus, status: e.target.value })}
                    >
                      {INVOICE_STATUS_PICKER_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="pg-input"
                      value={String(editStatus.status ?? "RECEIVED")}
                      onChange={(e) => setEditStatus({ ...editStatus, status: e.target.value })}
                    >
                      {INCOME_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s === "EXPECTED" ? "Unpaid" : s === "RECEIVED" ? "Paid" : "Cancelled"}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}

      {confirmDelete ? (
        <>
          <ModalOverlay open onClose={() => setConfirmDelete(null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel title="Delete item" onClose={() => setConfirmDelete(null)}>
              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                <div>
                  {String(confirmDelete.kind ?? "") === "invoice_hard" ? (
                    <>Are you sure you want to permanently delete line item?</>
                  ) : (
                    <>
                      Delete <strong>{confirmDelete.description || "this expense"}</strong>?
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </button>
                  <button
                    className="pg-btn pg-btn-danger"
                    type="button"
                    onClick={() => {
                      const kind = String(confirmDelete.kind ?? "expense");
                      if (kind === "income") {
                        void (async () => {
                          setError("");
                          try {
                            await deletePropertyIncome(String(confirmDelete.id));
                            setConfirmDelete(null);
                            await reload();
                          } catch (e: any) {
                            setError(e?.message ?? "Failed to delete income.");
                          }
                        })();
                        return;
                      }
                      if (kind === "invoice_hard") {
                        void (async () => {
                          setError("");
                          try {
                            await hardDeleteInvoice(String(confirmDelete.id));
                            setConfirmDelete(null);
                            await reload();
                          } catch (e: any) {
                            setError(e?.message ?? "Failed to delete invoice.");
                          }
                        })();
                        return;
                      }
                      void performDeleteExpense(String(confirmDelete.id));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </ModalPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}

