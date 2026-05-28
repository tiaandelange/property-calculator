import type { ReactNode } from "react";

export function PropertyFormField({
  label,
  required,
  help,
  info,
  children,
  className
}: {
  label: string;
  required?: boolean;
  help?: string;
  info?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["pg-prop-field", className].filter(Boolean).join(" ")}>
      <div className="pg-prop-field__head">
        <div className="pg-prop-field__label-row">
          <span className="pg-prop-field__label">
            {label}
            {required ? (
              <span className="pg-prop-field__required" aria-hidden="true">
                {" "}
                *
              </span>
            ) : null}
          </span>
          {info ? (
            <span className="pg-prop-field__info-wrap" tabIndex={0} role="note" aria-label={`${label} info`}>
              <span className="pg-prop-field__info-icon" aria-hidden="true">
                i
              </span>
              <span className="pg-prop-field__info-tooltip">{info}</span>
            </span>
          ) : null}
        </div>
        {help ? <span className="pg-prop-field__help">{help}</span> : null}
      </div>
      <div className="pg-prop-field__control">{children}</div>
    </div>
  );
}
