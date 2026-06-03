import { useId, useState } from "react";
import { homepageFaq, MARKETING_CTA_JOIN_FREE, MARKETING_CTA_VIEW_PRICING } from "../../../data/homepageMarketingContent";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingSection } from "./HomeMarketingSection";
import { HomeMarketingSectionCta } from "./HomeMarketingSectionCta";

export function HomeMarketingFaqSection() {
  const content = homepageFaq;
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <HomeMarketingSection id="faq" className="hm-section--faq">
      <HomeMarketingConversionHeader
        eyebrow={content.eyebrow}
        title={content.title}
        benefit={content.lead}
      />
      <dl className="hm-faq">
        {content.items.map((item, i) => {
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
      <HomeMarketingSectionCta primary={MARKETING_CTA_JOIN_FREE} secondary={MARKETING_CTA_VIEW_PRICING} />
    </HomeMarketingSection>
  );
}
