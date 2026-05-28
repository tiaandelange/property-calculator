import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { getPropertyStatement } from "../../../api/ownedProperties";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { ModalOverlay, ModalPanel } from "../../../components/ui/Modal";
import { createPropertyExpense, deletePropertyExpense, updatePropertyExpense } from "../../../api/ownedProperties";
import { MetricCard } from "../../../components/ui/DashboardKit";

type PeriodPreset = "LAST_MONTH" | "SIX_MONTHS" | "YTD" | "TWELVE_MONTHS" | "PER_YEAR" | "FOREVER";

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
  const [preset, setPreset] = useState<PeriodPreset>("SIX_MONTHS");
  const [year, setYear] = useState<number>(() => new Date().getUTCFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<any[]>([]);
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
  const [editExpense, setEditExpense] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
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
  }, [propertyId, monthIds]);

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

  const reload = async () => {
    // triggers the effect by toggling preset to itself
    setPreset((p) => p);
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
    if (!editExpense?.id) return;
    const amount = Number(String(editExpense.amount ?? "").trim());
    if (!String(editExpense.description ?? "").trim()) {
      setError("Description is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      await updatePropertyExpense(String(editExpense.id), {
        description: String(editExpense.description).trim(),
        amount,
        expenseDate: String(editExpense.date ?? editExpense.expenseDate ?? "").trim() || undefined,
        category: String(editExpense.category ?? editExpense.expenseCategory ?? "OTHER")
      });
      setEditExpense(null);
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save expense.");
    } finally {
      setEditSaving(false);
    }
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

  return (
    <div className="pg-workspace-inset-list">
      {error ? (
        <div className="pg-alert pg-alert-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="pg-metric-grid">
        <MetricCard title="Income received" value={fmtZar(totals.credit)} subtitle="Paid credits only" iconPreset="monthly-income" />
        <MetricCard title="Expenses" value={fmtZar(totals.debit)} subtitle="Debits" iconPreset="expenses" />
        <MetricCard title="Net position" value={fmtZar(totals.net)} subtitle="Paid credits − debits" iconPreset="cash-flow" />
      </div>

      {(rows?.length ?? 0) === 0 && !loading ? <div className="pg-muted">No statement lines found.</div> : null}
      {(rows?.length ?? 0) > 0 ? (
        <div className="pg-statement-wrap">
          <div className="pg-statement-topbar">
            <div className="pg-statement-topbar__title">Statement</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
              <button type="button" className="pg-btn pg-btn-secondary" disabled title="Coming next: Statement PDF export">
                <ExternalLink size={16} style={{ marginRight: 6 }} aria-hidden />
                Export PDF
              </button>
              <button type="button" className="pg-btn pg-btn-primary" onClick={() => setShowAddOnceOff(true)}>
                <Plus size={16} style={{ marginRight: 6 }} aria-hidden />
                Add Once-Off Expense
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
                const canEditExpense = r.source === "EXPENSE" && r.expenseId;
                return (
                  <tr key={r.id ?? `${r.source}-${r.date}-${r.description}`}>
                    <td style={{ verticalAlign: "top" }}>{String(r.date ?? "")}</td>
                    <td style={{ verticalAlign: "top", minWidth: 180 }}>{String(r.description ?? "")}</td>
                    <td style={{ verticalAlign: "top", minWidth: 140 }}>{String(r.type ?? "")}</td>
                    <td className="pg-statement-num" style={{ verticalAlign: "top" }}>
                      {r.debit != null ? fmtZar(r.debit) : "—"}
                    </td>
                    <td className={`pg-statement-num${creditClass}`} style={{ verticalAlign: "top" }}>
                      {r.credit != null ? fmtZar(r.credit) : "—"}
                    </td>
                    <td style={{ verticalAlign: "top" }}>{String(r.status ?? "")}</td>
                    <td style={{ verticalAlign: "top" }}>{String(r.source ?? "")}</td>
                    <td style={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                      {canEditExpense ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="pg-btn pg-btn-ghost"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                            onClick={() =>
                              setEditExpense({
                                id: String(r.expenseId),
                                date: String(r.date ?? "").slice(0, 10),
                                description: String(r.description ?? ""),
                                category: String(r.expenseCategory ?? "OTHER"),
                                amount: String(r.debit ?? "")
                              })
                            }
                          >
                            <Pencil size={14} style={{ marginRight: 6 }} aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="pg-btn pg-btn-ghost"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                            onClick={() => setConfirmDelete({ id: String(r.expenseId), description: String(r.description ?? "") })}
                          >
                            <Trash2 size={14} style={{ marginRight: 6 }} aria-hidden />
                            Delete
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

      {editExpense ? (
        <>
          <ModalOverlay open onClose={() => (!editSaving ? setEditExpense(null) : null)} />
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
            <ModalPanel
              title="Edit expense"
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
                  Category
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
                  Amount
                  <Input type="number" step="any" min={0} value={String(editExpense.amount ?? "")} onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })} />
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
            <ModalPanel title="Delete expense" onClose={() => setConfirmDelete(null)}>
              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                <div>
                  Delete <strong>{confirmDelete.description || "this expense"}</strong>?
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </button>
                  <button className="pg-btn pg-btn-danger" type="button" onClick={() => void performDeleteExpense(String(confirmDelete.id))}>
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

