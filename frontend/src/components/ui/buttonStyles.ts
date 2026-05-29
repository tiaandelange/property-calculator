export type ButtonVariant =
  | "primary"
  | "soft"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-outline";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "pg-btn-primary",
  soft: "pg-btn-soft",
  secondary: "pg-btn-soft",
  outline: "pg-btn-outline",
  ghost: "pg-btn-ghost",
  danger: "pg-btn-danger",
  "danger-outline": "pg-btn-danger-outline"
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
}): string {
  return [
    "pg-btn",
    VARIANT_CLASS[variant],
    `pg-btn--${size}`,
    fullWidth ? "pg-btn--full" : null,
    loading ? "pg-btn--loading" : null,
    className
  ]
    .filter(Boolean)
    .join(" ");
}
