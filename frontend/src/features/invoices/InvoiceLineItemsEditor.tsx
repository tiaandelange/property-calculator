import { AppIcon, IconButton } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { fmtZar } from "./invoiceDirectoryUtils";
import {
  INVOICE_LINE_CATEGORY_OPTIONS,
  categoryOptionLabel,
  categoryOptionValue,
  emptyInvoiceLine,
  lineItemAmount,
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

  return (
    <section className="pg-inv-lines" aria-labelledby="pg-inv-lines-heading">
      <h3 id="pg-inv-lines-heading" className="pg-inv-lines__section-title">
        Line items
      </h3>

      <div className="pg-inv-lines__desktop">
        <table className="pg-inv-lines__table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Description</th>
              <th scope="col" className="pg-inv-lines__num">
                Qty
              </th>
              <th scope="col" className="pg-inv-lines__num">
                Price
              </th>
              <th scope="col" className="pg-inv-lines__num">
                Tax
              </th>
              <th scope="col" className="pg-inv-lines__num">
                Amount
              </th>
              {editable ? (
                <th scope="col">
                  <span className="pg-invoices-sr-only">Actions</span>
                </th>
              ) : null}
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
                      <Select
                        value={optionValue}
                        onChange={(e) => setCategoryOption(idx, e.target.value)}
                        aria-label={`Item row ${idx + 1}`}
                      >
                        {INVOICE_LINE_CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      categoryOptionLabel(optionValue)
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
                      li.description || "—"
                    )}
                  </td>
                  <td className="pg-inv-lines__num">
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
                  <td className="pg-inv-lines__num">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.unitPrice}
                        onChange={(e) => patchLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                        aria-label={`Price row ${idx + 1}`}
                      />
                    ) : (
                      fmtZar(li.unitPrice)
                    )}
                  </td>
                  <td className="pg-inv-lines__num pg-inv-lines__tax-muted">—</td>
                  <td className="pg-inv-lines__num pg-inv-lines__amount">{fmtZar(amount)}</td>
                  {editable ? (
                    <td>
                      <IconButton
                        icon="delete"
                        aria-label={`Delete line ${idx + 1}`}
                        variant="outline"
                        size="sm"
                        className="pg-inv-lines__delete-btn"
                        disabled={lineItems.length <= 1}
                        onClick={() => removeLine(idx)}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pg-inv-lines__mobile">
        {lineItems.map((li, idx) => {
          const amount = lineItemAmount(li.quantity, li.unitPrice);
          const optionValue = categoryOptionValue(li.category, li.description);
          return (
            <article key={`m-${idx}-${li.sortOrder}`} className="pg-inv-lines__mobile-card">
              <div className="pg-inv-lines__mobile-card-head">
                <span className="pg-inv-lines__mobile-card-title">{categoryOptionLabel(optionValue)}</span>
                {editable ? (
                  <IconButton
                    icon="delete"
                    aria-label={`Delete line ${idx + 1}`}
                    variant="outline"
                    size="sm"
                    className="pg-inv-lines__delete-btn"
                    disabled={lineItems.length <= 1}
                    onClick={() => removeLine(idx)}
                  />
                ) : null}
              </div>
              {editable ? (
                <>
                  <div>
                    <div className="pg-inv-lines__mobile-label">Item</div>
                    <Select
                      value={optionValue}
                      onChange={(e) => setCategoryOption(idx, e.target.value)}
                      aria-label={`Item row ${idx + 1}`}
                    >
                      {INVOICE_LINE_CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <div className="pg-inv-lines__mobile-label">Description</div>
                    <Input
                      value={li.description}
                      onChange={(e) => patchLine(idx, { description: e.target.value })}
                      aria-label={`Description row ${idx + 1}`}
                    />
                  </div>
                  <div className="pg-inv-lines__mobile-row">
                    <div>
                      <div className="pg-inv-lines__mobile-label">Qty</div>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.quantity}
                        onChange={(e) => patchLine(idx, { quantity: Number(e.target.value) || 0 })}
                        aria-label={`Quantity row ${idx + 1}`}
                      />
                    </div>
                    <div>
                      <div className="pg-inv-lines__mobile-label">Price</div>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.unitPrice}
                        onChange={(e) => patchLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                        aria-label={`Price row ${idx + 1}`}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="pg-muted" style={{ margin: 0 }}>
                  {li.description || "—"}
                </p>
              )}
              <div className="pg-inv-lines__mobile-amount-row">
                <span className="pg-muted">Amount</span>
                <strong>{fmtZar(amount)}</strong>
              </div>
            </article>
          );
        })}
      </div>

      {editable ? (
        <div className="pg-inv-lines__add">
          <Button type="button" variant="ghost" onClick={addLine}>
            <AppIcon name="add" size="sm" style={{ marginRight: 8 }} />
            Add line item
          </Button>
        </div>
      ) : null}
    </section>
  );
}
