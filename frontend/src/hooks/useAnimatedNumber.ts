import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function useAnimatedNumber(
  target: number,
  options?: {
    durationMs?: number;
    enabled?: boolean;
    decimals?: number;
  }
): number {
  const { durationMs = 1800, enabled = true, decimals = 0 } = options ?? {};
  const [value, setValue] = useState(enabled ? 0 : target);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
    startRef.current = null;
    setValue(0);

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const next = target * easeOutCubic(progress);
      const factor = 10 ** decimals;
      setValue(Math.round(next * factor) / factor);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs, enabled, decimals]);

  return value;
}
