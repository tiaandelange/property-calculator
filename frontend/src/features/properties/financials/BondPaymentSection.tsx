import { Landmark, Pencil } from "lucide-react";
import { fmtZar } from "./propertyFinancialsAdapter";
import type { BondPaymentDisplayItem } from "./propertyBondAdapter";

function termBadgeClass(termLabel: string): string {
  if (termLabel.includes("months left") && termLabel.match(/(\d+) months left/)?.[1]) {
    const left = Number(termLabel.match(/(\d+) months left/)?.[1]);
    if (Number.isFinite(left) && left <= 24) return "pg-pfin-badge pg-pfin-badge--warning";
  }
  return "pg-pfin-badge pg-pfin-badge--info";
}

function statusBadgeClass(status: BondPaymentDisplayItem["status"]): string {
  if (status === "none") return "pg-pfin-badge pg-pfin-badge--muted";
  if (status === "incomplete") return "pg-pfin-badge pg-pfin-badge--warning";
  return "pg-pfin-badge pg-pfin-badge--success";
}

export function BondPaymentSection({
  items,
  loading,
  isMobile,
  onEdit,
  onSetup
}: {
  items: BondPaymentDisplayItem[];
  loading?: boolean;
  isMobile?: boolean;
  onEdit: () => void;
  onSetup: () => void;
}) {
  return (
    <section className="pg-pfin-section" id="pfin-bond-payment">
      <header className="pg-pfin-section__head pg-pfin-section__head--row">
        <div>
          <h2 className="pg-pfin-section__title">Bond Payment</h2>
          <p className="pg-pfin-section__desc">
            Monthly home-loan instalment from your property bond profile — same fields as Add / Edit property.
          </p>
        </div>
        {items.length > 0 ? (
          <button type="button" className="pg-btn pg-btn-primary pg-pfin-add-btn" onClick={onEdit}>
            <Landmark size={18} aria-hidden />
            Edit bond
          </button>
        ) : null}
      </header>

      {loading ? <div className="pg-muted">Loading bond profile…</div> : null}

      {!loading && items.length === 0 ? (
        <div className="pg-pfin-empty">
          <p>No bond profile yet</p>
          <p className="pg-muted">
            Add outstanding balance, interest rate, and term on the property form to calculate monthly payments.
          </p>
          <button type="button" className="pg-btn pg-btn-secondary" onClick={onSetup}>
            Set up bond
          </button>
        </div>
      ) : null}

      {!loading && items.length > 0 && !isMobile ? (
        <div className="pg-pfin-table-wrap">
          <table className="pg-pfin-table">
            <thead>
              <tr>
                <th>Bond</th>
                <th>Term</th>
                <th>Interest rate</th>
                <th>Monthly payment</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="pg-pfin-expense-name">
                      <span className="pg-pfin-expense-icon" aria-hidden>
                        <Landmark size={16} />
                      </span>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={termBadgeClass(item.termLabel)}>{item.termLabel}</span>
                  </td>
                  <td>{item.interestRateLabel}</td>
                  <td className="pg-pfin-table__amount">
                    {fmtZar(item.monthlyPayment)}
                    {item.monthlyPaymentHint ? (
                      <div className="pg-muted" style={{ fontSize: 11, fontWeight: 400 }}>
                        {item.monthlyPaymentHint}
                      </div>
                    ) : null}
                  </td>
                  <td className="pg-pfin-table__amount">{fmtZar(item.outstandingBalance)}</td>
                  <td>
                    <span className={statusBadgeClass(item.status)}>{item.statusLabel}</span>
                  </td>
                  <td>
                    <div className="pg-pfin-row-actions">
                      <button type="button" className="pg-pfin-icon-btn" aria-label="Edit bond profile" onClick={onEdit}>
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length > 0 && isMobile ? (
        <ul className="pg-pfin-expense-list">
          {items.map((item) => (
            <li key={item.id} className="pg-pfin-expense-list__item">
              <div className="pg-pfin-expense-list__main">
                <span className="pg-pfin-expense-icon" aria-hidden>
                  <Landmark size={18} />
                </span>
                <div>
                  <div className="pg-pfin-expense-list__title">{item.name}</div>
                  <span className={termBadgeClass(item.termLabel)}>{item.termLabel}</span>
                  <div className="pg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {item.interestRateLabel} · Balance {fmtZar(item.outstandingBalance)}
                  </div>
                </div>
              </div>
              <div className="pg-pfin-expense-list__right">
                <strong>{fmtZar(item.monthlyPayment)}</strong>
                <button type="button" className="pg-pfin-icon-btn" aria-label="Edit bond profile" onClick={onEdit}>
                  <Pencil size={16} />
                </button>
              </div>
            </li>
          ))}
          <li>
            <a href="#pfin-bond-payment" className="pg-pfin-link-all">
              View bond details
            </a>
          </li>
        </ul>
      ) : null}
    </section>
  );
}
