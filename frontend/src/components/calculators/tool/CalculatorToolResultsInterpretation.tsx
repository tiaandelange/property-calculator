type CalculatorToolResultsInterpretationProps = {
  text: string;
  warnings?: string[];
  showNegativeFundingNote?: boolean;
};

export function CalculatorToolResultsInterpretation({
  text,
  warnings = [],
  showNegativeFundingNote
}: CalculatorToolResultsInterpretationProps) {
  if (!text && !warnings.length && !showNegativeFundingNote) return null;

  return (
    <section className="pg-calc-tool-results-section pg-calc-tool-results-section--interpretation">
      <h3 className="pg-calc-tool-results-section__title">Interpretation</h3>
      <div className="pg-calc-tool-interpretation">
        {text ? <p className="pg-calc-tool-interpretation__text">{text}</p> : null}
        {showNegativeFundingNote ? (
          <p className="pg-calc-tool-interpretation__warn">
            This means the property may require monthly owner funding unless rent, expenses or financing terms improve.
          </p>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="pg-calc-tool-interpretation__warnings">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
