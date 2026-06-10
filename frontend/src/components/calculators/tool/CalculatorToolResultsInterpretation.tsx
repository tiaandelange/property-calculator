type CalculatorToolResultsInterpretationProps = {
  text: string;
  warnings?: string[];
  showNegativeFundingNote?: boolean;
  /** Optional educational copy below the primary interpretation (e.g. IRR declining by year). */
  supplementaryText?: string;
};

export function CalculatorToolResultsInterpretation({
  text,
  warnings = [],
  showNegativeFundingNote,
  supplementaryText
}: CalculatorToolResultsInterpretationProps) {
  if (!text && !warnings.length && !showNegativeFundingNote && !supplementaryText) return null;

  return (
    <section className="pg-calc-tool-results-section pg-calc-tool-results-section--interpretation">
      <h3 className="pg-calc-tool-results-section__title">Interpretation</h3>
      <div className="pg-calc-tool-interpretation">
        {text ? <p className="pg-calc-tool-interpretation__text">{text}</p> : null}
        {supplementaryText ? (
          <p className="pg-calc-tool-interpretation__supplementary">{supplementaryText}</p>
        ) : null}
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
