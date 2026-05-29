import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon, IconButton } from "../../components/icons";
import {
  createPropertyInvoice,
  generateInvoicePdf,
  getInvoice,
  hardDeleteInvoice,
  markInvoiceSent,
  updateInvoice,
  voidInvoice
} from "../../api/ownedProperties";
import { fetchPdfBlob, triggerPdfFileDownload } from "../../api/pdfBlob";
import { fetchMe } from "../../api/user";
import { invalidatePropertyWorkspace } from "../properties/invalidate";
import { openInvoicePdfExport, invoicePdfWasStored } from "./invoicePdfExport";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  invoiceCanHardDelete,
  invoiceCanVoid,
  fmtZar
} from "./invoiceDirectoryUtils";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { isInvoiceEditable } from "./invoiceFoundation";
import { InvoiceLineItemsEditor } from "./InvoiceLineItemsEditor";
import {
  calcInvoiceSubtotal,
  emptyInvoiceLine,
  invoiceLineItemsForSave,
  mapDbLineItem,
  sortInvoiceLineItems,
  type InvoiceLineItemDraft
} from "./invoiceLineItemUtils";
import { invoiceStatementPath } from "./invoiceRoutes";
import {
  INVOICE_SEND_EMAIL_COMING_SOON,
  INVOICE_SEND_MODAL_MESSAGE,
  INVOICE_SEND_MODAL_TITLE,
  canMarkInvoiceSent,
  invoiceSendButtonLabel,
  invoiceSendConfirmLabel,
  invoiceSendSuccessMessage,
  isInvoiceEmailDeliveryAvailable
} from "./invoiceSendWorkflow";

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
  const [loading, setLoading] = useState(Boolean(initialInvoiceId));
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<"delete" | "void" | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("Draft");
  const [status, setStatus] = useState<string>("DRAFT");
  const [balanceDue, setBalanceDue] = useState(0);
  const [fromName, setFromName] = useState(profileName);
  const [toName, setToName] = useState(bootstrapTenantName ?? "Tenant");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>([emptyInvoiceLine(defaultRent)]);
  const [paymentDetails, setPaymentDetails] = useState<unknown>(invoicePaymentDetails);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const editable = !activeId || isInvoiceEditable(status);
  const locked = Boolean(activeId) && !editable;
  const pageTitle = activeId ? "Edit Invoice" : "Create Invoice";
  const displayNumber = invoiceNumber === "Draft" && !activeId ? "New invoice" : invoiceNumber;

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

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

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

      const lines = (inv.lineItems as Array<Record<string, unknown>> | undefined) ?? [];
      if (lines.length) {
        setLineItems(sortInvoiceLineItems(lines.map((l, i) => mapDbLineItem(l, i))));
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
      setLineItems([emptyInvoiceLine(defaultRent)]);
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

  const subtotal = useMemo(() => calcInvoiceSubtotal(lineItems), [lineItems]);
  const total = subtotal;
  const taxAmount = 0;

  const bankLines = bankingLines(paymentDetails);

  const buildPayload = () => ({
    tenantId,
    leaseId: leaseId ?? undefined,
    invoiceDate: issueDate,
    issueDate,
    dueDate,
    notes: notes.trim() || null,
    subtotal,
    taxAmount,
    total,
    lineItems: invoiceLineItemsForSave(lineItems)
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
        await loadInvoice(savedId);
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
      await openInvoicePdfExport(gen);
      if (invoicePdfWasStored(gen)) setHasPdf(true);
      setSuccess(gen.reused ? "PDF opened (stored copy)." : "PDF opened in a new tab.");
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
    setMoreOpen(false);
    try {
      let inv = await getInvoice(id);
      let url = inv.downloadUrl as string | null | undefined;
      if (!url) {
        const gen = await generateInvoicePdf(id);
        url = gen.downloadUrl ?? null;
        if (invoicePdfWasStored(gen)) setHasPdf(true);
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

  const confirmSendInvoice = async () => {
    if (!editable) return;
    setError("");
    setSuccess("");
    const statusBeforeSend = status;
    setSendBusy(true);
    try {
      let id: string | undefined = activeId;
      if (!id) {
        const saved = await saveInvoice();
        if (!saved) return;
        id = saved;
      }
      await markInvoiceSent(id);
      await generateInvoicePdf(id);
      setHasPdf(true);
      invalidatePropertyWorkspace(propertyId);
      await loadInvoice(id);
      setConfirmSend(false);
      setSuccess(invoiceSendSuccessMessage(statusBeforeSend));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not mark invoice as sent.");
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

  const renderDateField = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <div className="pg-inv-editor__field pg-inv-editor__field--date">
      <label className="pg-inv-editor__label" htmlFor={id}>
        {label}
      </label>
      <div className="pg-inv-editor__input-wrap">
        <AppIcon name="calendar" size="md" className="pg-inv-editor__input-icon" />
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          readOnly={!editable}
          disabled={!editable}
          aria-label={label}
        />
      </div>
    </div>
  );

  const renderMoreMenu = () => (
    <div className="pg-inv-editor__more-wrap" ref={moreRef}>
      <IconButton
        icon="more"
        aria-label="More actions"
        variant="ghost"
        size="md"
        tooltip={false}
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        onClick={() => setMoreOpen((o) => !o)}
      />
      {moreOpen ? (
        <div className="pg-inv-editor__more-menu" role="menu">
          {activeId ? (
            <button type="button" className="pg-inv-editor__more-item" role="menuitem" disabled={pdfBusy} onClick={() => void downloadPdf()}>
              <AppIcon name="download" size="sm" />
              Download PDF
            </button>
          ) : null}
          {propertyId ? (
            <Link className="pg-inv-editor__more-item" role="menuitem" to={invoiceStatementPath(propertyId)} onClick={() => setMoreOpen(false)}>
              View statement
            </Link>
          ) : null}
          {activeId && invoiceCanHardDelete(status) ? (
            <button
              type="button"
              className="pg-inv-editor__more-item pg-inv-editor__more-item--danger"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                setConfirmDelete("delete");
              }}
            >
              <AppIcon name="delete" size="sm" />
              Delete invoice
            </button>
          ) : null}
          {activeId && invoiceCanVoid(status) ? (
            <button
              type="button"
              className="pg-inv-editor__more-item pg-inv-editor__more-item--danger"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                setConfirmDelete("void");
              }}
            >
              Void invoice
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              className="pg-inv-editor__more-item"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                onCancel();
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (loading) {
    return <div className="pg-tstmt-skeleton" style={{ minHeight: 320 }} aria-busy="true" />;
  }

  return (
    <>
      <form className="pg-inv-editor" onSubmit={submit}>
        <header className="pg-inv-editor__page-head">
          <div className="pg-inv-editor__page-head-main">
            <div className="pg-inv-editor__back-row">
              <Link className="pg-inv-editor__back" to="/invoices" aria-label="Back to invoices">
                <AppIcon name="back" size="md" />
              </Link>
              <nav className="pg-inv-editor__breadcrumb" aria-label="Breadcrumb">
                <Link to="/invoices">Invoices</Link>
                <span className="pg-inv-editor__breadcrumb-sep" aria-hidden>
                  /
                </span>
                <span aria-current="page">{displayNumber}</span>
              </nav>
            </div>
            <div className="pg-inv-editor__title-row">
              <h1 className="pg-inv-editor__title">{pageTitle}</h1>
              <InvoiceStatusBadge status={status} />
            </div>
            <p className="pg-inv-editor__subtitle">Create and send professional invoices to your tenants.</p>
          </div>
          <div className="pg-inv-editor__actions pg-inv-editor__actions--desktop">
            <Button type="button" variant="secondary" loading={pdfBusy} onClick={() => void exportPdf()}>
              <AppIcon name="view" size="sm" style={{ marginRight: 8 }} />
              Preview
            </Button>
            {editable ? (
              <Button type="submit" variant="secondary" loading={saving} className="pg-inv-editor__btn-outline">
                <AppIcon name="save" size="sm" style={{ marginRight: 8 }} />
                Save Draft
              </Button>
            ) : null}
            {editable && canMarkInvoiceSent(status) ? (
              <Button type="button" loading={sendBusy} onClick={() => setConfirmSend(true)}>
                <AppIcon name="send" size="sm" style={{ marginRight: 8 }} />
                {invoiceSendButtonLabel()}
              </Button>
            ) : null}
            {renderMoreMenu()}
          </div>
        </header>

        <header className="pg-inv-editor__mobile-head">
          <Link className="pg-inv-editor__back" to="/invoices" aria-label="Back to invoices">
            <AppIcon name="back" size="md" />
          </Link>
          <h1 className="pg-inv-editor__mobile-title">{pageTitle}</h1>
          {renderMoreMenu()}
        </header>

        {error ? (
          <div className="pg-alert pg-alert-error" role="alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="pg-alert" style={{ background: "var(--success-soft)", color: "var(--success)" }} role="status">
            {success}
          </div>
        ) : null}

        <div className="pg-inv-editor__card">
          {locked ? (
            <div className="pg-inv-editor__locked" role="status">
              This invoice has been sent and can no longer be edited.
            </div>
          ) : null}

          <div className="pg-inv-editor__fields pg-inv-editor__fields--desktop">
            <div className="pg-inv-editor__field pg-inv-editor__field--tenant">
              <span className="pg-inv-editor__label">Tenant / Contact</span>
              <div className="pg-inv-editor__tenant-select" aria-label="Tenant">
                <span className="pg-inv-editor__tenant-avatar" aria-hidden>
                  <AppIcon name="tenant" size="sm" />
                </span>
                <span className="pg-inv-editor__tenant-name">{toName}</span>
                <AppIcon name="chevronDown" size="md" className="pg-inv-editor__input-icon" />
              </div>
            </div>

            {renderDateField("inv-issue-date", "Issue Date", issueDate, setIssueDate)}
            {renderDateField("inv-due-date", "Due Date", dueDate, setDueDate)}

            <div className="pg-inv-editor__field pg-inv-editor__field--number">
              <label className="pg-inv-editor__label" htmlFor="inv-number">
                Invoice Number
              </label>
              <div className="pg-inv-editor__input-wrap">
                <AppIcon name="hash" size="md" className="pg-inv-editor__input-icon" />
                <Input id="inv-number" value={displayNumber} readOnly disabled aria-label="Invoice number" />
              </div>
            </div>

            <div className="pg-inv-editor__field pg-inv-editor__field--status">
              <span className="pg-inv-editor__label">Status</span>
              <div className="pg-inv-editor__status-wrap">
                <InvoiceStatusBadge status={status} />
              </div>
            </div>

            <div className="pg-inv-editor__branding">
              <span>PDF Branding:</span>
              <strong>{fromName ? `${fromName} Standard` : "Proplytic Standard"}</strong>
              <Link className="pg-inv-editor__branding-link" to="/settings">
                Change
              </Link>
            </div>
          </div>

          <div className="pg-inv-editor__mobile-fields">
            <div className="pg-inv-editor__mobile-card pg-inv-editor__mobile-card--status">
              <span className="pg-inv-editor__label">Status</span>
              <InvoiceStatusBadge status={status} />
            </div>

            <div className="pg-inv-editor__mobile-card">
              <span className="pg-inv-editor__label">Tenant / Contact</span>
              <div className="pg-inv-editor__tenant-select" style={{ marginTop: 8 }}>
                <span className="pg-inv-editor__tenant-avatar" aria-hidden>
                  <AppIcon name="tenant" size="sm" />
                </span>
                <span className="pg-inv-editor__tenant-name">{toName}</span>
                <AppIcon name="chevronDown" size="md" className="pg-inv-editor__input-icon" />
              </div>
            </div>

            <div className="pg-inv-editor__mobile-card">
              <dl>
                <div className="pg-inv-editor__mobile-detail-row">
                  <dt>Issue Date</dt>
                  <dd>
                    <Input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      required
                      readOnly={!editable}
                      disabled={!editable}
                      aria-label="Issue Date"
                      style={{ border: "none", background: "transparent", textAlign: "right", padding: 0, minHeight: 0 }}
                    />
                  </dd>
                </div>
                <div className="pg-inv-editor__mobile-detail-row">
                  <dt>Due Date</dt>
                  <dd>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                      readOnly={!editable}
                      disabled={!editable}
                      aria-label="Due Date"
                      style={{ border: "none", background: "transparent", textAlign: "right", padding: 0, minHeight: 0 }}
                    />
                  </dd>
                </div>
                <div className="pg-inv-editor__mobile-detail-row">
                  <dt>Invoice Number</dt>
                  <dd>{displayNumber}</dd>
                </div>
              </dl>
            </div>
          </div>

          <InvoiceLineItemsEditor lineItems={lineItems} editable={editable} defaultRent={defaultRent} onChange={setLineItems} />

          <div className="pg-inv-editor__footer-grid">
            <div className="pg-inv-editor__notes-stack">
              <div className="pg-inv-editor__field">
                <label className="pg-inv-editor__label" htmlFor="inv-notes-tenant">
                  Notes to tenant
                </label>
                <textarea
                  id="inv-notes-tenant"
                  className="pg-inv-editor__textarea"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  readOnly={!editable}
                  disabled={!editable}
                  placeholder="Thank you for your prompt payment."
                />
              </div>
            </div>

            <aside className="pg-inv-editor__totals" aria-label="Invoice totals">
              <div className="pg-inv-editor__totals-row">
                <span>Subtotal</span>
                <strong>{fmtZar(subtotal)}</strong>
              </div>
              {taxAmount > 0 ? (
                <div className="pg-inv-editor__totals-row">
                  <span>Tax</span>
                  <strong>{fmtZar(taxAmount)}</strong>
                </div>
              ) : null}
              <div className="pg-inv-editor__totals-row pg-inv-editor__totals-total">
                <span>Total</span>
                <strong>{fmtZar(total)}</strong>
              </div>
              <div className="pg-inv-editor__totals-row pg-inv-editor__totals-balance">
                <span>Balance Due</span>
                <strong>{fmtZar(activeId ? balanceDue : total)}</strong>
              </div>
            </aside>
          </div>

          {bankLines.length ? (
            <div className="pg-inv-editor__banking">
              <strong style={{ color: "var(--text-primary)" }}>Payment details</strong>
              <ul>
                {bankLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="pg-inv-editor__mobile-bar">
          {editable ? (
            <Button type="submit" variant="secondary" loading={saving} className="pg-inv-editor__btn-outline">
              <AppIcon name="save" size="sm" style={{ marginRight: 8 }} />
              Save Draft
            </Button>
          ) : (
            <Button type="button" variant="secondary" loading={pdfBusy} onClick={() => void exportPdf()}>
              <AppIcon name="view" size="sm" style={{ marginRight: 8 }} />
              Preview
            </Button>
          )}
          {editable && canMarkInvoiceSent(status) ? (
            <Button type="button" loading={sendBusy} onClick={() => setConfirmSend(true)}>
              {invoiceSendButtonLabel()}
            </Button>
          ) : locked ? (
            <Button type="button" variant="secondary" loading={pdfBusy} onClick={() => void exportPdf()}>
              Export PDF
            </Button>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        open={confirmSend}
        title={INVOICE_SEND_MODAL_TITLE}
        confirmLabel={invoiceSendConfirmLabel()}
        loading={sendBusy}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => void confirmSendInvoice()}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          {INVOICE_SEND_MODAL_MESSAGE}
        </p>
        {!isInvoiceEmailDeliveryAvailable() ? (
          <p className="pg-muted" style={{ margin: "12px 0 0", fontSize: "0.875rem" }}>
            {INVOICE_SEND_EMAIL_COMING_SOON}
          </p>
        ) : null}
      </ConfirmDialog>

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
