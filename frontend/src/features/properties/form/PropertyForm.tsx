import type { FormEvent, ReactNode } from "react";
import { useCallback, useState } from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { PropertyFormSections } from "./propertyFormSections";
import { PropertyMediaUpload, type PendingPhoto } from "./PropertyMediaUpload";
import { PropertyMetricCards } from "./PropertyMetricCards";
import { PropertySummaryPanel } from "./PropertySummaryPanel";
import type { PropertyFormMode, PropertyFormValues } from "./propertyFormConstants";
import { propertyFormProgress } from "./propertyFormProgress";

export function PropertyForm({
  form,
  setForm,
  mode,
  propertyId,
  error,
  pendingPhotos,
  onPendingPhotosChange,
  onSubmit,
  headerActions,
  footerActions
}: {
  form: PropertyFormValues;
  setForm: (patch: PropertyFormValues | ((prev: PropertyFormValues) => PropertyFormValues)) => void;
  mode: PropertyFormMode;
  propertyId?: string;
  error?: string;
  pendingPhotos: PendingPhoto[];
  onPendingPhotosChange: (photos: PendingPhoto[]) => void;
  onSubmit: (e: FormEvent) => void;
  headerActions?: ReactNode;
  footerActions?: ReactNode;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mediaCount, setMediaCount] = useState(0);

  const onMediaCountChange = useCallback((count: number) => {
    setMediaCount(count);
  }, []);

  const progress = propertyFormProgress(mediaCount, form);

  const mediaSection = (
    <PropertyMediaUpload
      propertyId={propertyId}
      pendingPhotos={pendingPhotos}
      onPendingChange={onPendingPhotosChange}
      onCountChange={onMediaCountChange}
    />
  );

  return (
    <form id="property-form-main" className="pg-prop-form" onSubmit={onSubmit}>
      {error ? <div className="pg-alert pg-alert-error pg-prop-form__alert">{error}</div> : null}

      <PropertyMetricCards form={form} mediaCount={mediaCount} compact={isMobile} />

      {isMobile ? (
        <div className="pg-prop-mobile-progress">
          <div className="pg-prop-mobile-progress__head">
            <span>Setup progress</span>
            <span>
              {progress.completed} of {progress.total}
            </span>
          </div>
          <div
            className="pg-prop-summary__progress-track"
            role="progressbar"
            aria-valuenow={progress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="pg-prop-summary__progress-fill" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      ) : null}

      {headerActions ? <div className="pg-prop-form__toolbar">{headerActions}</div> : null}

      <div className="pg-prop-form__layout">
        <div className="pg-prop-form__main">
          <div className="pg-prop-form__sections">
            <PropertyFormSections
              form={form}
              setForm={setForm}
              mode={mode}
              propertyId={propertyId}
              mediaSection={mediaSection}
            />
          </div>
          {footerActions ? <div className="pg-prop-form__footer">{footerActions}</div> : null}
        </div>
        {!isMobile ? (
          <PropertySummaryPanel form={form} mode={mode} propertyId={propertyId} mediaCount={mediaCount} />
        ) : null}
      </div>
    </form>
  );
}
