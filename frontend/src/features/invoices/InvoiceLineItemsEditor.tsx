import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { fmtZar } from "./invoiceDirectoryUtils";
import {
  INVOICE_LINE_CATEGORY_OPTIONS,
  categoryOptionLabel,
  categoryOptionValue,
  emptyInvoiceLine,
  lineItemAmount,
  moveLineItem,
  patchInvoiceLineItem,
  resolveCategoryFromOption,
  type InvoiceLineItemDraft
} from "./invoiceLineItemUtils";

type Props = {
  lineItems: InvoiceLineItemDraft[];
  editable: boolean;
  defaultRent?: number;
  onChange: (items: InvoiceLineItemDraft[]) => void;
};

export function InvoiceLineItemsEditor({ lineItems, editable, defaultRent, onChange }: Props) {
  const patchLine = (idx: number, patch: Partial<InvoiceLineItemDraft>) => {
    if (!editable) return;
    onChange(lineItems.map((row, i) => (i === idx ? patchInvoiceLineItem(row, patch) : row)));
  };

  const setCategoryOption = (idx: number, optionValue: string) => {
    if (!editable) return;
    const { category, defaultDescription } = resolveCategoryFromOption(optionValue);
    const row = lineItems[idx];
    const description =
      !row.description.trim() || row.description === categoryOptionLabel(categoryOptionValue(row.category, row.description))
        ? (defaultDescription ?? row.description)
        : row.description;
    patchLine(idx, { category, description });
  };

  const removeLine = (idx: number) => {
    if (!editable || lineItems.length <= 1) return;
    onChange(lineItems.filter((_, i) => i !== idx).map((row, i) => ({ ...row, sortOrder: i + 1 })));
  };

  const addLine = () => {
    if (!editable) return;
    onChange([...lineItems, emptyInvoiceLine(defaultRent, lineItems.length + 1)]);
  };

  const reorder = (from: number, to: number) => {
    if (!editable) return;
    onChange(moveLineItem(lineItems, from, to));
  };

  return (
    <div className="pg-invoice-line-items">
      <div className="pg-invoice-line-items__head">
        <span className="pg-muted">Line items</span>
        {editable ? (
          <Button type="button" variant="ghost" onClick={addLine}>
            <Plus size={16} style={{ marginRight: 6 }} aria-hidden />
            Add line item
          </Button>
        ) : null}
      </div>

      <div className="pg-invoice-line-items__table-wrap">
        <table className="pg-invoice-line-items__table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Category</th>
              <th scope="col" className="pg-invoice-line-items__num">
                Quantity
              </th>
              <th scope="col" className="pg-invoice-line-items__num">
                Unit price
              </th>
              <th scope="col" className="pg-invoice-line-items__num">
                Amount
              </th>
              {editable ? <th scope="col">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, idx) => {
              const amount = lineItemAmount(li.quantity, li.unitPrice);
              const optionValue = categoryOptionValue(li.category, li.description);
              return (
                <tr key={`${idx}-${li.sortOrder}`}>
                  <td>
                    {editable ? (
                      <Input
                        value={li.description}
                        onChange={(e) => patchLine(idx, { description: e.target.value })}
                        aria-label={`Description row ${idx + 1}`}
                      />
                    ) : (
                      li.description || "—"
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <select
                        className="pg-input"
                        value={optionValue}
                        onChange={(e) => setCategoryOption(idx, e.target.value)}
                        aria-label={`Category row ${idx + 1}`}
                      >
                        {INVOICE_LINE_CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      categoryOptionLabel(optionValue)
                    )}
                  </td>
                  <td className="pg-invoice-line-items__num">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.quantity}
                        onChange={(e) => patchLine(idx, { quantity: Number(e.target.value) || 0 })}
                        aria-label={`Quantity row ${idx + 1}`}
                      />
                    ) : (
                      li.quantity
                    )}
                  </td>
                  <td className="pg-invoice-line-items__num">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.unitPrice}
                        onChange={(e) => patchLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                        aria-label={`Unit price row ${idx + 1}`}
                      />
                    ) : (
                      fmtZar(li.unitPrice)
                    )}
                  </td>
                  <td className="pg-invoice-line-items__num pg-invoice-line-items__amount">{fmtZar(amount)}</td>
                  {editable ? (
                    <td>
                      <div className="pg-invoice-line-items__actions">
                        <button
                          type="button"
                          className="pg-invoices-action-btn"
                          aria-label={`Move line ${idx + 1} up`}
                          disabled={idx === 0}
                          onClick={() => reorder(idx, idx - 1)}
                        >
                          <ArrowUp size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="pg-invoices-action-btn"
                          aria-label={`Move line ${idx + 1} down`}
                          disabled={idx === lineItems.length - 1}
                          onClick={() => reorder(idx, idx + 1)}
                        >
                          <ArrowDown size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="pg-invoices-action-btn pg-invoices-action-btn--danger"
                          aria-label={`Delete line ${idx + 1}`}
                          disabled={lineItems.length <= 1}
                          onClick={() => removeLine(idx)}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
