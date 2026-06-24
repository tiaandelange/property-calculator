import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppIcon, IconButton } from "../../components/icons";
import {
  createPropertyInvoice,
  deleteInvoicePayment,
  generateInvoicePdf,
  getInvoice,
  getPropertyTenants,
  hardDeleteInvoice,
  markInvoiceSent,
  recordInvoicePayment,
  sendInvoiceEmail,
  updateInvoice,
  updateInvoicePayment,
  voidInvoice
} from "../../api/ownedProperties";
import { fetchPdfBlob, triggerPdfFileDownload } from "../../api/pdfBlob";
import { queryKeys } from "../../lib/queryKeys";
import { STALE_TIME_PROPERTIES_MS } from "../../lib/queryClient";
import { invalidateInvoiceQueries } from "../../lib/queryInvalidation";
import { useProfileQuery } from "../queries";
import { invalidatePropertyWorkspace } from "../properties/invalidate";
import { openInvoicePdfExport, invoicePdfWasStored } from "./invoicePdfExport";
import { Button } from "../../components/ui/Button";
import { SplitButton, type SplitButtonMenuItem } from "../../components/ui/SplitButton";
import { Input } from "../../components/ui/Input";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  invoiceCanHardDelete,
  invoiceCanVoid,
  fmtZar
} from "./invoiceDirectoryUtils";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import {
  canRecordInvoicePayment,
  canEditInvoiceDueDate,
  isInvoiceContentEditable,
  isInvoiceEditable,
  isInvoicePostSendStatus
} from "./invoiceFoundation";
import { InvoiceLineItemsEditor } from "./InvoiceLineItemsEditor";
import { InvoicePaymentsTable } from "./InvoicePaymentsTable";
import { InvoiceRecordPaymentModal, type InvoicePaymentFormState } from "./InvoiceRecordPaymentModal";
import { InvoiceSendEmailModal, type InvoiceSendEmailFormState } from "./InvoiceSendEmailModal";
import {
  formatPaymentDateLabel,
  mapInvoicePayments,
  sumInvoicePayments,
  type InvoicePaymentRow
} from "./invoicePaymentUtils";
import { getInvoiceAutomationSettings } from "../../services/invoiceAutomationSupabase";
import {
  calcInvoiceSubtotal,
  calcInvoiceTaxAmount,
  calcInvoiceTotal,
  emptyInvoiceLine,
  invoiceLineItemsForSave,
  mapDbLineItem,
  patchInvoiceLineItem,
  sortInvoiceLineItems,
  type InvoiceLineItemDraft
} from "./invoiceLineItemUtils";
import { dueDateFromIssueDate, mapPropertyTenantRow, type PropertyTenantOption } from "./invoiceEditorUtils";
import { invoiceStatementPath } from "./invoiceRoutes";
import {
  INVOICE_MARK_SENT_MODAL_MESSAGE,
  INVOICE_MARK_SENT_MODAL_TITLE,
  INVOICE_SEND_COMING_SOON_MESSAGE,
  INVOICE_SENT_EDIT_MODAL_MESSAGE,
  INVOICE_SENT_EDIT_MODAL_TITLE,
  canMarkInvoiceSent,
  invoiceAddPaymentMenuLabel,
  invoiceMarkAsSentConfirmLabel,
  invoiceMarkAsSentMenuLabel,
  invoiceSendButtonLabel,
  invoiceSendSuccessMessage,
  isInvoiceEmailDeliveryAvailable
} from "./invoiceSendWorkflow";

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
  const queryClient = useQueryClient();
  const profileQuery = useProfileQuery();
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
  const [confirmSentEdit, setConfirmSentEdit] = useState(false);
  const [sentEditUnlocked, setSentEditUnlocked] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [sendEmailModalOpen, setSendEmailModalOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentRowBusy, setPaymentRowBusy] = useState<string | null>(null);
  const [payments, setPayments] = useState<InvoicePaymentRow[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const dueDateManualRef = useRef(false);
  const dueDateSaveRef = useRef<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("Draft");
  const [status, setStatus] = useState<string>("DRAFT");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [balanceDue, setBalanceDue] = useState(0);
  const [fromName, setFromName] = useState(profileName);
  const [toName, setToName] = useState(bootstrapTenantName ?? "Tenant");
  const [tenantFirstName, setTenantFirstName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gracePeriodDays, setGracePeriodDays] = useState(7);
  const [leaseReference, setLeaseReference] = useState<string | null>(null);
  const [propertyTenants, setPropertyTenants] = useState<PropertyTenantOption[]>([]);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>([emptyInvoiceLine(defaultRent)]);
  const [paymentDetails, setPaymentDetails] = useState<unknown>(invoicePaymentDetails);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const draftEditable = !activeId || isInvoiceEditable(status);
  const contentEditable = !activeId || isInvoiceContentEditable(status);
  const postSend = Boolean(activeId) && isInvoicePostSendStatus(status, sentAt);
  const needsSentEditUnlock = postSend && !sentEditUnlocked;
  const fieldsEnabled = contentEditable && (!postSend || sentEditUnlocked);
  const dueDateEditable = canEditInvoiceDueDate(status);
  const pageTitle = activeId ? "Edit Invoice" : "Create Invoice";
  const displayNumber = invoiceNumber === "Draft" && !activeId ? "New invoice" : invoiceNumber;

  useEffect(() => {
    setActiveId(initialInvoiceId);
  }, [initialInvoiceId]);

  useEffect(() => {
    setFromName(profileName);
  }, [profileName]);

  useEffect(() => {
    const me = profileQuery.data;
    if (!me) return;
    const displayName =
      me.financialLandlord?.name?.trim() || me.name?.trim() || me.email?.trim() || "Proplytic";
    setFromName(displayName);
    if (invoicePaymentDetails != null) {
      setPaymentDetails(invoicePaymentDetails);
      return;
    }
    setPaymentDetails(me.invoicePaymentDetails ?? null);
  }, [invoicePaymentDetails, profileQuery.data, profileQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getInvoiceAutomationSettings();
        setGracePeriodDays(settings.rentInvoiceGracePeriodDays);
      } catch {
        /* use default grace period */
      }
    })();
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setPropertyTenants([]);
      return;
    }
    void (async () => {
      try {
        const rows = await getPropertyTenants(propertyId);
        setPropertyTenants(rows.map((row) => mapPropertyTenantRow(row as Record<string, unknown>)));
      } catch {
        setPropertyTenants([]);
      }
    })();
  }, [propertyId]);

  const [hasPdf, setHasPdf] = useState(false);

  const loadInvoice = useCallback(async (id: string, opts?: { force?: boolean }) => {
    setLoading(true);
    setError("");
    try {
      if (opts?.force) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceDetail(id) });
      }
      const inv = await queryClient.fetchQuery({
        queryKey: queryKeys.invoiceDetail(id),
        queryFn: () => getInvoice(id),
        staleTime: opts?.force ? 0 : STALE_TIME_PROPERTIES_MS
      });
      setActiveId(String(inv.id));
      setPropertyId(String(inv.propertyId ?? ""));
      setTenantId(String(inv.tenantId ?? inv.primaryTenantId ?? ""));
      setLeaseId(inv.leaseId != null ? String(inv.leaseId) : null);
      setInvoiceNumber(String(inv.invoiceNumber ?? inv.id));
      setStatus(String(inv.status ?? "DRAFT"));
      setSentAt(inv.sentAt != null ? String(inv.sentAt) : null);
      dueDateManualRef.current = false;
      const invoiceTotal = Number(inv.totalAmount ?? inv.total ?? 0);
      const bal = inv.balanceDue != null ? Number(inv.balanceDue) : invoiceTotal;
      setBalanceDue(Number.isFinite(bal) ? bal : invoiceTotal);
      setIssueDate(String(inv.issueDate ?? inv.invoiceDate ?? "").slice(0, 10));
      setDueDate(String(inv.dueDate ?? "").slice(0, 10));
      setNotes(String(inv.notes ?? ""));
      setHasPdf(Boolean(inv.hasPdf));

      const tenant = inv.tenant as Record<string, unknown> | undefined;
      if (tenant) {
        setToName(`${String(tenant.firstName ?? "")} ${String(tenant.lastName ?? "")}`.trim() || "Tenant");
        setTenantFirstName(String(tenant.firstName ?? "").trim());
        setTenantEmail(tenant.email != null ? String(tenant.email) : null);
      }

      const property = inv.property as Record<string, unknown> | undefined;
      setPropertyName(String(property?.name ?? property?.propertyName ?? "").trim());

      const lease = inv.lease as Record<string, unknown> | undefined;
      const refRaw = lease?.leaseReference ?? lease?.lease_reference;
      setLeaseReference(refRaw != null && String(refRaw).trim() ? String(refRaw).trim() : null);

      const lines = (inv.lineItems as Array<Record<string, unknown>> | undefined) ?? [];
      if (lines.length) {
        setLineItems(sortInvoiceLineItems(lines.map((l, i) => mapDbLineItem(l, i))));
      } else {
        const rentAmt =
          Number.isFinite(invoiceTotal) && invoiceTotal > 0
            ? invoiceTotal
            : defaultRent != null && Number.isFinite(defaultRent)
              ? defaultRent
              : 0;
        setLineItems([emptyInvoiceLine(rentAmt)]);
      }
      setPayments(mapInvoicePayments(inv.payments));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load invoice.");
    } finally {
      setLoading(false);
    }
  }, [defaultRent, queryClient]);

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
  const taxAmount = useMemo(() => calcInvoiceTaxAmount(lineItems), [lineItems]);
  const total = useMemo(() => calcInvoiceTotal(lineItems), [lineItems]);
  const paymentsTotal = useMemo(() => sumInvoicePayments(payments), [payments]);
  const defaultPaymentAmount = useMemo(() => {
    const due = balanceDue > 0 ? balanceDue : total;
    return due > 0 ? due : total;
  }, [balanceDue, total]);

  useEffect(() => {
    if (!isInvoicePostSendStatus(status, sentAt)) {
      setSentEditUnlocked(false);
    }
  }, [status, sentAt, activeId]);

  useEffect(() => {
    if (!fieldsEnabled || dueDateManualRef.current) return;
    setDueDate(dueDateFromIssueDate(issueDate, gracePeriodDays));
  }, [issueDate, gracePeriodDays, fieldsEnabled]);

  const saveDueDateOnly = useCallback(
    async (nextDueDate: string) => {
      if (!activeId || !dueDateEditable) return;
      if (fieldsEnabled) return;
      setSaving(true);
      setError("");
      try {
        await updateInvoice(activeId, { dueDate: nextDueDate });
        invalidatePropertyWorkspace(propertyId);
        setSuccess("Due date updated.");
        window.setTimeout(() => setSuccess(""), 3000);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not update due date.");
      } finally {
        setSaving(false);
      }
    },
    [activeId, dueDateEditable, fieldsEnabled, propertyId]
  );

  const handleDueDateChange = (value: string) => {
    dueDateManualRef.current = true;
    setDueDate(value);
  };

  const handleDueDateBlur = () => {
    if (!activeId || !dueDateEditable || fieldsEnabled) return;
    if (dueDateSaveRef.current === dueDate) return;
    dueDateSaveRef.current = dueDate;
    void saveDueDateOnly(dueDate);
  };

  const handleTenantChange = (nextTenantId: string) => {
    if (!fieldsEnabled) return;
    const tenant = propertyTenants.find((t) => t.id === nextTenantId);
    if (!tenant) return;
    setTenantId(nextTenantId);
    setToName(tenant.fullName);
    setTenantEmail(tenant.email);
    setLeaseId(tenant.leaseId);
    setLeaseReference(tenant.leaseReference);
    if (tenant.monthlyRent != null && Number.isFinite(tenant.monthlyRent)) {
      setLineItems((items) =>
        items.map((row) =>
          String(row.category).toUpperCase() === "RENT" && row.description.trim().toLowerCase().includes("rent")
            ? patchInvoiceLineItem(row, { unitPrice: tenant.monthlyRent! })
            : row
        )
      );
    }
  };

  const displayBalanceDue =
    payments.length > 0 || (activeId && !fieldsEnabled)
      ? Math.max(0, Number.isFinite(balanceDue) ? balanceDue : total - paymentsTotal)
      : total;
  const saveButtonLabel = draftEditable ? "Save Draft" : "Save";
  const showMarkAsSent = canMarkInvoiceSent(status, sentAt);

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
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
    };
    if (draftEditable) {
      payload.status = "DRAFT";
    }
    return payload;
  };

  const saveInvoice = async (): Promise<string | null> => {
    if (!fieldsEnabled && activeId) return activeId;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!propertyId || !tenantId) throw new Error("Property and tenant are required.");
      const payload = buildPayload();
      let savedId = activeId;
      if (activeId) {
        await updateInvoice(activeId, payload);
        invalidateInvoiceQueries({
          queryClient,
          propertyId: propertyId || undefined,
          tenantId: tenantId || undefined,
          invoiceId: activeId
        });
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
        await loadInvoice(savedId, { force: true });
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
      const gen = await generateInvoicePdf(id, { force: true });
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
      const inv = await getInvoice(id);
      const gen = await generateInvoicePdf(id, { force: true });
      const url = gen.downloadUrl ?? null;
      if (invoicePdfWasStored(gen)) setHasPdf(true);
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

  const openSendEmailModal = async () => {
    setError("");
    if (!isInvoiceEmailDeliveryAvailable()) {
      setSuccess(INVOICE_SEND_COMING_SOON_MESSAGE);
      return;
    }
    if (!activeId) {
      const saved = await saveInvoice();
      if (!saved) return;
    }
    setSendEmailModalOpen(true);
  };

  const handleSendClick = () => {
    void openSendEmailModal();
  };

  const submitSendEmail = async (values: InvoiceSendEmailFormState) => {
    setEmailSending(true);
    setError("");
    setSuccess("");
    try {
      let id = activeId;
      if (!id) {
        const saved = await saveInvoice();
        if (!saved) return;
        id = saved;
      }
      const result = await sendInvoiceEmail(id, {
        to: values.recipientEmails,
        subject: values.subject,
        message: values.message,
        copyMe: values.copyMe
      });
      invalidatePropertyWorkspace(propertyId);
      await loadInvoice(id);
      setSendEmailModalOpen(false);
      setSuccess(result.message || "Invoice sent.");
      setStatus((prev) => {
        const s = String(prev).toUpperCase();
        if (s === "PAID" || s === "CANCELLED" || s === "VOID") return prev;
        if (s === "DRAFT" || s === "GENERATED") return "SENT";
        return prev;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send invoice email.");
    } finally {
      setEmailSending(false);
    }
  };

  const openMarkPaidModal = async () => {
    setError("");
    if (!activeId) {
      const saved = await saveInvoice();
      if (!saved) return;
    }
    setPaymentModalOpen(true);
  };

  const submitRecordedPayment = async (values: InvoicePaymentFormState) => {
    const amount = Number(values.amount);
    if (!values.paymentDate || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment date and amount.");
      return;
    }
    setPaymentBusy(true);
    setError("");
    setSuccess("");
    try {
      let id = activeId;
      if (!id) {
        const saved = await saveInvoice();
        if (!saved) return;
        id = saved;
      }
      const result = await recordInvoicePayment(id, {
        paymentDate: values.paymentDate,
        paymentReference: values.paymentReference.trim() || leaseReference,
        amount
      });
      const nextStatus = String((result as { status?: string }).status ?? "");
      if (nextStatus) setStatus(nextStatus);
      invalidatePropertyWorkspace(propertyId);
      await loadInvoice(id);
      setPaymentModalOpen(false);
      setSuccess(
        nextStatus === "PAID"
          ? "Payment recorded. Invoice marked as paid."
          : "Payment recorded. Invoice marked as partially paid."
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not record payment.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const savePaymentRow = async (
    paymentId: string,
    patch: { paymentDate: string; paymentReference: string; amount: number }
  ) => {
    if (!activeId) return;
    setPaymentRowBusy(paymentId);
    setError("");
    try {
      await updateInvoicePayment(paymentId, {
        paymentDate: patch.paymentDate,
        paymentReference: patch.paymentReference || null,
        amount: patch.amount
      });
      invalidatePropertyWorkspace(propertyId);
      await loadInvoice(activeId);
      setSuccess("Payment updated.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update payment.");
    } finally {
      setPaymentRowBusy(null);
    }
  };

  const removePaymentRow = async (paymentId: string) => {
    if (!activeId) return;
    setPaymentRowBusy(paymentId);
    setError("");
    try {
      await deleteInvoicePayment(paymentId);
      invalidatePropertyWorkspace(propertyId);
      await loadInvoice(activeId);
      setSuccess("Payment removed.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not remove payment.");
    } finally {
      setPaymentRowBusy(null);
    }
  };

  const confirmMarkAsSent = async () => {
    if (!canMarkInvoiceSent(status, sentAt)) return;
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
      await generateInvoicePdf(id, { force: true });
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

  const renderDateField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    options?: { readOnly?: boolean; onBlur?: () => void }
  ) => {
    const readOnly = options?.readOnly ?? !fieldsEnabled;
    return (
      <div className="pg-inv-editor__field pg-inv-editor__field--date">
        <label className="pg-inv-editor__label" htmlFor={id}>
          {label}
        </label>
        <div className="pg-inv-editor__input-wrap pg-inv-editor__input-wrap--plain">
          <Input
            id={id}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={options?.onBlur}
            required
            readOnly={readOnly}
            disabled={readOnly}
            aria-label={label}
          />
        </div>
      </div>
    );
  };

  const renderTenantField = (showLabel = true) => {
    const canSelect = fieldsEnabled && propertyTenants.length > 0;
    const control = (
      <div
        className={`pg-inv-editor__tenant-select${canSelect ? " pg-inv-editor__tenant-select--editable" : ""}`}
      >
        <span className="pg-inv-editor__tenant-avatar" aria-hidden>
          <AppIcon name="tenant" size="sm" />
        </span>
        {canSelect ? (
          <select
            id={showLabel ? "inv-tenant" : undefined}
            className="pg-inv-editor__tenant-native-select"
            value={tenantId}
            onChange={(e) => handleTenantChange(e.target.value)}
            aria-label="Tenant / Contact"
          >
            {propertyTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        ) : (
          <span className="pg-inv-editor__tenant-name">{toName}</span>
        )}
        {canSelect ? <AppIcon name="chevronDown" size="md" className="pg-inv-editor__input-icon" aria-hidden /> : null}
      </div>
    );

    if (!showLabel) return control;

    return (
      <div className="pg-inv-editor__field pg-inv-editor__field--tenant">
        <label className="pg-inv-editor__label" htmlFor="inv-tenant">
          Tenant / Contact
        </label>
        {control}
      </div>
    );
  };

  const sendMenuItems: SplitButtonMenuItem[] = [
    ...(showMarkAsSent
      ? [
          {
            label: invoiceMarkAsSentMenuLabel(),
            icon: "send",
            disabled: sendBusy,
            onClick: () => setConfirmSend(true)
          } satisfies SplitButtonMenuItem
        ]
      : []),
    ...(canRecordInvoicePayment(status)
      ? [
          {
            label: invoiceAddPaymentMenuLabel(),
            icon: "payments",
            disabled: paymentBusy,
            onClick: () => void openMarkPaidModal()
          } satisfies SplitButtonMenuItem
        ]
      : []),
    ...(activeId
      ? [
          {
            label: "Download PDF",
            icon: "download",
            disabled: pdfBusy,
            onClick: () => void downloadPdf()
          } satisfies SplitButtonMenuItem
        ]
      : [])
  ];

  const showSendSplit = sendMenuItems.length > 0;

  const renderActionButtons = (splitMobileLarge: boolean) => (
    <>
      <Button type="button" variant="outline" loading={pdfBusy} iconLeft="view" onClick={() => void exportPdf()}>
        Preview
      </Button>
      {fieldsEnabled ? (
        <Button type="submit" variant="soft" loading={saving} iconLeft="save">
          {saveButtonLabel}
        </Button>
      ) : null}
      {showSendSplit ? (
        <SplitButton
          mainLabel={invoiceSendButtonLabel()}
          mainIcon="send"
          loading={sendBusy || paymentBusy}
          disabled={sendBusy || paymentBusy}
          mobileLarge={splitMobileLarge}
          onMainClick={handleSendClick}
          menuItems={sendMenuItems}
        />
      ) : null}
    </>
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
          {canRecordInvoicePayment(status) ? (
            <button
              type="button"
              className="pg-inv-editor__more-item"
              role="menuitem"
              disabled={paymentBusy}
              onClick={() => {
                setMoreOpen(false);
                void openMarkPaidModal();
              }}
            >
              <AppIcon name="payments" size="sm" />
              {invoiceAddPaymentMenuLabel()}
            </button>
          ) : null}
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
            {renderActionButtons(false)}
            {renderMoreMenu()}
          </div>
        </header>

        <header className="pg-inv-editor__mobile-head">
          <Link className="pg-inv-editor__back" to="/invoices" aria-label="Back to invoices">
            <AppIcon name="back" size="md" />
          </Link>
          <div className="pg-inv-editor__mobile-title-wrap">
            <h1 className="pg-inv-editor__mobile-title">{pageTitle}</h1>
            <InvoiceStatusBadge status={status} />
          </div>
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
          {needsSentEditUnlock ? (
            <div className="pg-inv-editor__locked" role="status">
              <span>This invoice has been sent.</span>
              <Button type="button" variant="soft" size="sm" onClick={() => setConfirmSentEdit(true)}>
                Edit invoice
              </Button>
            </div>
          ) : null}
          {postSend && sentEditUnlocked ? (
            <div className="pg-inv-editor__locked pg-inv-editor__locked--editing" role="status">
              You are editing a sent invoice. Save when you are done.
            </div>
          ) : null}

          <div className="pg-inv-editor__fields pg-inv-editor__fields--desktop">
            {renderTenantField()}

            {renderDateField("inv-issue-date", "Issue Date", issueDate, setIssueDate)}
            {renderDateField("inv-due-date", "Due Date", dueDate, handleDueDateChange, {
              readOnly: !(fieldsEnabled || dueDateEditable),
              onBlur: handleDueDateBlur
            })}

            <div className="pg-inv-editor__field pg-inv-editor__field--number">
              <label className="pg-inv-editor__label" htmlFor="inv-number">
                Invoice Number
              </label>
              <div className="pg-inv-editor__input-wrap">
                <AppIcon name="hash" size="md" className="pg-inv-editor__input-icon" />
                <Input id="inv-number" value={displayNumber} readOnly disabled aria-label="Invoice number" />
              </div>
            </div>

            <div className="pg-inv-editor__field pg-inv-editor__field--reference">
              <label className="pg-inv-editor__label" htmlFor="inv-reference">
                Reference
              </label>
              <div className="pg-inv-editor__input-wrap">
                <Input
                  id="inv-reference"
                  value={leaseReference ?? "—"}
                  readOnly
                  disabled
                  aria-label="Lease reference"
                />
              </div>
            </div>

            <div className="pg-inv-editor__branding">
              <span>PDF Branding:</span>
              <strong>{fromName ? `${fromName} Standard` : "Proplytic Standard"}</strong>
              <Link className="pg-inv-editor__branding-link" to="/settings?invoiceBanking=1">
                Change
              </Link>
            </div>
          </div>

          <div className="pg-inv-editor__mobile-fields">
            <div className="pg-inv-editor__mobile-card">
              <span className="pg-inv-editor__label">Tenant / Contact</span>
              <div style={{ marginTop: 8 }}>{renderTenantField(false)}</div>
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
                      readOnly={!fieldsEnabled}
                      disabled={!fieldsEnabled}
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
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      onBlur={handleDueDateBlur}
                      required
                      readOnly={!(fieldsEnabled || dueDateEditable)}
                      disabled={!(fieldsEnabled || dueDateEditable)}
                      aria-label="Due Date"
                      style={{ border: "none", background: "transparent", textAlign: "right", padding: 0, minHeight: 0 }}
                    />
                  </dd>
                </div>
                <div className="pg-inv-editor__mobile-detail-row">
                  <dt>Invoice Number</dt>
                  <dd>{displayNumber}</dd>
                </div>
                <div className="pg-inv-editor__mobile-detail-row">
                  <dt>Reference</dt>
                  <dd>{leaseReference ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <InvoiceLineItemsEditor lineItems={lineItems} editable={fieldsEnabled} defaultRent={defaultRent} onChange={setLineItems} />

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
                  readOnly={!fieldsEnabled}
                  disabled={!fieldsEnabled}
                  placeholder="Thank you for your prompt payment."
                />
              </div>
            </div>

            <aside className="pg-inv-editor__totals" aria-label="Invoice totals">
              {payments.map((p) => (
                <div key={p.id} className="pg-inv-editor__totals-row pg-inv-editor__totals-payment">
                  <span>
                    Payment · {formatPaymentDateLabel(p.paymentDate)}
                    {p.paymentReference?.trim() ? ` · ${p.paymentReference.trim()}` : ""}
                  </span>
                  <strong>−{fmtZar(p.amount)}</strong>
                </div>
              ))}
              <div className="pg-inv-editor__totals-row">
                <span>Subtotal</span>
                <strong>{fmtZar(subtotal)}</strong>
              </div>
              <div className="pg-inv-editor__totals-row">
                <span>VAT</span>
                <strong>{fmtZar(taxAmount)}</strong>
              </div>
              <div className="pg-inv-editor__totals-row pg-inv-editor__totals-balance">
                <span>Balance Due</span>
                <strong>{fmtZar(displayBalanceDue)}</strong>
              </div>
            </aside>
          </div>

          {activeId && payments.length > 0 ? (
            <InvoicePaymentsTable
              payments={payments}
              invoiceTotal={total}
              busyId={paymentRowBusy}
              onSave={(paymentId, patch) => void savePaymentRow(paymentId, patch)}
              onDelete={(paymentId) => void removePaymentRow(paymentId)}
            />
          ) : null}

        </div>

        <div className="pg-inv-editor__mobile-bar">{renderActionButtons(true)}</div>
      </form>

      <ConfirmDialog
        open={confirmSend}
        title={INVOICE_MARK_SENT_MODAL_TITLE}
        confirmLabel={invoiceMarkAsSentConfirmLabel()}
        loading={sendBusy}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => void confirmMarkAsSent()}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          {INVOICE_MARK_SENT_MODAL_MESSAGE}
        </p>
        {!isInvoiceEmailDeliveryAvailable() ? (
          <p className="pg-text-helper" style={{ margin: "12px 0 0" }}>
            Email delivery is not enabled yet. This marks the invoice as sent without emailing the tenant.
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmSentEdit}
        title={INVOICE_SENT_EDIT_MODAL_TITLE}
        confirmLabel="Edit invoice"
        onClose={() => setConfirmSentEdit(false)}
        onConfirm={() => {
          setSentEditUnlocked(true);
          setConfirmSentEdit(false);
        }}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          {INVOICE_SENT_EDIT_MODAL_MESSAGE}
        </p>
      </ConfirmDialog>

      <InvoiceSendEmailModal
        open={sendEmailModalOpen}
        loading={emailSending}
        tenantEmail={tenantEmail}
        tenantFirstName={tenantFirstName || toName.split(/\s+/)[0]}
        propertyName={propertyName}
        invoiceNumber={displayNumber}
        totalAmount={total}
        balanceDue={displayBalanceDue}
        dueDate={dueDate}
        userOrBusinessName={fromName}
        invoicePaymentDetails={paymentDetails}
        onClose={() => setSendEmailModalOpen(false)}
        onSubmit={(values) => void submitSendEmail(values)}
      />

      <InvoiceRecordPaymentModal
        open={paymentModalOpen}
        title="Add payment"
        loading={paymentBusy}
        defaultReference={leaseReference}
        defaultAmount={defaultPaymentAmount}
        onClose={() => setPaymentModalOpen(false)}
        onSubmit={(values) => void submitRecordedPayment(values)}
      />

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
