import { useQuery } from "@tanstack/react-query";
import { authFetch } from "../../lib/authFetch";
import { formatStorageBytes } from "../../lib/billing/planStorageLimits";
import { SettingsAccordion } from "./components/SettingsAccordion";

type StorageUsageResponse = {
  usedBytes: number;
  limitBytes: number;
  percentage: number;
  planCode: string;
};

async function fetchStorageUsage(): Promise<StorageUsageResponse> {
  return authFetch("/api/storage/usage") as Promise<StorageUsageResponse>;
}

export function StorageUsageCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: fetchStorageUsage,
    staleTime: 60_000,
    retry: 1
  });

  const summary =
    data && data.limitBytes > 0
      ? `${formatStorageBytes(data.usedBytes)} of ${formatStorageBytes(data.limitBytes)}`
      : undefined;

  return (
    <SettingsAccordion title="Storage usage" summary={summary} defaultOpen={false}>
      {isLoading ? (
        <p className="pg-settings-panel-muted">Loading storage…</p>
      ) : isError ? (
        <div className="pg-settings-storage-usage">
          <p className="pg-settings-panel-muted">
            {error instanceof Error ? error.message : "Storage usage is not available yet."}
          </p>
          <button type="button" className="pg-link-button" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : data ? (
        <div className="pg-settings-storage-usage">
          <div className="pg-settings-storage-usage__row">
            <span className="pg-settings-storage-usage__label">Used</span>
            <span className="pg-settings-storage-usage__value">
              {formatStorageBytes(data.usedBytes)} of {formatStorageBytes(data.limitBytes)}
            </span>
          </div>
          <div
            className="pg-settings-storage-usage__bar"
            role="progressbar"
            aria-valuenow={data.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Storage used"
          >
            <span
              className="pg-settings-storage-usage__bar-fill"
              style={{ width: `${data.percentage}%` }}
            />
          </div>
          <p className="pg-settings-storage-usage__hint">
            Includes uploaded documents, PDFs, reports, and your profile photo. Limit is based on your{" "}
            {data.planCode} plan.
          </p>
          <button
            type="button"
            className="pg-link-button"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Refresh
          </button>
        </div>
      ) : (
        <p className="pg-settings-panel-muted">Storage usage is not available yet.</p>
      )}
    </SettingsAccordion>
  );
}
