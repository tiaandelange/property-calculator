import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { IconButton } from "../components/icons";
import {
  ProplyticMobileRowCard,
  ProplyticMobileRowList,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap,
  ProplyticTableRowActionsMenu,
  type ProplyticTableRowAction
} from "../components/tables";
import { AppListPage } from "../components/ui/AppPage";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { QueryErrorCard } from "../components/ui/QueryState";
import { AppConfirmDialog } from "../components/ui/AppModal";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { deleteTenantStatement, generateTenantStatementPdf, propertyApiErrorMessage } from "../api/ownedProperties";
import { InvoiceStatusBadge } from "../features/invoices/InvoiceStatusBadge";
import { isInvoiceEditable } from "../features/invoices/invoiceFoundation";
import { fmtZar } from "../features/invoices/invoiceDirectoryUtils";
import { openStatementPdfExport } from "../features/statements/statementPdfExport";
import {
  listActiveLeaseContractsDirectory,
  openActiveLeaseContract,
  type ActiveLeaseContractRow
} from "../services/documentsDirectorySupabase";
import {
  getTenantStatementDirectorySignedUrl,
  listTenantStatementsDirectory,
  type TenantStatementDirectoryRow
} from "../services/tenantStatementsSupabase";

function statementTypeLabel(type: TenantStatementDirectoryRow["statementType"]): string {
  return type === "DEPOSIT" ? "Deposit statement" : "Financial statement";
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? iso : dt.toLocaleString();
}

function formatPeriod(row: TenantStatementDirectoryRow): string {
  if (row.periodStart && row.periodEnd) return `${row.periodStart} – ${row.periodEnd}`;
  if (row.periodStart) return `From ${row.periodStart}`;
  if (row.periodEnd) return `Until ${row.periodEnd}`;
  return "—";
}

export function OwnedDocumentsPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const loadSeq = useRef(0);

  const [statements, setStatements] = useState<TenantStatementDirectoryRow[]>([]);
  const [leases, setLeases] = useState<ActiveLeaseContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TenantStatementDirectoryRow | null>(null);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");

    try {
      let statementError: unknown = null;
      let leaseError: unknown = null;

      const statementPromise = listTenantStatementsDirectory().catch((e) => {
        statementError = e;
        return [] as TenantStatementDirectoryRow[];
      });

      const leasePromise = listActiveLeaseContractsDirectory().catch((e) => {
        leaseError = e;
        return [] as ActiveLeaseContractRow[];
      });

      const [statementRows, leaseRows] = await Promise.all([statementPromise, leasePromise]);

      if (seq !== loadSeq.current) return;

      const primaryError = statementError ?? leaseError;
      if (primaryError) {
        setError(propertyApiErrorMessage(primaryError));
        setStatements(statementRows);
        setLeases(leaseRows);
        return;
      }

      setStatements(statementRows);
      setLeases(leaseRows);
    } catch (e: unknown) {
      if (seq !== loadSeq.current) return;
      setError(propertyApiErrorMessage(e));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeStatementRow = (id: string) => {
    setStatements((prev) => prev.filter((r) => r.id !== id));
  };

  const openStatement = (row: TenantStatementDirectoryRow) => {
    navigate(`/statements/${row.id}`);
  };

  const openStatementPdf = async (row: TenantStatementDirectoryRow) => {
    setActionError("");
    try {
      if (row.hasPdf && row.pdfStorageKey) {
        const url = await getTenantStatementDirectorySignedUrl(row);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }
      }
      const gen = await generateTenantStatementPdf(row.id);
      await openStatementPdfExport(gen);
      void load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not open statement PDF.");
    }
  };

  const openLeaseContract = async (row: ActiveLeaseContractRow) => {
    setActionError("");
    try {
      await openActiveLeaseContract(row);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not open lease contract.");
    }
  };

  const statementActions = (row: TenantStatementDirectoryRow): ProplyticTableRowAction[] => {
    const editable = isInvoiceEditable(row.status);
    const actions: ProplyticTableRowAction[] = [
      {
        key: "open",
        label: editable ? "Edit statement" : "Open statement",
        icon: "open",
        onClick: () => openStatement(row),
        primary: true
      },
      {
        key: "pdf",
        label: "View or download PDF",
        icon: "download",
        onClick: () => void openStatementPdf(row)
      }
    ];
    if (editable) {
      actions.push({
        key: "delete",
        label: "Delete draft",
        icon: "delete",
        onClick: () => setPendingDelete(row),
        destructive: true
      });
    }
    return actions;
  };

  const leaseActions = (row: ActiveLeaseContractRow): ProplyticTableRowAction[] => {
    const actions: ProplyticTableRowAction[] = [
      {
        key: "tenant",
        label: "Open tenant workspace",
        icon: "open",
        onClick: () => navigate(`/tenants/${row.tenantId}`),
        primary: true
      }
    ];
    if (row.contract?.storageKey) {
      actions.push({
        key: "contract",
        label: "View signed lease contract",
        icon: "download",
        onClick: () => void openLeaseContract(row)
      });
    }
    return actions;
  };

  return (
    <>
      <AppListPage>
        <Helmet>
          <title>Documents | The Property Guy</title>
        </Helmet>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div className="pg-muted">
              Tenant statements and signed lease contracts across your portfolio.
            </div>
            <Button variant="soft" type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Card>

        {error ? <QueryErrorCard message={error} onRetry={() => void load()} retrying={loading} /> : null}

        {actionError ? (
          <div className="pg-alert pg-alert-error" role="alert">
            {actionError}
          </div>
        ) : null}

        <section className="pg-tenants-list-panel pg-workspace-card" aria-busy={loading} style={{ marginBottom: 14 }}>
          <div className="pg-card-title" style={{ marginBottom: 10 }}>
            Tenant Statements
          </div>
          {loading ? (
            <ProplyticTableSkeleton rows={4} />
          ) : statements.length ? (
            isMobile ? (
              <ProplyticMobileRowList>
                {statements.map((row) => (
                  <li key={row.id}>
                    <ProplyticMobileRowCard
                      title={row.statementNumber}
                      subtitle={row.tenantName}
                      badge={<InvoiceStatusBadge status={row.status} />}
                      fields={[
                        { label: "Type", value: statementTypeLabel(row.statementType) },
                        { label: "Property", value: row.propertyName },
                        { label: "Period", value: formatPeriod(row) },
                        { label: "Total", value: fmtZar(row.total) },
                        { label: "Updated", value: formatWhen(row.createdAt) }
                      ]}
                      actions={
                        <>
                          <IconButton
                            icon="open"
                            aria-label="Open statement"
                            variant="outline"
                            onClick={() => openStatement(row)}
                          />
                          <IconButton
                            icon="download"
                            aria-label="View statement PDF"
                            variant="outline"
                            onClick={() => void openStatementPdf(row)}
                          />
                          {isInvoiceEditable(row.status) ? (
                            <IconButton
                              icon="delete"
                              aria-label="Delete draft statement"
                              variant="danger"
                              onClick={() => setPendingDelete(row)}
                            />
                          ) : null}
                        </>
                      }
                    />
                  </li>
                ))}
              </ProplyticMobileRowList>
            ) : (
              <ProplyticTableWrap responsive>
                <ProplyticTable>
                  <ProplyticTableHeader>
                    <ProplyticTableRow>
                      <ProplyticTableHeadCell columnType="date">Updated</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">Statement</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">Tenant / Property</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">Period</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="currency">Total</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="status">Status</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="actions" />
                    </ProplyticTableRow>
                  </ProplyticTableHeader>
                  <ProplyticTableBody>
                    {statements.map((row) => (
                      <ProplyticTableRow key={row.id}>
                        <ProplyticTableCell columnType="date">
                          <div style={{ fontWeight: 700 }}>{formatWhen(row.updatedAt ?? row.createdAt)}</div>
                          <div className="pg-tenants-sub">{row.id}</div>
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="text">
                          <strong>{row.statementNumber}</strong>
                          <div className="pg-tenants-sub">{statementTypeLabel(row.statementType)}</div>
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="text">
                          <strong>{row.tenantName}</strong>
                          <div className="pg-tenants-sub">{row.propertyName}</div>
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="text">{formatPeriod(row)}</ProplyticTableCell>
                        <ProplyticTableCell columnType="currency">{fmtZar(row.total)}</ProplyticTableCell>
                        <ProplyticTableCell columnType="status">
                          <InvoiceStatusBadge status={row.status} />
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="actions">
                          <ProplyticTableRowActionsMenu actions={statementActions(row)} />
                        </ProplyticTableCell>
                      </ProplyticTableRow>
                    ))}
                  </ProplyticTableBody>
                </ProplyticTable>
              </ProplyticTableWrap>
            )
          ) : (
            <ProplyticTableEmptyState
              title="No tenant statements yet"
              description="Create a financial or deposit statement from a tenant workspace to see them here."
            />
          )}
        </section>

        <section className="pg-tenants-list-panel pg-workspace-card" aria-busy={loading}>
          <div className="pg-card-title" style={{ marginBottom: 10 }}>
            Active Leases
          </div>
          {loading ? (
            <ProplyticTableSkeleton rows={4} />
          ) : leases.length ? (
            isMobile ? (
              <ProplyticMobileRowList>
                {leases.map((row) => (
                  <li key={row.leaseId}>
                    <ProplyticMobileRowCard
                      title={row.tenantName}
                      subtitle={row.propertyName}
                      badge={<span className="pg-muted" style={{ fontSize: 12 }}>{row.displayStatus}</span>}
                      fields={[
                        { label: "Lease", value: row.leaseReference || row.leaseId },
                        { label: "Start", value: row.startDate || "—" },
                        {
                          label: "Contract",
                          value: row.contract?.fileName ?? "Not uploaded"
                        }
                      ]}
                      actions={
                        <>
                          <IconButton
                            icon="open"
                            aria-label="Open tenant workspace"
                            variant="outline"
                            onClick={() => navigate(`/tenants/${row.tenantId}`)}
                          />
                          {row.contract?.storageKey ? (
                            <IconButton
                              icon="download"
                              aria-label="View signed lease contract"
                              variant="outline"
                              onClick={() => void openLeaseContract(row)}
                            />
                          ) : null}
                        </>
                      }
                    />
                  </li>
                ))}
              </ProplyticMobileRowList>
            ) : (
              <ProplyticTableWrap responsive>
                <ProplyticTable>
                  <ProplyticTableHeader>
                    <ProplyticTableRow>
                      <ProplyticTableHeadCell columnType="date">Start</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">Tenant / Property</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">Lease</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">Signed contract</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="status">Status</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="actions" />
                    </ProplyticTableRow>
                  </ProplyticTableHeader>
                  <ProplyticTableBody>
                    {leases.map((row) => (
                      <ProplyticTableRow key={row.leaseId}>
                        <ProplyticTableCell columnType="date">
                          <div style={{ fontWeight: 700 }}>{row.startDate || "—"}</div>
                          <div className="pg-tenants-sub">{row.leaseId}</div>
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="text">
                          <strong>{row.tenantName}</strong>
                          <div className="pg-tenants-sub">{row.propertyName}</div>
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="text">
                          <strong>{row.leaseReference || "—"}</strong>
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="text">
                          {row.contract ? (
                            <>
                              <div style={{ fontWeight: 700 }}>{row.contract.fileName}</div>
                              <div className="pg-tenants-sub">{formatWhen(row.contract.uploadedAt)}</div>
                            </>
                          ) : (
                            <span className="pg-muted">Not uploaded</span>
                          )}
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="status">
                          <span className="pg-muted">{row.displayStatus}</span>
                        </ProplyticTableCell>
                        <ProplyticTableCell columnType="actions">
                          <ProplyticTableRowActionsMenu actions={leaseActions(row)} />
                        </ProplyticTableCell>
                      </ProplyticTableRow>
                    ))}
                  </ProplyticTableBody>
                </ProplyticTable>
              </ProplyticTableWrap>
            )
          ) : (
            <ProplyticTableEmptyState
              title="No active leases"
              description="Signed lease contracts uploaded during lease setup will appear here."
            />
          )}
        </section>
      </AppListPage>

      <AppConfirmDialog
        open={pendingDelete != null}
        title="Delete draft statement"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const row = pendingDelete;
          setPendingDelete(null);
          removeStatementRow(row.id);
          setActionError("");
          void (async () => {
            try {
              await deleteTenantStatement(row.id);
            } catch (e: unknown) {
              setActionError(e instanceof Error ? e.message : "Could not delete statement.");
              await load();
            }
          })();
        }}
        consequence="This removes the statement and any stored PDF."
      >
        <p style={{ margin: 0 }}>
          Delete draft statement <strong>{pendingDelete?.statementNumber}</strong> for{" "}
          <strong>{pendingDelete?.tenantName}</strong>?
        </p>
      </AppConfirmDialog>
    </>
  );
}
