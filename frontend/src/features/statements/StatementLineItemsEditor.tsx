import { IconButton } from "../../components/icons";
import { ProplyticTableWrap } from "../../components/tables";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { fmtZar } from "../invoices/invoiceDirectoryUtils";
import { emptyStatementLine, patchStatementLineItem } from "./statementLineItemUtils";
import type { StatementLineItemDraft, TenantStatementDocumentType } from "./statementTypes";

type Props = {
  lineItems: StatementLineItemDraft[];
  editable: boolean;
  statementType: TenantStatementDocumentType;
  onChange: (items: StatementLineItemDraft[]) => void;
};

export function StatementLineItemsEditor({ lineItems, editable, statementType, onChange }: Props) {
  const patchLine = (idx: number, patch: Partial<StatementLineItemDraft>) => {
    if (!editable) return;
    onChange(lineItems.map((row, i) => (i === idx ? patchStatementLineItem(row, patch) : row)));
  };

  const removeLine = (idx: number) => {
    if (!editable || lineItems.length <= 1) return;
    onChange(lineItems.filter((_, i) => i !== idx).map((row, i) => ({ ...row, sortOrder: i + 1 })));
  };

  const addLine = () => {
    if (!editable) return;
    const entryType = statementType === "DEPOSIT" ? "DEBIT" : "DEBIT";
    const desc = statementType === "DEPOSIT" ? "Cleaning / repairs" : "Line item";
    onChange([...lineItems, emptyStatementLine(0, entryType, desc)]);
  };

  const showEntryType = statementType === "FINANCIAL";

  return (
    <section className="pg-inv-lines" aria-labelledby="pg-stmt-lines-heading">
      <h3 id="pg-stmt-lines-heading" className="pg-inv-lines__section-title">
        Statement lines
      </h3>

      <div className="pg-inv-lines__desktop">
        <ProplyticTableWrap>
          <table className="pg-ptable pg-ptable--editable pg-inv-lines__table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                {showEntryType ? <th scope="col">Type</th> : null}
                <th scope="col" className="pg-inv-lines__num">
                  Qty
                </th>
                <th scope="col" className="pg-inv-lines__num">
                  Amount
                </th>
                <th scope="col" className="pg-inv-lines__num">
                  Total
                </th>
                {editable ? (
                  <th scope="col">
                    <span className="pg-invoices-sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, idx) => (
                <tr key={`${idx}-${li.sortOrder}`}>
                  <td>
                    {editable ? (
                      <Input
                        type="date"
                        value={li.transactionDate?.slice(0, 10) ?? ""}
                        onChange={(e) => patchLine(idx, { transactionDate: e.target.value || null })}
                        aria-label={`Date row ${idx + 1}`}
                      />
                    ) : (
                      li.transactionDate?.slice(0, 10) ?? "—"
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <Input
                        value={li.description}
                        onChange={(e) => patchLine(idx, { description: e.target.value })}
                        aria-label={`Description row ${idx + 1}`}
                      />
                    ) : (
                      li.description
                    )}
                  </td>
                  {showEntryType ? (
                    <td>
                      {editable ? (
                        <Select
                          value={li.entryType}
                          onChange={(e) =>
                            patchLine(idx, { entryType: e.target.value === "CREDIT" ? "CREDIT" : "DEBIT" })
                          }
                          aria-label={`Type row ${idx + 1}`}
                        >
                          <option value="DEBIT">Charge</option>
                          <option value="CREDIT">Credit</option>
                        </Select>
                      ) : li.entryType === "CREDIT" ? (
                        "Credit"
                      ) : (
                        "Charge"
                      )}
                    </td>
                  ) : null}
                  <td className="pg-inv-lines__num">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.quantity}
                        onChange={(e) => patchLine(idx, { quantity: Number(e.target.value) })}
                        aria-label={`Quantity row ${idx + 1}`}
                      />
                    ) : (
                      li.quantity
                    )}
                  </td>
                  <td className="pg-inv-lines__num">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.unitPrice}
                        onChange={(e) => patchLine(idx, { unitPrice: Number(e.target.value) })}
                        aria-label={`Amount row ${idx + 1}`}
                      />
                    ) : (
                      fmtZar(li.unitPrice)
                    )}
                  </td>
                  <td className="pg-inv-lines__num">{fmtZar(li.total)}</td>
                  {editable ? (
                    <td>
                      <IconButton
                        icon="delete"
                        aria-label={`Remove row ${idx + 1}`}
                        variant="ghost"
                        size="sm"
                        tooltip={false}
                        disabled={lineItems.length <= 1}
                        onClick={() => removeLine(idx)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </ProplyticTableWrap>
      </div>

      {editable ? (
        <div className="pg-inv-lines__add">
          <Button type="button" variant="soft" iconLeft="plus" onClick={addLine}>
            {statementType === "DEPOSIT" ? "Add expense" : "Add line"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
