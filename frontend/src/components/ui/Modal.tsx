import type React from "react";
import { Button } from "./Button";
import { ModalOverlay as SharedOverlay, ModalPanelShell } from "./modalShared";
import { useId, useRef } from "react";

export { ModalOverlay } from "./modalShared";

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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <ModalPanelShell
      panelRef={panelRef}
      title={title}
      titleId={titleId}
      onClose={onClose}
      headerActions={actions}
      className={["pg-modal-panel", className].filter(Boolean).join(" ")}
      size="md"
    >
      {children}
    </ModalPanelShell>
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
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  if (!open) return null;

  return (
    <>
      <SharedOverlay open onClose={onClose} />
      <aside
        ref={panelRef}
        className={["pg-sheet-panel", "pg-app-drawer", "pg-app-drawer--right", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {title || onClose ? (
          <div className="pg-sheet-header pg-app-drawer-header">
            {title ? (
              <h2 id={titleId} className="pg-sheet-title pg-app-modal-title">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {onClose ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
                ✕
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="pg-app-drawer-body">{children}</div>
      </aside>
    </>
  );
}
