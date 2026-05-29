import { useMemo, useState } from "react";
import {
  getPropertyTypeConfig,
  mapStructureTypeToDbFields,
  PROPERTY_TYPE_CONFIGS
} from "../../../config/propertyTypes";
import { PropertyFormField } from "../form/PropertyFormField";
import { PropertyFormSection } from "../form/PropertyFormSection";
import type { PropertyFormMode, PropertyFormValues } from "../form/propertyFormConstants";
import { INVESTMENT_TYPE_OPTIONS } from "../form/propertyFormConstants";
import { UnitSetupTable, duplicateUnitRow } from "./UnitSetupTable";
import type { PropertyUnitDraft } from "./propertyUnitTypes";
import { buildSuggestedUnits, sumUnitsExpectedRentMonthly, unitsForStructureType } from "./unitSetupUtils";

type SetForm = (patch: PropertyFormValues | ((prev: PropertyFormValues) => PropertyFormValues)) => void;

function unitsFromForm(form: PropertyFormValues): PropertyUnitDraft[] {
  const raw = form.units;
  return Array.isArray(raw) ? (raw as PropertyUnitDraft[]) : [];
}

export function PropertyStructureSection({
  form,
  setForm,
  mode
}: {
  form: PropertyFormValues;
  setForm: SetForm;
  mode: PropertyFormMode;
}) {
  const patch = (p: PropertyFormValues) => setForm((prev) => ({ ...prev, ...p }));
  const structureTypeId = String(form.structureTypeId ?? "single_family_house");
  const cfg = getPropertyTypeConfig(structureTypeId);
  const units = unitsFromForm(form);
  const unitCount = Number(form.unitCount ?? cfg.defaultUnitCount) || cfg.defaultUnitCount;
  const hasMultipleUnits = Boolean(form.hasMultipleUnits);
  const rentBasis = (form.rentBasis === "bed" ? "bed" : "room") as "room" | "bed";
  const [typeChangeConfirm, setTypeChangeConfirm] = useState<string | null>(null);

  const showUnitTable = useMemo(() => {
    if (cfg.unitMode === "no_units_by_default") return hasMultipleUnits;
    if (cfg.unitMode === "custom") return hasMultipleUnits;
    return units.length > 0 || cfg.defaultUnitCount > 0;
  }, [cfg, hasMultipleUnits, units.length]);

  const showResidentialFields =
    cfg.supportsRooms || ["single_family_house", "duplex", "townhouse", "apartment_flat", "multi_family"].includes(cfg.id);
  const showUseType = cfg.supportsCommercialLeases || cfg.id === "mixed_use";

  const totalExpectedRent = sumUnitsExpectedRentMonthly(units);

  const applyStructureType = (nextId: string, regenerate: boolean) => {
    const nextCfg = getPropertyTypeConfig(nextId);
    const mapped = mapStructureTypeToDbFields(nextId, String(form.investmentType ?? ""));
    const nextUnits = regenerate
      ? unitsForStructureType(nextId, Number(form.unitCount ?? nextCfg.defaultUnitCount) || nextCfg.defaultUnitCount, {
          hasMultipleUnits: nextCfg.unitMode === "custom" ? hasMultipleUnits : undefined,
          rentBasis: nextCfg.unitMode === "rooms_or_beds" ? rentBasis : undefined
        })
      : units;

    patch({
      structureTypeId: nextId,
      propertyType: mapped.propertyType,
      investmentType: mapped.investmentType,
      unitCount: nextCfg.defaultUnitCount || unitCount,
      hasMultipleUnits: nextCfg.unitMode === "custom" ? hasMultipleUnits : nextCfg.defaultUnitCount > 1,
      units: nextUnits,
      expectedMonthlyIncome: sumUnitsExpectedRentMonthly(nextUnits) || form.expectedMonthlyIncome
    });
    setTypeChangeConfirm(null);
  };

  const onStructureTypeChange = (nextId: string) => {
    if (mode === "edit" && units.some((u) => u.id)) {
      setTypeChangeConfirm(nextId);
      return;
    }
    applyStructureType(nextId, true);
  };

  const regenerateUnits = () => {
    const next = unitsForStructureType(structureTypeId, unitCount, {
      hasMultipleUnits,
      rentBasis: cfg.unitMode === "rooms_or_beds" ? rentBasis : undefined,
      existing: units
    });
    patch({ units: next, expectedMonthlyIncome: sumUnitsExpectedRentMonthly(next) || form.expectedMonthlyIncome });
  };

  return (
    <PropertyFormSection
      number={2}
      title="Property Structure"
      description="Define the asset and its rentable units. Tenants are assigned later from the Tenants workspace."
      id="property-section-structure"
    >
      {typeChangeConfirm ? (
        <div className="pg-alert" role="alert" style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px" }}>
            Changing property type may regenerate unit rows. Saved units are kept when possible. Continue?
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="pg-btn pg-btn-primary" onClick={() => applyStructureType(typeChangeConfirm, true)}>
              Regenerate units
            </button>
            <button type="button" className="pg-btn pg-btn-secondary" onClick={() => applyStructureType(typeChangeConfirm, false)}>
              Keep current units
            </button>
            <button type="button" className="pg-btn pg-btn-ghost" onClick={() => setTypeChangeConfirm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="pg-prop-grid pg-prop-grid--2">
        <PropertyFormField label="Property type" required>
          <select
            className="pg-input"
            value={structureTypeId}
            onChange={(e) => onStructureTypeChange(e.target.value)}
          >
            {PROPERTY_TYPE_CONFIGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {cfg.description}
          </p>
        </PropertyFormField>
        <PropertyFormField label="Ownership / rental strategy">
          <select
            className="pg-input"
            value={String(form.investmentType ?? "LONG_TERM_RENTAL")}
            onChange={(e) => {
              const inv = e.target.value;
              const mapped = mapStructureTypeToDbFields(structureTypeId, inv);
              patch({ investmentType: inv, propertyType: mapped.propertyType });
            }}
          >
            {INVESTMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </PropertyFormField>
      </div>

      <div className="pg-prop-structure-flags">
        {cfg.supportsTenants ? (
          <span className="pg-pfin-badge pg-pfin-badge--success">Tenants supported</span>
        ) : (
          <span className="pg-pfin-badge pg-pfin-badge--muted">No tenant assignment in setup</span>
        )}
        {cfg.supportsBookings ? (
          <span className="pg-pfin-badge pg-pfin-badge--info">Bookings / occupancy</span>
        ) : null}
        {cfg.supportsLeases ? (
          <span className="pg-pfin-badge pg-pfin-badge--primary">Leases</span>
        ) : null}
        {units.length > 0 ? (
          <span className="pg-pfin-badge pg-pfin-badge--warning">
            {units.length} {cfg.unitLabel}
            {units.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {cfg.unitMode === "custom" ? (
        <PropertyFormField label="Does this property have rentable units?">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={hasMultipleUnits}
              onChange={(e) => {
                const on = e.target.checked;
                const next = on
                  ? unitsForStructureType(structureTypeId, Math.max(1, unitCount), { hasMultipleUnits: true })
                  : [];
                patch({ hasMultipleUnits: on, units: next });
              }}
            />
            <span>Yes — add units / spaces</span>
          </label>
        </PropertyFormField>
      ) : null}

      {cfg.unitMode === "no_units_by_default" ? (
        <PropertyFormField label="Rentable units on this land?">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={hasMultipleUnits}
              onChange={(e) => {
                const on = e.target.checked;
                patch({
                  hasMultipleUnits: on,
                  units: on ? unitsForStructureType(structureTypeId, 1, { hasMultipleUnits: true }) : []
                });
              }}
            />
            <span>Optional units (e.g. future development)</span>
          </label>
        </PropertyFormField>
      ) : null}

      {cfg.askUnitCount && showUnitTable ? (
        <div className="pg-prop-grid pg-prop-grid--2">
          <PropertyFormField label={`How many ${cfg.unitLabel.toLowerCase()}s?`} required>
            <input
              className="pg-input"
              type="number"
              min={1}
              max={200}
              value={unitCount}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value) || 1);
                patch({ unitCount: n });
              }}
              onBlur={() => regenerateUnits()}
            />
          </PropertyFormField>
          <PropertyFormField label=" ">
            <button type="button" className="pg-btn pg-btn-secondary" onClick={regenerateUnits}>
              Apply count to unit rows
            </button>
          </PropertyFormField>
        </div>
      ) : null}

      {cfg.unitMode === "rooms_or_beds" ? (
        <PropertyFormField label="Rent charged per">
          <select
            className="pg-input"
            value={rentBasis}
            onChange={(e) => {
              const basis = e.target.value === "bed" ? "bed" : "room";
              const next = unitsForStructureType(structureTypeId, unitCount, { rentBasis: basis, existing: units });
              patch({ rentBasis: basis, units: next });
            }}
          >
            <option value="room">Room</option>
            <option value="bed">Bed</option>
          </select>
        </PropertyFormField>
      ) : null}

      {cfg.supportsShortTermRentalCosts ? (
        <div className="pg-prop-grid pg-prop-grid--2">
          <p className="pg-muted pg-prop-grid__span-2" style={{ margin: 0 }}>
            Short-term rental — use occupancy and rate fields below. Tenants are not created during property setup.
          </p>
        </div>
      ) : null}

      {showUnitTable ? (
        <>
          {totalExpectedRent > 0 ? (
            <p className="pg-muted" style={{ fontSize: 13, marginBottom: 8 }}>
              Total expected rent (monthly equivalent): <strong>R {Math.round(totalExpectedRent).toLocaleString()}</strong>
            </p>
          ) : null}
          <UnitSetupTable
            units={units}
            structureTypeId={structureTypeId}
            showResidentialFields={showResidentialFields}
            showUseType={showUseType}
            onChange={(next) =>
              patch({
                units: next,
                expectedMonthlyIncome: sumUnitsExpectedRentMonthly(next) || form.expectedMonthlyIncome
              })
            }
            onAdd={() => {
              const next = [
                ...units,
                ...buildSuggestedUnits(cfg, 1, {
                  rentBasis: cfg.unitMode === "rooms_or_beds" ? rentBasis : undefined
                }).map((u, i) => ({ ...u, sortOrder: units.length + i }))
              ];
              patch({ units: next, unitCount: next.length });
            }}
            onDuplicate={(i) => patch({ units: duplicateUnitRow(units, i, structureTypeId) })}
            onRemove={(i) => {
              if (units[i]?.id && mode === "edit") {
                if (!window.confirm("Remove this unit from the property setup? It will be archived if already saved.")) return;
              }
              const next = units.filter((_, j) => j !== i).map((u, j) => ({ ...u, sortOrder: j }));
              patch({ units: next, unitCount: next.length, expectedMonthlyIncome: sumUnitsExpectedRentMonthly(next) });
            }}
          />
        </>
      ) : (
        <p className="pg-muted">No rentable units for this property type. Property-level income and expenses still apply.</p>
      )}
    </PropertyFormSection>
  );
}
