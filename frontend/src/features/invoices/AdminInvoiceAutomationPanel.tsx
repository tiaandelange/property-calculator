import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  generateDueLeaseInvoices,
  getInvoiceAutomationSettings,
  updatePlatformInvoiceAutomationDefaults,
  type GenerateDueLeaseInvoicesResult
} from "../../services/invoiceAutomationSupabase";

function RangeField({
  label,
  hint,
  min,
  max,
  value,
  onChange,
  disabled
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <label style={{ fontWeight: 700, fontSize: 13 }}>{label}</label>
        <strong>{value}</strong>
      </div>
      {hint ? (
        <p className="pg-muted" style={{ margin: "4px 0 8px", fontSize: 13 }}>
          {hint}
        </p>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", maxWidth: 360 }}
      />
    </div>
  );
}

export function AdminInvoiceAutomationPanel() {
  const [daysBefore, setDaysBefore] = useState(10);
  const [graceDays, setGraceDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [syncResult, setSyncResult] = useState<GenerateDueLeaseInvoicesResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await getInvoiceAutomationSettings();
      setDaysBefore(s.platformDaysBeforeDue);
      setGraceDays(s.platformGracePeriodDays);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load platform invoice settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const row = await updatePlatformInvoiceAutomationDefaults({
        rentInvoiceDaysBeforeDue: daysBefore,
        rentInvoiceGracePeriodDays: graceDays
      });
      setDaysBefore(row.rentInvoiceDaysBeforeDue);
      setGraceDays(row.rentInvoiceGracePeriodDays);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save platform defaults.");
    } finally {
      setSaving(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      const res = await generateDueLeaseInvoices();
      setSyncResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invoice sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card title="Rent invoice automation (platform defaults)">
      {loading ? <div className="pg-muted">Loading…</div> : null}
      {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="pg-alert" style={{ marginBottom: 12 }}>Platform defaults saved.</div> : null}
      {!loading ? (
        <>
          <p className="pg-muted" style={{ marginTop: 0 }}>
            Default timing for all landlords unless they set their own override under Settings. Daily cron runs
            server-side (no browser required).
          </p>
          <div style={{ display: "grid", gap: 18, marginTop: 16, maxWidth: 420 }}>
            <RangeField
              label="Days before rent due date to generate invoice"
              min={0}
              max={28}
              value={daysBefore}
              onChange={setDaysBefore}
              disabled={saving || syncing}
            />
            <RangeField
              label="Grace period after due date (days)"
              min={0}
              max={31}
              value={graceDays}
              onChange={setGraceDays}
              disabled={saving || syncing}
            />
          </div>
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Button onClick={() => void save()} loading={saving}>
              Save platform defaults
            </Button>
            <Button variant="secondary" onClick={() => void runSync()} loading={syncing}>
              Run invoice sync (debug)
            </Button>
          </div>
          {syncResult ? (
            <div className="pg-muted" style={{ marginTop: 14, fontSize: 13 }}>
              Sync as of {syncResult.asOfDate} ({syncResult.timezone}): checked {syncResult.leasesChecked} leases,
              created {syncResult.invoicesCreated}, skipped {syncResult.skippedDuplicate} duplicates,{" "}
              {syncResult.skippedInactive} inactive, {syncResult.skippedNotDue} not yet due.
              {syncResult.errors.length > 0 ? (
                <div style={{ marginTop: 8, color: "var(--danger)" }}>
                  {syncResult.errors.length} lease error(s) — see server logs for details.
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
