import type { ReactNode } from "react";
import type { IconName } from "../../components/icons/iconRegistry";
import { LoginAffixInput } from "./LoginAffixInput";

export function LoginIconField({
  label,
  labelExtra,
  icon,
  type = "text",
  autoComplete,
  placeholder,
  value,
  onChange,
  required
}: {
  label: string;
  labelExtra?: ReactNode;
  icon: IconName;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="pg-login-field">
      <div className="pg-login-field__label-row">
        <label className="pg-login-field__label">{label}</label>
        {labelExtra}
      </div>
      <LoginAffixInput
        icon={icon}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
