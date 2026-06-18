import type { InputHTMLAttributes } from "react";

type SettingsFieldInputProps = InputHTMLAttributes<HTMLInputElement> & {
  narrow?: boolean;
};

export function SettingsFieldInput({ className, narrow, ...props }: SettingsFieldInputProps) {
  return (
    <input
      className={[
        "pg-input",
        "pg-settings-control",
        narrow ? "pg-settings-control--narrow" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
