import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon, IconButton } from "../../components/icons";
import {
  createTenantStatement,
  deleteTenantStatement,
  generateTenantStatementPdf,
  getTenantStatement,
  markTenantStatementSent,
  sendTenantStatementEmail,
  updateTenantStatement
} from "../../api/ownedProperties";
import { fetchPdfBlob, triggerPdfFileDownload } from "../../api/pdfBlob";
import { useProfileQuery } from "../queries";
import { Button } from "../../components/ui/Button";
import { SplitButton, type SplitButtonMenuItem } from "../../components/ui/SplitButton";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { fmtZar } from "../invoices/invoiceDirectoryUtils";
import { InvoiceStatusBadge } from "../invoices/InvoiceStatusBadge";
import {
  isInvoiceContentEditable,
  isInvoiceEditable,
  isInvoicePostSendStatus
} from "../invoices/invoiceFoundation";
import { isInvoiceEmailDeliveryAvailable } from "../invoices/invoiceSendWorkflow";
import {
  depositOpeningLine,
  emptyDepositExpenseLine,
  loadFinancialStatementLines
} from "./statementBootstrap";
import {
  calcStatementCredits,
  calcStatementDebits,
  calcStatementNetTotal,
  patchStatementLineItem,
  sortStatementLineItems,
  statementLineItemsForSave
} from "./statementLineItemUtils";
import { openStatementPdfExport, statementPdfWasStored } from "./statementPdfExport";
import { StatementLineItemsEditor } from "./StatementLineItemsEditor";
import { StatementSendEmailModal, type StatementSendEmailFormState } from "./StatementSendEmailModal";
import { statementSendButtonLabel, statementSendSuccessMessage } from "./statementSendWorkflow";
import {
  STATEMENT_PERIOD_OPTIONS,
  type StatementLineItemDraft,
  type StatementPeriodKey,
  type TenantStatementDocumentType
} from "./statementTypes";

export function StatementDetailPanel({
  statementId: initialStatementId,
  statementType: bootstrapType,
  propertyId: bootstrapPropertyId,
  tenantId: bootstrapTenantId,
  tenantName: bootstrapTenantName,
  tenantEmail: bootstrapTenantEmail,
  leaseId: bootstrapLeaseId,
  depositAmount,
  leaseStartDate,
  tenantLeaseIds = [],
  profileName = "Proplytic",
  onStatementCreated,
  onSaved,
  onCancel,
  onDeleted
}: {
  statementId?: string;
  statementType: TenantStatementDocumentType;
  propertyId?: string;
  tenantId?: string;
  tenantName?: string;
  tenantEmail?: string | null;
  leaseId?: string | null;
  depositAmount?: number;
  leaseStartDate?: string | null;
  tenantLeaseIds?: string[];
  profileName?: string;
  onStatementCreated?: (statementId: string) => void;
  onSaved?: (statementId: string) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}) {
  const profileQuery = useProfileQuery();
  const [activeId, setActiveId] = useState<string | undefined>(initialStatementId);
  const [statementType, setStatementType] = useState<TenantStatementDocumentType>(bootstrapType);
  const [propertyId, setPropertyId] = useState(bootstrapPropertyId ?? "");
  const [tenantId, setTenantId] = useState(bootstrapTenantId ?? "");
  const [tenantEmail, setTenantEmail] = useState(bootstrapTenantEmail ?? null);
  const [leaseId, setLeaseId] = useState(bootstrapLeaseId ?? null);
  const [loading, setLoading] = useState(Boolean(initialStatementId));
  const [bootstrapLoading, setBootstrapLoading] = useState(!initialStatementId);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmSentEdit, setConfirmSentEdit] = useState(false);
  const [sentEditUnlocked, setSentEditUnlocked] = useState(false);
  const [sendEmailModalOpen, setSendEmailModalOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [statementNumber, setStatementNumber] = useState("Draft");
  const [status, setStatus] = useState<string>("DRAFT");
  const [fromName, setFromName] = useState(profileName);
  const [toName, setToName] = useState(bootstrapTenantName ?? "Tenant");
  const [tenantFirstName, setTenantFirstName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaseReference, setLeaseReference] = useState<string | null>(null);
  const [periodKey, setPeriodKey] = useState<StatementPeriodKey>("last_6_months");
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<StatementLineItemDraft[]>([]);
  const [hasPdf, setHasPdf] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const draftEditable = !activeId || isInvoiceEditable(status);
  const contentEditable = !activeId || isInvoiceContentEditable(status);
  const postSend = Boolean(activeId) && isInvoicePostSendStatus(status);
  const needsSentEditUnlock = postSend && !sentEditUnlocked;
  const fieldsEnabled = contentEditable && (!postSend || sentEditUnlocked);
  const pageTitle =
    statementType === "DEPOSIT"
      ? activeId
        ? "Edit Deposit Statement"
        : "Create Deposit Statement"
      : activeId
        ? "Edit Financial Statement"
        : "Create Financial Statement";
  const displayNumber = statementNumber === "Draft" && !activeId ? "New statement" : statementNumber;

  useEffect(() => {
    setActiveId(initialStatementId);
  }, [initialStatementId]);

  useEffect(() => {
    setStatementType(bootstrapType);
  }, [bootstrapType]);

  useEffect(() => {
    const me = profileQuery.data;
    if (!me) return;
    setFromName(me.financialLandlord?.name?.trim() || me.name?.trim() || me.email?.trim() || "Proplytic");
  }, [profileQuery.data]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  useEffect(() => {
    if (!isInvoicePostSendStatus(status)) setSentEditUnlocked(false);
  }, [status, activeId]);

  const debits = useMemo(() => calcStatementDebits(lineItems), [lineItems]);
  const credits = useMemo(() => calcStatementCredits(lineItems), [lineItems]);
  const total = useMemo(() => calcStatementNetTotal(lineItems, statementType), [lineItems, statementType]);

  const bootstrapNewStatement = useCallback(async () => {
    if (!propertyId || !tenantId || activeId) return;
    setBootstrapLoading(true);
    setError("");
    try {
      if (statementType === "DEPOSIT") {
        const deposit = depositAmount != null && Number.isFinite(depositAmount) ? depositAmount : 0;
        setOpeningBalance(deposit);
        setLineItems([depositOpeningLine(deposit), emptyDepositExpenseLine()]);
        setPeriodLabel("");
        setPeriodStart(null);
        setPeriodEnd(null);
      } else {
        const loaded = await loadFinancialStatementLines({
          propertyId,
          tenantId,
          tenantLeaseIds,
          leaseStartDate,
          periodKey,
          singleTenantProperty: true
        });
        setLineItems(loaded.lines);
        setOpeningBalance(loaded.openingBalance);
        setPeriodLabel(loaded.period.label);
        setPeriodStart(loaded.period.startYmd);
        setPeriodEnd(loaded.period.endYmd);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load statement data.");
    } finally {
      setBootstrapLoading(false);
    }
  }, [
    propertyId,
    tenantId,
    activeId,
    statementType,
    depositAmount,
    tenantLeaseIds,
    leaseStartDate,
    periodKey
  ]);

  useEffect(() => {
    if (activeId) return;
    void bootstrapNewStatement();
  }, [activeId, bootstrapNewStatement]);

  const reloadPeriodLines = async (nextKey: StatementPeriodKey) => {
    if (!propertyId || !tenantId || statementType !== "FINANCIAL" || activeId) return;
    setPeriodKey(nextKey);
    setBootstrapLoading(true);
    try {
      const loaded = await loadFinancialStatementLines({
        propertyId,
        tenantId,
        tenantLeaseIds,
        leaseStartDate,
        periodKey: nextKey,
        singleTenantProperty: true
      });
      setLineItems(loaded.lines);
      setOpeningBalance(loaded.openingBalance);
      setPeriodLabel(loaded.period.label);
      setPeriodStart(loaded.period.startYmd);
      setPeriodEnd(loaded.period.endYmd);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reload period.");
    } finally {
      setBootstrapLoading(false);
    }
  };

  const syncDepositOpening = (amount: number) => {
    setOpeningBalance(amount);
    setLineItems((items) => {
      const idx = items.findIndex((l) => l.entryType === "CREDIT" && l.category === "DEPOSIT");
      if (idx < 0) return items;
      return items.map((row, i) =>
        i === idx ? patchStatementLineItem(row, { unitPrice: amount }) : row
      );
    });
  };

  const loadStatement = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const stmt = await getTenantStatement(id);
      setActiveId(String(stmt.id));
      setPropertyId(String(stmt.propertyId ?? ""));
      setTenantId(String(stmt.tenantId ?? ""));
      setLeaseId(stmt.leaseId != null ? String(stmt.leaseId) : null);
      setStatementType(
        String(stmt.statementType ?? "FINANCIAL").toUpperCase() === "DEPOSIT" ? "DEPOSIT" : "FINANCIAL"
      );
      setStatementNumber(String(stmt.statementNumber ?? stmt.id));
      setStatus(String(stmt.status ?? "DRAFT"));
      setIssueDate(String(stmt.statementDate ?? "").slice(0, 10));
      setNotes(String(stmt.notes ?? ""));
      setOpeningBalance(Number(stmt.openingBalance ?? 0));
      setPeriodStart(stmt.periodStart != null ? String(stmt.periodStart).slice(0, 10) : null);
      setPeriodEnd(stmt.periodEnd != null ? String(stmt.periodEnd).slice(0, 10) : null);
      setHasPdf(Boolean(stmt.hasPdf));

      const tenant = stmt.tenant as Record<string, unknown> | undefined;
      if (tenant) {
        setToName(`${String(tenant.firstName ?? "")} ${String(tenant.lastName ?? "")}`.trim() || "Tenant");
        setTenantFirstName(String(tenant.firstName ?? "").trim());
        setTenantEmail(tenant.email != null ? String(tenant.email) : null);
      }

      const property = stmt.property as Record<string, unknown> | undefined;
      setPropertyName(String(property?.name ?? "").trim());

      const lease = stmt.lease as Record<string, unknown> | undefined;
      const refRaw = lease?.leaseReference ?? lease?.lease_reference;
      setLeaseReference(refRaw != null && String(refRaw).trim() ? String(refRaw).trim() : null);

      const lines = (stmt.lineItems as StatementLineItemDraft[] | undefined) ?? [];
      if (lines.length) setLineItems(sortStatementLineItems(lines));

      if (stmt.periodStart && stmt.periodEnd) {
        setPeriodLabel(`${String(stmt.periodStart).slice(0, 10)} – ${String(stmt.periodEnd).slice(0, 10)}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load statement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) void loadStatement(activeId);
    else {
      if (bootstrapPropertyId) setPropertyId(bootstrapPropertyId);
      if (bootstrapTenantId) setTenantId(bootstrapTenantId);
      if (bootstrapTenantName) setToName(bootstrapTenantName);
      if (bootstrapTenantEmail != null) setTenantEmail(bootstrapTenantEmail);
      if (bootstrapLeaseId) setLeaseId(bootstrapLeaseId);
      setLoading(false);
    }
  }, [
    activeId,
    bootstrapPropertyId,
    bootstrapTenantId,
    bootstrapTenantName,
    bootstrapTenantEmail,
    bootstrapLeaseId,
    loadStatement
  ]);

  const buildPayload = () => ({
    tenantId,
    leaseId: leaseId ?? undefined,
    statementType,
    statementDate: issueDate,
    periodStart,
    periodEnd,
    openingBalance,
    notes: notes.trim() || null,
    subtotal: debits + credits,
    total,
    lineItems: statementLineItemsForSave(lineItems),
    ...(draftEditable ? { status: "DRAFT" } : {})
  });

  const saveStatement = async (): Promise<string | null> => {
    if (!fieldsEnabled && activeId) return activeId;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!propertyId || !tenantId) throw new Error("Property and tenant are required.");
      const payload = buildPayload();
      let savedId = activeId;
      if (activeId) {
        await updateTenantStatement(activeId, payload);
      } else {
        const created = await createTenantStatement(propertyId, payload);
        savedId = String(created.id);
        setActiveId(savedId);
        setStatementNumber(String(created.statementNumber ?? savedId));
        onStatementCreated?.(savedId);
      }
      if (savedId) {
        setSuccess("Statement saved.");
        await loadStatement(savedId);
        onSaved?.(savedId);
        return savedId;
      }
      return null;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save statement.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveStatement();
  };

  const exportPdf = async () => {
    setError("");
    let id: string | undefined = activeId;
    if (!id) {
      const saved = await saveStatement();
      if (!saved) return;
      id = saved;
    }
    setPdfBusy(true);
    try {
      const gen = await generateTenantStatementPdf(id, { force: true });
      await openStatementPdfExport(gen);
      if (statementPdfWasStored(gen)) setHasPdf(true);
      setSuccess(gen.reused ? "PDF opened (stored copy)." : "PDF opened in a new tab.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not export PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!activeId) return;
    setPdfBusy(true);
    setMoreOpen(false);
    try {
      const stmt = await getTenantStatement(activeId);
      const gen = await generateTenantStatementPdf(activeId, { force: true });
      const url = gen.downloadUrl ?? null;
      if (statementPdfWasStored(gen)) setHasPdf(true);
      if (!url) throw new Error("Generate the PDF first.");
      const blob = await fetchPdfBlob(url);
      triggerPdfFileDownload(blob, `${String(stmt.statementNumber ?? "statement").replace(/\s+/g, "_")}.pdf`);
      setSuccess("PDF downloaded.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setPdfBusy(false);
    }
  };

  const openSendEmailModal = async () => {
    if (!isInvoiceEmailDeliveryAvailable()) {
      setSuccess("Email delivery is not configured.");
      return;
    }
    if (!activeId) {
      const saved = await saveStatement();
      if (!saved) return;
    }
    setSendEmailModalOpen(true);
  };

  const submitSendEmail = async (values: StatementSendEmailFormState) => {
    setEmailSending(true);
    setError("");
    try {
      let id = activeId;
      if (!id) {
        const saved = await saveStatement();
        if (!saved) return;
        id = saved;
      }
      const result = await sendTenantStatementEmail(id, {
        to: values.recipientEmails,
        subject: values.subject,
        message: values.message,
        copyMe: values.copyMe
      });
      await loadStatement(id);
      setSendEmailModalOpen(false);
      setSuccess(result.message || statementSendSuccessMessage());
      setStatus((prev) => {
        const s = String(prev).toUpperCase();
        if (s === "DRAFT" || s === "GENERATED") return "SENT";
        return prev;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send statement email.");
    } finally {
      setEmailSending(false);
    }
  };

  const markSent = async () => {
    if (!activeId) return;
    setSendBusy(true);
    try {
      await markTenantStatementSent(activeId);
      await loadStatement(activeId);
      setSuccess("Statement marked as sent.");
      setConfirmSend(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not mark as sent.");
    } finally {
      setSendBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!activeId) return;
    try {
      await deleteTenantStatement(activeId);
      onDeleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete statement.");
    } finally {
      setConfirmDelete(false);
    }
  };

  const sendMenuItems: SplitButtonMenuItem[] = [
    ...(draftEditable || status === "GENERATED"
      ? [
          {
            label: "Mark as sent",
            icon: "send",
            disabled: sendBusy,
            onClick: () => setConfirmSend(true)
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

  const renderActionButtons = (splitMobileLarge: boolean) => (
    <>
      <Button type="button" variant="outline" loading={pdfBusy} iconLeft="view" onClick={() => void exportPdf()}>
        Preview
      </Button>
      {fieldsEnabled ? (
        <Button type="submit" variant="soft" loading={saving} iconLeft="save">
          Save Draft
        </Button>
      ) : null}
      <SplitButton
        mainLabel={statementSendButtonLabel()}
        mainIcon="send"
        loading={sendBusy || emailSending}
        disabled={sendBusy || emailSending}
        mobileLarge={splitMobileLarge}
        onMainClick={() => void openSendEmailModal()}
        menuItems={sendMenuItems}
      />
    </>
  );

  if (loading || bootstrapLoading) {
    return <div className="pg-tstmt-skeleton" style={{ minHeight: 320 }} aria-busy="true" />;
  }

  return (
    <>
      <form className="pg-inv-editor" onSubmit={submit}>
        <header className="pg-inv-editor__page-head">
          <div className="pg-inv-editor__page-head-main">
            <div className="pg-inv-editor__back-row">
              <Link className="pg-inv-editor__back" to={`/tenants/${tenantId}`} aria-label="Back to tenant">
                <AppIcon name="back" size="md" />
              </Link>
              <nav className="pg-inv-editor__breadcrumb" aria-label="Breadcrumb">
                <Link to="/tenants">Tenants</Link>
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
            <p className="pg-inv-editor__subtitle">
              {statementType === "DEPOSIT"
                ? "Deposit held, deductions, and refund due."
                : "Tenant account activity for the selected period."}
            </p>
          </div>
          <div className="pg-inv-editor__actions pg-inv-editor__actions--desktop">{renderActionButtons(false)}</div>
        </header>

        {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
        {success ? (
          <div className="pg-alert" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            {success}
          </div>
        ) : null}

        <div className="pg-inv-editor__card">
          {needsSentEditUnlock ? (
            <div className="pg-inv-editor__locked">
              <span>This statement has been sent.</span>
              <Button type="button" variant="soft" size="sm" onClick={() => setConfirmSentEdit(true)}>
                Edit statement
              </Button>
            </div>
          ) : null}

          <div className="pg-inv-editor__fields pg-inv-editor__fields--desktop">
            <div className="pg-inv-editor__field">
              <label className="pg-inv-editor__label">Tenant</label>
              <Input value={toName} readOnly disabled />
            </div>
            <div className="pg-inv-editor__field">
              <label className="pg-inv-editor__label" htmlFor="stmt-issue-date">
                Statement date
              </label>
              <Input
                id="stmt-issue-date"
                type="date"
                value={issueDate}
                disabled={!fieldsEnabled}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            {statementType === "FINANCIAL" ? (
              <div className="pg-inv-editor__field">
                <label className="pg-inv-editor__label" htmlFor="stmt-period">
                  Period
                </label>
                <Select
                  id="stmt-period"
                  value={periodKey}
                  disabled={!fieldsEnabled || Boolean(activeId)}
                  onChange={(e) => void reloadPeriodLines(e.target.value as StatementPeriodKey)}
                >
                  {STATEMENT_PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                {periodLabel ? <p className="pg-muted" style={{ marginTop: 4 }}>{periodLabel}</p> : null}
              </div>
            ) : (
              <div className="pg-inv-editor__field">
                <label className="pg-inv-editor__label" htmlFor="stmt-opening">
                  Opening deposit (credit)
                </label>
                <Input
                  id="stmt-opening"
                  type="number"
                  min={0}
                  step="0.01"
                  value={openingBalance}
                  disabled={!fieldsEnabled}
                  onChange={(e) => syncDepositOpening(Number(e.target.value))}
                />
              </div>
            )}
            <div className="pg-inv-editor__field">
              <label className="pg-inv-editor__label">Reference</label>
              <Input value={leaseReference ?? "—"} readOnly disabled />
            </div>
            <div className="pg-inv-editor__branding">
              <span>PDF Branding:</span>
              <strong>{fromName ? `${fromName} Standard` : "Proplytic Standard"}</strong>
              <Link className="pg-inv-editor__branding-link" to="/settings?invoiceBanking=1">
                Change
              </Link>
            </div>
          </div>

          <StatementLineItemsEditor
            lineItems={lineItems}
            editable={fieldsEnabled}
            statementType={statementType}
            onChange={setLineItems}
          />

          <div className="pg-inv-editor__totals">
            <div>
              <span className="pg-muted">Charges</span>
              <strong>{fmtZar(debits)}</strong>
            </div>
            <div>
              <span className="pg-muted">Credits</span>
              <strong>{fmtZar(credits)}</strong>
            </div>
            <div>
              <span className="pg-muted">{statementType === "DEPOSIT" ? "Refund due" : "Balance due"}</span>
              <strong>{fmtZar(total)}</strong>
            </div>
          </div>

          <div className="pg-inv-editor__field" style={{ marginTop: 16 }}>
            <label className="pg-inv-editor__label" htmlFor="stmt-notes">
              Notes
            </label>
            <textarea
              id="stmt-notes"
              className="pg-input"
              rows={3}
              value={notes}
              disabled={!fieldsEnabled}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="pg-inv-editor__actions pg-inv-editor__actions--mobile">{renderActionButtons(true)}</div>
      </form>

      <StatementSendEmailModal
        open={sendEmailModalOpen}
        loading={emailSending}
        tenantEmail={tenantEmail}
        tenantFirstName={tenantFirstName}
        propertyName={propertyName}
        statementNumber={displayNumber}
        statementType={statementType}
        periodLabel={periodLabel}
        userOrBusinessName={fromName}
        onClose={() => setSendEmailModalOpen(false)}
        onSubmit={submitSendEmail}
      />

      <ConfirmDialog
        open={confirmSend}
        title="Mark as sent?"
        confirmLabel="Mark as sent"
        loading={sendBusy}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => void markSent()}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          Mark this statement as sent without emailing?
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmSentEdit}
        title="Edit sent statement?"
        confirmLabel="Edit statement"
        onClose={() => setConfirmSentEdit(false)}
        onConfirm={() => {
          setSentEditUnlocked(true);
          setConfirmSentEdit(false);
        }}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          Changes will update this sent statement.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete statement?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
      >
        <p className="pg-muted" style={{ margin: 0 }}>
          Only draft statements can be deleted.
        </p>
      </ConfirmDialog>
    </>
  );
}
