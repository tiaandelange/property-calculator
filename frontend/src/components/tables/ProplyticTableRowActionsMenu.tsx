import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AppIcon } from "../icons";
import type { IconName } from "../icons/iconRegistry";
import { IconButton } from "../icons/IconButton";
import { ProplyticTableActions } from "./ProplyticTable";

export type ProplyticTableRowAction = {
  key: string;
  label: string;
  /** Visible text in the overflow menu; defaults to `label`. */
  menuLabel?: string;
  icon: IconName;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  primary?: boolean;
};

function pickEditDirectAction(actions: ProplyticTableRowAction[]): ProplyticTableRowAction | null {
  return (
    actions.find((action) => action.key === "edit" || action.icon === "edit") ??
    actions.find((action) => action.primary && !action.destructive) ??
    actions.find((action) => !action.destructive) ??
    actions[0] ??
    null
  );
}

function splitRowActions(actions: ProplyticTableRowAction[], compactActions?: boolean) {
  if (actions.length <= 2) {
    return { direct: actions, overflow: [] as ProplyticTableRowAction[] };
  }

  if (compactActions) {
    const primary = pickEditDirectAction(actions);
    if (!primary) return { direct: [], overflow: actions };
    return {
      direct: [primary],
      overflow: actions.filter((action) => action.key !== primary.key)
    };
  }

  const editAction = pickEditDirectAction(actions);
  if (!editAction) {
    return { direct: actions.slice(0, 1), overflow: actions.slice(1) };
  }

  return {
    direct: [editAction],
    overflow: actions.filter((action) => action.key !== editAction.key)
  };
}

function actionsLayoutClass(directCount: number, hasOverflow: boolean) {
  if (!hasOverflow) return `pg-ptable-actions--count-${directCount}`;
  return "pg-ptable-actions--count-edit-menu";
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
        <span>{action.menuLabel ?? action.label}</span>
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
      <span>{action.menuLabel ?? action.label}</span>
    </button>
  );
}

function useOverflowMenuPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLDivElement | null>,
  panelRef: React.RefObject<HTMLDivElement | null>
) {
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const rect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const panelWidth = panelRect.width || 180;
      const panelHeight = panelRect.height || 160;
      const margin = 8;

      let top = rect.bottom + 6;
      if (top + panelHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - panelHeight - 6);
      }

      let left = rect.right;
      let transform = "translateX(-100%)";

      if (rect.right - panelWidth < margin) {
        left = rect.left;
        transform = "none";
      } else if (rect.right > window.innerWidth - margin) {
        left = rect.right;
        transform = "translateX(-100%)";
      }

      setPanelStyle({
        position: "fixed",
        top,
        left,
        transform,
        zIndex: 200
      });
    };

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, triggerRef, panelRef]);

  return panelStyle;
}

export function ProplyticTableRowActionsMenu({
  actions,
  compactActions
}: {
  actions: ProplyticTableRowAction[];
  compactActions?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const panelStyle = useOverflowMenuPosition(open, triggerRef, panelRef);

  const { direct, overflow } = splitRowActions(actions, compactActions);
  const layoutClass = actionsLayoutClass(direct.length, overflow.length > 0);

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

  if (!overflow.length) {
    return (
      <ProplyticTableActions className={layoutClass}>
        {direct.map((action) => (
          <ActionIconButton key={action.key} action={action} />
        ))}
      </ProplyticTableActions>
    );
  }

  return (
    <ProplyticTableActions className={layoutClass}>
      {direct.map((action) => (
        <ActionIconButton key={action.key} action={action} />
      ))}
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
