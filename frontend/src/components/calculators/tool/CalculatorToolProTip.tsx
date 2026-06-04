import { Lightbulb } from "lucide-react";

export function CalculatorToolProTip({ text }: { text: string }) {
  return (
    <aside className="pg-calc-tool-protip" aria-label="Pro tip">
      <div className="pg-calc-tool-protip__icon-wrap" aria-hidden>
        <Lightbulb size={18} strokeWidth={2} />
      </div>
      <div>
        <p className="pg-calc-tool-protip__label">Pro Tip</p>
        <p className="pg-calc-tool-protip__text">{text}</p>
      </div>
    </aside>
  );
}
