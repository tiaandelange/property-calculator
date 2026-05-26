import type React from "react";

export function ModalOverlay({
  open,
  onClose,
  className
}: {
  open: boolean;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div
      className={["pg-overlay", className].filter(Boolean).join(" ")}
      data-open={open ? "true" : "false"}
      onClick={onClose}
      aria-hidden={!open}
    />
  );
}

export function ModalPanel({
  title,
  children,
  onClose,
  className,
  actions
}: {
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={["pg-modal-panel", className].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "pg-modal-title" : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      {title || onClose || actions ? (
        <div className="pg-modal-header">
          {title ? (
            <h2 id="pg-modal-title" className="pg-modal-title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {actions}
            {onClose ? (
              <button type="button" className="pg-btn pg-btn-ghost" onClick={onClose} aria-label="Close">
                ✕
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function SheetPanel({
  title,
  children,
  onClose,
  className,
  open = true
}: {
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  open?: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <ModalOverlay open onClose={onClose} />
      <aside
        className={["pg-sheet-panel", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "pg-sheet-title" : undefined}
      >
        {title || onClose ? (
          <div className="pg-sheet-header">
            {title ? (
              <h2 id="pg-sheet-title" className="pg-sheet-title">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {onClose ? (
              <button type="button" className="pg-btn pg-btn-ghost" onClick={onClose} aria-label="Close">
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </aside>
    </>
  );
}
