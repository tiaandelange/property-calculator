import type { ReactNode } from "react";
import { Check, Circle, ExternalLink, Upload, X } from "lucide-react";
import { buttonClassName } from "../ui/buttonStyles";
import { Button } from "../ui/Button";
import { DOCUMENT_UPLOAD_FILE_ACCEPT } from "./documentUploadConstants";

export function DocumentUploadSlotIndicator({ uploaded, busy }: { uploaded: boolean; busy?: boolean }) {
  if (busy) {
    return <span className="pg-doc-upload-slot__indicator pg-doc-upload-slot__indicator--busy" aria-hidden />;
  }
  if (uploaded) {
    return (
      <span className="pg-doc-upload-slot__indicator pg-doc-upload-slot__indicator--done" aria-hidden>
        <Check size={16} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="pg-doc-upload-slot__indicator" aria-hidden>
      <Circle size={16} strokeWidth={2} />
    </span>
  );
}

export function DocumentUploadFileTrigger({
  inputId,
  label,
  multiple,
  disabled,
  busy,
  disabledHint,
  variant = "outline",
  onFiles
}: {
  inputId: string;
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  disabledHint?: string;
  variant?: "outline" | "soft";
  onFiles: (files: FileList) => void;
}) {
  const inactive = disabled || busy;

  return (
    <label
      className={buttonClassName({
        variant,
        size: "sm",
        className: `pg-doc-upload-file-btn${inactive ? " is-disabled" : ""}`
      })}
      aria-disabled={inactive || undefined}
      title={disabled ? disabledHint : undefined}
    >
      <input
        id={inputId}
        type="file"
        accept={DOCUMENT_UPLOAD_FILE_ACCEPT}
        multiple={multiple}
        disabled={inactive}
        className="pg-doc-upload-file-btn__input"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <span className="pg-doc-upload-file-btn__content">
        <Upload size={14} aria-hidden />
        {busy ? "Uploading…" : label}
      </span>
    </label>
  );
}

export type DocumentUploadSlotFile = { id: string; name: string };

export function DocumentUploadSlotRow({
  title,
  description,
  complete,
  files,
  busy,
  readOnly,
  uploadsEnabled,
  inputId,
  uploadLabel,
  replaceLabel,
  multiple,
  disabledHint,
  onFiles,
  onRemoveFile,
  onView
}: {
  title: string;
  description?: string;
  complete: boolean;
  files: DocumentUploadSlotFile[];
  busy?: boolean;
  readOnly?: boolean;
  uploadsEnabled: boolean;
  inputId: string;
  uploadLabel?: string;
  replaceLabel?: string;
  multiple?: boolean;
  disabledHint?: string;
  onFiles: (files: FileList) => void;
  onRemoveFile?: (fileId: string) => void;
  onView?: () => void;
}) {
  const canRemove = !readOnly && Boolean(onRemoveFile);

  return (
    <li className="pg-doc-upload-slot">
      <DocumentUploadSlotIndicator uploaded={complete} busy={busy} />
      <div className="pg-doc-upload-slot__copy">
        <div className="pg-doc-upload-slot__label">{title}</div>
        {description ? <p className="pg-muted pg-doc-upload-slot__desc">{description}</p> : null}
        {files.length ? (
          <ul className="pg-doc-upload-slot__files">
            {files.map((file) => (
              <li key={file.id} className="pg-doc-upload-slot__file-item">
                <span className="pg-doc-upload-slot__file-name">{file.name}</span>
                {canRemove ? (
                  <button
                    type="button"
                    className="pg-doc-upload-slot__file-remove"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onRemoveFile?.(file.id)}
                  >
                    <X size={14} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="pg-doc-upload-slot__file pg-muted">Not uploaded yet</div>
        )}
      </div>
      <div className="pg-doc-upload-slot__actions">
        {onView && complete ? (
          <Button type="button" variant="ghost" size="sm" onClick={onView}>
            <ExternalLink size={14} aria-hidden style={{ marginRight: 4 }} />
            View
          </Button>
        ) : null}
        {!readOnly ? (
          <DocumentUploadFileTrigger
            inputId={inputId}
            label={complete ? (replaceLabel ?? "Replace") : (uploadLabel ?? (multiple ? "Choose files" : "Choose file"))}
            multiple={multiple}
            disabled={!uploadsEnabled}
            busy={busy}
            disabledHint={disabledHint}
            variant={complete ? "soft" : "outline"}
            onFiles={onFiles}
          />
        ) : null}
      </div>
    </li>
  );
}

export function DocumentUploadSectionShell({
  title,
  description,
  progressLabel,
  embedded,
  error,
  loading,
  loadingMessage,
  children
}: {
  title: string;
  description?: string;
  progressLabel?: string;
  embedded?: boolean;
  error?: string;
  loading?: boolean;
  loadingMessage?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`pg-doc-upload-section${embedded ? " pg-doc-upload-section--embedded" : ""}`}
      aria-labelledby="doc-upload-section-title"
    >
      <div className="pg-doc-upload-section__head">
        <div>
          <h2 id="doc-upload-section-title" className="pg-doc-upload-section__title">
            {title}
          </h2>
          {description ? <p className="pg-muted pg-doc-upload-section__desc">{description}</p> : null}
        </div>
        {progressLabel ? (
          <span className="pg-doc-upload-section__progress" aria-live="polite">
            {progressLabel}
          </span>
        ) : null}
      </div>
      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      {loading ? <p className="pg-muted">{loadingMessage ?? "Loading documents…"}</p> : null}
      <ul className="pg-doc-upload-section__slots">{children}</ul>
    </section>
  );
}
