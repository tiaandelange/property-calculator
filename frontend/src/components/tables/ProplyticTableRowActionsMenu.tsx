import { useEffect, useId, useRef, useState } from "react";
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

export function ProplyticTableRowActionsMenu({ actions }: { actions: ProplyticTableRowAction[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const primary = pickPrimaryAction(actions);
  const overflow = primary ? actions.filter((action) => action.key !== primary.key) : [];

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  if (!primary) return null;

  if (!overflow.length) {
    return (
      <ProplyticTableActions>
        <IconButton
          icon={primary.icon}
          aria-label={primary.label}
          href={primary.href}
          variant={primary.destructive ? "danger-outline" : "outline"}
          disabled={primary.disabled}
          onClick={primary.onClick}
        />
      </ProplyticTableActions>
    );
  }

  return (
    <ProplyticTableActions>
      <IconButton
        icon={primary.icon}
        aria-label={primary.label}
        href={primary.href}
        variant={primary.destructive ? "danger-outline" : "outline"}
        disabled={primary.disabled}
        onClick={primary.onClick}
      />
      <div className="pg-ptable-row-actions-menu" ref={menuRef}>
        <IconButton
          icon="more"
          aria-label="More actions"
          aria-expanded={open}
          aria-controls={menuId}
          variant="outline"
          onClick={() => setOpen((value) => !value)}
        />
        {open ? (
          <div className="pg-ptable-row-actions-menu__panel" id={menuId} role="menu">
            {overflow.map((action) => (
              <MenuItem key={action.key} action={action} onSelect={() => setOpen(false)} />
            ))}
          </div>
        ) : null}
      </div>
    </ProplyticTableActions>
  );
}
