/** Scroll to a hash target after lazy routes/sections mount (public marketing pages). */
export function scrollToMarketingHash(hash: string): boolean {
  const id = hash.replace(/^#/, "").trim();
  if (!id) return true;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

export function scheduleMarketingHashScroll(
  hash: string,
  opts?: { maxAttempts?: number; intervalMs?: number }
): () => void {
  const maxAttempts = opts?.maxAttempts ?? 24;
  const intervalMs = opts?.intervalMs ?? 50;
  let cancelled = false;
  let attempts = 0;

  const tick = () => {
    if (cancelled) return;
    if (scrollToMarketingHash(hash) || attempts >= maxAttempts) return;
    attempts += 1;
    window.setTimeout(tick, intervalMs);
  };

  tick();
  return () => {
    cancelled = true;
  };
}
