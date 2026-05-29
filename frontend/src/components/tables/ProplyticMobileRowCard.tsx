import type { ReactNode } from "react";

export type ProplyticMobileField = {
  label: string;
  value: ReactNode;
};

export function ProplyticMobileRowCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  children,
  className,
  onClick
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  fields?: ProplyticMobileField[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "article";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={["pg-ptable-mobile-card", className].filter(Boolean).join(" ")}
      onClick={onClick}
      style={onClick ? { width: "100%", textAlign: "left", cursor: "pointer" } : undefined}
    >
      <div className="pg-ptable-mobile-card__head">
        <div>
          <div className="pg-ptable-mobile-card__title">{title}</div>
          {subtitle ? <div className="pg-ptable-mobile-card__subtitle">{subtitle}</div> : null}
        </div>
        {badge || actions ? (
          <div className="pg-ptable-mobile-card__head-end">
            {badge}
            {!fields?.length && actions ? (
              <div className="pg-ptable-mobile-card__actions">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </div>
      {fields?.length ? (
        <dl className="pg-ptable-mobile-card__fields">
          {fields.map((f) => (
            <div key={f.label} className="pg-ptable-mobile-card__field">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {fields?.length && actions ? <div className="pg-ptable-mobile-card__actions">{actions}</div> : null}
      {children}
    </Tag>
  );
}

export function ProplyticMobileRowList({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ul className={["pg-ptable-mobile-list", className].filter(Boolean).join(" ")}>{children}</ul>;
}
