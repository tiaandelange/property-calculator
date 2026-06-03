import { useId, useState } from "react";
import { pricingFaq } from "../../data/pricingPageContent";

export function PricingFaqSection() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="pg-pricing-faq" aria-labelledby="pricing-faq-heading">
      <h2 id="pricing-faq-heading" className="pg-pricing-section-title">
        Frequently asked questions
      </h2>
      <dl className="pg-pricing-faq__list">
        {pricingFaq.map((item, i) => {
          const open = openIndex === i;
          const qId = `${baseId}-q-${i}`;
          const aId = `${baseId}-a-${i}`;
          return (
            <div key={item.q} className={`pg-pricing-faq__item${open ? " pg-pricing-faq__item--open" : ""}`}>
              <dt>
                <button
                  type="button"
                  className="pg-pricing-faq__question"
                  id={qId}
                  aria-expanded={open}
                  aria-controls={aId}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span className="pg-pricing-faq__question-text">{item.q}</span>
                  <span className="pg-pricing-faq__chevron" aria-hidden />
                </button>
              </dt>
              <dd id={aId} role="region" aria-labelledby={qId} hidden={!open}>
                {item.a}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
