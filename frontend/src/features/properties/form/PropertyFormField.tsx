import type { ReactNode } from "react";
import { FieldInfoTip } from "../../../components/ui/FieldInfoTip";

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
  /** Shown in the info icon tooltip (preferred over `help`). */
  info?: string;
  children: ReactNode;
  className?: string;
}) {
  const tip = (info ?? help)?.trim();

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
          <FieldInfoTip label={label} text={tip} />
        </div>
      </div>
      <div className="pg-prop-field__control">{children}</div>
    </div>
  );
}
