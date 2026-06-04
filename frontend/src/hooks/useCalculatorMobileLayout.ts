import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

const MOBILE_CALC_QUERY = "(max-width: 768px)";

/**
 * Mobile calculator UX: collapsible inputs after calculate, sticky actions, scroll-to-inputs.
 */
export function useCalculatorMobileLayout(slug: string | undefined) {
  const isMobile = useMediaQuery(MOBILE_CALC_QUERY);
  const [inputsExpanded, setInputsExpanded] = useState(true);

  useEffect(() => {
    setInputsExpanded(true);
  }, [slug]);

  useEffect(() => {
    if (!isMobile) setInputsExpanded(true);
  }, [isMobile]);

  const onCalculateSuccess = useCallback(() => {
    if (isMobile) setInputsExpanded(false);
  }, [isMobile]);

  const openInputs = useCallback(() => {
    setInputsExpanded(true);
    window.requestAnimationFrame(() => {
      document.getElementById("calculator-inputs-pane")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return {
    isMobile,
    inputsExpanded,
    setInputsExpanded,
    onCalculateSuccess,
    openInputs,
    showStickyActions: isMobile
  };
}
