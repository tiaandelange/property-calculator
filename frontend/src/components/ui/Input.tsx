import { Search } from "lucide-react";
import React from "react";
import { FieldInfoTip } from "./FieldInfoTip";
import { typographyClassName } from "./Typography";

export function Field({
  label,
  help,
  fieldId,
  children
}: {
  label: string;
  help?: string;
  /** When set, associates the label with the control via htmlFor/id. */
  fieldId?: string;
  children: React.ReactNode;
}) {
  const LabelTag = fieldId ? "label" : "div";
  return (
    <div className="pg-field">
      <div className="pg-field__label-row">
        <LabelTag
          {...(fieldId ? { htmlFor: fieldId } : {})}
          className={typographyClassName("label", "pg-label")}
        >
          {label}
        </LabelTag>
        <FieldInfoTip label={label} text={help} />
      </div>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="pg-input" {...props} />;
}

/** Search field with leading icon — 44px min height (40px on mobile). */
export function SearchInput({
  className,
  wrapperClassName,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }) {
  return (
    <div className={["pg-search-field", wrapperClassName].filter(Boolean).join(" ")}>
      <Search className="pg-search-field__icon" size={18} strokeWidth={2} aria-hidden />
      <input type="search" className={["pg-input", "pg-search-field__input", className].filter(Boolean).join(" ")} {...props} />
    </div>
  );
}

export { Select } from "./Select";
