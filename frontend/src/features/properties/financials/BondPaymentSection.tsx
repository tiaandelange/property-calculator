import { Pencil, Plus, Trash2 } from "lucide-react";
import { fmtZar } from "./propertyFinancialsAdapter";
import type { BondPaymentDisplayItem } from "./propertyBondAdapter";

function termBadgeClass(remainingTermMonths: number | null): string {
  if (remainingTermMonths != null && remainingTermMonths > 0 && remainingTermMonths <= 24) {
    return "pg-pfin-badge pg-pfin-badge--warning";
  }
  return "pg-pfin-badge pg-pfin-badge--info";
}

function statusBadgeClass(status: BondPaymentDisplayItem["status"]): string {
  if (status === "none") return "pg-pfin-badge pg-pfin-badge--muted";
  if (status === "incomplete") return "pg-pfin-badge pg-pfin-badge--warning";
  return "pg-pfin-badge pg-pfin-badge--success";
}

function BondRowActions({
  item,
  onEditPropertyBond,
  onEditAdditionalBond,
  onDeleteAdditionalBond
}: {
  item: BondPaymentDisplayItem;
  onEditPropertyBond: () => void;
  onEditAdditionalBond: (id: string) => void;
  onDeleteAdditionalBond?: (id: string) => void;
}) {
  if (item.source === "property") {
    return (
      <button type="button" className="pg-pfin-icon-btn" aria-label="Edit property bond profile" onClick={onEditPropertyBond}>
        <Pencil size={16} />
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        className="pg-pfin-icon-btn"
        aria-label="Edit additional bond"
        onClick={() => onEditAdditionalBond(item.id)}
      >
        <Pencil size={16} />
      </button>
      {onDeleteAdditionalBond ? (
        <button
          type="button"
          className="pg-pfin-icon-btn"
          aria-label="Remove additional bond"
          onClick={() => onDeleteAdditionalBond(item.id)}
        >
          <Trash2 size={16} />
        </button>
      ) : null}
    </>
  );
}

export function BondPaymentSection({
  items,
  loading,
  isMobile,
  onEditPropertyBond,
  onSetupPropertyBond,
  onAddAdditionalBond,
  onEditAdditionalBond,
  onDeleteAdditionalBond
}: {
  items: BondPaymentDisplayItem[];
  loading?: boolean;
  isMobile?: boolean;
  onEditPropertyBond: () => void;
  onSetupPropertyBond: () => void;
  onAddAdditionalBond: () => void;
  onEditAdditionalBond: (id: string) => void;
  onDeleteAdditionalBond?: (id: string) => void;
}) {
  const hasPropertyBond = items.some((i) => i.source === "property");
  const showTable = !loading;

  return (
    <section className="pg-pfin-section" id="pfin-bond-payment">
      <header className="pg-pfin-section__head">
        <div>
          <h2 className="pg-pfin-section__title">Bond Payment</h2>
          <p className="pg-pfin-section__desc">
            Primary home-loan from your property profile, plus any additional bonds or credit facilities affecting this
            property.
          </p>
        </div>
      </header>

      {loading ? <div className="pg-muted">Loading bond profile…</div> : null}

      {!loading && !hasPropertyBond && items.length === 0 ? (
        <div className="pg-pfin-empty">
          <p>No bond profile yet</p>
          <p className="pg-muted">
            Add outstanding balance, interest rate, and term on the property form to calculate monthly payments.
          </p>
          <button type="button" className="pg-btn pg-btn-secondary" onClick={onSetupPropertyBond}>
            Set up property bond
          </button>
        </div>
      ) : null}

      {showTable && !isMobile ? (
        <div className="pg-ptable-wrap pg-ptable-wrap--responsive">
          <table className="pg-ptable pg-pfin-table">
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
                    <span>{item.name}</span>
                  </td>
                  <td>
                    <span
                      className={termBadgeClass(item.remainingTermMonths)}
                      title={item.termHoverLabel ?? undefined}
                    >
                      {item.termLabel}
                    </span>
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
                      <BondRowActions
                        item={item}
                        onEditPropertyBond={onEditPropertyBond}
                        onEditAdditionalBond={onEditAdditionalBond}
                        onDeleteAdditionalBond={onDeleteAdditionalBond}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="pg-pfin-bond-add-row">
                <td colSpan={7}>
                  <button
                    type="button"
                    className="pg-pfin-bond-add-row__btn"
                    aria-label="Add additional bond"
                    onClick={onAddAdditionalBond}
                  >
                    <Plus size={22} strokeWidth={1.75} aria-hidden />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {showTable && isMobile ? (
        <ul className="pg-pfin-expense-list">
          {items.map((item) => (
            <li key={item.id} className="pg-pfin-expense-list__item">
              <div className="pg-pfin-expense-list__main">
                <div>
                  <div className="pg-pfin-expense-list__title">{item.name}</div>
                  <span
                    className={termBadgeClass(item.remainingTermMonths)}
                    title={item.termHoverLabel ?? undefined}
                  >
                    {item.termLabel}
                  </span>
                  <div className="pg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {item.interestRateLabel} · Balance {fmtZar(item.outstandingBalance)}
                  </div>
                </div>
              </div>
              <div className="pg-pfin-expense-list__right">
                <strong>{fmtZar(item.monthlyPayment)}</strong>
                <div className="pg-pfin-row-actions">
                  <BondRowActions
                    item={item}
                    onEditPropertyBond={onEditPropertyBond}
                    onEditAdditionalBond={onEditAdditionalBond}
                    onDeleteAdditionalBond={onDeleteAdditionalBond}
                  />
                </div>
              </div>
            </li>
          ))}
          <li>
            <button type="button" className="pg-pfin-bond-add-row__btn pg-pfin-bond-add-row__btn--mobile" onClick={onAddAdditionalBond}>
              <Plus size={22} strokeWidth={1.75} aria-hidden />
              <span>Add additional bond</span>
            </button>
          </li>
        </ul>
      ) : null}
    </section>
  );
}
