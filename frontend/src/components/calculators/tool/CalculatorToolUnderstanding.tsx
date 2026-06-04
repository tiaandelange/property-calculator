import type { CalculatorUnderstandingBlock } from "../../../data/calculatorToolPageMeta";
import { IconContainerByName } from "../../icons";
import type { IconName } from "../../icons/iconRegistry";

const DEFAULT_ICON: IconName = "info";

export function CalculatorToolUnderstanding({ blocks }: { blocks: CalculatorUnderstandingBlock[] }) {
  if (!blocks.length) return null;

  return (
    <section className="pg-calc-tool-understanding" aria-labelledby="calc-tool-understanding-heading">
      <h2 id="calc-tool-understanding-heading" className="pg-calc-tool-understanding__title">
        Understanding Your Results
      </h2>
      <div className="pg-calc-tool-understanding__grid">
        {blocks.map((block) => (
          <article key={block.title} className="pg-calc-tool-understanding__card">
            <IconContainerByName icon={block.icon ?? DEFAULT_ICON} accent="purple" size="sm" className="pg-calc-tool-understanding__icon" />
            <div>
              <h3 className="pg-calc-tool-understanding__card-title">{block.title}</h3>
              <p className="pg-calc-tool-understanding__card-body">{block.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
