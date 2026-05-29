import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  createProperty,
  deleteProperty,
  getProperty,
  listPropertyUnits,
  propertyApiErrorMessage,
  syncPropertyUnits,
  updateProperty
} from "../api/ownedProperties";
import { legacyPropertyTypeToStructureId, mapStructureTypeToDbFields } from "../config/propertyTypes";
import type { PropertyUnitDraft } from "../features/properties/units/propertyUnitTypes";
import { resolvePropertyExpectedMonthlyIncome, unitsForStructureType } from "../features/properties/units/unitSetupUtils";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { PropertyForm } from "../features/properties/form/PropertyForm";
import { BOND_TERM_YEAR_OPTIONS } from "../features/properties/form/propertyFormConstants";
import { uploadPendingPropertyPhotos, type PendingPhoto } from "../features/properties/form/PropertyMediaUpload";
import type { PropertyFormValues } from "../features/properties/form/propertyFormConstants";

const DEFAULT_FORM: PropertyFormValues = {
  name: "",
  propertyType: "HOUSE",
  investmentType: "LONG_TERM_RENTAL",
  structureTypeId: "single_family_house",
  unitCount: 1,
  hasMultipleUnits: false,
  rentBasis: "room",
  units: [] as PropertyUnitDraft[],
  addressLine1: "",
  city: "",
  province: "",
  country: "South Africa",
  purchasePrice: ""
};

function draftKeyForProperty(id: string | undefined, isEdit: boolean) {
  // Only persist drafts for edit to avoid confusing “Create” flows.
  return isEdit && id ? `pg:property-form-draft:${id}` : null;
}

export function OwnedPropertyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PropertyFormValues>({ ...DEFAULT_FORM });
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [draftBanner, setDraftBanner] = useState<null | { restoredAt: number }>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    setForm((prev) => {
      if (Array.isArray(prev.units) && (prev.units as PropertyUnitDraft[]).length > 0) return prev;
      const sid = String(prev.structureTypeId ?? "single_family_house");
      const generated = unitsForStructureType(sid, Number(prev.unitCount ?? 1) || 1);
      return { ...prev, units: generated, unitCount: generated.length };
    });
  }, [isEdit]);

  useEffect(() => {
    async function load() {
      if (!isEdit || !id) return;
      setLoaded(false);
      setError("");
      try {
        const data = await getProperty(id);
        const structureTypeId =
          String(data.structureTypeId ?? "") ||
          legacyPropertyTypeToStructureId(String(data.propertyType ?? "OTHER"), String(data.investmentType ?? ""));
        let units: PropertyUnitDraft[] = [];
        try {
          units = await listPropertyUnits(id);
        } catch {
          units = [];
        }
        if (units.length === 0) {
          units = unitsForStructureType(structureTypeId, 1);
        }
        const next: PropertyFormValues = {
          ...data,
          propertyType: data.propertyType ?? "OTHER",
          investmentType: data.investmentType ?? "LONG_TERM_RENTAL",
          structureTypeId,
          unitCount: units.length || 1,
          hasMultipleUnits: units.length > 1,
          rentBasis: "room",
          units,
          purchasePrice: data.purchasePrice ?? "",
          currentEstimatedValue: data.currentEstimatedValue ?? "",
          outstandingBondBalance: data.outstandingBondBalance ?? ""
        };

        // Restore unsaved draft if present (e.g. after a deploy / refresh).
        const k = draftKeyForProperty(id, isEdit);
        if (k) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw) as { savedAt?: number; form?: PropertyFormValues };
              if (parsed?.form) {
                setForm({
                  ...next,
                  ...parsed.form,
                  propertyType: parsed.form.propertyType ?? next.propertyType ?? "OTHER",
                  investmentType: parsed.form.investmentType ?? next.investmentType ?? "LONG_TERM_RENTAL"
                });
                setDraftBanner({ restoredAt: Date.now() });
                setLoaded(true);
                return;
              }
            }
          } catch {
            // Ignore malformed drafts
          }
        }

        setForm(next);
        setLoaded(true);
      } catch (e: unknown) {
        // If auth/session expired or RLS blocks, don't blow away the form with defaults.
        setError(propertyApiErrorMessage(e) || "Failed to load property. Please refresh or sign in again.");
        setLoaded(false);
      }
    }
    void load();
  }, [id, isEdit]);

  useEffect(() => {
    const k = draftKeyForProperty(id, isEdit);
    if (!k || !loaded) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(k, JSON.stringify({ savedAt: Date.now(), form }));
      } catch {
        // Ignore quota / private mode failures
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [form, id, isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const tyRaw = form.bondTermYears;
      const allowedYears = BOND_TERM_YEAR_OPTIONS as unknown as number[];
      const bondTermYears =
        tyRaw === "" || tyRaw == null ? null : allowedYears.includes(Number(tyRaw)) ? Number(tyRaw) : null;
      const sdRaw = typeof form.bondStartDate === "string" ? form.bondStartDate.trim() : "";
      const bondStartDate = /^\d{4}-\d{2}-\d{2}$/.test(sdRaw) ? sdRaw : null;

      const structureTypeId = String(form.structureTypeId ?? "single_family_house");
      const mapped = mapStructureTypeToDbFields(structureTypeId, String(form.investmentType ?? ""));
      const units = Array.isArray(form.units) ? (form.units as PropertyUnitDraft[]) : [];
      const rolledIncome = resolvePropertyExpectedMonthlyIncome(form, units, structureTypeId);

      const propertyPayload: PropertyFormValues = {
        ...form,
        propertyType: mapped.propertyType,
        investmentType: mapped.investmentType,
        structureTypeId,
        expectedMonthlyIncome: rolledIncome ?? form.expectedMonthlyIncome ?? null,
        bondTermYears,
        bondStartDate,
        bondRemainingTermMonths:
          bondTermYears != null && bondStartDate != null ? null : (form.bondRemainingTermMonths ?? null)
      };
      const saved = isEdit && id ? await updateProperty(id, propertyPayload) : await createProperty(propertyPayload);
      const propertyId = isEdit && id ? id : (saved?.id as string | number | undefined);

      if (propertyId != null && propertyId !== "" && units.length > 0) {
        try {
          await syncPropertyUnits(propertyId, units);
        } catch (unitErr: unknown) {
          const msg = unitErr instanceof Error ? unitErr.message : "Property saved but units could not be saved.";
          setError(msg);
          setSaving(false);
          navigate(`/owned-properties/${propertyId}?tab=overview`);
          return;
        }
      }
      const k = draftKeyForProperty(id, isEdit);
      if (k) {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      }
      if (propertyId != null && propertyId !== "") {
        invalidatePropertyWorkspace(propertyId);
        if (pendingPhotos.length > 0) {
          try {
            await uploadPendingPropertyPhotos(String(propertyId), pendingPhotos);
            setPendingPhotos([]);
          } catch (photoErr: unknown) {
            const msg = photoErr instanceof Error ? photoErr.message : "Property saved but photo upload failed.";
            setError(msg);
            setSaving(false);
            navigate(`/owned-properties/${propertyId}?tab=overview`);
            return;
          }
        }
      }

      navigate(`/owned-properties/${propertyId}?tab=overview`);
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e) || "Failed to save property.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!isEdit || !id) return;
    if (!window.confirm("Permanently delete this property? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    try {
      await deleteProperty(id);
      invalidatePropertyWorkspace(id);
      navigate("/owned-properties");
    } catch (e: unknown) {
      setError(propertyApiErrorMessage(e) || "Failed to delete property.");
    } finally {
      setDeleting(false);
    }
  };

  const pageTitle = isEdit ? "Edit Property" : "Create Property";
  const saveLabel = isEdit ? "Save Changes" : "Save Property";

  return (
    <div className="pg-prop-form-page">
      <Helmet>
        <title>{pageTitle} | The Property Guy</title>
      </Helmet>
      <div className="pg-prop-form-page__head" style={{ justifyContent: "flex-end" }}>
        <div className="pg-prop-form-page__actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(isEdit && id ? `/owned-properties/${id}` : "/owned-properties")}
          >
            Cancel
          </Button>
          <Button type="submit" form="property-form-main" loading={saving}>
            {saveLabel}
          </Button>
        </div>
      </div>

      {draftBanner ? (
        <div className="pg-alert" style={{ marginBottom: 12, display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Unsaved edits restored.</strong>{" "}
            <span className="pg-muted">This can happen after a refresh or when new code is deployed.</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const k = draftKeyForProperty(id, isEdit);
              if (k) {
                try {
                  localStorage.removeItem(k);
                } catch {
                  // ignore
                }
              }
              setDraftBanner(null);
              // Re-load the last saved data
              if (isEdit && id) {
                void (async () => {
                  try {
                    const data = await getProperty(id);
                    setForm({
                      ...data,
                      propertyType: data.propertyType ?? "OTHER",
                      investmentType: data.investmentType ?? "LONG_TERM_RENTAL",
                      purchasePrice: data.purchasePrice ?? "",
                      currentEstimatedValue: data.currentEstimatedValue ?? "",
                      outstandingBondBalance: data.outstandingBondBalance ?? ""
                    });
                  } catch {
                    // ignore
                  }
                })();
              }
            }}
          >
            Discard draft
          </Button>
        </div>
      ) : null}

      <PropertyForm
        form={form}
        setForm={setForm}
        mode={isEdit ? "edit" : "create"}
        propertyId={id}
        error={error}
        pendingPhotos={pendingPhotos}
        onPendingPhotosChange={setPendingPhotos}
        onSubmit={submit}
        footerActions={
          <>
            <Button type="submit" loading={saving} className="pg-prop-form__submit-mobile">
              {saveLabel}
            </Button>
            {isEdit && id ? (
              <Button
                type="button"
                variant="secondary"
                loading={deleting}
                onClick={() => void onDelete()}
                style={{ borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)", color: "var(--danger)" }}
              >
                Delete property
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
