import { FormEvent, useEffect, useState } from "react";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { isValidEmailAddress, normalizeRecipientEmails } from "../invoices/invoiceEmailDefaults";
import {
  defaultStatementEmailMessage,
  defaultStatementEmailSubject
} from "./statementSendWorkflow";
import type { TenantStatementDocumentType } from "./statementTypes";

export type StatementSendEmailFormState = {
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
  statementNumber: string;
  statementType: TenantStatementDocumentType;
  periodLabel?: string | null;
  userOrBusinessName?: string | null;
  onClose: () => void;
  onSubmit: (values: StatementSendEmailFormState) => void | Promise<void>;
};

export function StatementSendEmailModal({
  open,
  loading = false,
  tenantEmail,
  tenantFirstName,
  propertyName,
  statementNumber,
  statementType,
  periodLabel,
  userOrBusinessName,
  onClose,
  onSubmit
}: Props) {
  const [recipientEmails, setRecipientEmails] = useState<string[]>([""]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copyMe, setCopyMe] = useState(true);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRecipientEmails([tenantEmail?.trim() ?? ""]);
    setSubject(
      defaultStatementEmailSubject({ statementType, propertyName, statementNumber })
    );
    setMessage(
      defaultStatementEmailMessage({
        tenantFirstName,
        statementType,
        propertyName,
        periodLabel,
        userOrBusinessName
      })
    );
    setCopyMe(true);
    setValidationError("");
  }, [
    open,
    tenantEmail,
    tenantFirstName,
    propertyName,
    statementNumber,
    statementType,
    periodLabel,
    userOrBusinessName
  ]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalized = normalizeRecipientEmails(recipientEmails);
    if (!normalized.length) {
      setValidationError("Enter at least one recipient email.");
      return;
    }
    if (normalized.some((addr) => !isValidEmailAddress(addr))) {
      setValidationError("Enter valid email addresses.");
      return;
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
    void onSubmit({ recipientEmails: normalized, subject: subject.trim(), message: message.trim(), copyMe });
  };

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Send statement"
      onClose={onClose}
      size="md"
      loading={loading}
      closeOnOverlayClick={!loading}
      onSubmit={handleSubmit}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {loading ? "Sending…" : "Send email"}
          </Button>
        </div>
      }
    >
      <div className="pg-inv-send-email">
        {validationError ? <div className="pg-alert pg-alert-error">{validationError}</div> : null}
        <Field label="To">
          <Input
            value={recipientEmails[0] ?? ""}
            onChange={(e) => setRecipientEmails([e.target.value])}
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </Field>
        <Field label="Message">
          <textarea
            className="pg-input"
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </Field>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input type="checkbox" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} />
          Send me a copy
        </label>
      </div>
    </AppFormModal>
  );
}
