import type { InputHTMLAttributes } from "react";
import { AppIcon } from "../../components/icons/AppIcon";
import type { IconName } from "../../components/icons/iconRegistry";

/** Themed login/signup input with leading icon (matches pg-search-field pattern). */
export function LoginAffixInput({
  icon,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  icon: IconName;
}) {
  return (
    <div className="pg-login-affix-field">
      <AppIcon name={icon} size="md" className="pg-login-affix-field__icon" aria-hidden="true" />
      <input
        className={["pg-input", "pg-login-affix-field__input", className].filter(Boolean).join(" ")}
        {...props}
      />
    </div>
  );
}
