import { Copy, Plus, Trash2 } from "lucide-react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { Input } from "../../../components/ui/Input";
import { getPropertyTypeConfig } from "../../../config/propertyTypes";
import {
  UNIT_OCCUPANCY_OPTIONS,
  UNIT_RENT_FREQUENCY_OPTIONS,
  UNIT_USE_TYPE_OPTIONS,
  type PropertyUnitDraft
} from "./propertyUnitTypes";
import { newClientId } from "./unitSetupUtils";

function numVal(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(v);
}

export function UnitSetupTable({
  units,
  structureTypeId,
  showResidentialFields,
  showUseType,
  onChange,
  onAdd,
  onDuplicate,
  onRemove,
  readOnly
}: {
  units: PropertyUnitDraft[];
  structureTypeId: string;
  showResidentialFields: boolean;
  showUseType: boolean;
  onChange: (units: PropertyUnitDraft[]) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const cfg = getPropertyTypeConfig(structureTypeId);
  const label = cfg.unitLabel;

  const patchUnit = (index: number, patch: Partial<PropertyUnitDraft>) => {
    onChange(units.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  };

  if (isMobile) {
    return (
      <div className="pg-prop-units-mobile">
        {units.map((u, i) => (
          <div key={u.clientId} className="pg-prop-unit-card">
            <div className="pg-prop-unit-card__head">
              <strong>{u.unitName || `${label} ${i + 1}`}</strong>
              {!readOnly ? (
                <div className="pg-pfin-row-actions">
                  <button type="button" className="pg-pfin-icon-btn" aria-label="Duplicate unit" onClick={() => onDuplicate(i)}>
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="pg-pfin-icon-btn pg-pfin-icon-btn--danger"
                    aria-label="Remove unit"
                    onClick={() => onRemove(i)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : null}
            </div>
            <UnitFieldsMobile
              unit={u}
              showResidentialFields={showResidentialFields}
              showUseType={showUseType}
              disabled={readOnly}
              onPatch={(p) => patchUnit(i, p)}
            />
          </div>
        ))}
        {!readOnly ? (
          <button type="button" className="pg-btn pg-btn-secondary pg-prop-units-add" onClick={onAdd}>
            <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
            Add {label}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pg-pfin-table-wrap">
      <table className="pg-pfin-table pg-prop-units-table">
        <thead>
          <tr>
            <th>{label} name</th>
            {showUseType ? <th>Use</th> : null}
            <th>Description</th>
            {showResidentialFields ? (
              <>
                <th>Beds</th>
                <th>Baths</th>
              </>
            ) : null}
            <th>Size m²</th>
            <th>Expected rent</th>
            <th>Frequency</th>
            <th>Status</th>
            {!readOnly ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {units.map((u, i) => (
            <tr key={u.clientId}>
              <td>
                <Input
                  value={u.unitName}
                  onChange={(e) => patchUnit(i, { unitName: e.target.value })}
                  disabled={readOnly}
                  style={{ height: 34, minWidth: 120 }}
                />
              </td>
              {showUseType ? (
                <td>
                  <select
                    className="pg-input"
                    value={u.unitType ?? "residential"}
                    onChange={(e) => patchUnit(i, { unitType: e.target.value })}
                    disabled={readOnly}
                    style={{ height: 34 }}
                  >
                    {UNIT_USE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              ) : null}
              <td>
                <Input
                  value={u.description ?? ""}
                  onChange={(e) => patchUnit(i, { description: e.target.value })}
                  disabled={readOnly}
                  style={{ height: 34 }}
                />
              </td>
              {showResidentialFields ? (
                <>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      value={numVal(u.bedrooms)}
                      onChange={(e) =>
                        patchUnit(i, { bedrooms: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      disabled={readOnly}
                      style={{ height: 34, width: 64 }}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={numVal(u.bathrooms)}
                      onChange={(e) =>
                        patchUnit(i, { bathrooms: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      disabled={readOnly}
                      style={{ height: 34, width: 64 }}
                    />
                  </td>
                </>
              ) : null}
              <td>
                <Input
                  type="number"
                  min={0}
                  value={numVal(u.sizeSqm)}
                  onChange={(e) => patchUnit(i, { sizeSqm: e.target.value === "" ? null : Number(e.target.value) })}
                  disabled={readOnly}
                  style={{ height: 34, width: 80 }}
                />
              </td>
              <td>
                <Input
                  type="number"
                  min={0}
                  value={numVal(u.expectedRent)}
                  onChange={(e) =>
                    patchUnit(i, { expectedRent: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  disabled={readOnly}
                  style={{ height: 34, width: 100, textAlign: "right" }}
                />
              </td>
              <td>
                <select
                  className="pg-input"
                  value={u.rentFrequency}
                  onChange={(e) => patchUnit(i, { rentFrequency: e.target.value as PropertyUnitDraft["rentFrequency"] })}
                  disabled={readOnly}
                  style={{ height: 34 }}
                >
                  {UNIT_RENT_FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  className="pg-input"
                  value={u.occupancyStatus}
                  onChange={(e) =>
                    patchUnit(i, { occupancyStatus: e.target.value as PropertyUnitDraft["occupancyStatus"] })
                  }
                  disabled={readOnly}
                  style={{ height: 34 }}
                >
                  {UNIT_OCCUPANCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
              {!readOnly ? (
                <td>
                  <div className="pg-pfin-row-actions">
                    <button type="button" className="pg-pfin-icon-btn" aria-label="Duplicate unit" onClick={() => onDuplicate(i)}>
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      className="pg-pfin-icon-btn pg-pfin-icon-btn--danger"
                      aria-label="Remove unit"
                      onClick={() => onRemove(i)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly ? (
        <button type="button" className="pg-btn pg-btn-secondary" style={{ marginTop: 10 }} onClick={onAdd}>
          <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
          Add {label}
        </button>
      ) : null}
    </div>
  );
}

function UnitFieldsMobile({
  unit,
  showResidentialFields,
  showUseType,
  disabled,
  onPatch
}: {
  unit: PropertyUnitDraft;
  showResidentialFields: boolean;
  showUseType: boolean;
  disabled?: boolean;
  onPatch: (p: Partial<PropertyUnitDraft>) => void;
}) {
  return (
    <div className="pg-prop-unit-card__fields">
      <label className="pg-muted" style={{ fontSize: 12 }}>
        Name
        <Input value={unit.unitName} onChange={(e) => onPatch({ unitName: e.target.value })} disabled={disabled} />
      </label>
      {showUseType ? (
        <label className="pg-muted" style={{ fontSize: 12 }}>
          Use
          <select
            className="pg-input"
            value={unit.unitType ?? "residential"}
            onChange={(e) => onPatch({ unitType: e.target.value })}
            disabled={disabled}
          >
            {UNIT_USE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="pg-muted" style={{ fontSize: 12 }}>
        Expected rent
        <Input
          type="number"
          min={0}
          value={numVal(unit.expectedRent)}
          onChange={(e) => onPatch({ expectedRent: e.target.value === "" ? null : Number(e.target.value) })}
          disabled={disabled}
        />
      </label>
      <label className="pg-muted" style={{ fontSize: 12 }}>
        Status
        <select
          className="pg-input"
          value={unit.occupancyStatus}
          onChange={(e) => onPatch({ occupancyStatus: e.target.value as PropertyUnitDraft["occupancyStatus"] })}
          disabled={disabled}
        >
          {UNIT_OCCUPANCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {showResidentialFields ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label className="pg-muted" style={{ fontSize: 12 }}>
            Beds
            <Input
              type="number"
              min={0}
              value={numVal(unit.bedrooms)}
              onChange={(e) => onPatch({ bedrooms: e.target.value === "" ? null : Number(e.target.value) })}
              disabled={disabled}
            />
          </label>
          <label className="pg-muted" style={{ fontSize: 12 }}>
            Baths
            <Input
              type="number"
              min={0}
              value={numVal(unit.bathrooms)}
              onChange={(e) => onPatch({ bathrooms: e.target.value === "" ? null : Number(e.target.value) })}
              disabled={disabled}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function duplicateUnitRow(units: PropertyUnitDraft[], index: number, structureTypeId: string): PropertyUnitDraft[] {
  const src = units[index];
  if (!src) return units;
  const cfg = getPropertyTypeConfig(structureTypeId);
  const copy: PropertyUnitDraft = {
    ...src,
    clientId: newClientId(),
    id: undefined,
    unitName: `${src.unitName} (copy)`,
    sortOrder: units.length
  };
  const next = [...units];
  next.splice(index + 1, 0, copy);
  return next.map((u, i) => ({ ...u, sortOrder: i }));
}
