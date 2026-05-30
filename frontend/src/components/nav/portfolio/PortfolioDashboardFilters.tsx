import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "../../ui/Button";
import { useLocation, useNavigate } from "react-router-dom";
import { usePropertyOptionsQuery } from "../../../features/queries";

const TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "LONG_TERM_RENTAL", label: "Long-Term Rental" },
  { id: "SHORT_TERM_RENTAL", label: "Short-Term Rental / Airbnb" },
  { id: "PRIMARY_RESIDENCE", label: "Primary Residence" },
  { id: "HOUSE_HACK", label: "House Hack" },
  { id: "BRRRR", label: "BRRRR" },
  { id: "FLIP", label: "Flip / Renovation Project" },
  { id: "VACANT_LAND", label: "Vacant Land" },
  { id: "COMMERCIAL", label: "Commercial" },
  { id: "MIXED_USE", label: "Mixed Use" },
  { id: "OTHER", label: "Other" }
];

function parseTypesParam(search: string) {
  const raw = new URLSearchParams(search).get("types");
  if (!raw) return [] as string[];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseMonthParam(search: string) {
  const raw = new URLSearchParams(search).get("month");
  if (!raw) return null;
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

function parsePropertyParam(search: string): string | number | null {
  const raw = new URLSearchParams(search).get("propertyId");
  if (!raw) return null;
  const t = raw.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return t;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function monthDropdownValues() {
  const out: string[] = [];
  const d = new Date();
  for (let i = -36; i <= 24; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(x.toISOString().slice(0, 7));
  }
  return [...new Set(out)].sort((a, b) => b.localeCompare(a));
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type Props = {
  className?: string;
  buttonClassName?: string;
};

export function PortfolioDashboardFilters({ className, buttonClassName }: Props) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const propertyOptionsQuery = usePropertyOptionsQuery();
  const properties = propertyOptionsQuery.data ?? [];
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selectedTypes = useMemo(() => parseTypesParam(search), [search]);
  const selectedType = selectedTypes.length === 1 ? selectedTypes[0] : "";
  const month = useMemo(
    () => parseMonthParam(search) ?? new Date().toISOString().slice(0, 7),
    [search]
  );
  const propertyId = useMemo(() => parsePropertyParam(search), [search]);
  const monthChoices = useMemo(() => monthDropdownValues(), []);
  const monthSelectOptions = useMemo(() => {
    if (!month || monthChoices.includes(month)) return monthChoices;
    return [month, ...monthChoices].sort((a, b) => b.localeCompare(a));
  }, [monthChoices, month]);

  const filterActive = propertyId != null || selectedTypes.length > 0;

  useEffect(() => {
    if (!filtersOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  const setParam = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(search);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    });
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  const setTypeFilter = (typeId: string) => {
    const params = new URLSearchParams(search);
    if (typeId) params.set("types", typeId);
    else params.delete("types");
    if (month) params.set("month", month);
    if (propertyId != null) params.set("propertyId", String(propertyId));
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  const resetFilters = () => {
    const params = new URLSearchParams();
    params.set("month", new Date().toISOString().slice(0, 7));
    navigate(`/owned-properties/dashboard?${params.toString()}`);
    setFiltersOpen(false);
  };

  return (
    <div ref={wrapRef} className={className ?? "pg-dashboard-header-filters"}>
      <button
        type="button"
        className={`pg-dashboard-shell-icon-btn pg-dashboard-shell-filter-btn${filterActive ? " pg-dashboard-shell-filter-btn--active" : ""}${buttonClassName ? ` ${buttonClassName}` : ""}`}
        aria-expanded={filtersOpen}
        aria-haspopup="dialog"
        aria-controls="portfolio-dashboard-filters"
        aria-label={filterActive ? "Open filters (filters active)" : "Open filters"}
        onClick={() => setFiltersOpen((v) => !v)}
      >
        <SlidersHorizontal size={18} aria-hidden />
      </button>
      {filtersOpen ? (
        <div
          id="portfolio-dashboard-filters"
          role="dialog"
          aria-label="Dashboard filters"
          className="pg-workspace-card pg-workspace-filter-dropdown pg-dashboard-filters-popover pg-dashboard-shell-filters-popover"
        >
          <div className="pg-workspace-filter-dropdown__title">Filters</div>
          <p className="pg-workspace-filter-dropdown__hint pg-muted">Figures reflect the selected month.</p>
          <div className="pg-workspace-filter-dropdown__grid">
            <label className="pg-workspace-filter-dropdown__field">
              <span className="pg-workspace-filter-dropdown__label">Property</span>
              <select
                className="pg-input"
                value={propertyId ?? ""}
                onChange={(e) => setParam({ propertyId: e.target.value || null })}
              >
                <option value="">All properties</option>
                {properties.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pg-workspace-filter-dropdown__field">
              <span className="pg-workspace-filter-dropdown__label">Property type</span>
              <select className="pg-input" value={selectedType} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pg-workspace-filter-dropdown__field">
              <span className="pg-workspace-filter-dropdown__label">Month</span>
              <select className="pg-input" value={month} onChange={(e) => setParam({ month: e.target.value })}>
                {monthSelectOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button type="button" variant="ghost" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
