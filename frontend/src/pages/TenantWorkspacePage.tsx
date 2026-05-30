import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, MoreVertical, Plus } from "lucide-react";
import { AppDetailPage } from "../components/ui/AppPage";
import { AppSectionTabs } from "../components/ui/AppSectionTabs";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cancelLease, deleteTenant, getTenant } from "../api/ownedProperties";
import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab } from "../api/pdfBlob";
import { generateReportViaVercel } from "../services/reportsVercel";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { TenantInvoiceEditorForm } from "../features/tenants/workspace/TenantInvoiceEditorForm";
import {
  TenantFinSubTabs,
  TenantInvoicesTable,
  TenantLedgerPanel,
  TenantPaymentsTable,
  TenantStatementTabContent,
  TenantSummaryCard
} from "../features/tenants/workspace/TenantStatementPanels";
import { TenantApplicantDetailsCard } from "../features/tenants/workspace/TenantApplicantDetailsCard";
import { useTenantApplicantDetails } from "../features/tenants/workspace/useTenantApplicantDetails";
import { useTenantWorkspaceData } from "../features/tenants/workspace/useTenantWorkspaceData";
import { invoiceCreatePath, invoiceDetailPath } from "../features/invoices/invoiceRoutes";
import type { TenantStatementPeriodKey } from "../features/tenants/statement/tenantStatementTypes";

function useFinTab() {
  const [search, setSearch] = useSearchParams();
  const fin = search.get("fin") ?? "statement";
  const setFin = (next: string) => {
    const s = new URLSearchParams(search);
    s.set("tab", "statement");
    s.set("fin", next);
    setSearch(s, { replace: true });
  };
  return { fin, setFin };
}

function useWorkspaceTab() {
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") ?? "statement";
  const setTab = (next: string) => {
    const s = new URLSearchParams(search);
    s.set("tab", next);
    if (next === "statement" && !s.get("fin")) s.set("fin", "statement");
    setSearch(s, { replace: true });
  };
  return { tab, setTab };
}

export function TenantWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const { tab, setTab } = useWorkspaceTab();
  const { fin, setFin } = useFinTab();
  const [periodKey, setPeriodKey] = useState<TenantStatementPeriodKey>("this_month");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [invoiceOverlay, setInvoiceOverlay] = useState(false);
  const [overlayInvoiceId, setOverlayInvoiceId] = useState<string | undefined>(undefined);
  const [overview, setOverview] = useState<{ tenant: Record<string, unknown>; currentLease: Record<string, unknown> | null } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const { ctx, summary, transactions, invoices, paidInvoices, loading, error, leaseStatus, reload } =
    useTenantWorkspaceData(id, periodKey);
  const { record: applicantRecord, loading: applicantLoading } = useTenantApplicantDetails(id);

  const loadOverview = useCallback(async () => {
    if (!id) return;
    setOverviewLoading(true);
    try {
      setOverview(await getTenant(id));
    } catch {
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab === "overview") void loadOverview();
  }, [tab, loadOverview]);

  const tenantName = summary?.tenantName ?? "Tenant";
  const propertyId = ctx?.propertyId ?? "";
  const propertyName = ctx?.propertyName ?? "Property";

  const breadcrumbs = (
    <nav className="pg-tstmt-breadcrumb" aria-label="Breadcrumb">
      <Link to="/owned-properties">Properties</Link>
      <span aria-hidden>›</span>
      {propertyId ? (
        <>
          <Link to={`/owned-properties/${propertyId}`}>{propertyName}</Link>
          <span aria-hidden>›</span>
        </>
      ) : null}
      <Link to="/tenants">Tenants</Link>
      <span aria-hidden>›</span>
      <span>{tenantName}</span>
      <span aria-hidden>›</span>
      <span>Statement</span>
    </nav>
  );

  const downloadStatement = async () => {
    if (!propertyId) return;
    setDownloadBusy(true);
    setDownloadError("");
    try {
      const gen = await generateReportViaVercel({ reportType: "PROPERTY_SUMMARY", propertyId });
      const downloadUrl = gen.downloadUrl;
      if (!downloadUrl) throw new Error(gen.error ?? "No download URL returned.");
      if (isAbsoluteHttpUrl(downloadUrl)) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        const blob = await fetchPdfBlob(downloadUrl);
        openPdfBlobInNewTab(blob);
      }
    } catch (e: unknown) {
      setDownloadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloadBusy(false);
    }
  };

  const openCreateInvoice = () => {
    if (!id) return;
    if (!propertyId) {
      window.alert("Link this tenant to a property before creating an invoice.");
      return;
    }
    const url = `${window.location.origin}${invoiceCreatePath({
      tenantId: id,
      propertyId,
      leaseId: ctx?.currentLease?.id != null ? String(ctx.currentLease.id) : null
    })}`;
    if (isMobile) {
      setOverlayInvoiceId(undefined);
      setInvoiceOverlay(true);
    } else {
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.alert("Pop-up blocked. Allow pop-ups for this site, or open the invoice editor from the link in the address bar.");
      }
    }
  };

  const defaultRent =
    ctx?.currentLease?.monthlyRent != null ? Number(ctx.currentLease.monthlyRent) : undefined;

  return (
    <>
      <AppDetailPage contentClassName="pg-tstmt">
        <Helmet>
          <title>Tenant Statement | The Property Guy</title>
        </Helmet>
          <header className="pg-tstmt-mobile-header">
            <Button
              type="button"
              variant="ghost"
              aria-label="Go back"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={20} />
            </Button>
            <h1>Tenant Statement</h1>
            <Button type="button" variant="ghost" aria-label="More options">
              <MoreVertical size={20} />
            </Button>
          </header>

          <div className="pg-tstmt-page-head">
            <div className="pg-tstmt-page-head--desktop-title">
              <h1>Tenant Statement</h1>
              {breadcrumbs}
            </div>
            <div className="pg-tstmt-actions pg-tstmt-actions--desktop-only">
              <Button variant="secondary" loading={downloadBusy} onClick={() => void downloadStatement()} disabled={!propertyId}>
                <Download size={16} style={{ marginRight: 8 }} aria-hidden />
                Download Statement
              </Button>
              <Button onClick={openCreateInvoice} disabled={!propertyId}>
                <Plus size={16} style={{ marginRight: 8 }} aria-hidden />
                Create Invoice
              </Button>
            </div>
          </div>

          {downloadError ? <div className="pg-alert pg-alert-error">{downloadError}</div> : null}
          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

          <AppSectionTabs
            ariaLabel="Tenant sections"
            activeId={tab}
            onSelect={setTab}
            items={[
              { id: "statement", label: "Financials" },
              { id: "overview", label: "Details" },
              { id: "settings", label: "Invoice settings" }
            ]}
          />

          {tab === "statement" ? (
            <>
              <TenantSummaryCard summary={summary} leaseStatus={leaseStatus} loading={loading} />
              <TenantApplicantDetailsCard record={applicantRecord} loading={applicantLoading} />

              <div className="pg-tstmt-actions pg-tstmt-actions--mobile-only" style={{ marginTop: 0 }}>
                <Button variant="secondary" loading={downloadBusy} onClick={() => void downloadStatement()} disabled={!propertyId}>
                  <Download size={16} style={{ marginRight: 8 }} aria-hidden />
                  Download
                </Button>
                <Button onClick={openCreateInvoice} disabled={!propertyId}>
                  <Plus size={16} style={{ marginRight: 8 }} aria-hidden />
                  Create Invoice
                </Button>
              </div>

              <TenantFinSubTabs fin={fin} onFin={setFin} />

              {fin === "statement" ? (
                <TenantStatementTabContent
                  summary={summary}
                  transactions={transactions}
                  periodKey={periodKey}
                  onPeriodKey={setPeriodKey}
                  rentDueDay={ctx?.rentDueDay ?? null}
                  loading={loading}
                />
              ) : null}
              {fin === "invoices" ? (
                <TenantInvoicesTable invoices={invoices} loading={loading} />
              ) : null}
              {fin === "payments" ? <TenantPaymentsTable paidInvoices={paidInvoices} loading={loading} /> : null}
              {fin === "ledger" ? (
                <TenantLedgerPanel
                  transactions={transactions}
                  loading={loading}
                  tenantId={id ?? ""}
                  propertyId={propertyId}
                />
              ) : null}
            </>
          ) : null}

          {tab === "overview" ? (
            <>
              <TenantApplicantDetailsCard record={applicantRecord} loading={applicantLoading} />
              <TenantOverviewPanel
              id={id}
              data={overview}
              loading={overviewLoading}
              onReload={loadOverview}
              navigate={navigate}
            />
            </>
          ) : null}

          {tab === "settings" ? (
            <Card title="Invoice payment details">
              <p className="pg-muted">
                Banking details shown on tenant invoices are managed in your account profile.
              </p>
              <ButtonLink href="/account" variant="primary" style={{ marginTop: 12, display: "inline-flex" }}>
                Edit invoice settings
              </ButtonLink>
            </Card>
          ) : null}
      </AppDetailPage>

      {invoiceOverlay && ctx && id ? (
        <div className="pg-tstmt-overlay-backdrop" role="dialog" aria-modal="true" aria-label="Create invoice">
          <div className="pg-tstmt-overlay-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Create Invoice</h2>
              <Button type="button" variant="ghost" onClick={() => setInvoiceOverlay(false)}>
                Close
              </Button>
            </div>
            <TenantInvoiceEditorForm
              propertyId={ctx.propertyId}
              tenantId={id}
              tenantName={tenantName}
              tenantEmail={ctx.tenant.email != null ? String(ctx.tenant.email) : null}
              invoiceId={overlayInvoiceId}
              leaseId={ctx.currentLease?.id != null ? String(ctx.currentLease.id) : null}
              profileName={ctx.profileName}
              invoicePaymentDetails={ctx.invoicePaymentDetails}
              defaultRent={defaultRent}
              onInvoiceCreated={(newId) => {
                setOverlayInvoiceId(newId);
                navigate(invoiceDetailPath(newId));
              }}
              onSaved={() => void reload()}
              onCancel={() => {
                setInvoiceOverlay(false);
                setOverlayInvoiceId(undefined);
                void reload();
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function TenantOverviewPanel({
  id,
  data,
  loading,
  onReload,
  navigate
}: {
  id?: string;
  data: { tenant: Record<string, unknown>; currentLease: Record<string, unknown> | null } | null;
  loading: boolean;
  onReload: () => void;
  navigate: (path: string) => void;
}) {
  const tenant = data?.tenant;
  const currentLease = data?.currentLease;

  const onCancelLease = async () => {
    if (!currentLease?.id) return;
    const cancellationDate = window.prompt("Cancellation date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!cancellationDate) return;
    const cancellationReason = window.prompt("Cancellation reason (optional)", "") ?? undefined;
    await cancelLease(String(currentLease.id), {
      cancellationDate,
      cancellationReason,
      cancelledBy: "LANDLORD"
    });
    onReload();
  };

  const onDelete = async () => {
    if (!id) return;
    const ok = window.confirm("Delete this tenant? If they have leases, they will be marked as PAST instead.");
    if (!ok) return;
    await deleteTenant(id);
    navigate("/tenants");
  };

  if (loading) return <div className="pg-tstmt-skeleton" style={{ minHeight: 200 }} />;
  if (!tenant) return <p className="pg-muted">No tenant selected.</p>;

  return (
    <>
      <Card title="Details">
        <div style={{ display: "grid", gap: 6 }}>
          <div>Status: {String(tenant.status ?? "—")}</div>
          <div className="pg-muted">
            {tenant.phone ? `Phone: ${tenant.phone}` : "Phone: —"} {tenant.email ? `| Email: ${tenant.email}` : ""}
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={onReload}>Refresh</Button>
          {id ? <ButtonLink href={`/tenants/${id}/edit`} variant="soft">Edit Tenant</ButtonLink> : null}
        </div>
      </Card>
      <Card title="Linked property">
        {(tenant.property as Record<string, unknown> | undefined)?.id ? (
          <Link className="pg-link" to={`/owned-properties/${(tenant.property as Record<string, unknown>).id}`}>
            {String((tenant.property as Record<string, unknown>).name ?? "Property")}
          </Link>
        ) : (
          <span className="pg-muted">No property linked.</span>
        )}
      </Card>
      <Card title="Current lease">
        {currentLease ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div>Status: {String(currentLease.displayStatus ?? currentLease.status)}</div>
            <div>Monthly rent: R {Number(currentLease.monthlyRent ?? 0).toLocaleString()}</div>
            <Button variant="soft" type="button" onClick={() => void onCancelLease()}>
              Cancel Lease
            </Button>
          </div>
        ) : (
          <div className="pg-muted">No current lease.</div>
        )}
      </Card>
      <Button variant="ghost" type="button" onClick={() => void onDelete()}>
        Delete tenant
      </Button>
    </>
  );
}
