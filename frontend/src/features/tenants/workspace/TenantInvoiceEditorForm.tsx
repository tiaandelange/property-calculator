import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, Plus, Save, Trash2 } from "lucide-react";
import {
  createPropertyInvoice,
  generateInvoicePdf,
  getInvoice,
  sendInvoiceEmail,
  updateInvoice
} from "../../../api/ownedProperties";
import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab, triggerPdfFileDownload } from "../../../api/pdfBlob";
import { invalidatePropertyWorkspace } from "../../properties/invalidate";
import { Button } from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/Input";
import { fmtZar } from "../statement/tenantStatementAdapter";

type LineItem = { description: string; quantity: number; unitPrice: number; total: number };

const INVOICE_STATUS_OPTIONS = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;

function emptyLine(): LineItem {
  return { description: "Monthly Rent", quantity: 1, unitPrice: 0, total: 0 };
}

function bankingLines(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const d = details as Record<string, unknown>;
  const lines: string[] = [];
  if (d.bankName) lines.push(String(d.bankName));
  if (d.accountHolder) lines.push(`Account holder: ${d.accountHolder}`);
  if (d.accountNumber) lines.push(`Account: ${d.accountNumber}`);
  if (d.branchCode) lines.push(`Branch: ${d.branchCode}`);
  if (d.referenceNote) lines.push(String(d.referenceNote));
  if (Array.isArray(d.extraLines)) {
    for (const x of d.extraLines) {
      if (typeof x === "string" && x.trim()) lines.push(x.trim());
    }
  }
  return lines;
}

export function TenantInvoiceEditorForm({
  propertyId,
  tenantId,
  tenantName,
  tenantEmail,
  invoiceId: initialInvoiceId,
  leaseId,
  profileName,
  invoicePaymentDetails,
  defaultRent,
  onInvoiceCreated,
  onSaved,
  onCancel
}: {
  propertyId: string;
  tenantId: string;
  tenantName: string;
  tenantEmail?: string | null;
  invoiceId?: string;
  leaseId?: string | null;
  profileName: string;
  invoicePaymentDetails: unknown;
  defaultRent?: number;
  /** After first save of a new invoice — parent can update URL to edit route. */
  onInvoiceCreated?: (invoiceId: string) => void;
  onSaved?: (invoiceId: string) => void;
  onCancel?: () => void;
}) {
  const [activeId, setActiveId] = useState<string | undefined>(initialInvoiceId);
  const [loading, setLoading] = useState(Boolean(initialInvoiceId));
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("Draft");
  const [status, setStatus] = useState<string>("DRAFT");
  const [fromName, setFromName] = useState(profileName);
  const [toName, setToName] = useState(tenantName);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [hasPdf, setHasPdf] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setActiveId(initialInvoiceId);
  }, [initialInvoiceId]);

  useEffect(() => {
    setFromName(profileName);
    setToName(tenantName);
  }, [profileName, tenantName]);

  const loadInvoice = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const inv = await getInvoice(id);
      setActiveId(String(inv.id));
      setInvoiceNumber(String(inv.invoiceNumber ?? inv.id));
      setStatus(String(inv.status ?? "DRAFT"));
      setInvoiceDate(String(inv.invoiceDate ?? "").slice(0, 10));
      setDueDate(String(inv.dueDate ?? "").slice(0, 10));
      setNotes(String(inv.notes ?? ""));
      setHasPdf(Boolean(inv.hasPdf));
      const tenant = inv.tenant as Record<string, unknown> | undefined;
      if (tenant) {
        setToName(`${String(tenant.firstName ?? "")} ${String(tenant.lastName ?? "")}`.trim());
      }
      const lines = (inv.lineItems as LineItem[] | undefined) ?? [];
      if (lines.length) {
        setLineItems(
          lines.map((l) => ({
            description: String(l.description ?? ""),
            quantity: Number(l.quantity ?? 1),
            unitPrice: Number(l.unitPrice ?? 0),
            total: Number(l.total ?? 0)
          }))
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load invoice.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) {
      void loadInvoice(activeId);
      return;
    }
    if (defaultRent != null && Number.isFinite(defaultRent)) {
      setLineItems([{ description: "Monthly Rent", quantity: 1, unitPrice: defaultRent, total: defaultRent }]);
    }
    setLoading(false);
  }, [activeId, defaultRent, loadInvoice]);

  const total = useMemo(
    () => lineItems.reduce((s, li) => s + (Number.isFinite(li.total) ? li.total : li.quantity * li.unitPrice), 0),
    [lineItems]
  );

  const bankLines = bankingLines(invoicePaymentDetails);

  const patchLine = (idx: number, patch: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        next.total = next.quantity * next.unitPrice;
        return next;
      })
    );
  };

  const buildPayload = () => ({
    tenantId,
    leaseId: leaseId ?? undefined,
    invoiceDate,
    dueDate,
    status,
    notes: notes.trim() || null,
    total,
    lineItems: lineItems.map((li) => ({
      description: li.description.trim() || "Line item",
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      total: li.quantity * li.unitPrice
    }))
  });

  const saveInvoice = async (): Promise<string | null> => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = buildPayload();
      let savedId = activeId;
      if (activeId) {
        await updateInvoice(activeId, payload);
      } else {
        const created = await createPropertyInvoice(propertyId, payload);
        savedId = String(created.id);
        setActiveId(savedId);
        setInvoiceNumber(String(created.invoiceNumber ?? savedId));
        invalidatePropertyWorkspace(propertyId);
        onInvoiceCreated?.(savedId);
      }
      invalidatePropertyWorkspace(propertyId);
      if (savedId) {
        setSuccess("Invoice saved. It will appear on the tenant statement.");
        onSaved?.(savedId);
        return savedId;
      }
      return null;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save invoice.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveInvoice();
  };

  const exportPdf = async () => {
    setError("");
    setSuccess("");
    let id: string | undefined = activeId;
    if (!id) {
      const saved = await saveInvoice();
      if (!saved) return;
      id = saved;
    }
    setPdfBusy(true);
    try {
      const gen = await generateInvoicePdf(id);
      const downloadUrl = gen.downloadUrl;
      if (!downloadUrl) throw new Error(gen.error ?? "No download URL returned.");
      setHasPdf(true);
      if (isAbsoluteHttpUrl(downloadUrl)) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        const blob = await fetchPdfBlob(downloadUrl);
        openPdfBlobInNewTab(blob);
      }
      setSuccess("PDF opened in a new tab. Use your browser to save or print.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not export PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadPdf = async () => {
    setError("");
    let id: string | undefined = activeId;
    if (!id) {
      const saved = await saveInvoice();
      if (!saved) return;
      id = saved;
    }
    setPdfBusy(true);
    try {
      let inv = await getInvoice(id);
      let url = inv.downloadUrl as string | null | undefined;
      if (!url) {
        const gen = await generateInvoicePdf(id);
        url = gen.downloadUrl ?? null;
      }
      if (!url) throw new Error("Generate the PDF first.");
      const blob = await fetchPdfBlob(url);
      triggerPdfFileDownload(blob, `${String(inv.invoiceNumber ?? "invoice").replace(/\s+/g, "_")}.pdf`);
      setHasPdf(true);
      setSuccess("PDF downloaded.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setPdfBusy(false);
    }
  };

  const sendToTenant = async () => {
    setError("");
    setSuccess("");
    let id: string | undefined = activeId;
    if (!id) {
      const saved = await saveInvoice();
      if (!saved) return;
      id = saved;
    }
    if (!tenantEmail?.trim()) {
      setError("This tenant has no email on file. Add an email on the tenant profile, then try again.");
      return;
    }
    setSendBusy(true);
    try {
      if (status === "DRAFT") {
        await updateInvoice(id, { status: "SENT" });
        setStatus("SENT");
      }
      if (!hasPdf) {
        await generateInvoicePdf(id);
        setHasPdf(true);
      }
      const res = await sendInvoiceEmail(id);
      setSuccess(res.message ?? `Invoice sent to ${tenantEmail}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send invoice.");
    } finally {
      setSendBusy(false);
    }
  };

  if (loading) {
    return <div className="pg-tstmt-skeleton" style={{ minHeight: 240 }} aria-busy="true" />;
  }

  return (
    <form className="pg-tstmt-invoice-editor" onSubmit={submit}>
      <div>
        {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
        {success ? <div className="pg-alert" style={{ marginBottom: 12, background: "var(--success-soft)", color: "var(--success)" }}>{success}</div> : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <Button type="submit" loading={saving}>
            <Save size={16} style={{ marginRight: 8 }} aria-hidden />
            {activeId ? "Save changes" : "Save invoice"}
          </Button>
          <Button type="button" variant="secondary" loading={pdfBusy} onClick={() => void exportPdf()}>
            <Download size={16} style={{ marginRight: 8 }} aria-hidden />
            Export PDF
          </Button>
          {hasPdf ? (
            <Button type="button" variant="ghost" loading={pdfBusy} onClick={() => void downloadPdf()}>
              Download PDF
            </Button>
          ) : null}
          <Button type="button" variant="secondary" loading={sendBusy} onClick={() => void sendToTenant()}>
            <Mail size={16} style={{ marginRight: 8 }} aria-hidden />
            Send to tenant
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Field label="From">
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </Field>
          <Field label="To">
            <Input value={toName} onChange={(e) => setToName(e.target.value)} />
          </Field>
          <Field label="Status">
            <select className="pg-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {INVOICE_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invoice date">
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </Field>
        </div>

        {tenantEmail ? (
          <p className="pg-muted" style={{ marginTop: 8, fontSize: "0.8125rem" }}>
            Will send to: {tenantEmail}
          </p>
        ) : (
          <p className="pg-muted" style={{ marginTop: 8, fontSize: "0.8125rem" }}>
            No tenant email on file — add one before sending.
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="pg-muted" style={{ marginBottom: 8 }}>
            Line items
          </div>
          {lineItems.map((li, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "2fr 80px 120px auto",
                marginBottom: 8,
                alignItems: "end"
              }}
            >
              <Field label={idx === 0 ? "Description" : "\u00a0"}>
                <Input value={li.description} onChange={(e) => patchLine(idx, { description: e.target.value })} />
              </Field>
              <Field label={idx === 0 ? "Qty" : "\u00a0"}>
                <Input
                  type="number"
                  min={1}
                  value={li.quantity}
                  onChange={(e) => patchLine(idx, { quantity: Number(e.target.value) || 1 })}
                />
              </Field>
              <Field label={idx === 0 ? "Amount (ZAR)" : "\u00a0"}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={li.unitPrice}
                  onChange={(e) => patchLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                />
              </Field>
              {lineItems.length > 1 ? (
                <button
                  type="button"
                  className="pg-btn pg-btn-ghost"
                  aria-label="Remove line"
                  onClick={() => setLineItems((p) => p.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={18} />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={() => setLineItems((p) => [...p, emptyLine()])}>
            <Plus size={16} style={{ marginRight: 6 }} aria-hidden />
            Add item
          </Button>
        </div>

        <Field label="Notes">
          <textarea
            className="pg-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%", resize: "vertical" }}
          />
        </Field>

        {bankLines.length ? (
          <div style={{ marginTop: 12, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Banking details (from your profile)</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {bankLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="pg-muted" style={{ marginTop: 12 }}>
            Add banking details under Account → Invoice payment details.
          </p>
        )}
      </div>

      <aside className="pg-tstmt-invoice-preview" aria-label="Live invoice preview">
        <div style={{ fontWeight: 700, color: "var(--primary)", marginBottom: 8, fontSize: "1.25rem" }}>Proplytic</div>
        <div className="pg-muted">Tax Invoice · {invoiceNumber}</div>
        <div style={{ marginTop: 12, fontSize: "0.875rem", display: "grid", gap: 4 }}>
          <div>
            <span className="pg-muted">From: </span>
            {fromName}
          </div>
          <div>
            <span className="pg-muted">To: </span>
            {toName}
          </div>
          <div>
            <span className="pg-muted">Date: </span>
            {invoiceDate}
          </div>
          <div>
            <span className="pg-muted">Due: </span>
            {dueDate}
          </div>
          <div>
            <span className="pg-muted">Status: </span>
            {status}
          </div>
        </div>
        <table style={{ width: "100%", marginTop: 16, fontSize: "0.8125rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <th style={{ textAlign: "left", padding: "6px 0", color: "var(--text-muted)" }}>Item</th>
              <th style={{ textAlign: "right", padding: "6px 0", color: "var(--text-muted)" }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <td style={{ padding: "8px 0" }}>{li.description || "—"}</td>
                <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtZar(li.quantity * li.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pg-tstmt-invoice-preview__total">{fmtZar(total)}</div>
        <p className="pg-muted" style={{ fontSize: "0.8125rem", marginTop: 8 }}>
          Amount payable
        </p>
        {bankLines.length ? (
          <div style={{ marginTop: 16, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {bankLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        ) : null}
        {notes.trim() ? (
          <p style={{ marginTop: 12, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{notes}</p>
        ) : null}
      </aside>
    </form>
  );
}
