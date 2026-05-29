import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Mail, Plus, Save, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  createPropertyInvoice,
  generateInvoicePdf,
  getInvoice,
  hardDeleteInvoice,
  sendInvoiceEmail,
  updateInvoice,
  voidInvoice
} from "../../api/ownedProperties";
import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab, triggerPdfFileDownload } from "../../api/pdfBlob";
import { fetchMe } from "../../api/user";
import { invalidatePropertyWorkspace } from "../properties/invalidate";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  invoiceCanHardDelete,
  invoiceCanVoid,
  fmtZar
} from "./invoiceDirectoryUtils";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { isInvoiceEditable } from "./invoiceFoundation";
import { invoiceDetailPath, invoiceStatementPath } from "./invoiceRoutes";

type LineItem = {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

const LINE_CATEGORIES = [
  { value: "RENT", label: "Rent" },
  { value: "UTILITIES_RECOVERY", label: "Utilities recovery" },
  { value: "OTHER", label: "Other" }
] as const;

function emptyLine(defaultRent?: number): LineItem {
  const amt = defaultRent != null && Number.isFinite(defaultRent) ? defaultRent : 0;
  return { description: "Monthly Rent", category: "RENT", quantity: 1, unitPrice: amt, total: amt };
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

function unitLabel(unit: Record<string, unknown> | null | undefined): string | null {
  if (!unit) return null;
  const label = String(unit.unitLabel ?? unit.unit_label ?? "").trim();
  if (label) return label;
  const num = String(unit.unitNumber ?? unit.unit_number ?? "").trim();
  return num ? `Unit ${num}` : null;
}

export function InvoiceDetailPanel({
  invoiceId: initialInvoiceId,
  propertyId: bootstrapPropertyId,
  tenantId: bootstrapTenantId,
  tenantName: bootstrapTenantName,
  tenantEmail: bootstrapTenantEmail,
  leaseId: bootstrapLeaseId,
  profileName = "Proplytic",
  invoicePaymentDetails,
  defaultRent,
  onInvoiceCreated,
  onSaved,
  onCancel,
  onDeleted
}: {
  invoiceId?: string;
  propertyId?: string;
  tenantId?: string;
  tenantName?: string;
  tenantEmail?: string | null;
  leaseId?: string | null;
  profileName?: string;
  invoicePaymentDetails?: unknown;
  defaultRent?: number;
  onInvoiceCreated?: (invoiceId: string) => void;
  onSaved?: (invoiceId: string) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}) {
  const [activeId, setActiveId] = useState<string | undefined>(initialInvoiceId);
  const [propertyId, setPropertyId] = useState(bootstrapPropertyId ?? "");
  const [tenantId, setTenantId] = useState(bootstrapTenantId ?? "");
  const [tenantEmail, setTenantEmail] = useState(bootstrapTenantEmail ?? null);
  const [leaseId, setLeaseId] = useState(bootstrapLeaseId ?? null);
  const [propertyName, setPropertyName] = useState("—");
  const [unitLabelText, setUnitLabelText] = useState<string | null>(null);
  const [leaseLabel, setLeaseLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(initialInvoiceId));
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<"delete" | "void" | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("Draft");
  const [status, setStatus] = useState<string>("DRAFT");
  const [invoicePeriod, setInvoicePeriod] = useState<string | null>(null);
  const [balanceDue, setBalanceDue] = useState(0);
  const [fromName, setFromName] = useState(profileName);
  const [toName, setToName] = useState(bootstrapTenantName ?? "Tenant");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine(defaultRent)]);
  const [paymentDetails, setPaymentDetails] = useState<unknown>(invoicePaymentDetails);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const editable = !activeId || isInvoiceEditable(status);
  const locked = Boolean(activeId) && !editable;

  useEffect(() => {
    setActiveId(initialInvoiceId);
  }, [initialInvoiceId]);

  useEffect(() => {
    setFromName(profileName);
  }, [profileName]);

  useEffect(() => {
    if (invoicePaymentDetails != null) {
      setPaymentDetails(invoicePaymentDetails);
      return;
    }
    void (async () => {
      try {
        const me = await fetchMe();
        setFromName(String(me.name ?? me.email ?? "Proplytic"));
        setPaymentDetails(me.invoicePaymentDetails ?? null);
      } catch {
        /* profile optional for view */
      }
    })();
  }, [invoicePaymentDetails]);

  const [hasPdf, setHasPdf] = useState(false);

  const loadInvoice = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const inv = await getInvoice(id);
      setActiveId(String(inv.id));
      setPropertyId(String(inv.propertyId ?? ""));
      setTenantId(String(inv.tenantId ?? inv.primaryTenantId ?? ""));
      setLeaseId(inv.leaseId != null ? String(inv.leaseId) : null);
      setInvoiceNumber(String(inv.invoiceNumber ?? inv.id));
      setStatus(String(inv.status ?? "DRAFT"));
      setInvoicePeriod(inv.invoicePeriod != null ? String(inv.invoicePeriod) : null);
      const total = Number(inv.totalAmount ?? inv.total ?? 0);
      const bal = inv.balanceDue != null ? Number(inv.balanceDue) : total;
      setBalanceDue(Number.isFinite(bal) ? bal : total);
      setIssueDate(String(inv.issueDate ?? inv.invoiceDate ?? "").slice(0, 10));
      setDueDate(String(inv.dueDate ?? "").slice(0, 10));
      setNotes(String(inv.notes ?? ""));
      setHasPdf(Boolean(inv.hasPdf));

      const tenant = inv.tenant as Record<string, unknown> | undefined;
      if (tenant) {
        setToName(`${String(tenant.firstName ?? "")} ${String(tenant.lastName ?? "")}`.trim() || "Tenant");
        setTenantEmail(tenant.email != null ? String(tenant.email) : null);
      }

      const property = inv.property as Record<string, unknown> | undefined;
      if (property?.name) setPropertyName(String(property.name));

      const unit = inv.unit as Record<string, unknown> | undefined;
      setUnitLabelText(unitLabel(unit ?? null));

      const lease = inv.lease as Record<string, unknown> | undefined;
      if (lease?.startDate ?? lease?.start_date) {
        setLeaseLabel(`From ${String(lease.startDate ?? lease.start_date).slice(0, 10)}`);
      } else if (inv.leaseId) {
        setLeaseLabel("View lease");
      }

      const lines = (inv.lineItems as Array<Record<string, unknown>> | undefined) ?? [];
      if (lines.length) {
        setLineItems(
          lines.map((l) => ({
            description: String(l.description ?? ""),
            category: String(l.category ?? "OTHER"),
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
    if (bootstrapPropertyId) setPropertyId(bootstrapPropertyId);
    if (bootstrapTenantId) setTenantId(bootstrapTenantId);
    if (bootstrapTenantName) setToName(bootstrapTenantName);
    if (bootstrapTenantEmail != null) setTenantEmail(bootstrapTenantEmail);
    if (bootstrapLeaseId) setLeaseId(bootstrapLeaseId);
    if (defaultRent != null && Number.isFinite(defaultRent)) {
      setLineItems([emptyLine(defaultRent)]);
    }
    setLoading(false);
  }, [
    activeId,
    bootstrapPropertyId,
    bootstrapTenantId,
    bootstrapTenantName,
    bootstrapTenantEmail,
    bootstrapLeaseId,
    defaultRent,
    loadInvoice
  ]);

  const total = useMemo(
    () => lineItems.reduce((s, li) => s + (Number.isFinite(li.total) ? li.total : li.quantity * li.unitPrice), 0),
    [lineItems]
  );

  const bankLines = bankingLines(paymentDetails);

  const patchLine = (idx: number, patch: Partial<LineItem>) => {
    if (!editable) return;
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
    invoiceDate: issueDate,
    issueDate,
    dueDate,
    status,
    notes: notes.trim() || null,
    total,
    lineItems: lineItems.map((li) => ({
      description: li.description.trim() || "Line item",
      category: li.category,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      total: li.quantity * li.unitPrice
    }))
  });

  const saveInvoice = async (): Promise<string | null> => {
    if (!editable && activeId) return activeId;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!propertyId || !tenantId) throw new Error("Property and tenant are required.");
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
        setSuccess("Invoice saved.");
        setBalanceDue(total);
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
      setSuccess("PDF opened in a new tab.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not export PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadPdf = async () => {
    setError("");
    let id: string | undefined = activeId;
    if (!id) return;
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
    if (!editable) return;
    setError("");
    setSuccess("");
    let id: string | undefined = activeId;
    if (!id) {
      const saved = await saveInvoice();
      if (!saved) return;
      id = saved;
    }
    if (!tenantEmail?.trim()) {
      setError("This tenant has no email on file.");
      return;
    }
    setSendBusy(true);
    try {
      if (status === "DRAFT" || status === "GENERATED") {
        await updateInvoice(id, { status: "SENT" });
        setStatus("SENT");
      }
      if (!hasPdf) {
        await generateInvoicePdf(id);
        setHasPdf(true);
      }
      const res = await sendInvoiceEmail(id);
      setSuccess(res.message ?? `Invoice sent to ${tenantEmail}.`);
      await loadInvoice(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send invoice.");
    } finally {
      setSendBusy(false);
    }
  };

  async function confirmRemove() {
    if (!activeId || !confirmDelete) return;
    setActionBusy(true);
    setError("");
    try {
      if (confirmDelete === "delete") await hardDeleteInvoice(activeId);
      else await voidInvoice(activeId);
      invalidatePropertyWorkspace(propertyId);
      setConfirmDelete(null);
      onDeleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <div className="pg-tstmt-skeleton" style={{ minHeight: 240 }} aria-busy="true" />;
  }

  return (
    <>
      <form className="pg-tstmt-invoice-editor" onSubmit={submit}>
        <div>
          {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
          {success ? (
            <div className="pg-alert" style={{ marginBottom: 12, background: "var(--success-soft)", color: "var(--success)" }}>
              {success}
            </div>
          ) : null}

          {locked ? (
            <div className="pg-alert" style={{ marginBottom: 16, background: "var(--warning-soft)", color: "var(--text-primary)" }}>
              This invoice has been sent and can no longer be edited. To correct it, delete/void it or create a correction
              according to your accounting workflow.
            </div>
          ) : null}

          <header className="pg-invoice-detail-head" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{invoiceNumber}</h2>
              <InvoiceStatusBadge status={status} />
              {!activeId ? <span className="pg-muted">New invoice</span> : null}
            </div>
            <dl className="pg-invoice-detail-meta">
              <div>
                <dt>Property</dt>
                <dd>
                  {propertyId ? (
                    <Link className="pg-link" to={`/owned-properties/${propertyId}`}>
                      {propertyName}
                    </Link>
                  ) : (
                    propertyName
                  )}
                </dd>
              </div>
              <div>
                <dt>Unit</dt>
                <dd>{unitLabelText ?? "—"}</dd>
              </div>
              <div>
                <dt>Lease</dt>
                <dd>
                  {leaseId ? (
                    <Link className="pg-link" to={`/leases/${leaseId}`}>
                      {leaseLabel ?? "View lease"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Tenant</dt>
                <dd>
                  {tenantId ? (
                    <Link className="pg-link" to={`/tenants/${tenantId}`}>
                      {toName}
                    </Link>
                  ) : (
                    toName
                  )}
                </dd>
              </div>
              <div>
                <dt>Period</dt>
                <dd>{invoicePeriod ?? "—"}</dd>
              </div>
              <div>
                <dt>Balance due</dt>
                <dd>{fmtZar(activeId ? balanceDue : total)}</dd>
              </div>
            </dl>
          </header>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
            {editable ? (
              <Button type="submit" loading={saving}>
                <Save size={16} style={{ marginRight: 8 }} aria-hidden />
                {activeId ? "Save changes" : "Save invoice"}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" loading={pdfBusy} onClick={() => void exportPdf()}>
              <Download size={16} style={{ marginRight: 8 }} aria-hidden />
              Export PDF
            </Button>
            {hasPdf ? (
              <Button type="button" variant="ghost" loading={pdfBusy} onClick={() => void downloadPdf()}>
                Download PDF
              </Button>
            ) : null}
            {editable ? (
              <Button type="button" variant="secondary" loading={sendBusy} onClick={() => void sendToTenant()}>
                <Mail size={16} style={{ marginRight: 8 }} aria-hidden />
                Send to tenant
              </Button>
            ) : null}
            {propertyId ? (
              <Link className="pg-btn pg-btn-ghost" to={invoiceStatementPath(propertyId)}>
                <ExternalLink size={16} style={{ marginRight: 8 }} aria-hidden />
                Statement
              </Link>
            ) : null}
            {activeId && invoiceCanHardDelete(status) ? (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete("delete")}>
                <Trash2 size={16} style={{ marginRight: 8 }} aria-hidden />
                Delete
              </Button>
            ) : null}
            {activeId && invoiceCanVoid(status) ? (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete("void")}>
                Void
              </Button>
            ) : null}
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label="From">
              <Input value={fromName} readOnly disabled />
            </Field>
            <Field label="To">
              <Input value={toName} readOnly disabled />
            </Field>
            <Field label="Issue date">
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                readOnly={!editable}
                disabled={!editable}
              />
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                readOnly={!editable}
                disabled={!editable}
              />
            </Field>
          </div>

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
                  gridTemplateColumns: editable ? "1fr 120px 2fr 80px 120px auto" : "2fr 120px 1fr 80px 120px",
                  marginBottom: 8,
                  alignItems: "end"
                }}
              >
                <Field label={idx === 0 ? "Description" : "\u00a0"}>
                  <Input
                    value={li.description}
                    onChange={(e) => patchLine(idx, { description: e.target.value })}
                    readOnly={!editable}
                    disabled={!editable}
                  />
                </Field>
                <Field label={idx === 0 ? "Category" : "\u00a0"}>
                  <select
                    className="pg-input"
                    value={li.category}
                    onChange={(e) => patchLine(idx, { category: e.target.value })}
                    disabled={!editable}
                  >
                    {LINE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <span />
                <Field label={idx === 0 ? "Qty" : "\u00a0"}>
                  <Input
                    type="number"
                    min={1}
                    value={li.quantity}
                    onChange={(e) => patchLine(idx, { quantity: Number(e.target.value) || 1 })}
                    readOnly={!editable}
                    disabled={!editable}
                  />
                </Field>
                <Field label={idx === 0 ? "Unit price" : "\u00a0"}>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={li.unitPrice}
                    onChange={(e) => patchLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                    readOnly={!editable}
                    disabled={!editable}
                  />
                </Field>
                {editable && lineItems.length > 1 ? (
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
            {editable ? (
              <Button type="button" variant="ghost" onClick={() => setLineItems((p) => [...p, emptyLine()])}>
                <Plus size={16} style={{ marginRight: 6 }} aria-hidden />
                Add item
              </Button>
            ) : null}
          </div>

          <Field label="Notes">
            <textarea
              className="pg-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              readOnly={!editable}
              disabled={!editable}
              style={{ width: "100%", resize: "vertical" }}
            />
          </Field>

          {bankLines.length ? (
            <div style={{ marginTop: 12, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>Banking details</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {bankLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="pg-tstmt-invoice-preview" aria-label="Invoice summary">
          <div style={{ fontWeight: 700, color: "var(--primary)", marginBottom: 8, fontSize: "1.25rem" }}>Proplytic</div>
          <div className="pg-muted">Tax Invoice · {invoiceNumber}</div>
          <div style={{ marginTop: 12, fontSize: "0.875rem", display: "grid", gap: 4 }}>
            <div>
              <span className="pg-muted">To: </span>
              {toName}
            </div>
            <div>
              <span className="pg-muted">Issue: </span>
              {issueDate}
            </div>
            <div>
              <span className="pg-muted">Due: </span>
              {dueDate}
            </div>
            <div>
              <span className="pg-muted">Total: </span>
              {fmtZar(total)}
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
        </aside>
      </form>

      <ConfirmDialog
        open={confirmDelete != null}
        title={confirmDelete === "void" ? "Void invoice" : "Delete invoice"}
        confirmLabel={confirmDelete === "void" ? "Void invoice" : "Delete invoice"}
        confirmVariant="danger"
        loading={actionBusy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void confirmRemove()}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          {confirmDelete === "void"
            ? "This invoice will be voided and excluded from balances."
            : "This draft invoice will be permanently deleted."}
        </p>
      </ConfirmDialog>
    </>
  );
}
