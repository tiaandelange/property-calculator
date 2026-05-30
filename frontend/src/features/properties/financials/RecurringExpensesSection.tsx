import { Receipt, Shield, Droplets, Wrench, Trees } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { IconButton } from "../../../components/icons";
import {
  ProplyticAmountCell,
  ProplyticMobileRowCard,
  ProplyticMobileRowList,
  ProplyticStatusBadge,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap,
  ProplyticTableRowActionsMenu
} from "../../../components/tables";
import { fmtZar, type RecurringExpenseDisplayItem } from "./propertyFinancialsAdapter";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Taxes: Receipt,
  "HOA / Levies": Shield,
  Insurance: Shield,
  Utilities: Droplets,
  Maintenance: Wrench,
  Other: Trees
};

function formatFrequency(freq: string): string {
  const f = freq.toUpperCase();
  if (f === "MONTHLY") return "Monthly";
  if (f.includes("WEEK")) return "Weekly";
  if (f.includes("QUARTER")) return "Quarterly";
  if (f.includes("YEAR") || f.includes("ANNUAL")) return "Annual";
  return freq;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function recurringStatusKey(status: string): string {
  if (status === "paused") return "inactive";
  if (status === "overdue") return "overdue";
  if (status === "due_soon") return "due";
  return "active";
}

export function RecurringExpensesSection({
  items,
  loading,
  isMobile,
  onAdd,
  onEdit,
  onStop,
  onDelete
}: {
  items: RecurringExpenseDisplayItem[];
  loading?: boolean;
  isMobile?: boolean;
  onAdd: () => void;
  onEdit: (item: RecurringExpenseDisplayItem) => void;
  onStop: (item: RecurringExpenseDisplayItem) => void;
  onDelete: (item: RecurringExpenseDisplayItem) => void;
}) {
  return (
    <section className="pg-pfin-section" id="pfin-recurring">
      <header className="pg-pfin-section__head pg-pfin-section__head--row">
        <div>
          <h2 className="pg-pfin-section__title">Recurring Expenses</h2>
          <p className="pg-pfin-section__desc">Monthly schedules posted automatically to your property ledger.</p>
        </div>
        <Button type="button" variant="primary" className="pg-pfin-add-btn" onClick={onAdd}>
          Add Expense
        </Button>
      </header>

      {loading ? <ProplyticTableSkeleton rows={4} /> : null}

      {!loading && items.length === 0 ? (
        <ProplyticTableEmptyState
          title="No recurring expenses yet"
          description="Add recurring expenses to improve monthly cash-flow forecasting."
          action={
            <Button type="button" variant="soft" onClick={onAdd}>
              Add Expense
            </Button>
          }
        />
      ) : null}

      {!loading && items.length > 0 && !isMobile ? (
        <ProplyticTableWrap responsive>
          <ProplyticTable variant="financial">
            <ProplyticTableHeader>
              <ProplyticTableRow>
                <ProplyticTableHeadCell>Expense name</ProplyticTableHeadCell>
                <ProplyticTableHeadCell>Category</ProplyticTableHeadCell>
                <ProplyticTableHeadCell>Frequency</ProplyticTableHeadCell>
                <ProplyticTableHeadCell numeric>Amount</ProplyticTableHeadCell>
                <ProplyticTableHeadCell>Next due</ProplyticTableHeadCell>
                <ProplyticTableHeadCell>Status</ProplyticTableHeadCell>
                <ProplyticTableHeadCell actions>
                  <span className="pg-ptable-sr-only">Actions</span>
                </ProplyticTableHeadCell>
              </ProplyticTableRow>
            </ProplyticTableHeader>
            <ProplyticTableBody>
              {items.map((item) => {
                const Icon = CATEGORY_ICONS[item.categoryLabel] ?? Receipt;
                return (
                  <ProplyticTableRow key={String(item.id)}>
                    <ProplyticTableCell>
                      <div className="pg-pfin-expense-name">
                        <span className="pg-pfin-expense-icon" aria-hidden>
                          <Icon size={16} />
                        </span>
                        <span>{item.name}</span>
                      </div>
                    </ProplyticTableCell>
                    <ProplyticTableCell>{item.categoryLabel}</ProplyticTableCell>
                    <ProplyticTableCell>
                      <ProplyticStatusBadge status={item.frequency} label={formatFrequency(item.frequency)} />
                    </ProplyticTableCell>
                    <ProplyticTableCell numeric>
                      <ProplyticAmountCell tone="debit">{fmtZar(item.amount)}</ProplyticAmountCell>
                    </ProplyticTableCell>
                    <ProplyticTableCell>{formatDate(item.nextDueDate)}</ProplyticTableCell>
                    <ProplyticTableCell>
                      <ProplyticStatusBadge
                        status={recurringStatusKey(item.status)}
                        label={item.status === "active" ? "Active" : "Paused"}
                      />
                    </ProplyticTableCell>
                    <ProplyticTableCell actions>
                      <ProplyticTableRowActionsMenu
                        actions={[
                          {
                            key: "edit",
                            label: "Edit expense",
                            icon: "edit",
                            onClick: () => onEdit(item),
                            primary: true
                          },
                          {
                            key: "stop",
                            label: "Stop schedule",
                            icon: "void",
                            onClick: () => onStop(item)
                          },
                          {
                            key: "delete",
                            label: "Delete expense",
                            icon: "delete",
                            onClick: () => onDelete(item),
                            destructive: true
                          }
                        ]}
                      />
                    </ProplyticTableCell>
                  </ProplyticTableRow>
                );
              })}
            </ProplyticTableBody>
          </ProplyticTable>
        </ProplyticTableWrap>
      ) : null}

      {!loading && items.length > 0 && isMobile ? (
        <ProplyticMobileRowList>
          {items.map((item) => {
            const Icon = CATEGORY_ICONS[item.categoryLabel] ?? Receipt;
            return (
              <li key={String(item.id)}>
                <ProplyticMobileRowCard
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="pg-pfin-expense-icon" aria-hidden>
                        <Icon size={16} />
                      </span>
                      {item.name}
                    </span>
                  }
                  subtitle={item.categoryLabel}
                  badge={
                    <ProplyticStatusBadge
                      status={recurringStatusKey(item.status)}
                      label={item.status === "active" ? "Active" : "Paused"}
                    />
                  }
                  fields={[
                    { label: "Frequency", value: formatFrequency(item.frequency) },
                    { label: "Amount", value: fmtZar(item.amount) },
                    { label: "Next due", value: formatDate(item.nextDueDate) }
                  ]}
                  actions={
                    <>
                      <IconButton icon="edit" aria-label="Edit expense" variant="outline" onClick={() => onEdit(item)} />
                      <IconButton icon="delete" aria-label="Delete expense" variant="danger" onClick={() => onDelete(item)} />
                    </>
                  }
                />
              </li>
            );
          })}
        </ProplyticMobileRowList>
      ) : null}
    </section>
  );
}
