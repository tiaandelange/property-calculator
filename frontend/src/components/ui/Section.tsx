import React from "react";

export function Section({
  children,
  className,
  id
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`pg-section ${className ?? ""}`.trim()}>
      {children}
    </section>
  );
}

