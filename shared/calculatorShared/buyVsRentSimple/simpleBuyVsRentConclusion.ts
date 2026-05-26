import type { SimpleBuyVsRentSummary, SimpleBuyVsRentVerdict } from "./simpleBuyVsRentTypes.js";

export function generateSimpleBuyVsRentConclusion(
  summary: SimpleBuyVsRentSummary,
  _inputs?: { analysisYears: number }
): string {
  const verdict: SimpleBuyVsRentVerdict = summary.verdict;

  if (verdict === "buy") {
    return (
      "Buying looks stronger over this period. Based on your inputs, the property builds enough estimated equity to beat the renting-and-investing option. " +
      "This usually makes more sense if you plan to stay long enough, can afford the monthly ownership costs and are comfortable with maintenance and property risk."
    );
  }

  if (verdict === "rent") {
    return (
      "Renting looks stronger over this period. Based on your inputs, renting leaves more money available to invest and avoids the upfront and ongoing costs of ownership. " +
      "Buying may still make sense if you expect stronger property growth, negotiate a lower purchase price or plan to stay longer."
    );
  }

  return (
    "The result is very close. In this case, the decision is less about pure numbers and more about lifestyle, stability, flexibility, location certainty and risk tolerance."
  );
}
