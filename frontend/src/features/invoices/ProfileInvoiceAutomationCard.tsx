import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  getInvoiceAutomationSettings,
  updateProfileInvoiceAutomationSettings,
  type InvoiceAutomationSettings
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

export function ProfileInvoiceAutomationCard() {
  const [settings, setSettings] = useState<InvoiceAutomationSettings | null>(null);
  const [daysBefore, setDaysBefore] = useState(10);
  const [graceDays, setGraceDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await getInvoiceAutomationSettings();
      setSettings(s);
      setDaysBefore(s.rentInvoiceDaysBeforeDue);
      setGraceDays(s.rentInvoiceGracePeriodDays);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load invoice automation settings.");
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
      const s = await updateProfileInvoiceAutomationSettings({
        rentInvoiceDaysBeforeDue: daysBefore,
        rentInvoiceGracePeriodDays: graceDays
      });
      setSettings(s);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Rent invoice automation">
      {loading ? <div className="pg-muted">Loading…</div> : null}
      {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="pg-alert" style={{ marginBottom: 12 }}>Saved.</div> : null}
      {!loading ? (
        <>
          <p className="pg-muted" style={{ marginTop: 0 }}>
            Rent invoices are created automatically from active leases{" "}
            <strong>{daysBefore} day{daysBefore === 1 ? "" : "s"}</strong> before each lease&apos;s rent due day
            (business calendar: Africa/Johannesburg). Platform default: {settings?.platformDaysBeforeDue ?? 10} days
            before due, {settings?.platformGracePeriodDays ?? 7} days grace after due.
          </p>
          <div style={{ display: "grid", gap: 18, marginTop: 16, maxWidth: 420 }}>
            <RangeField
              label="Days before rent due date to generate invoice"
              hint="Example: due on the 1st with 10 days → invoice generates on the 21st of the prior month."
              min={0}
              max={28}
              value={daysBefore}
              onChange={setDaysBefore}
              disabled={saving}
            />
            <RangeField
              label="Grace period after due date (days)"
              hint="Used for overdue treatment; generation still catches up safely if a run was missed."
              min={0}
              max={31}
              value={graceDays}
              onChange={setGraceDays}
              disabled={saving}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => void save()} loading={saving}>
              Save invoice automation
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
