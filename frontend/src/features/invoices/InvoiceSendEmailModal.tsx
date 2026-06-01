import { FormEvent, useEffect, useMemo, useState } from "react";
import { IconButton } from "../../components/icons";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import {
  buildInvoiceEmailTemplateContext,
  defaultInvoiceEmailMessage,
  defaultInvoiceEmailSubject,
  emailTemplateFromPaymentDetails,
  isValidEmailAddress,
  normalizeRecipientEmails
} from "./invoiceEmailDefaults";

export type InvoiceSendEmailFormState = {
  recipientEmails: string[];
  subject: string;
  message: string;
  copyMe: boolean;
};

type Props = {
  open: boolean;
  loading?: boolean;
  tenantEmail?: string | null;
  tenantFirstName?: string | null;
  propertyName?: string | null;
  invoiceNumber: string;
  totalAmount: number;
  balanceDue?: number | null;
  dueDate?: string | null;
  userOrBusinessName?: string | null;
  invoicePaymentDetails?: unknown;
  onClose: () => void;
  onSubmit: (values: InvoiceSendEmailFormState) => void | Promise<void>;
};

export function InvoiceSendEmailModal({
  open,
  loading = false,
  tenantEmail,
  tenantFirstName,
  propertyName,
  invoiceNumber,
  totalAmount,
  balanceDue,
  dueDate,
  userOrBusinessName,
  invoicePaymentDetails,
  onClose,
  onSubmit
}: Props) {
  const [recipientEmails, setRecipientEmails] = useState<string[]>([""]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copyMe, setCopyMe] = useState(true);
  const [validationError, setValidationError] = useState("");

  const templateCtx = useMemo(
    () =>
      buildInvoiceEmailTemplateContext({
        propertyName,
        invoiceNumber,
        tenantFirstName,
        totalAmount,
        balanceDue,
        dueDate,
        userOrBusinessName
      }),
    [propertyName, invoiceNumber, tenantFirstName, totalAmount, balanceDue, dueDate, userOrBusinessName]
  );

  useEffect(() => {
    if (!open) return;
    const templates = emailTemplateFromPaymentDetails(invoicePaymentDetails);
    setRecipientEmails([tenantEmail?.trim() ?? ""]);
    setSubject(defaultInvoiceEmailSubject(templateCtx, templates.subject));
    setMessage(defaultInvoiceEmailMessage(templateCtx, templates.body));
    setCopyMe(true);
    setValidationError("");
  }, [open, tenantEmail, invoicePaymentDetails, templateCtx]);

  const addRecipient = () => {
    setRecipientEmails((rows) => [...rows, ""]);
  };

  const removeRecipient = (index: number) => {
    setRecipientEmails((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  };

  const updateRecipient = (index: number, value: string) => {
    setRecipientEmails((rows) => rows.map((r, i) => (i === index ? value : r)));
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalized = normalizeRecipientEmails(recipientEmails);
    if (!normalized.length) {
      setValidationError("Add at least one recipient email address.");
      return;
    }
    for (const email of normalized) {
      if (!isValidEmailAddress(email)) {
        setValidationError(`Invalid email address: ${email}`);
        return;
      }
    }
    if (!subject.trim()) {
      setValidationError("Subject is required.");
      return;
    }
    if (!message.trim()) {
      setValidationError("Message is required.");
      return;
    }
    setValidationError("");
    void onSubmit({
      recipientEmails: normalized,
      subject: subject.trim(),
      message: message.trim(),
      copyMe
    });
  };

  const noTenantEmail = !tenantEmail?.trim();

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Send invoice"
      size="md"
      loading={loading}
      closeOnOverlayClick={!loading}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={onClose} disabled={loading}>
            Discard
          </Button>
          <Button type="submit" loading={loading}>
            {loading ? "Sending…" : "Send"}
          </Button>
        </div>
      }
    >
      <div className="pg-inv-send-email">
        {validationError ? (
          <div className="pg-alert pg-alert-error" role="alert">
            {validationError}
          </div>
        ) : null}

        <div className="pg-inv-send-email__section">
          <div className="pg-inv-send-email__section-head">
            <span className="pg-inv-editor__label">To</span>
            <IconButton
              icon="add"
              variant="ghost"
              size="sm"
              aria-label="Add recipient"
              tooltip="Add recipient"
              disabled={loading}
              onClick={addRecipient}
            />
          </div>
          {noTenantEmail ? (
            <p className="pg-text-helper" style={{ margin: "0 0 8px" }}>
              No tenant email found. Add an email address before sending.
            </p>
          ) : null}
          <div className="pg-inv-send-email__recipients">
            {recipientEmails.map((email, index) => (
              <div key={index} className="pg-inv-send-email__recipient-row">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => updateRecipient(index, e.target.value)}
                  placeholder="name@example.com"
                  aria-label={index === 0 ? "Primary recipient email" : `Additional recipient ${index + 1}`}
                  disabled={loading}
                  required={index === 0}
                />
                {recipientEmails.length > 1 ? (
                  <IconButton
                    icon="close"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove recipient"
                    tooltip="Remove"
                    disabled={loading}
                    onClick={() => removeRecipient(index)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={loading} />
        </Field>

        <Field label="Message">
          <textarea
            className="pg-inv-editor__textarea"
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            disabled={loading}
            aria-label="Email message"
          />
        </Field>

        <label className="pg-inv-send-email__checkbox">
          <input type="checkbox" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} disabled={loading} />
          <span>Copy me in this email</span>
        </label>
        {copyMe ? (
          <p className="pg-text-helper" style={{ margin: "4px 0 0" }}>
            A copy will be sent to your account email (from Account → invoice copy / CC settings).
          </p>
        ) : null}
      </div>
    </AppFormModal>
  );
}
