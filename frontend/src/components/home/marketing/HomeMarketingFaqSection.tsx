import { useId, useState } from "react";
import { homepageFaq } from "../../../data/homepageMarketingContent";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

export function HomeMarketingFaqSection() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <HomeMarketingSection id="faq" className="hm-section--faq">
      <HomeMarketingSectionHeader title="Frequently asked questions" align="center" />
      <dl className="hm-faq">
        {homepageFaq.map((item, i) => {
          const open = openIndex === i;
          const qId = `${baseId}-q-${i}`;
          const aId = `${baseId}-a-${i}`;
          return (
            <div key={item.q} className={`hm-faq__item${open ? " hm-faq__item--open" : ""}`}>
              <dt>
                <button
                  type="button"
                  className="hm-faq__question"
                  id={qId}
                  aria-expanded={open}
                  aria-controls={aId}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span className="hm-faq__question-text">{item.q}</span>
                  <span className="hm-faq__chevron" aria-hidden />
                </button>
              </dt>
              <dd id={aId} role="region" aria-labelledby={qId} hidden={!open}>
                {item.a}
              </dd>
            </div>
          );
        })}
      </dl>
    </HomeMarketingSection>
  );
}
