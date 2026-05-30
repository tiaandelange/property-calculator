import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "./Button";

export type AppModalSize = "sm" | "md" | "lg" | "xl" | "full-mobile";

export function modalSizeClass(size: AppModalSize = "md"): string {
  if (size === "sm") return "pg-app-modal-panel--sm";
  if (size === "lg") return "pg-app-modal-panel--lg";
  if (size === "xl") return "pg-app-modal-panel--xl";
  if (size === "full-mobile") return "pg-app-modal-panel--full-mobile";
  return "pg-app-modal-panel--md";
}

export function useModalEffects({
  open,
  onClose,
  closeOnEscape = true,
  closeOnOverlayClick = true,
  panelRef
}: {
  open: boolean;
  onClose?: () => void;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus();
      previousFocus.current = null;
    };
  }, [open, panelRef]);

  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  const handleOverlayClick = () => {
    if (closeOnOverlayClick && onClose) onClose();
  };

  return { handleOverlayClick };
}

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
      className={["pg-overlay", "pg-app-modal-overlay", className].filter(Boolean).join(" ")}
      data-open={open ? "true" : "false"}
      onClick={onClose}
      aria-hidden={!open}
    />
  );
}

export function ModalCenterHost({
  open,
  children,
  mobileSheet,
  className
}: {
  open: boolean;
  children: ReactNode;
  mobileSheet?: boolean;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className={[
        "pg-app-modal-host",
        mobileSheet ? "pg-app-modal-host--mobile-sheet" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ pointerEvents: "none" }}
    >
      {children}
    </div>
  );
}

export function ModalPanelShell({
  title,
  titleId,
  description,
  descriptionId,
  children,
  footer,
  onClose,
  headerBorder,
  footerBorder,
  className,
  size = "md",
  mobileSheet,
  panelRef,
  headerActions
}: {
  title?: string;
  titleId: string;
  description?: string;
  descriptionId?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  headerBorder?: boolean;
  footerBorder?: boolean;
  className?: string;
  size?: AppModalSize;
  mobileSheet?: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  headerActions?: ReactNode;
}) {
  const showHeader = Boolean(title || description || onClose || headerActions);

  return (
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={[
        "pg-app-modal-panel",
        modalSizeClass(size),
        mobileSheet ? "pg-app-modal-panel--mobile-sheet" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => event.stopPropagation()}
      style={{ pointerEvents: "auto" }}
    >
      {showHeader ? (
        <div className={["pg-app-modal-header", headerBorder ? "pg-app-modal-header--bordered" : ""].filter(Boolean).join(" ")}>
          <div className="pg-app-modal-header-copy">
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
          <div className="pg-app-modal-header-actions">
            {headerActions}
            {onClose ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
                ✕
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="pg-app-modal-body">{children}</div>
      {footer ? (
        <div className={["pg-app-modal-footer", footerBorder ? "pg-app-modal-footer--bordered" : ""].filter(Boolean).join(" ")}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
