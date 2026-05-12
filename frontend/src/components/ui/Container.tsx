import React from "react";

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={["pg-container", className].filter(Boolean).join(" ")}>{children}</div>;
}
