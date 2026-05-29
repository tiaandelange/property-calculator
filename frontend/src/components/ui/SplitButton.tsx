import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AppIcon } from "../icons/AppIcon";
import type { IconName } from "../icons/iconRegistry";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./buttonStyles";

export type SplitButtonMenuItem = {
  label: string;
  icon?: IconName;
  onClick: () => void;
  /** Style destructive actions with danger colour. */
  danger?: boolean;
  disabled?: boolean;
};

type SplitButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  mainLabel: string;
  mainIcon?: IconName;
  onMainClick: () => void;
  menuItems: SplitButtonMenuItem[];
  /** Use 44px height on mobile for primary actions. */
  mobileLarge?: boolean;
  mainAriaLabel?: string;
};

export function SplitButton({
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  disabled,
  mainLabel,
  mainIcon,
  onMainClick,
  menuItems,
  mobileLarge = true,
  mainAriaLabel
}: SplitButtonProps) {
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    if (open && focusIndex >= 0) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const baseClass = buttonClassName({ variant, size, loading, className: undefined });
  const splitVariantClass =
    variant === "secondary" ? "pg-split-btn--secondary" : `pg-split-btn--${variant.replace("danger-outline", "outline")}`;

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      const firstEnabled = menuItems.findIndex((item) => !item.disabled);
      setFocusIndex(firstEnabled >= 0 ? firstEnabled : 0);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const enabledIndices = menuItems.map((item, i) => (!item.disabled ? i : -1)).filter((i) => i >= 0);
    if (!enabledIndices.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const current = focusIndex >= 0 ? enabledIndices.indexOf(focusIndex) : -1;
      const next = enabledIndices[(current + 1) % enabledIndices.length];
      setFocusIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const current = focusIndex >= 0 ? enabledIndices.indexOf(focusIndex) : 0;
      const prev = enabledIndices[(current - 1 + enabledIndices.length) % enabledIndices.length];
      setFocusIndex(prev);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIndex(enabledIndices[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIndex(enabledIndices[enabledIndices.length - 1]);
    }
  };

  const iconSize = size === "xs" || size === "sm" ? "sm" : "md";

  return (
    <div
      ref={wrapRef}
      className={[
        "pg-split-btn",
        splitVariantClass,
        fullWidth ? "pg-split-btn--full" : null,
        mobileLarge ? "pg-split-btn--mobile-lg" : null
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={[baseClass, "pg-split-btn__main"].join(" ")}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-label={mainAriaLabel ?? mainLabel}
        onClick={() => {
          if (disabled || loading) return;
          onMainClick();
        }}
      >
        {loading ? <span className="pg-spinner" aria-hidden="true" /> : null}
        {!loading && mainIcon ? (
          <AppIcon name={mainIcon} size={iconSize} className="pg-btn__icon" aria-hidden="true" />
        ) : null}
        <span className="pg-btn__label">{mainLabel}</span>
      </button>
      <button
        ref={triggerRef}
        type="button"
        className={[baseClass, "pg-split-btn__trigger"].join(" ")}
        disabled={disabled || loading || menuItems.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${mainLabel} — more options`}
        onClick={() => {
          if (disabled || loading) return;
          setOpen((o) => !o);
          if (!open) {
            const firstEnabled = menuItems.findIndex((item) => !item.disabled);
            setFocusIndex(firstEnabled >= 0 ? firstEnabled : 0);
          }
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <AppIcon name="chevronDown" size={iconSize} aria-hidden="true" />
      </button>
      {open && menuItems.length > 0 ? (
        <ul
          id={menuId}
          className="pg-split-btn__menu"
          role="menu"
          aria-label={`${mainLabel} options`}
          onKeyDown={onMenuKeyDown}
        >
          {menuItems.map((item, idx) => (
            <li key={item.label} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                role="menuitem"
                className={[
                  "pg-split-btn__menu-item",
                  item.danger ? "pg-split-btn__menu-item--danger" : null
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={item.disabled}
                tabIndex={focusIndex === idx ? 0 : -1}
                onClick={() => {
                  closeMenu();
                  item.onClick();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    closeMenu();
                    item.onClick();
                  }
                }}
              >
                {item.icon ? <AppIcon name={item.icon} size="sm" aria-hidden="true" /> : null}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
