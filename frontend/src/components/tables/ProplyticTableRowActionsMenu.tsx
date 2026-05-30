import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AppIcon } from "../icons";
import type { IconName } from "../icons/iconRegistry";
import { IconButton } from "../icons/IconButton";
import { ProplyticTableActions } from "./ProplyticTable";

export type ProplyticTableRowAction = {
  key: string;
  label: string;
  icon: IconName;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  primary?: boolean;
};

function pickPrimaryAction(actions: ProplyticTableRowAction[]): ProplyticTableRowAction | null {
  if (!actions.length) return null;
  return (
    actions.find((action) => action.primary) ??
    actions.find((action) => action.icon === "edit") ??
    actions[0]
  );
}

function ActionIconButton({ action }: { action: ProplyticTableRowAction }) {
  return (
    <IconButton
      icon={action.icon}
      aria-label={action.label}
      href={action.href}
      variant={action.destructive ? "danger-outline" : "outline"}
      disabled={action.disabled}
      onClick={action.onClick}
    />
  );
}

function MenuItem({ action, onSelect }: { action: ProplyticTableRowAction; onSelect: () => void }) {
  const className = [
    "pg-ptable-row-actions-menu__item",
    action.destructive ? "pg-ptable-row-actions-menu__item--danger" : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (action.href && !action.disabled) {
    return (
      <Link to={action.href} className={className} role="menuitem" onClick={onSelect}>
        <AppIcon name={action.icon} size="sm" strokeWidth={2} aria-hidden />
        <span>{action.label}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      role="menuitem"
      disabled={action.disabled}
      onClick={() => {
        action.onClick?.();
        onSelect();
      }}
    >
      <AppIcon name={action.icon} size="sm" strokeWidth={2} aria-hidden />
      <span>{action.label}</span>
    </button>
  );
}

function useOverflowMenuPosition(open: boolean, triggerRef: React.RefObject<HTMLDivElement | null>) {
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.right,
        transform: "translateX(-100%)"
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, triggerRef]);

  return panelStyle;
}

export function ProplyticTableRowActionsMenu({ actions }: { actions: ProplyticTableRowAction[] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const panelStyle = useOverflowMenuPosition(open, triggerRef);

  const primary = pickPrimaryAction(actions);
  const overflow =
    primary && actions.length >= 3 ? actions.filter((action) => action.key !== primary.key) : [];

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!actions.length) return null;

  if (actions.length === 1) {
    return (
      <ProplyticTableActions>
        <ActionIconButton action={actions[0]} />
      </ProplyticTableActions>
    );
  }

  if (actions.length === 2) {
    return (
      <ProplyticTableActions>
        {actions.map((action) => (
          <ActionIconButton key={action.key} action={action} />
        ))}
      </ProplyticTableActions>
    );
  }

  if (!primary || !overflow.length) return null;

  return (
    <ProplyticTableActions>
      <ActionIconButton action={primary} />
      <div className="pg-ptable-row-actions-menu" ref={triggerRef}>
        <IconButton
          icon="more"
          aria-label="More actions"
          aria-expanded={open}
          aria-controls={menuId}
          variant="outline"
          onClick={() => setOpen((value) => !value)}
        />
        {open
          ? createPortal(
              <div
                ref={panelRef}
                className="pg-ptable-row-actions-menu__panel pg-ptable-row-actions-menu__panel--portal"
                id={menuId}
                role="menu"
                style={panelStyle}
              >
                {overflow.map((action) => (
                  <MenuItem key={action.key} action={action} onSelect={() => setOpen(false)} />
                ))}
              </div>,
              document.body
            )
          : null}
      </div>
    </ProplyticTableActions>
  );
}
