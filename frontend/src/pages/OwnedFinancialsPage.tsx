import { FormEvent, useEffect, useState } from "react";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { usePropertyWorkspaceRefresh } from "../features/properties/usePropertyWorkspaceRefresh";
import { Helmet } from "react-helmet-async";
import { api, authHeader } from "../api/client";
import { deletePropertyIncome, getProperties, getPropertyTenants, hardDeletePropertyExpense, updatePropertyIncome } from "../api/ownedProperties";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useLocation } from "react-router-dom";
import { PageBreadcrumb } from "../components/nav/PageBreadcrumb";
import { workspacePage } from "../nav/workspaceBreadcrumbs";

const RECURRING_ANCHOR_OPTIONS: Array<{ value: "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH"; label: string }> = [
  { value: "FIRST_OF_MONTH", label: "1st of the month" },
  { value: "LAST_OF_MONTH", label: "Last day of the month" },
  { value: "DAY_OF_MONTH", label: "Specific calendar day" }
];

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

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function OwnedFinancialsPage() {
  const { search } = useLocation();
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<any[]>([]);
  const [recurringIncomeRules, setRecurringIncomeRules] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [income, setIncome] = useState<any>({ category: "RENT", description: "Rent", amount: "", incomeDate: "" });
  const [expense, setExpense] = useState<any>(() => {
    const d = todayYmd();
    return {
      category: "RATES_TAXES",
      description: "Rates",
      amount: "",
      expenseDate: d
    };
  });
  const [recurringSchedule, setRecurringSchedule] = useState<any>(() => {
    const d = todayYmd();
    return {
      category: "RATES_TAXES",
      description: "Rates",
      amount: "",
      recurringStartDate: d,
      recurringEndDate: "",
      recurringOpenEnded: true,
      recurringMonthAnchor: "FIRST_OF_MONTH",
      recurringDayOfMonth: 15
    };
  });

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    const params = new URLSearchParams(search);
    const pid = params.get("propertyId");
    const presetPid = pid != null && !Number.isNaN(Number(pid)) ? Number(pid) : null;
    if (!propertyId && presetPid != null) setPropertyId(presetPid);
    else if (!propertyId && rows[0]) setPropertyId(rows[0].id);

  }
  async function loadSummary(pid: number) {
    const res = await api.get(`/properties/${pid}/financials`, { headers: authHeader() });
    setSummary(res.data?.summary ?? null);
    setExpenses(res.data?.expenses ?? []);
    setIncomeEntries(res.data?.income ?? []);
    setRecurringIncomeRules(res.data?.recurringIncomeRules ?? []);
    try {
      setTenants(await getPropertyTenants(pid));
    } catch {
      setTenants([]);
    }
  }
  useEffect(() => { void loadProperties(); }, []);
  useEffect(() => { if (propertyId) void loadSummary(Number(propertyId)); }, [propertyId]);

  usePropertyWorkspaceRefresh({
    propertyId: propertyId || undefined,
    onRefresh: () => {
      void loadProperties();
      if (propertyId) void loadSummary(Number(propertyId));
    }
  });

  const refreshSummaryAndBroadcast = async (pid?: number | null) => {
    const resolved = pid ?? (propertyId ? Number(propertyId) : null);
    if (resolved != null) await loadSummary(resolved);
    invalidatePropertyWorkspace(resolved ?? undefined);
  };

  const addIncome = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await api.post(`/properties/${propertyId}/income`, { ...income, source: "MANUAL_FINANCIAL_ENTRY", status: "RECEIVED" }, { headers: authHeader() });
    await refreshSummaryAndBroadcast(Number(propertyId));
  };
  const addExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await api.post(
      `/properties/${propertyId}/expenses`,
      {
        category: expense.category,
        description: expense.description,
        amount: Number(expense.amount),
        expenseDate: expense.expenseDate,
        source: "MANUAL_FINANCIAL_ENTRY",
        status: "ACTIVE"
      },
      { headers: authHeader() }
    );
    await refreshSummaryAndBroadcast(Number(propertyId));
  };

  const addRecurringExpenseSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (
      !recurringSchedule.recurringOpenEnded &&
      (!recurringSchedule.recurringEndDate || recurringSchedule.recurringEndDate < recurringSchedule.recurringStartDate)
    ) {
      window.alert("Choose an end date on or after the start date, or tick “No end date”.");
      return;
    }
    if (
      recurringSchedule.recurringMonthAnchor === "DAY_OF_MONTH" &&
      (recurringSchedule.recurringDayOfMonth < 1 || recurringSchedule.recurringDayOfMonth > 31)
    ) {
      window.alert("Choose a calendar day between 1 and 31.");
      return;
    }
    await api.post(
      `/properties/${propertyId}/expenses`,
      {
        category: recurringSchedule.category,
        description: recurringSchedule.description,
        amount: Number(recurringSchedule.amount),
        recurringSchedule: true,
        recurringStartDate: recurringSchedule.recurringStartDate,
        recurringEndDate: recurringSchedule.recurringOpenEnded ? null : recurringSchedule.recurringEndDate || null,
        recurringOpenEnded: Boolean(recurringSchedule.recurringOpenEnded),
        recurringMonthAnchor: recurringSchedule.recurringMonthAnchor,
        ...(recurringSchedule.recurringMonthAnchor === "DAY_OF_MONTH"
          ? { recurringDayOfMonth: recurringSchedule.recurringDayOfMonth }
          : {}),
        source: "MANUAL_FINANCIAL_ENTRY",
        status: "ACTIVE"
      },
      { headers: authHeader() }
    );
    const d = todayYmd();
    setRecurringSchedule({
      category: recurringSchedule.category,
      description: recurringSchedule.description,
      amount: "",
      recurringStartDate: d,
      recurringEndDate: "",
      recurringOpenEnded: true,
      recurringMonthAnchor: "FIRST_OF_MONTH",
      recurringDayOfMonth: 15
    });
    await refreshSummaryAndBroadcast(Number(propertyId));
  };

  const removeExpense = async (id: number) => {
    if (
      !window.confirm(
        "Permanently delete this expense from your ledger? Recurring schedule lines follow the same rules as the statement (posted SYSTEM rows archive instead of deleting so they are not recreated)."
      )
    )
      return;
    await hardDeletePropertyExpense(id);
    await refreshSummaryAndBroadcast(Number(propertyId));
  };

  const archiveIncome = async (id: number) => {
    if (!window.confirm("Archive this income entry?")) return;
    await deletePropertyIncome(id);
    await refreshSummaryAndBroadcast(Number(propertyId));
  };

  const runExpectedIncome = async () => {
    await api.post(`/recurring-income/run-due`, {}, { headers: authHeader() });
    if (propertyId) await loadSummary(Number(propertyId));
    invalidatePropertyWorkspace();
  };

  const activateRecurring = async (id: number) => {
    await api.post(`/recurring-income/${id}/activate`, {}, { headers: authHeader() });
    await refreshSummaryAndBroadcast(Number(propertyId));
  };

  const markReceived = async (id: number) => {
    const paymentDate = window.prompt("Payment received date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!paymentDate) return;
    await api.post(`/income/${id}/mark-received`, { paymentDate }, { headers: authHeader() });
    await refreshSummaryAndBroadcast(Number(propertyId));
  };

  const editIncome = async (inc: any) => {
    const amount = window.prompt("Amount (number)", String(inc.amount ?? 0));
    if (amount == null) return;
    const incomeDate = window.prompt("Income date (YYYY-MM-DD)", new Date(inc.incomeDate).toISOString().slice(0, 10));
    if (!incomeDate) return;
    const tenantId = window.prompt("Tenant ID (optional)", inc.tenantId != null ? String(inc.tenantId) : "");
    const description = window.prompt("Description", inc.description ?? "") ?? inc.description;
    await updatePropertyIncome(inc.id, {
      amount: Number(amount),
      incomeDate,
      tenantId: tenantId === "" ? null : Number(tenantId),
      description
    });
    await refreshSummaryAndBroadcast(Number(propertyId));
  };

  return (
    <Section>
      <Helmet><title>Financials | The Property Guy</title></Helmet>
      <Container>
        <PageBreadcrumb items={workspacePage("Financials")} />
        <h1 className="pg-h2">Financials</h1>
        <Card>
          <Field label="Property">
            <select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {summary ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div>Monthly income: {summary.monthly.totalIncome?.toLocaleString?.() ?? 0}</div>
              <div>Expected income (draft): {summary.monthly.expectedIncome?.toLocaleString?.() ?? 0}</div>
              <div>Monthly expenses: {summary.monthly.totalExpenses?.toLocaleString?.() ?? 0}</div>
              <div>Net cash flow: {summary.monthly.netMonthlyCashFlow?.toLocaleString?.() ?? 0}</div>
              <div>Gross yield: {(Number(summary.investorMetrics.grossYield ?? 0) * 100).toFixed(2)}%</div>
              <div>Net yield: {(Number(summary.investorMetrics.netYield ?? 0) * 100).toFixed(2)}%</div>
              <div>Occupancy: {summary.investorMetrics.occupancyStatus}</div>
            </div>
          ) : null}
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Expected rent income (from leases)">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="ghost" onClick={runExpectedIncome}>Run expected income (due)</Button>
            <div className="pg-muted">Rules are created when a lease is created, and stay paused until activated.</div>
          </div>
          <div style={{ height: 10 }} />
          {(recurringIncomeRules?.length ?? 0) ? (
            <div style={{ display: "grid", gap: 8 }}>
              {recurringIncomeRules.map((r: any) => (
                <div key={r.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div><strong>{r.category}</strong> — R {Number(r.amount ?? 0).toLocaleString()} / {r.frequency}</div>
                    <div className="pg-muted">Day {r.dayOfMonth} | Status: {r.status}</div>
                  </div>
                  {r.status === "PAUSED" ? <Button variant="ghost" onClick={() => activateRecurring(r.id)}>Activate</Button> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="pg-muted">No expected rent rules yet. Create a lease to generate one.</div>
          )}
        </Card>

        <div style={{ height: 12 }} />
        <Card title="Income entries">
          {(incomeEntries?.length ?? 0) ? (
            <div style={{ display: "grid", gap: 8 }}>
              {incomeEntries.map((inc: any) => (
                <div key={inc.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div><strong>{inc.category}</strong> — {inc.description}</div>
                    <div className="pg-muted">{new Date(inc.incomeDate).toLocaleDateString()} | {inc.source} | {inc.status}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div><strong>R {Number(inc.amount ?? 0).toLocaleString()}</strong></div>
                    {inc.status === "EXPECTED" ? <Button variant="ghost" onClick={() => markReceived(inc.id)}>Mark received</Button> : null}
                    <Button variant="ghost" onClick={() => void editIncome(inc)}>Edit</Button>
                    <Button variant="ghost" onClick={() => archiveIncome(inc.id)}>Archive</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pg-muted">No income entries yet.</div>
          )}
        </Card>

        <div style={{ height: 12 }} />
        <Card title="Expense entries">
          {(expenses?.length ?? 0) ? (
            <div style={{ display: "grid", gap: 8 }}>
              {expenses.map((ex: any) => (
                <div key={ex.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div><strong>{ex.category}</strong> — {ex.description}</div>
                    <div className="pg-muted">{new Date(ex.expenseDate).toLocaleDateString()} | {ex.source} | {ex.status} {ex.isRecurring ? "| recurring" : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div><strong>R {Number(ex.amount ?? 0).toLocaleString()}</strong></div>
                    <Button variant="ghost" onClick={() => removeExpense(ex.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pg-muted">No expense entries yet.</div>
          )}
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Add income">
          <form onSubmit={addIncome}>
            <Field label="Tenant (optional)">
              <select
                className="pg-input"
                value={income.tenantId ?? ""}
                onChange={(e) => setIncome({ ...income, tenantId: e.target.value === "" ? null : Number(e.target.value) })}
              >
                <option value="">No tenant</option>
                {tenants.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category"><select className="pg-input" value={income.category} onChange={(e) => setIncome({ ...income, category: e.target.value })}>{["RENT", "DEPOSIT", "LATE_FEE", "UTILITIES_RECOVERY", "OTHER"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Description"><Input value={income.description} onChange={(e) => setIncome({ ...income, description: e.target.value })} required /></Field>
            <Field label="Amount"><Input type="number" value={income.amount} onChange={(e) => setIncome({ ...income, amount: Number(e.target.value) })} required /></Field>
            <Field label="Income date"><Input type="date" value={income.incomeDate} onChange={(e) => setIncome({ ...income, incomeDate: e.target.value })} required /></Field>
            <Button type="submit">Add Income</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Add expense">
          <p className="pg-muted" style={{ marginTop: 0, marginBottom: 16 }}>
            Record a single dated expense here. Monthly repeating charges belong under{" "}
            <strong>Monthly expense schedules</strong> below (or on the property workspace{" "}
            <strong>Financials → Recurring charges</strong> tab).
          </p>
          <form onSubmit={addExpense}>
            <Field label="Expense date">
              <Input type="date" value={expense.expenseDate} onChange={(e) => setExpense({ ...expense, expenseDate: e.target.value })} required />
            </Field>
            <Field label="Category">
              <select className="pg-input" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })}>
                {["RATES_TAXES", "WATER", "ELECTRICITY", "LEVIES", "INSURANCE", "MAINTENANCE", "REPAIRS", "BOND_PAYMENT", "OTHER"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Description"><Input value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} required /></Field>
            <Field label="Amount"><Input type="number" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: Number(e.target.value) })} required /></Field>
            <Button type="submit">Add expense</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Monthly expense schedules">
          <p className="pg-muted" style={{ marginTop: 0, marginBottom: 16 }}>
            Create templates that repeat each month (rates, levies, bond debit orders). One-off repairs and bills stay under{" "}
            <strong>Add expense</strong>.
          </p>
          <form onSubmit={addRecurringExpenseSchedule}>
            <Field label="Schedule starts">
              <Input
                type="date"
                value={recurringSchedule.recurringStartDate}
                onChange={(e) => setRecurringSchedule({ ...recurringSchedule, recurringStartDate: e.target.value })}
                required
              />
            </Field>
            <Field
              label="Due each month"
              help="1st / last day / or pick a calendar day — only the day number repeats each month."
            >
              <select
                className="pg-input"
                value={recurringSchedule.recurringMonthAnchor}
                onChange={(e) =>
                  setRecurringSchedule({
                    ...recurringSchedule,
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
            {recurringSchedule.recurringMonthAnchor === "DAY_OF_MONTH" ? (
              <Field
                label="Calendar day"
                help="Only the day number is used; shorter months use the last valid day."
              >
                <Input
                  type="date"
                  value={ymdCarrierForDayDom(recurringSchedule.recurringDayOfMonth)}
                  onChange={(e) =>
                    setRecurringSchedule({
                      ...recurringSchedule,
                      recurringDayOfMonth: parseDomFromYmd(e.target.value)
                    })
                  }
                  required
                />
              </Field>
            ) : null}
            <label className="pg-pill" style={{ cursor: "pointer", justifyContent: "flex-start", display: "flex", marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={Boolean(recurringSchedule.recurringOpenEnded)}
                onChange={(e) =>
                  setRecurringSchedule({
                    ...recurringSchedule,
                    recurringOpenEnded: e.target.checked,
                    recurringEndDate: e.target.checked ? "" : recurringSchedule.recurringEndDate
                  })
                }
              />
              <span style={{ marginLeft: 8 }}>No end date</span>
            </label>
            {!recurringSchedule.recurringOpenEnded ? (
              <Field label="Schedule ends">
                <Input
                  type="date"
                  value={recurringSchedule.recurringEndDate}
                  onChange={(e) => setRecurringSchedule({ ...recurringSchedule, recurringEndDate: e.target.value })}
                  required
                />
              </Field>
            ) : null}
            <Field label="Category">
              <select
                className="pg-input"
                value={recurringSchedule.category}
                onChange={(e) => setRecurringSchedule({ ...recurringSchedule, category: e.target.value })}
              >
                {["RATES_TAXES", "WATER", "ELECTRICITY", "LEVIES", "INSURANCE", "MAINTENANCE", "REPAIRS", "BOND_PAYMENT", "OTHER"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <Input
                value={recurringSchedule.description}
                onChange={(e) => setRecurringSchedule({ ...recurringSchedule, description: e.target.value })}
                required
              />
            </Field>
            <Field label="Amount">
              <Input
                type="number"
                value={recurringSchedule.amount}
                onChange={(e) => setRecurringSchedule({ ...recurringSchedule, amount: Number(e.target.value) })}
                required
              />
            </Field>
            <Button type="submit">Save monthly schedule</Button>
          </form>
        </Card>
      </Container>
    </Section>
  );
}
