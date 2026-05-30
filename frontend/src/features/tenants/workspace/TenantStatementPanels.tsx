import { useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  CircleDollarSign,
  ExternalLink,
  Filter,
  ReceiptText,
  Wallet
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { IconButton } from "../../../components/icons";
import {
  ProplyticAmountCell,
  ProplyticStatusBadge,
  ProplyticTable,
  ProplyticTableActions,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap
} from "../../../components/tables";
import { IconContainer } from "../../../components/ui/IconContainer";
import { AppSectionTabs } from "../../../components/ui/AppSectionTabs";
import { Button } from "../../../components/ui/Button";
import { invoiceDetailPath } from "../../invoices/invoiceRoutes";
import {
  invoiceIdFromStatementRow,
  invoiceStatementCreditClass,
  isInvoiceStatementRow
} from "../../invoices/invoiceStatementUtils";
import { fmtZar, paymentTermsNote } from "../statement/tenantStatementAdapter";
import { formatDateShort, tenantInitials } from "../tenantDirectoryUtils";
import type {
  TenantInvoiceListItem,
  TenantLedgerTransaction,
  TenantStatementPeriodKey,
  TenantStatementSummary
} from "../statement/tenantStatementTypes";
import type { TenantWorkspaceContext } from "./useTenantWorkspaceData";

const PERIOD_OPTIONS: { value: TenantStatementPeriodKey; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "since_lease", label: "Since start of lease" }
];

function amountColor(type: string, amount: number): string | undefined {
  if (type === "payment" || type === "credit" || amount < 0) return "var(--success)";
  if (type === "charge" || type === "late_fee") return type === "late_fee" ? "var(--danger)" : "var(--primary)";
  if (type === "adjustment") return "var(--warning)";
  return undefined;
}

function TypeBadge({ type }: { type: string }) {
  const key = type.replace(/\s+/g, "_").toLowerCase();
  const cls =
    key === "payment" || key === "credit"
      ? "pg-tstmt-type-badge--payment"
      : key === "charge"
        ? "pg-tstmt-type-badge--charge"
        : key === "adjustment"
          ? "pg-tstmt-type-badge--adjustment"
          : key === "late_fee"
            ? "pg-tstmt-type-badge--late_fee"
            : "pg-tstmt-type-badge--balance";
  return <span className={`pg-tstmt-type-badge ${cls}`}>{type.replace(/_/g, " ")}</span>;
}

export function TenantSummaryCard({
  summary,
  leaseStatus,
  loading
}: {
  summary: TenantStatementSummary | null;
  leaseStatus: string;
  loading?: boolean;
}) {
  if (loading || !summary) {
    return <div className="pg-tstmt-summary-card pg-tstmt-skeleton" aria-busy="true" />;
  }

  const badgeClass =
    leaseStatus === "active"
      ? "pg-tstmt-badge--active"
      : leaseStatus === "overdue" || summary.outstandingBalance > 0
        ? "pg-tstmt-badge--arrears"
        : "pg-tstmt-badge--inactive";
  const badgeLabel =
    leaseStatus === "active"
      ? "Active Tenant"
      : summary.outstandingBalance > 0
        ? "In Arrears"
        : leaseStatus === "inactive" || leaseStatus === "expired"
          ? "Inactive"
          : "Tenant";

  const initials = tenantInitials({
    firstName: summary.tenantName.split(" ")[0] ?? "",
    lastName: summary.tenantName.split(" ").slice(1).join(" "),
    fullName: summary.tenantName
  });

  return (
    <div className="pg-tstmt-summary-card">
      <div className="pg-tstmt-summary-left">
        <div className="pg-tstmt-avatar" aria-hidden>
          {summary.tenantAvatarUrl ? (
            <img src={summary.tenantAvatarUrl} alt="" />
          ) : (
            initials
          )}
        </div>
        <div>
          <div className="pg-tstmt-summary-name">{summary.tenantName}</div>
          <div className="pg-tstmt-summary-sub">{summary.unitName ?? summary.propertyName}</div>
          <span className={`pg-tstmt-badge ${badgeClass}`}>{badgeLabel}</span>
        </div>
      </div>
      <div className="pg-tstmt-metrics pg-tstmt-desktop-only">
        <MetricBlock label="Outstanding Balance" value={fmtZar(summary.outstandingBalance)} tone={summary.outstandingBalance > 0 ? "danger" : undefined} />
        <MetricBlock label="This Month's Charges" value={fmtZar(summary.monthCharges)} tone="primary" />
        <MetricBlock label="This Month's Payments" value={fmtZar(summary.monthPayments)} tone="success" />
        <MetricBlock
          label="Available Credit"
          value={fmtZar(summary.availableCredit)}
          tone={summary.availableCredit > 0 ? "success" : undefined}
        />
      </div>
      <div className="pg-tstmt-metrics-mobile">
        <MobileMetric icon={AlertCircle} accent="danger" label="Outstanding" value={fmtZar(summary.outstandingBalance)} />
        <MobileMetric icon={ReceiptText} accent="primary" label="Charges" value={fmtZar(summary.monthCharges)} />
        <MobileMetric icon={CircleDollarSign} accent="success" label="Payments" value={fmtZar(summary.monthPayments)} />
        <MobileMetric icon={Wallet} accent="info" label="Credit" value={fmtZar(summary.availableCredit)} />
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "danger" | "success" | "primary";
}) {
  const color =
    tone === "danger" ? "var(--danger)" : tone === "success" ? "var(--success)" : tone === "primary" ? "var(--primary)" : undefined;
  return (
    <div className="pg-tstmt-metric">
      <div className="pg-tstmt-metric-label">{label}</div>
      <div className="pg-tstmt-metric-value" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function MobileMetric({
  icon,
  accent,
  label,
  value
}: {
  icon: typeof AlertCircle;
  accent: "danger" | "primary" | "success" | "info";
  label: string;
  value: string;
}) {
  return (
    <div className="pg-tstmt-metric-card">
      <IconContainer icon={icon} accent={accent} size="md" />
      <div className="pg-tstmt-metric-card__copy">
        <div className="pg-tstmt-metric-card__label">{label}</div>
        <div className="pg-tstmt-metric-card__value">{value}</div>
      </div>
    </div>
  );
}

export function TenantFinSubTabs({
  fin,
  onFin,
}: {
  fin: string;
  onFin: (next: string) => void;
}) {
  return (
    <AppSectionTabs
      asTablist
      ariaLabel="Tenant financial sections"
      activeId={fin}
      onSelect={onFin}
      items={[
        { id: "statement", label: "Statement" },
        { id: "invoices", label: "Invoices" },
        { id: "payments", label: "Payments" },
        { id: "ledger", label: "Ledger" }
      ]}
    />
  );
}

export function TenantStatementTabContent({
  summary,
  transactions,
  periodKey,
  onPeriodKey,
  rentDueDay,
  loading
}: {
  summary: TenantStatementSummary | null;
  transactions: TenantLedgerTransaction[];
  periodKey: TenantStatementPeriodKey;
  onPeriodKey: (k: TenantStatementPeriodKey) => void;
  rentDueDay: number | null;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");

  const filtered = useMemo(() => {
    if (typeFilter === "ALL") return transactions;
    return transactions.filter((t) => t.type === typeFilter);
  }, [transactions, typeFilter]);

  if (loading || !summary) {
    return (
      <div className="pg-tstmt-grid">
        <div className="pg-tstmt-card pg-tstmt-skeleton" />
        <div className="pg-tstmt-card pg-tstmt-skeleton" />
      </div>
    );
  }

  const closingColor =
    summary.closingBalance > 0 ? "var(--danger)" : summary.closingBalance < 0 ? "var(--success)" : "var(--text-primary)";

  return (
    <div className="pg-tstmt-grid">
      <div className="pg-tstmt-card">
        <h2>Statement Summary</h2>
        <div className="pg-tstmt-period-row">
          <span className="pg-tstmt-period-label">{summary.periodLabel}</span>
          <select
            className="pg-tstmt-period-select"
            value={periodKey}
            onChange={(e) => onPeriodKey(e.target.value as TenantStatementPeriodKey)}
            aria-label="Statement period"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="pg-tstmt-summary-rows">
          <SummaryRow label="Opening Balance" value={fmtZar(summary.openingBalance)} />
          <SummaryRow label="Charges" value={fmtZar(summary.charges)} valueStyle={{ color: "var(--primary)" }} />
          <SummaryRow
            label="Payments"
            value={summary.payments > 0 ? `-R ${Math.round(summary.payments).toLocaleString()}` : fmtZar(0)}
            valueStyle={{ color: "var(--success)" }}
          />
          <SummaryRow label="Adjustments" value={fmtZar(summary.adjustments)} valueStyle={{ color: "var(--warning)" }} />
          <div className="pg-tstmt-summary-row pg-tstmt-summary-row--closing">
            <span>Closing Balance</span>
            <span style={{ color: closingColor }}>{fmtZar(summary.closingBalance)}</span>
          </div>
        </div>
        <div className="pg-tstmt-info-box">{paymentTermsNote(rentDueDay)}</div>
      </div>

      <div className="pg-tstmt-card">
        <div className="pg-tstmt-table-head">
          <h2 style={{ margin: 0 }}>Transaction History</h2>
          <Button variant="ghost" type="button" onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen}>
            <Filter size={16} aria-hidden style={{ marginRight: 6 }} />
            Filter
          </Button>
        </div>
        {filterOpen ? (
          <div style={{ marginBottom: 12 }}>
            <label className="pg-muted" htmlFor="tstmt-type-filter">
              Type
            </label>
            <select
              id="tstmt-type-filter"
              className="pg-tstmt-period-select"
              style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 220 }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All types</option>
              <option value="charge">Charge</option>
              <option value="payment">Payment</option>
              <option value="adjustment">Adjustment</option>
              <option value="late_fee">Late fee</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        ) : null}

        {!filtered.length ? (
          <p className="pg-muted">No transactions found for this period.</p>
        ) : (
          <>
            <div className="pg-tstmt-table-wrap">
              <table className="pg-tstmt-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Type</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const raw = row.raw ?? {};
                    const showInvoiceView = isInvoiceStatementRow(raw) && !!invoiceIdFromStatementRow(raw);
                    const invoiceCreditClass = isInvoiceStatementRow(raw)
                      ? invoiceStatementCreditClass(row.status)
                      : "";

                    return (
                      <tr key={row.id}>
                        <td>{formatDateShort(row.date)}</td>
                        <td>{row.description || "—"}</td>
                        <td>
                          <TypeBadge type={row.type} />
                        </td>
                        <td
                          className={invoiceCreditClass}
                          style={
                            invoiceCreditClass ? undefined : { color: amountColor(row.type, row.amount) }
                          }
                        >
                          {row.amount < 0 ? "-" : ""}
                          {fmtZar(Math.abs(row.amount))}
                        </td>
                        <td>{fmtZar(row.balance)}</td>
                        <td>
                          {showInvoiceView ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                              onClick={() =>
                                navigate(invoiceDetailPath(invoiceIdFromStatementRow(raw)))
                              }
                              aria-label="View invoice"
                              title="View invoice"
                            >
                              <ExternalLink size={14} aria-hidden />
                              View
                            </Button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pg-tstmt-txn-mobile">
              {filtered.map((row) => {
                const raw = row.raw ?? {};
                const showInvoiceView = isInvoiceStatementRow(raw) && !!invoiceIdFromStatementRow(raw);
                return (
                <div key={row.id} className="pg-tstmt-txn-card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span className="pg-muted">{formatDateShort(row.date)}</span>
                    <TypeBadge type={row.type} />
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 500 }}>{row.description || "—"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
                    <span style={{ color: amountColor(row.type, row.amount) }}>
                      {row.amount < 0 ? "-" : ""}
                      {fmtZar(Math.abs(row.amount))}
                    </span>
                    <span className="pg-muted">Bal {fmtZar(row.balance)}</span>
                  </div>
                  {showInvoiceView ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8 }}
                      onClick={() => navigate(invoiceDetailPath(invoiceIdFromStatementRow(raw)))}
                    >
                      <ExternalLink size={14} aria-hidden />
                      View
                    </Button>
                  ) : null}
                </div>
              );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueStyle
}: {
  label: string;
  value: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div className="pg-tstmt-summary-row">
      <span>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

export function TenantInvoicesTable({
  invoices,
  loading
}: {
  invoices: TenantInvoiceListItem[];
  tenantId?: string;
  propertyId?: string;
  loading?: boolean;
  /** @deprecated Invoice edits open on /invoices/:id — prop ignored. */
  onOpenInvoice?: (id: string) => void;
}) {
  if (loading) return <ProplyticTableSkeleton rows={4} />;
  if (!invoices.length) {
    return (
      <div className="pg-tstmt-card">
        <p className="pg-muted">No invoices yet.</p>
      </div>
    );
  }
  return (
    <div className="pg-tstmt-card">
      <ProplyticTableWrap responsive>
        <ProplyticTable variant="financial">
          <ProplyticTableHeader>
            <ProplyticTableRow>
              <ProplyticTableHeadCell columnType="reference">Invoice</ProplyticTableHeadCell>
              <ProplyticTableHeadCell columnType="date">Date</ProplyticTableHeadCell>
              <ProplyticTableHeadCell columnType="date">Due</ProplyticTableHeadCell>
              <ProplyticTableHeadCell columnType="status">Status</ProplyticTableHeadCell>
              <ProplyticTableHeadCell columnType="currency">Total</ProplyticTableHeadCell>
              <ProplyticTableHeadCell columnType="actions" />
            </ProplyticTableRow>
          </ProplyticTableHeader>
          <ProplyticTableBody>
            {invoices.map((inv) => (
              <ProplyticTableRow key={inv.id}>
                <ProplyticTableCell columnType="reference">{inv.invoiceNumber}</ProplyticTableCell>
                <ProplyticTableCell columnType="date">{formatDateShort(inv.invoiceDate)}</ProplyticTableCell>
                <ProplyticTableCell columnType="date">{formatDateShort(inv.dueDate)}</ProplyticTableCell>
                <ProplyticTableCell columnType="status">
                  <ProplyticStatusBadge status={inv.status} />
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  <ProplyticAmountCell>{fmtZar(inv.total)}</ProplyticAmountCell>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="actions">
                  <ProplyticTableActions className="pg-ptable-actions--count-1">
                    <IconButton icon="open" aria-label="View invoice" href={invoiceDetailPath(inv.id)} variant="outline" />
                  </ProplyticTableActions>
                </ProplyticTableCell>
              </ProplyticTableRow>
            ))}
          </ProplyticTableBody>
        </ProplyticTable>
      </ProplyticTableWrap>
    </div>
  );
}

export function TenantPaymentsTable({
  paidInvoices,
  loading
}: {
  paidInvoices: TenantInvoiceListItem[];
  loading?: boolean;
}) {
  if (loading) return <ProplyticTableSkeleton rows={4} />;
  if (!paidInvoices.length) {
    return (
      <div className="pg-tstmt-card">
        <p className="pg-muted">No payments recorded.</p>
      </div>
    );
  }
  return (
    <div className="pg-tstmt-card">
      <ProplyticTableWrap responsive>
        <ProplyticTable variant="financial">
          <ProplyticTableHeader>
            <ProplyticTableRow>
              <ProplyticTableHeadCell columnType="date">Date</ProplyticTableHeadCell>
              <ProplyticTableHeadCell columnType="reference">Invoice</ProplyticTableHeadCell>
              <ProplyticTableHeadCell columnType="currency">Amount</ProplyticTableHeadCell>
            </ProplyticTableRow>
          </ProplyticTableHeader>
          <ProplyticTableBody>
            {paidInvoices.map((inv) => (
              <ProplyticTableRow key={inv.id}>
                <ProplyticTableCell columnType="date">{formatDateShort(inv.paidAt ?? inv.invoiceDate)}</ProplyticTableCell>
                <ProplyticTableCell columnType="reference">{inv.invoiceNumber}</ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  <ProplyticAmountCell tone="credit-paid">{fmtZar(inv.total)}</ProplyticAmountCell>
                </ProplyticTableCell>
              </ProplyticTableRow>
            ))}
          </ProplyticTableBody>
        </ProplyticTable>
      </ProplyticTableWrap>
    </div>
  );
}

export function TenantLedgerPanel({
  transactions,
  loading,
  tenantId,
  propertyId
}: {
  transactions: TenantLedgerTransaction[];
  loading?: boolean;
  tenantId: string;
  propertyId?: string | null;
}) {
  const navigate = useNavigate();

  if (loading) return <div className="pg-tstmt-card pg-tstmt-skeleton" />;
  if (!transactions.length) {
    return (
      <div className="pg-tstmt-card">
        <h2>Ledger</h2>
        <p className="pg-muted">No ledger entries for this period.</p>
      </div>
    );
  }
  return (
    <div className="pg-tstmt-card">
      <h2>Ledger</h2>
      <div className="pg-ptable-wrap pg-ptable-wrap--responsive" style={{ marginTop: 12 }}>
        <table className="pg-ptable pg-ptable--financial pg-tstmt-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Type</th>
              <th scope="col">Amount</th>
              <th scope="col">Balance</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((row) => {
              const raw = row.raw ?? {};
              const showInvoiceView = isInvoiceStatementRow(raw) && !!invoiceIdFromStatementRow(raw);
              const amountStyle = isInvoiceStatementRow(raw)
                ? { color: undefined as string | undefined }
                : { color: amountColor(row.type, row.amount) };
              const invoiceCreditClass = isInvoiceStatementRow(raw)
                ? invoiceStatementCreditClass(row.status)
                : "";

              return (
                <tr key={row.id}>
                  <td>{formatDateShort(row.date)}</td>
                  <td>{row.description || "—"}</td>
                  <td>
                    <TypeBadge type={row.type} />
                  </td>
                  <td
                    className={invoiceCreditClass}
                    style={invoiceCreditClass ? undefined : amountStyle}
                  >
                    {row.amount < 0 ? "-" : ""}
                    {fmtZar(Math.abs(row.amount))}
                  </td>
                  <td>{fmtZar(row.balance)}</td>
                  <td>
                    {showInvoiceView ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={() =>
                          navigate(invoiceDetailPath(invoiceIdFromStatementRow(raw)))
                        }
                        aria-label="View invoice"
                        title="View invoice"
                      >
                        <ExternalLink size={14} aria-hidden />
                        View
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { TenantWorkspaceContext };
