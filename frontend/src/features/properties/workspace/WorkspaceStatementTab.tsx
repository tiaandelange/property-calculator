import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getPropertyStatement } from "../../../api/ownedProperties";
import { Card } from "../../../components/ui/Card";

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
  propertyName
}: {
  propertyId: string;
  propertyName?: string;
}) {
  const [preset, setPreset] = useState<PeriodPreset>("SIX_MONTHS");
  const [year, setYear] = useState<number>(() => new Date().getUTCFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<any[]>([]);

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
        const merged = stmts
          .flatMap((s) => (s ? ((s as any).statementRows ?? []) : []))
          .filter(Boolean);

        merged.sort((a: any, b: any) => String(a.date ?? "").localeCompare(String(b.date ?? "")) || String(a.id ?? "").localeCompare(String(b.id ?? "")));
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

  return (
    <div className="pg-workspace-inset-list">
      {error ? (
        <div className="pg-alert pg-alert-error" role="alert">
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Property Statement</div>
          <div className="pg-muted" style={{ marginTop: 4 }}>
            {propertyName ? <strong>{propertyName}</strong> : null} {loading ? "· Loading…" : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="pg-input" value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)}>
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
          <button type="button" className="pg-btn pg-btn-primary" disabled title="Coming next: manual once-off expense">
            Add Once-Off Expense
          </button>
        </div>
      </div>

      <div className="pg-metric-grid">
        <Card title="Credits (paid)">
          <div className="pg-metric-value">{fmtZar(totals.credit)}</div>
        </Card>
        <Card title="Debits">
          <div className="pg-metric-value">{fmtZar(totals.debit)}</div>
        </Card>
        <Card title="Net position (paid only)">
          <div className="pg-metric-value">{fmtZar(totals.net)}</div>
        </Card>
      </div>

      {(rows?.length ?? 0) === 0 && !loading ? <div className="pg-muted">No statement lines found.</div> : null}
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
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const creditClass = r.source === "INVOICE" && r.status !== "PAID" ? " pg-statement-credit-unpaid" : "";
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

