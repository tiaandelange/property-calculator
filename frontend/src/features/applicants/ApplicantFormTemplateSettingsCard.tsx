import { useEffect, useState } from "react";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { asArray } from "../../lib/asArray";
import {
  createCustomFieldId,
  DEFAULT_APPLICANT_FORM_TEMPLATE,
  normalizeApplicantFormTemplate,
  validateApplicantFormTemplate,
  type ApplicantFormFieldDef,
  type ApplicantFormTemplate
} from "./applicantFormTemplate";

function FieldEditorRow({
  field,
  onChange,
  onDelete
}: {
  field: ApplicantFormFieldDef;
  onChange: (next: ApplicantFormFieldDef) => void;
  onDelete: () => void;
}) {
  const typeLocked =
    field.system &&
    ["firstName", "lastName", "email", "monthlyIncome", "additionalOccupants", "animals"].includes(
      field.id
    );

  return (
    <div className="pg-applicant-template-field-row">
      <Field label="Label">
        <Input value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
      </Field>
      <Field label="Type">
        <select
          className="pg-settings-input"
          value={field.type}
          disabled={typeLocked}
          onChange={(e) =>
            onChange({
              ...field,
              type: e.target.value as ApplicantFormFieldDef["type"]
            })
          }
        >
          <option value="text">Text</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="income">Income</option>
          <option value="select">Select</option>
          <option value="animals">Pets</option>
        </select>
      </Field>
      <Field label="Width">
        <select
          className="pg-settings-input"
          value={field.width ?? "full"}
          onChange={(e) => onChange({ ...field, width: e.target.value === "half" ? "half" : "full" })}
        >
          <option value="full">Full</option>
          <option value="half">Half</option>
        </select>
      </Field>
      <label className="pg-applicant-template-field-row__required">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ ...field, required: e.target.checked })}
        />
        Required
      </label>
      {!field.system ? (
        <Button type="button" variant="ghost" onClick={onDelete}>
          Delete
        </Button>
      ) : (
        <span className="pg-muted" style={{ fontSize: 12 }}>
          Core field
        </span>
      )}
    </div>
  );
}

export function ApplicantFormTemplateEditorModal({
  open,
  template,
  onClose,
  onApply
}: {
  open: boolean;
  template: ApplicantFormTemplate;
  onClose: () => void;
  onApply: (next: ApplicantFormTemplate) => void;
}) {
  const [draft, setDraft] = useState(template);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(normalizeApplicantFormTemplate(template));
      setError("");
      setNewLabel("");
    }
  }, [open, template]);

  const addField = () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = createCustomFieldId(label, draft.fields);
    setDraft((prev) => ({
      ...prev,
      fields: [...prev.fields, { id, label, type: "text", required: false, width: "full" }]
    }));
    setNewLabel("");
  };

  const apply = () => {
    const normalized = normalizeApplicantFormTemplate(draft);
    const validationError = validateApplicantFormTemplate(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    onApply(normalized);
    onClose();
  };

  const resetDefault = () => {
    setDraft(structuredClone(DEFAULT_APPLICANT_FORM_TEMPLATE));
    setError("");
  };

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Applicant form template"
      description="This template is used for every applicant share link you send."
      size="lg"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={resetDefault}>
            Reset to default
          </Button>
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Apply to settings</Button>
        </div>
      }
    >
      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      <Field label="Form title">
        <Input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
      </Field>
      <Field label="Intro description">
        <Input value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
      </Field>
      <label className="pg-applicant-co-toggle">
        <input
          type="checkbox"
          checked={draft.allowCoApplicant}
          onChange={(e) => setDraft((p) => ({ ...p, allowCoApplicant: e.target.checked }))}
        />
        <span>Allow second applicant on shared form</span>
      </label>

      <div className="pg-applicant-template-field-list">
        {draft.fields.map((field, index) => (
          <FieldEditorRow
            key={field.id}
            field={field}
            onChange={(next) =>
              setDraft((prev) => ({
                ...prev,
                fields: prev.fields.map((f, i) => (i === index ? next : f))
              }))
            }
            onDelete={() =>
              setDraft((prev) => ({
                ...prev,
                fields: prev.fields.filter((_, i) => i !== index)
              }))
            }
          />
        ))}
      </div>

      <div className="pg-applicant-template-add-row">
        <Field label="Add custom field">
          <Input value={newLabel} placeholder="e.g. Employer name" onChange={(e) => setNewLabel(e.target.value)} />
        </Field>
        <Button type="button" variant="soft" onClick={addField} disabled={!newLabel.trim()}>
          Add field
        </Button>
      </div>
    </AppFormModal>
  );
}

export function ApplicantFormTemplateSettingsCard({
  template,
  onTemplateChange
}: {
  template: ApplicantFormTemplate;
  onTemplateChange: (next: ApplicantFormTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const fields = asArray<ApplicantFormFieldDef>(template.fields);

  return (
    <>
      <div id="applicant-form-template" className="pg-applicant-template-summary">
        <p className="pg-muted" style={{ margin: "0 0 8px" }}>
          {fields.length} fields · {template.allowCoApplicant ? "Co-applicant enabled" : "Single applicant only"}
        </p>
        <ul className="pg-applicant-template-summary__list">
          {fields.slice(0, 6).map((f) => (
            <li key={f.id}>
              {f.label}
              {f.required ? " *" : ""}
            </li>
          ))}
          {fields.length > 6 ? <li>+{fields.length - 6} more</li> : null}
        </ul>
      </div>
      <div className="pg-settings-actions" style={{ marginTop: 12 }}>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Edit form template
        </Button>
      </div>
      <ApplicantFormTemplateEditorModal
        open={open}
        template={template}
        onClose={() => setOpen(false)}
        onApply={onTemplateChange}
      />
    </>
  );
}
