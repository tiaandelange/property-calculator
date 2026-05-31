import { AppIcon } from "../../../components/icons";
import { ButtonLink } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/DashboardKit";
import {
  buildPropertyAddress,
  formatLastUpdated,
  propertyDescription,
  propertyStatusDisplay,
  propertyTypeLabel
} from "./propertyOverviewUtils";
import { usePropertyMainImage } from "./usePropertyMainImage";
import { useEffect, useState } from "react";

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pg-prop-overview-hero__stat">
      <span className="pg-prop-overview-hero__stat-label">{label}</span>
      <strong className="pg-prop-overview-hero__stat-value">{value}</strong>
    </div>
  );
}

export function PropertyOverviewHero({
  data,
  propertyId,
  currentLeases
}: {
  data: Record<string, unknown>;
  propertyId: string;
  currentLeases: unknown[];
}) {
  const { imageUrl, loading: imageLoading } = usePropertyMainImage(propertyId);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
  }, [imageUrl]);

  const showImage = Boolean(imageUrl) && !imageBroken;
  const name = String(data.name ?? "Untitled property");
  const address = buildPropertyAddress(data);
  const description = propertyDescription(data);
  const typeLabel = propertyTypeLabel(data);
  const status = propertyStatusDisplay(data);
  const lastUpdated = formatLastUpdated(data);

  return (
    <section className="pg-prop-overview-hero" aria-label="Property summary">
      <div className="pg-prop-overview-hero__media">
        {showImage ? (
          <img
            className="pg-prop-overview-hero__image"
            src={imageUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <div className="pg-prop-overview-hero__image-placeholder" aria-hidden={imageLoading ? undefined : true}>
            <AppIcon name="property" size="lg" />
            <span>{imageLoading ? "Loading image…" : "No property image uploaded"}</span>
            {!imageLoading ? (
              <ButtonLink href={`/owned-properties/${propertyId}/edit`} variant="ghost" size="sm">
                Upload image
              </ButtonLink>
            ) : null}
          </div>
        )}
      </div>

      <div className="pg-prop-overview-hero__main">
        <div className="pg-prop-overview-hero__heading">
          <div>
            <h1 className="pg-prop-overview-hero__title">{name}</h1>
            {typeLabel ? <p className="pg-prop-overview-hero__type">{typeLabel}</p> : null}
          </div>
          <div className="pg-prop-overview-hero__actions">
            <ButtonLink href={`/owned-properties/${propertyId}/edit`} variant="soft">
              Edit Property
            </ButtonLink>
            <ButtonLink href={`/owned-properties/${propertyId}/report`} target="_blank" rel="noopener noreferrer" variant="soft">
              Export Report
            </ButtonLink>
          </div>
        </div>

        <p className="pg-prop-overview-hero__address">
          <AppIcon name="units" size="sm" aria-hidden="true" />
          <span>{address || "No address added"}</span>
        </p>

        <p className="pg-prop-overview-hero__description">{description ?? "No description added yet."}</p>

        <div className="pg-prop-overview-hero__status-row">
          <StatusPill label={status.label} tone={status.tone} />
        </div>
      </div>

      <div className="pg-prop-overview-hero__stats">
        <HeroStat label="Active leases" value={String(currentLeases.length)} />
        <HeroStat label="Last updated" value={lastUpdated ?? "—"} />
      </div>
    </section>
  );
}
