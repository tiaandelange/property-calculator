import type { SelectHTMLAttributes } from "react";
import { Select } from "../../../components/ui/Input";

type SettingsFieldSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function SettingsFieldSelect({ className, children, ...props }: SettingsFieldSelectProps) {
  return (
    <Select className={["pg-settings-control", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Select>
  );
}
