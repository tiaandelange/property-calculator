import { useId, useRef, type FormEvent, type ReactNode } from "react";
import type { IconName } from "../icons/iconRegistry";
import { IconContainer } from "../icons/IconContainer";
import { Button } from "./Button";
import {
  ModalCenterHost,
  ModalOverlay,
  ModalPanelShell,
  useModalEffects,
  type AppModalSize
} from "./modalShared";

export type { AppModalSize };

export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
  footer,
  onClose,
  closeOnEscape = true,
  closeOnOverlayClick = true,
  headerBorder,
  footerBorder,
  headerActions,
  mobileSheet = true,
  className
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: AppModalSize;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  headerBorder?: boolean;
  footerBorder?: boolean;
  headerActions?: ReactNode;
  mobileSheet?: boolean;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const handleClose = () => {
    onClose?.();
    onOpenChange(false);
  };

  const { handleOverlayClick } = useModalEffects({
    open,
    onClose: handleClose,
    closeOnEscape,
    closeOnOverlayClick,
    panelRef
  });

  if (!open) return null;

  return (
    <>
      <ModalOverlay open onClose={closeOnOverlayClick ? handleOverlayClick : undefined} />
      <ModalCenterHost open mobileSheet={mobileSheet}>
        <ModalPanelShell
          panelRef={panelRef}
          title={title}
          titleId={titleId}
          description={description}
          descriptionId={descriptionId}
          footer={footer}
          onClose={handleClose}
          headerBorder={headerBorder}
          footerBorder={footerBorder}
          headerActions={headerActions}
          size={size}
          mobileSheet={mobileSheet}
          className={className}
        >
          {children}
        </ModalPanelShell>
      </ModalCenterHost>
    </>
  );
}

export function AppConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  tone,
  loading,
  onConfirm,
  onCancel,
  onClose,
  consequence,
  icon,
  size = "sm"
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  tone?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  consequence?: string;
  icon?: IconName;
  size?: AppModalSize;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmedRef = useRef(false);

  const resolvedTone: "danger" | "warning" | "primary" = tone ?? (destructive ? "danger" : "primary");
  const resolvedIcon: IconName = icon ?? (resolvedTone === "warning" ? "warning" : "delete");
  const iconAccent = resolvedTone === "warning" ? "warning" : resolvedTone === "danger" ? "danger" : "primary";

  const handleClose = () => {
    if (loading) return;
    onCancel?.();
    onClose?.();
    onOpenChange?.(false);
  };

  const { handleOverlayClick } = useModalEffects({
    open,
    onClose: handleClose,
    closeOnEscape: !loading,
    closeOnOverlayClick: false,
    panelRef
  });

  const handleConfirm = () => {
    if (loading || confirmedRef.current) return;
    confirmedRef.current = true;
    onConfirm();
    window.setTimeout(() => {
      confirmedRef.current = false;
    }, 400);
  };

  if (!open) return null;

  return (
    <>
      <ModalOverlay open onClose={handleOverlayClick} />
      <ModalCenterHost open>
        <ModalPanelShell
          panelRef={panelRef}
          title={title}
          titleId={titleId}
          description={description}
          descriptionId={descriptionId}
          size={size}
          className="pg-app-confirm-dialog"
          footer={
            <div className="pg-app-modal-actions">
              <Button type="button" variant="soft" onClick={handleClose} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={resolvedTone === "danger" ? "danger" : "primary"}
                onClick={handleConfirm}
                loading={loading}
              >
                {confirmLabel}
              </Button>
            </div>
          }
          footerBorder
        >
          <div className="pg-app-confirm-dialog-body">
            <div className={`pg-app-confirm-dialog-icon pg-app-confirm-dialog-icon--${resolvedTone}`}>
              <IconContainer icon={resolvedIcon} accent={iconAccent} size="md" />
            </div>
            <div className="pg-app-confirm-dialog-copy">
              {children}
              {consequence ? <p className="pg-app-confirm-dialog-consequence">{consequence}</p> : null}
            </div>
          </div>
        </ModalPanelShell>
      </ModalCenterHost>
    </>
  );
}

export function AppFormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onSubmit,
  size = "md",
  loading,
  mobileSheet = true,
  closeOnOverlayClick = true,
  onClose
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  size?: AppModalSize;
  loading?: boolean;
  mobileSheet?: boolean;
  closeOnOverlayClick?: boolean;
  onClose?: () => void;
}) {
  const handleClose = () => {
    if (loading) return;
    onClose?.();
    onOpenChange(false);
  };

  const defaultFooter = footer ?? (
    <div className="pg-app-modal-actions">
      <Button type="button" variant="soft" onClick={handleClose} disabled={loading}>
        Cancel
      </Button>
    </div>
  );

  const body = onSubmit ? (
    <form className="pg-app-form-modal-form" onSubmit={onSubmit}>
      <div className="pg-app-form-modal-scroll">{children}</div>
      <div className="pg-app-form-modal-footer">{defaultFooter}</div>
    </form>
  ) : (
    <>
      <div className="pg-app-form-modal-scroll">{children}</div>
      <div className="pg-app-form-modal-footer">{defaultFooter}</div>
    </>
  );

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      mobileSheet={mobileSheet}
      closeOnOverlayClick={closeOnOverlayClick && !loading}
      onClose={onClose}
      className="pg-app-form-modal"
    >
      {body}
    </AppModal>
  );
}

export function AppDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  onClose
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
  onClose?: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);

  const handleClose = () => {
    onClose?.();
    onOpenChange(false);
  };

  useModalEffects({
    open,
    onClose: handleClose,
    closeOnEscape: true,
    closeOnOverlayClick: true,
    panelRef
  });

  if (!open) return null;

  return (
    <>
      <ModalOverlay open onClose={handleClose} />
      <aside
        ref={panelRef}
        className={["pg-app-drawer", side === "left" ? "pg-app-drawer--left" : "pg-app-drawer--right"].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        {(title || description) && (
          <div className="pg-app-drawer-header">
            <div>
              {title ? (
                <h2 id={titleId} className="pg-app-modal-title">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="pg-app-modal-description">
                  {description}
                </p>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} aria-label="Close">
              ✕
            </Button>
          </div>
        )}
        <div className="pg-app-drawer-body">{children}</div>
        {footer ? <div className="pg-app-drawer-footer">{footer}</div> : null}
      </aside>
    </>
  );
}

export function AppSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onClose
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    onClose?.();
    onOpenChange(false);
  };

  useModalEffects({
    open,
    onClose: handleClose,
    closeOnEscape: true,
    closeOnOverlayClick: true,
    panelRef
  });

  if (!open) return null;

  return (
    <>
      <ModalOverlay open onClose={handleClose} />
      <div className="pg-app-sheet-host">
        <div
          ref={panelRef}
          className="pg-app-sheet-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pg-app-sheet-handle" aria-hidden="true" />
          {(title || description) && (
            <div className="pg-app-sheet-header">
              {title ? (
                <h2 id={titleId} className="pg-app-modal-title">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="pg-app-modal-description">
                  {description}
                </p>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={handleClose} aria-label="Close">
                ✕
              </Button>
            </div>
          )}
          <div className="pg-app-sheet-body">{children}</div>
          {footer ? <div className="pg-app-sheet-footer">{footer}</div> : null}
        </div>
      </div>
    </>
  );
}

export function AppPopover({
  open,
  onOpenChange,
  children,
  align = "start",
  className
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  if (!open) return null;

  return (
    <>
      <div className="pg-app-popover-backdrop" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div
        className={[
          "pg-app-popover",
          align === "center" ? "pg-app-popover--center" : "",
          align === "end" ? "pg-app-popover--end" : "",
          className
        ]
          .filter(Boolean)
          .join(" ")}
        role="menu"
      >
        {children}
      </div>
    </>
  );
}

export function AppPopoverItem({
  children,
  destructive,
  onClick,
  className
}: {
  children: ReactNode;
  destructive?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={[
        "pg-app-popover-item",
        destructive ? "pg-app-popover-item--danger" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      role="menuitem"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AppPopoverDivider() {
  return <div className="pg-app-popover-divider" role="separator" />;
}
