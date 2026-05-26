import type { ReactNode } from "react";

export function PropertyFormField({
  label,
  required,
  help,
  children,
  className
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["pg-prop-field", className].filter(Boolean).join(" ")}>
      <div className="pg-prop-field__head">
        <span className="pg-prop-field__label">
          {label}
          {required ? (
            <span className="pg-prop-field__required" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </span>
        {help ? <span className="pg-prop-field__help">{help}</span> : null}
      </div>
      <div className="pg-prop-field__control">{children}</div>
    </div>
  );
}
