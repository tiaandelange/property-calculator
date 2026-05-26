import React from "react";

export function Card({
  title,
  children,
  pad = true,
  elevated = false,
  className
}: {
  title?: string;
  children: React.ReactNode;
  pad?: boolean;
  elevated?: boolean;
  className?: string;
}) {
  const cardClass = ["pg-card", elevated ? "pg-card--elevated" : "", className].filter(Boolean).join(" ");
  return (
    <div className={cardClass}>
      <div className={pad ? "pg-card-pad" : ""}>
        {title ? <div className="pg-card-title">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}
