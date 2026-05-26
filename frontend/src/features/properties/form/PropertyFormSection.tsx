import type { ReactNode } from "react";

export function PropertyFormSection({
  number,
  title,
  description,
  children,
  id
}: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="pg-prop-section" id={id}>
      <header className="pg-prop-section__head">
        <span className="pg-prop-section__num" aria-hidden="true">
          {number}
        </span>
        <div>
          <h2 className="pg-prop-section__title">{title}</h2>
          {description ? <p className="pg-prop-section__desc">{description}</p> : null}
        </div>
      </header>
      <div className="pg-prop-section__body">{children}</div>
    </section>
  );
}
