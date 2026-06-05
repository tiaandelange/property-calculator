import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../../ui/Button";

type AmortMonthRow = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

type AmortYearRow = {
  year: number;
  interest: number;
  principal: number;
  balanceEnd: number;
};

function formatZar(n: number): string {
  return Math.round(n).toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
}

const PREVIEW_ROWS = 5;

export function CalculatorToolAmortisationTable({
  monthly,
  yearly,
  title
}: {
  monthly: AmortMonthRow[];
  yearly: AmortYearRow[];
  title?: string;
}) {
  const [view, setView] = useState<"yearly" | "monthly">("yearly");
  const [showFull, setShowFull] = useState(false);

  const yearlyRows = useMemo(() => {
    return yearly.map((y) => {
      const startMonth = (y.year - 1) * 12 + 1;
      let openingBalance = 0;
      if (monthly.length) {
        if (startMonth <= 1) {
          openingBalance = monthly[0].balance + monthly[0].principal;
        } else {
          const prev = monthly.find((r) => r.month === startMonth - 1);
          openingBalance = prev?.balance ?? 0;
        }
      }
      return {
        year: y.year,
        openingBalance,
        payment: y.principal + y.interest,
        interest: y.interest,
        principal: y.principal,
        closingBalance: y.balanceEnd
      };
    });
  }, [monthly, yearly]);

  const monthlyDisplay = useMemo(() => {
    return monthly.map((row, idx) => {
      const opening = idx === 0 ? row.balance + row.principal : monthly[idx - 1].balance;
      return {
        period: `Month ${row.month}`,
        openingBalance: opening,
        payment: row.payment,
        interest: row.interest,
        principal: row.principal,
        closingBalance: row.balance
      };
    });
  }, [monthly]);

  const rows = view === "yearly" ? yearlyRows : monthlyDisplay;
  const visible = showFull ? rows : rows.slice(0, PREVIEW_ROWS);

  return (
    <div className="pg-calc-tool-panel pg-calc-tool-panel--table pg-calc-tool-amort-table">
      <div className="pg-calc-tool-amort-table__head">
        <h3 className="pg-calc-tool-amort-table__title">{title ?? "Payment schedule preview"}</h3>
        <div className="pg-calc-tool-toggle" role="group" aria-label="View schedule by">
          <span className="pg-calc-tool-toggle__label">View by:</span>
          <button
            type="button"
            className="pg-calc-tool-toggle__btn"
            data-active={view === "yearly" ? "true" : "false"}
            onClick={() => setView("yearly")}
          >
            Yearly
          </button>
          <button
            type="button"
            className="pg-calc-tool-toggle__btn"
            data-active={view === "monthly" ? "true" : "false"}
            onClick={() => setView("monthly")}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="pg-calc-tool-amort-rows" role="table" aria-label="Amortisation breakdown">
        <div className="pg-calc-tool-amort-rows__header" role="row">
          <span role="columnheader">{view === "yearly" ? "Year" : "Period"}</span>
          <span role="columnheader">Opening</span>
          <span role="columnheader">Payment</span>
          <span role="columnheader">Interest</span>
          <span role="columnheader">Principal</span>
          <span role="columnheader">Closing</span>
        </div>
        {visible.map((row, idx) => (
          <div
            key={view === "yearly" ? `y-${(row as { year: number }).year}` : `m-${idx}`}
            className="pg-calc-tool-amort-rows__row"
            role="row"
          >
            <span className="pg-calc-tool-amort-rows__period" role="cell">
              {view === "yearly" ? `Year ${(row as { year: number }).year}` : (row as { period: string }).period}
            </span>
            <span role="cell">Open {formatZar(row.openingBalance)}</span>
            <span role="cell">Pay {formatZar(row.payment)}</span>
            <span role="cell">Int {formatZar(row.interest)}</span>
            <span role="cell">Prin {formatZar(row.principal)}</span>
            <span role="cell" className="pg-calc-tool-amort-rows__closing">
              Close {formatZar(row.closingBalance)}
            </span>
          </div>
        ))}
      </div>

      {rows.length > PREVIEW_ROWS ? (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          className="pg-calc-tool-amort-table__cta"
          onClick={() => setShowFull((v) => !v)}
        >
          {showFull ? "Show fewer rows" : "View Full Amortisation Schedule"}
          <ChevronRight size={18} aria-hidden className="pg-calc-tool-amort-table__cta-icon" />
        </Button>
      ) : null}
    </div>
  );
}
