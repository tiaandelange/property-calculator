import { Search } from "lucide-react";
import React from "react";

export function Field({
  label,
  help,
  children
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pg-field">
      <div>
        <div className="pg-label">{label}</div>
        {help ? <div className="pg-help">{help}</div> : null}
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
