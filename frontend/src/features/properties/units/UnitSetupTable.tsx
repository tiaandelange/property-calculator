import { Copy, Plus, Trash2 } from "lucide-react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { ProplyticTableWrap } from "../../../components/tables";
import { Input } from "../../../components/ui/Input";
import { getPropertyTypeConfig } from "../../../config/propertyTypes";
import { UNIT_USE_TYPE_OPTIONS, type PropertyUnitDraft } from "./propertyUnitTypes";
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
  lockUnitCount,
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
  /** Duplex and other fixed-count types — no add/remove/duplicate. */
  lockUnitCount?: boolean;
  onChange: (units: PropertyUnitDraft[]) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const cfg = getPropertyTypeConfig(structureTypeId);
  const label = cfg.unitLabel;
  const rowsLocked = lockUnitCount || readOnly;

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
              {!rowsLocked ? (
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
        {!rowsLocked ? (
          <button type="button" className="pg-btn pg-btn-secondary pg-prop-units-add" onClick={onAdd}>
            <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
            Add {label}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ProplyticTableWrap>
      <table className="pg-ptable pg-ptable--editable pg-pfin-table pg-prop-units-table">
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
            {!rowsLocked ? <th>Actions</th> : null}
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
              {!rowsLocked ? (
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
      {!rowsLocked ? (
        <button type="button" className="pg-btn pg-btn-secondary" style={{ marginTop: 10 }} onClick={onAdd}>
          <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
          Add {label}
        </button>
      ) : null}
    </ProplyticTableWrap>
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
        Description
        <Input
          value={unit.description ?? ""}
          onChange={(e) => onPatch({ description: e.target.value })}
          disabled={disabled}
        />
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
      <label className="pg-muted" style={{ fontSize: 12 }}>
        Size m²
        <Input
          type="number"
          min={0}
          value={numVal(unit.sizeSqm)}
          onChange={(e) => onPatch({ sizeSqm: e.target.value === "" ? null : Number(e.target.value) })}
          disabled={disabled}
        />
      </label>
    </div>
  );
}

export function duplicateUnitRow(units: PropertyUnitDraft[], index: number, structureTypeId: string): PropertyUnitDraft[] {
  const src = units[index];
  if (!src) return units;
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
