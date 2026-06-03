import type { ReactNode } from "react";
import type { IconName } from "../../components/icons/iconRegistry";
import { AppIcon } from "../../components/icons/AppIcon";

export function LoginIconField({
  label,
  labelExtra,
  icon,
  children
}: {
  label: string;
  labelExtra?: ReactNode;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <div className="pg-login-field">
      <div className="pg-login-field__label-row">
        <label className="pg-login-field__label">{label}</label>
        {labelExtra}
      </div>
      <div className="pg-login-field__control">
        <AppIcon name={icon} size="sm" className="pg-login-field__icon" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
