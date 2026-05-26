import React from "react";

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={["pg-select", "pg-input", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </select>
  );
}
