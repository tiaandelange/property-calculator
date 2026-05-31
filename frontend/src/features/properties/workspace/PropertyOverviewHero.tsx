import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../../components/icons";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/DashboardKit";
import {
  buildPropertyAddress,
  formatLastUpdated,
  formatOverviewCurrency,
  propertyDescription,
  propertyStatusDisplay,
  propertyTypeLabel,
  unitsOccupiedLabel
} from "./propertyOverviewUtils";
import { usePropertyMainImage } from "./usePropertyMainImage";

type MoreAction = {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
};

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pg-prop-overview-hero__stat">
      <span className="pg-prop-overview-hero__stat-label">{label}</span>
      <strong className="pg-prop-overview-hero__stat-value">{value}</strong>
    </div>
  );
}

function MoreActionsMenu({ actions }: { actions: MoreAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="pg-prop-overview-hero__more" ref={rootRef}>
      <Button type="button" variant="soft" aria-expanded={open} aria-haspopup="menu" aria-controls={menuId} onClick={() => setOpen((v) => !v)}>
        More
      </Button>
      {open ? (
        <div className="pg-prop-overview-hero__more-menu" id={menuId} role="menu">
          {actions.map((action) =>
            action.href ? (
              <Link key={action.key} className="pg-prop-overview-hero__more-item" role="menuitem" to={action.href} onClick={() => setOpen(false)}>
                {action.label}
              </Link>
            ) : (
              <button
                key={action.key}
                type="button"
                className="pg-prop-overview-hero__more-item"
                role="menuitem"
                onClick={() => {
                  action.onClick?.();
                  setOpen(false);
                }}
              >
                {action.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PropertyOverviewHero({
  data,
  propertyId,
  currentLeases,
  monthlyIncome
}: {
  data: Record<string, unknown>;
  propertyId: string;
  currentLeases: unknown[];
  monthlyIncome: number;
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
  const totalUnits = Math.max(1, Number(data.activeUnitCount ?? 1) || 1);
  const occupancyLabel = unitsOccupiedLabel(data, currentLeases);
  const lastUpdated = formatLastUpdated(data);

  const moreActions: MoreAction[] = [
    { key: "statement", label: "Open statement", href: `/owned-properties/${propertyId}?tab=statement` },
    { key: "documents", label: "Open documents", href: `/owned-properties/${propertyId}?tab=documents` },
    { key: "reports", label: "View reports", href: `/owned-properties/${propertyId}?tab=reports` },
    { key: "tenants", label: "Manage tenants", href: `/owned-properties/${propertyId}?tab=tenants` }
  ];

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
          <StatusPill label={status.label} tone={status.tone} />
        </div>

        <p className="pg-prop-overview-hero__address">
          <AppIcon name="units" size="sm" aria-hidden="true" />
          <span>{address || "No address added"}</span>
        </p>

        <p className="pg-prop-overview-hero__description">{description ?? "No description added yet."}</p>

        <div className="pg-prop-overview-hero__actions">
          <ButtonLink href={`/owned-properties/${propertyId}/edit`} variant="primary">
            Edit Property
          </ButtonLink>
          <ButtonLink href={`/owned-properties/${propertyId}/report`} target="_blank" rel="noopener noreferrer" variant="soft">
            Export Report
          </ButtonLink>
          <MoreActionsMenu actions={moreActions} />
        </div>
      </div>

      <div className="pg-prop-overview-hero__stats">
        <HeroStat label="Property type" value={typeLabel || "—"} />
        <HeroStat label="Units" value={String(totalUnits)} />
        <HeroStat label="Occupancy" value={status.label} />
        <HeroStat label="Active leases" value={String(currentLeases.length)} />
        <HeroStat label="Monthly income" value={formatOverviewCurrency(monthlyIncome)} />
        <HeroStat label="Last updated" value={lastUpdated ?? "—"} />
      </div>
    </section>
  );
}
