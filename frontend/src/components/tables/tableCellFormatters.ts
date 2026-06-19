import { formatDateShort } from "../../features/tenants/tenantDirectoryUtils";

/** Deduplicate comma-separated address parts and shorten for table cells. */
export function dedupeAddressParts(address: string | null | undefined): string[] {
  const parts = (address ?? "")
    .split(/[,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const deduped: string[] = [];
  for (const part of parts) {
    const prev = deduped[deduped.length - 1];
    if (prev?.toLowerCase() === part.toLowerCase()) continue;
    deduped.push(part);
  }
  return deduped;
}

export function formatTablePropertyAddress(
  name: string | null | undefined,
  address: string | null | undefined
): { primary: string; secondary: string; fullTitle: string } {
  const primary = name?.trim() || "—";
  const parts = dedupeAddressParts(address);

  let secondary = "";
  if (parts.length >= 2) {
    secondary = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  } else if (parts.length === 1) {
    secondary = parts[0]!;
  }

  const fullTitle = [primary, ...parts].filter(Boolean).join("\n");
  return { primary, secondary, fullTitle };
}

export function formatTableLeaseTerm(
  start: string | null | undefined,
  end: string | null | undefined,
  endFallback = "Month-to-month"
): { startLabel: string; endLabel: string; fullTitle: string } | null {
  if (!start && !end) return null;

  const startLabel = start ? formatDateShort(start) : "—";
  const endLabel = end ? formatDateShort(end) : endFallback;
  return {
    startLabel,
    endLabel,
    fullTitle: `${startLabel} – ${endLabel}`
  };
}
