import { useId, useState, type ReactNode } from "react";
import { AppIcon } from "../../../components/icons";

export type SettingsAccordionProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Collapsible settings group — same card chrome as SettingsCard. */
export function SettingsAccordion({
  title,
  summary,
  defaultOpen = false,
  children
}: SettingsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={[
        "pg-settings-card",
        "pg-settings-accordion",
        open ? "pg-settings-accordion--open" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="pg-settings-accordion__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pg-settings-accordion__title">{title}</span>
        {summary ? <span className="pg-settings-accordion__summary">{summary}</span> : null}
        <AppIcon name="chevronDown" size="sm" className="pg-settings-accordion__chevron" aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="pg-settings-accordion__panel">
          {children}
        </div>
      ) : null}
    </div>
  );
}
