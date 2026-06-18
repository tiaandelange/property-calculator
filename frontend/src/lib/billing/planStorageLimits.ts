/** Storage quota bytes per subscription plan (settings display). */
export const PLAN_STORAGE_LIMIT_BYTES: Record<string, number> = {
  starter: 100 * 1024 * 1024,
  investor: 500 * 1024 * 1024,
  portfolio: 2 * 1024 * 1024 * 1024,
  portfolio_pro: 10 * 1024 * 1024 * 1024
};

export function storageLimitBytesForPlan(planCode: string | null | undefined): number {
  const code = String(planCode ?? "starter").trim().toLowerCase();
  return PLAN_STORAGE_LIMIT_BYTES[code] ?? PLAN_STORAGE_LIMIT_BYTES.starter;
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
