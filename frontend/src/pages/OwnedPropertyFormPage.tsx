import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  createProperty,
  deleteProperty,
  getProperty,
  propertyApiErrorMessage,
  updateProperty
} from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { PropertyForm } from "../features/properties/form/PropertyForm";
import { BOND_TERM_YEAR_OPTIONS } from "../features/properties/form/propertyFormConstants";
import { uploadPendingPropertyPhotos, type PendingPhoto } from "../features/properties/form/PropertyMediaUpload";
import type { PropertyFormValues } from "../features/properties/form/propertyFormConstants";

const DEFAULT_FORM: PropertyFormValues = {
  name: "",
  propertyType: "OTHER",
  investmentType: "LONG_TERM_RENTAL",
  addressLine1: "",
  city: "",
  province: "",
  country: "South Africa",
  purchasePrice: ""
};

export function OwnedPropertyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PropertyFormValues>({ ...DEFAULT_FORM });
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  useEffect(() => {
    async function load() {
      if (!isEdit || !id) return;
      const data = await getProperty(id);
      setForm({
        ...data,
        propertyType: data.propertyType ?? "OTHER",
        investmentType: data.investmentType ?? "LONG_TERM_RENTAL",
        purchasePrice: data.purchasePrice ?? "",
        currentEstimatedValue: data.currentEstimatedValue ?? "",
        outstandingBondBalance: data.outstandingBondBalance ?? ""
      });
    }
    void load();
  }, [id, isEdit]);

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

      const propertyPayload: PropertyFormValues = {
        ...form,
        propertyType: form.propertyType ?? "OTHER",
        bondTermYears,
        bondStartDate,
        bondRemainingTermMonths:
          bondTermYears != null && bondStartDate != null ? null : (form.bondRemainingTermMonths ?? null)
      };
      const saved = isEdit && id ? await updateProperty(id, propertyPayload) : await createProperty(propertyPayload);
      const propertyId = isEdit && id ? id : (saved?.id as string | number | undefined);
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

      <header className="pg-prop-form-page__head">
        <h1 className="pg-prop-form-page__title">{pageTitle}</h1>
        <div className="pg-prop-form-page__actions">
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit && id ? `/owned-properties/${id}` : "/owned-properties")}>
            Cancel
          </Button>
          <Button type="submit" form="property-form-main" loading={saving}>
            {saveLabel}
          </Button>
        </div>
      </header>

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
