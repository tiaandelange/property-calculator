import type { ReactNode } from "react";

export type SettingsRowProps = {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  danger?: boolean;
  htmlFor?: string;
};

export function SettingsRow({
  label,
  description,
  children,
  className,
  danger,
  htmlFor
}: SettingsRowProps) {
  const labelProps = htmlFor ? { htmlFor } : {};
  const LabelTag = htmlFor ? "label" : "div";

  return (
    <div
      className={[
        "pg-settings-panel-row",
        danger ? "pg-settings-panel-row--danger" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <LabelTag className="pg-settings-panel-row__label" {...labelProps}>
        <span className="pg-settings-panel-row__title">{label}</span>
        {description ? <span className="pg-settings-panel-row__desc">{description}</span> : null}
      </LabelTag>
      <div className="pg-settings-panel-row__control">{children}</div>
    </div>
  );
}
