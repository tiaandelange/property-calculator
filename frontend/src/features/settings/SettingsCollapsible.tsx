import { useId, useState, type ReactNode } from "react";
import { AppIcon } from "../../components/icons";

type SettingsCollapsibleProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function SettingsCollapsible({
  title,
  summary,
  defaultOpen = false,
  children
}: SettingsCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={`pg-settings-collapsible${open ? " pg-settings-collapsible--open" : ""}`}>
      <button
        type="button"
        className="pg-settings-collapsible__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pg-settings-collapsible__title">{title}</span>
        {summary ? <span className="pg-settings-collapsible__summary">{summary}</span> : null}
        <AppIcon
          name="chevronDown"
          size="sm"
          className="pg-settings-collapsible__chevron"
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="pg-settings-collapsible__panel">
          {children}
        </div>
      ) : null}
    </div>
  );
}
