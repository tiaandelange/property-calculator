import { createServiceRoleSupabase } from "../supabaseServiceRole.js";

const PLAN_STORAGE_LIMIT_BYTES: Record<string, number> = {
  starter: 100 * 1024 * 1024,
  investor: 500 * 1024 * 1024,
  portfolio: 2 * 1024 * 1024 * 1024,
  portfolio_pro: 10 * 1024 * 1024 * 1024
};

function storageLimitBytesForPlan(planCode: string | null | undefined): number {
  const code = String(planCode ?? "starter").trim().toLowerCase();
  return PLAN_STORAGE_LIMIT_BYTES[code] ?? PLAN_STORAGE_LIMIT_BYTES.starter;
}

const USER_BUCKETS: Array<{ bucket: string; prefix: (userId: string) => string }> = [
  { bucket: "avatars", prefix: (uid) => uid },
  { bucket: "property-documents", prefix: (uid) => uid },
  { bucket: "tenant-documents", prefix: (uid) => uid },
  { bucket: "invoices", prefix: (uid) => uid },
  { bucket: "reports", prefix: (uid) => uid }
];

async function listFolderBytes(
  sb: NonNullable<ReturnType<typeof createServiceRoleSupabase>>,
  bucket: string,
  path: string
): Promise<number> {
  let total = 0;
  let offset = 0;
  const limit = 100;

  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(path, { limit, offset });
    if (error || !data?.length) break;

    for (const item of data) {
      const size = item.metadata && typeof item.metadata.size === "number" ? item.metadata.size : 0;
      if (size > 0) {
        total += size;
        continue;
      }
      // Subfolder — Supabase folders have null id
      if (item.id == null && item.name) {
        const childPath = path ? `${path}/${item.name}` : item.name;
        total += await listFolderBytes(sb, bucket, childPath);
      }
    }

    if (data.length < limit) break;
    offset += data.length;
  }

  return total;
}

export type StorageUsageResult = {
  usedBytes: number;
  limitBytes: number;
  percentage: number;
  planCode: string;
};

export async function getStorageUsageForUser(userId: string): Promise<StorageUsageResult> {
  const sb = createServiceRoleSupabase();
  if (!sb) {
    throw new Error("Storage service is not configured.");
  }

  let usedBytes = 0;
  for (const entry of USER_BUCKETS) {
    usedBytes += await listFolderBytes(sb, entry.bucket, entry.prefix(userId));
  }

  const { data: sub } = await sb
    .from("user_subscriptions")
    .select("plan_code, status")
    .eq("user_id", userId)
    .maybeSingle();

  const planCode =
    sub?.status === "active" || sub?.status === "trialing" ? String(sub.plan_code ?? "starter") : "starter";
  const limitBytes = storageLimitBytesForPlan(planCode);
  const percentage = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;

  return { usedBytes, limitBytes, percentage, planCode };
}
