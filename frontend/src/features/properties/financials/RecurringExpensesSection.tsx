import { Pencil, Plus, Trash2, Receipt, Shield, Droplets, Wrench, Wifi, Trees } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fmtZar, type RecurringExpenseDisplayItem } from "./propertyFinancialsAdapter";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Taxes: Receipt,
  "HOA / Levies": Shield,
  Insurance: Shield,
  Utilities: Droplets,
  Maintenance: Wrench,
  Other: Trees
};

function frequencyBadgeClass(freq: string): string {
  const f = freq.toUpperCase();
  if (f.includes("WEEK")) return "pg-pfin-badge pg-pfin-badge--info";
  if (f.includes("QUARTER")) return "pg-pfin-badge pg-pfin-badge--warning";
  if (f.includes("YEAR") || f.includes("ANNUAL")) return "pg-pfin-badge pg-pfin-badge--primary";
  return "pg-pfin-badge pg-pfin-badge--success";
}

function statusBadgeClass(status: string): string {
  if (status === "paused") return "pg-pfin-badge pg-pfin-badge--muted";
  if (status === "overdue") return "pg-pfin-badge pg-pfin-badge--danger";
  if (status === "due_soon") return "pg-pfin-badge pg-pfin-badge--warning";
  return "pg-pfin-badge pg-pfin-badge--success";
}

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
        <button type="button" className="pg-btn pg-btn-primary pg-pfin-add-btn" onClick={onAdd}>
          <Plus size={18} aria-hidden />
          Add Expense
        </button>
      </header>

      {loading ? <div className="pg-muted">Loading recurring expenses…</div> : null}

      {!loading && items.length === 0 ? (
        <div className="pg-pfin-empty">
          <p>No recurring expenses yet</p>
          <p className="pg-muted">Add recurring expenses to improve monthly cash-flow forecasting.</p>
          <button type="button" className="pg-btn pg-btn-secondary" onClick={onAdd}>
            Add Expense
          </button>
        </div>
      ) : null}

      {!loading && items.length > 0 && !isMobile ? (
        <div className="pg-pfin-table-wrap">
          <table className="pg-pfin-table">
            <thead>
              <tr>
                <th>Expense name</th>
                <th>Category</th>
                <th>Frequency</th>
                <th>Amount</th>
                <th>Next due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const Icon = CATEGORY_ICONS[item.categoryLabel] ?? Receipt;
                return (
                  <tr key={String(item.id)}>
                    <td>
                      <div className="pg-pfin-expense-name">
                        <span className="pg-pfin-expense-icon" aria-hidden>
                          <Icon size={16} />
                        </span>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td>{item.categoryLabel}</td>
                    <td>
                      <span className={frequencyBadgeClass(item.frequency)}>{formatFrequency(item.frequency)}</span>
                    </td>
                    <td className="pg-pfin-table__amount">{fmtZar(item.amount)}</td>
                    <td>{formatDate(item.nextDueDate)}</td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>{item.status === "active" ? "Active" : "Paused"}</span>
                    </td>
                    <td>
                      <div className="pg-pfin-row-actions">
                        <button type="button" className="pg-pfin-icon-btn" aria-label="Edit" onClick={() => onEdit(item)}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="pg-pfin-icon-btn" aria-label="Stop schedule" onClick={() => onStop(item)}>
                          <span className="pg-pfin-icon-btn__text">Stop</span>
                        </button>
                        <button
                          type="button"
                          className="pg-pfin-icon-btn pg-pfin-icon-btn--danger"
                          aria-label="Delete"
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length > 0 && isMobile ? (
        <ul className="pg-pfin-expense-list">
          {items.map((item) => {
            const Icon = CATEGORY_ICONS[item.categoryLabel] ?? Receipt;
            return (
              <li key={String(item.id)} className="pg-pfin-expense-list__item">
                <div className="pg-pfin-expense-list__main">
                  <span className="pg-pfin-expense-icon" aria-hidden>
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="pg-pfin-expense-list__title">{item.name}</div>
                    <span className={frequencyBadgeClass(item.frequency)}>{formatFrequency(item.frequency)}</span>
                  </div>
                </div>
                <div className="pg-pfin-expense-list__right">
                  <strong>{fmtZar(item.amount)}</strong>
                  <button type="button" className="pg-pfin-icon-btn" aria-label="Edit" onClick={() => onEdit(item)}>
                    <Pencil size={16} />
                  </button>
                </div>
              </li>
            );
          })}
          <li>
            <a href="#pfin-recurring" className="pg-pfin-link-all">
              View all expenses
            </a>
          </li>
        </ul>
      ) : null}
    </section>
  );
}
