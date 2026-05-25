import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

const MOBILE_CALC_QUERY = "(max-width: 768px)";

/** On narrow viewports, after Calculate, show results over inputs until the user edits again. */
export function useCalculatorMobileResults(slug: string | undefined) {
  const isMobile = useMediaQuery(MOBILE_CALC_QUERY);
  const [focusResults, setFocusResults] = useState(false);

  useEffect(() => {
    setFocusResults(false);
  }, [slug]);

  useEffect(() => {
    if (!isMobile) setFocusResults(false);
  }, [isMobile]);

  const onCalculateSuccess = useCallback(() => {
    if (isMobile) setFocusResults(true);
  }, [isMobile]);

  const showInputs = useCallback(() => {
    setFocusResults(false);
    window.requestAnimationFrame(() => {
      document.getElementById("calculator-inputs-pane")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return {
    isMobile,
    focusResults: isMobile && focusResults,
    onCalculateSuccess,
    showInputs
  };
}
