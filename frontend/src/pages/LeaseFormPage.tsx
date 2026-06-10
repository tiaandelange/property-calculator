import { FormEvent, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createLease,
  getLease,
  getTenantsEligibleForProperty,
  getProperties,
  listPropertyUnits,
  propertyApiErrorMessage,
  updateLease
} from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { trackEvent } from "../lib/analytics/analytics";
import type { PropertyUnitDraft } from "../features/properties/units/propertyUnitTypes";
import { unitDisplayLabel } from "../features/properties/link-tenants/unitTenantLinkUtils";
import {
  computeEndDateFromTerm,
  fixedTermEndFromPreset,
  isLeaseEndExpired,
  LEASE_TERM_PRESET_OPTIONS,
  resolveLeaseTypeFromEndDate,
  type LeaseTermPreset
} from "../utils/leaseTermUtils";
import { AppFormPage, AppPageHeader, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button, ButtonLink } from "../components/ui/Button";
import { getOrCreateUserSettings } from "../services/settingsSupabase";
import { LeaseContractUploadSection } from "../features/leases/LeaseContractUploadSection";
import { uploadLeaseContractOwner } from "../services/tenantDocumentsSupabase";

type RentDueMode = "first" | "last" | "custom";

function rentDueDayFromMode(mode: RentDueMode, customDay: number): number {
  if (mode === "first") return 1;
  if (mode === "last") return 31;
  return Math.min(31, Math.max(1, customDay));
}

/** Stable YYYY-MM-DD for date input from day-of-month (January always has 31 days). */
function ymdFromRentDueDay(day: number): string {
  const y = new Date().getFullYear();
  const d = Math.min(31, Math.max(1, day));
  return `${y}-01-${String(d).padStart(2, "0")}`;
}

function rentDueLabel(day: number): string {
  if (day === 1) return "1st of the month";
  if (day === 31) return "Last day of the month";
  const suffix = day === 2 ? "nd" : day === 3 ? "rd" : "th";
  return `${day}${suffix} of the month`;
}

function inferTermPreset(startYmd: string, endYmd: string | null | undefined): LeaseTermPreset {
  const end = endYmd?.trim().slice(0, 10) ?? "";
  if (!startYmd.trim() || !end) return "manual";
  if (end === fixedTermEndFromPreset(startYmd, 6)) return "6";
  if (end === fixedTermEndFromPreset(startYmd, 12)) return "12";
  if (end === fixedTermEndFromPreset(startYmd, 24)) return "24";
  return "manual";
}

function rentDueModeFromDay(day: number): RentDueMode {
  if (day === 1) return "first";
  if (day === 31) return "last";
  return "custom";
}

export function LeaseFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeLeaseId } = useParams<{ id?: string }>();
  const editLeaseId = location.pathname.endsWith("/edit") && routeLeaseId ? routeLeaseId : null;
  const isEdit = Boolean(editLeaseId);
  const [searchParams] = useSearchParams();
  const prefillPropertyId = searchParams.get("propertyId") ?? "";

  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [units, setUnits] = useState<PropertyUnitDraft[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [primaryTenantId, setPrimaryTenantId] = useState("");
  const [additionalTenantIds, setAdditionalTenantIds] = useState<string[]>([]);
  const [rentSplitEnabled, setRentSplitEnabled] = useState(false);
  const [rentShares, setRentShares] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingLease, setLoadingLease] = useState(isEdit);
  const [pendingLeaseContract, setPendingLeaseContract] = useState<File | null>(null);
  const [form, setForm] = useState({
    unitId: "",
    startDate: "",
    termPreset: "12" as LeaseTermPreset,
    endDate: "",
    monthlyRent: "",
    depositAmount: "",
    rentDueMode: "first" as RentDueMode,
    rentDueCustomDay: 15,
    notes: ""
  });

  const effectiveEndDate = useMemo(
    () => computeEndDateFromTerm(form.startDate, form.termPreset, form.endDate),
    [form.startDate, form.termPreset, form.endDate]
  );

  const effectiveLeaseType = useMemo(
    () => resolveLeaseTypeFromEndDate(effectiveEndDate),
    [effectiveEndDate]
  );

  const termExpired = useMemo(
    () => Boolean(effectiveEndDate && isLeaseEndExpired(effectiveEndDate)),
    [effectiveEndDate]
  );

  useEffect(() => {
    void (async () => {
      const rows = await getProperties();
      setProperties(rows);
      if (!isEdit) {
        if (!prefillPropertyId && rows[0]) setPropertyId(String(rows[0].id));
        else if (prefillPropertyId) setPropertyId(prefillPropertyId);
      }
    })();
  }, [prefillPropertyId, isEdit]);

  useEffect(() => {
    if (!editLeaseId) return;
    void (async () => {
      setLoadingLease(true);
      setError("");
      try {
        const lease = await getLease(editLeaseId);
        const propId = String(lease.propertyId ?? "");
        const start = String(lease.startDate ?? "").slice(0, 10);
        const end = lease.fixedTermEndDate ? String(lease.fixedTermEndDate).slice(0, 10) : "";
        const termPreset = inferTermPreset(start, end);
        const rentDay = Number(lease.rentDueDay ?? 1);
        const monthly = lease.monthlyRent != null ? String(lease.monthlyRent) : "";
        const deposit = lease.depositAmount != null ? String(lease.depositAmount) : "";

        setPropertyId(propId);
        setRentSplitEnabled(Boolean(lease.rentSplitEnabled));
        setForm({
          unitId: lease.unitId != null ? String(lease.unitId) : "",
          startDate: start,
          termPreset,
          endDate: termPreset === "manual" ? end : "",
          monthlyRent: monthly,
          depositAmount: deposit,
          rentDueMode: rentDueModeFromDay(rentDay),
          rentDueCustomDay: rentDay >= 1 && rentDay <= 28 ? rentDay : 15,
          notes: lease.notes != null ? String(lease.notes) : ""
        });

        const leaseTenants = (lease.leaseTenants as Array<Record<string, unknown>> | undefined) ?? [];
        const primaryRow = leaseTenants.find((t) => Boolean(t.isPrimary)) ?? leaseTenants[0];
        const primaryId = primaryRow?.tenantId != null ? String(primaryRow.tenantId) : String(lease.tenantId ?? "");
        setPrimaryTenantId(primaryId);
        setAdditionalTenantIds(
          leaseTenants
            .map((t) => (t.tenantId != null ? String(t.tenantId) : ""))
            .filter((tid) => tid && tid !== primaryId)
        );

        const shares: Record<string, string> = {};
        for (const t of leaseTenants) {
          const tid = t.tenantId != null ? String(t.tenantId) : "";
          if (!tid) continue;
          if (t.rentShareAmount != null) shares[tid] = String(t.rentShareAmount);
        }
        setRentShares(shares);

        const tenantRows = leaseTenants
          .map((t) => {
            const embedded = t.tenant as Record<string, unknown> | undefined;
            if (embedded?.id) return embedded;
            if (t.tenantId) {
              return { id: t.tenantId, firstName: "", lastName: "" };
            }
            return null;
          })
          .filter(Boolean) as Record<string, unknown>[];
        if (tenantRows.length) setTenants(tenantRows);
      } catch (err: unknown) {
        setError(propertyApiErrorMessage(err));
      } finally {
        setLoadingLease(false);
      }
    })();
  }, [editLeaseId]);

  useEffect(() => {
    if (isEdit) return;
    void (async () => {
      try {
        const settings = await getOrCreateUserSettings();
        const termStr = String(settings.leaseDefaultTermMonths) as LeaseTermPreset;
        const validTerms = ["6", "12", "24", "36", "custom"];
        const termPreset = validTerms.includes(termStr) ? termStr : "12";
        const dueDay = settings.defaultRentDueDay;
        setForm((prev) => ({
          ...prev,
          termPreset: termPreset as LeaseTermPreset,
          rentDueMode: dueDay === 1 ? "first" : dueDay === 31 ? "last" : "custom",
          rentDueCustomDay: dueDay >= 1 && dueDay <= 28 ? dueDay : 15
        }));
      } catch {
        /* keep form defaults */
      }
    })();
  }, [isEdit]);

  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      if (!isEdit) {
        setTenants([]);
        setForm((prev) => ({ ...prev, unitId: "" }));
        setPrimaryTenantId("");
        setAdditionalTenantIds([]);
      }
      return;
    }
    void (async () => {
      setUnitsLoading(true);
      if (!isEdit) setTenantsLoading(true);
      try {
        if (isEdit) {
          const unitRows = await listPropertyUnits(propertyId);
          setUnits(unitRows.filter((u) => u.isActive !== false));
          return;
        }
        const [unitRows, tenantRows] = await Promise.all([
          listPropertyUnits(propertyId),
          getTenantsEligibleForProperty(propertyId)
        ]);
        const active = unitRows.filter((u) => u.isActive !== false);
        setUnits(active);
        setTenants(Array.isArray(tenantRows) ? tenantRows : []);
        setForm((prev) => {
          const stillValid = active.some((u) => String(u.id) === prev.unitId);
          if (stillValid) return prev;
          const only = active.length === 1 && active[0]?.id ? String(active[0].id) : "";
          return { ...prev, unitId: only };
        });
        setPrimaryTenantId((prev) => (prev && tenantRows.some((t) => String(t.id) === prev) ? prev : ""));
        setAdditionalTenantIds((prev) => prev.filter((id) => tenantRows.some((t) => String(t.id) === id)));
      } catch {
        setUnits([]);
        setTenants([]);
      } finally {
        setUnitsLoading(false);
        if (!isEdit) setTenantsLoading(false);
      }
    })();
  }, [propertyId, isEdit]);

  const showUnitField = units.length > 0;

  const additionalTenantOptions = useMemo(
    () => tenants.filter((t) => String(t.id) !== primaryTenantId),
    [tenants, primaryTenantId]
  );

  const allSelectedTenantIds = useMemo(
    () => [primaryTenantId, ...additionalTenantIds.filter((id) => id && id !== primaryTenantId)].filter(Boolean),
    [primaryTenantId, additionalTenantIds]
  );

  const rentDueDay = rentDueDayFromMode(form.rentDueMode, form.rentDueCustomDay);

  const addAdditionalTenant = (tenantId: string) => {
    if (!tenantId || tenantId === primaryTenantId || additionalTenantIds.includes(tenantId)) return;
    setAdditionalTenantIds((prev) => [...prev, tenantId]);
  };

  const removeAdditionalTenant = (tenantId: string) => {
    setAdditionalTenantIds((prev) => prev.filter((id) => id !== tenantId));
    setRentShares((prev) => {
      const next = { ...prev };
      delete next[tenantId];
      return next;
    });
  };

  useEffect(() => {
    if (!rentSplitEnabled || allSelectedTenantIds.length < 2) return;
    const total = Number(form.monthlyRent);
    if (!Number.isFinite(total) || total <= 0) return;
    const per = Math.round((total / allSelectedTenantIds.length) * 100) / 100;
    const next: Record<string, string> = {};
    let assigned = 0;
    allSelectedTenantIds.forEach((id, i) => {
      if (i === allSelectedTenantIds.length - 1) {
        next[id] = String(Math.round((total - assigned) * 100) / 100);
      } else {
        next[id] = String(per);
        assigned += per;
      }
    });
    setRentShares(next);
  }, [rentSplitEnabled, allSelectedTenantIds.join(","), form.monthlyRent]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (!primaryTenantId) {
      setError("Select a primary tenant.");
      return;
    }
    if (showUnitField && !form.unitId) {
      setError("Select a unit for this property.");
      return;
    }
    if (form.termPreset === "manual" && !form.endDate) {
      setError("Select an end date or choose a fixed term (6, 12, or 24 months).");
      return;
    }
    if (!effectiveEndDate) {
      setError("Enter a start date to calculate the lease end.");
      return;
    }
    if (effectiveEndDate <= form.startDate) {
      setError("End date must be after the start date.");
      return;
    }

    const monthlyRent = Number(form.monthlyRent);
    if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
      setError("Enter a valid monthly rent.");
      return;
    }

    if (rentSplitEnabled && allSelectedTenantIds.length >= 2) {
      const shareTotal = allSelectedTenantIds.reduce((sum, id) => sum + Number(rentShares[id] ?? 0), 0);
      if (Math.abs(shareTotal - monthlyRent) > 0.01) {
        setError("Split rent amounts must sum to the total monthly rent.");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      if (isEdit && editLeaseId) {
        await updateLease(editLeaseId, {
          unitId: form.unitId || null,
          startDate: form.startDate,
          leaseType: effectiveLeaseType,
          fixedTermEndDate: effectiveEndDate,
          monthlyRent,
          depositAmount: Number(form.depositAmount),
          rentDueDay,
          notes: form.notes || null
        });
        if (pendingLeaseContract && primaryTenantId) {
          await uploadLeaseContractOwner(primaryTenantId, editLeaseId, pendingLeaseContract);
          setPendingLeaseContract(null);
        }
        invalidatePropertyWorkspace(propertyId);
        navigate(`/owned-properties/${propertyId}?tab=tenants`);
        return;
      }

      const leaseTenants = allSelectedTenantIds.map((tenantId) => ({
        tenantId,
        role: tenantId === primaryTenantId ? "primary_tenant" : "co_tenant",
        isPrimary: tenantId === primaryTenantId,
        rentShareAmount:
          rentSplitEnabled && allSelectedTenantIds.length >= 2
            ? Number(rentShares[tenantId] ?? 0)
            : tenantId === primaryTenantId
              ? monthlyRent
              : null
      }));

      const created = await createLease(propertyId, {
        tenantId: primaryTenantId,
        unitId: form.unitId || null,
        leaseTenants,
        rentSplitEnabled: rentSplitEnabled && allSelectedTenantIds.length >= 2,
        startDate: form.startDate,
        leaseType: effectiveLeaseType,
        fixedTermEndDate: effectiveEndDate,
        endDate: effectiveEndDate,
        monthlyRent,
        depositAmount: Number(form.depositAmount),
        rentDueDay,
        notes: form.notes || undefined
      });
      trackEvent("lease_created", {
        source_page: `/owned-properties/${propertyId}/leases/new`
      });
      const newLeaseId = created.id != null ? String(created.id) : "";
      if (pendingLeaseContract && newLeaseId && primaryTenantId) {
        await uploadLeaseContractOwner(primaryTenantId, newLeaseId, pendingLeaseContract);
        setPendingLeaseContract(null);
      }
      invalidatePropertyWorkspace(propertyId);
      navigate(`/owned-properties/${propertyId}?tab=tenants`);
    } catch (err: unknown) {
      setError(propertyApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadingLease) {
    return (
      <AppFormPage>
        <p className="pg-muted">Loading lease…</p>
      </AppFormPage>
    );
  }

  const pageTitle = isEdit ? "Edit Lease" : "Add Lease";
  const submitLabel = isEdit ? "Save Changes" : "Create Lease";
  const backHref = isEdit && propertyId ? `/owned-properties/${propertyId}?tab=tenants` : "/leases";

  return (
    <AppFormPage>
      <Helmet>
        <title>{pageTitle} | The Property Guy</title>
      </Helmet>
      <AppPageHeader>
        <div className="pg-app-page-header__main">
          <AppPageTitle>{pageTitle}</AppPageTitle>
          <AppPageSubtitle>
            {isEdit
              ? "Update lease terms, rent, and dates. Tenant assignments are shown for reference."
              : "Select property and unit, choose tenants, and set lease terms. Tenants appear under the property automatically."}
          </AppPageSubtitle>
        </div>
        <ButtonLink href={backHref} variant="ghost">
          {isEdit ? "Back to property" : "Back to Leases"}
        </ButtonLink>
      </AppPageHeader>
      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      <Card>
            <form onSubmit={submit}>
              <Field label="Property">
                <select
                  className="pg-input"
                  value={propertyId}
                  onChange={(e) => {
                    if (isEdit) return;
                    setPropertyId(e.target.value);
                    setPrimaryTenantId("");
                    setAdditionalTenantIds([]);
                  }}
                  required
                  disabled={isEdit}
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>

              {propertyId && showUnitField ? (
                <Field label="Unit">
                  <select
                    className="pg-input"
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    disabled={unitsLoading}
                    required
                  >
                    <option value="">Select unit</option>
                    {units.map((u) => (
                      <option key={u.id ?? u.clientId} value={u.id ?? ""}>
                        {unitDisplayLabel(u)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <Field label="Primary tenant">
                <select
                  className="pg-input"
                  value={primaryTenantId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPrimaryTenantId(next);
                    setAdditionalTenantIds((prev) => prev.filter((id) => id !== next));
                  }}
                  disabled={!propertyId || tenantsLoading || isEdit}
                  required
                >
                  <option value="">{tenantsLoading ? "Loading tenants…" : "Select primary tenant"}</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
                {!tenantsLoading && propertyId && tenants.length === 0 ? (
                  <p className="pg-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                    No tenants yet.{" "}
                    <Link className="pg-link" to="/tenants/new">
                      Create a tenant
                    </Link>{" "}
                    first.
                  </p>
                ) : null}
              </Field>

              <Field label="Start date">
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </Field>

              <Field label="Lease term">
                <select
                  className="pg-input"
                  value={form.termPreset}
                  onChange={(e) => setForm({ ...form, termPreset: e.target.value as LeaseTermPreset })}
                >
                  {LEASE_TERM_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {form.termPreset !== "manual" && form.startDate && effectiveEndDate ? (
                  <p className="pg-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                    End date: <strong>{effectiveEndDate}</strong>
                    {termExpired ? (
                      <span> · Term has ended — lease will be saved as month-to-month</span>
                    ) : (
                      <span> · Fixed-term until this date</span>
                    )}
                  </p>
                ) : null}
              </Field>

              {form.termPreset === "manual" ? (
                <Field label="End date">
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                  />
                  {form.endDate && termExpired ? (
                    <p className="pg-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                      This date has passed — lease will be saved as month-to-month.
                    </p>
                  ) : null}
                </Field>
              ) : null}

              <Field label="Lease status">
                <div className="pg-input" style={{ background: "var(--surface-muted)", cursor: "default" }} aria-readonly>
                  {effectiveLeaseType === "MONTH_TO_MONTH" ? "Month-to-month" : "Fixed term"}
                </div>
                <p className="pg-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                  Set automatically from the term and dates. After a fixed term ends, the lease continues as
                  month-to-month.
                </p>
              </Field>

              <Field label="Monthly rent">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.monthlyRent}
                  onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
                  required
                />
                <p className="pg-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                  Drives property income and recurring rent. Deposit is shown on invoices as additional information.
                </p>
              </Field>

              <Field label="Deposit amount">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.depositAmount}
                  onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
                  required
                />
              </Field>

              <Field label="Rent due day">
                <select
                  className="pg-input"
                  value={form.rentDueMode}
                  onChange={(e) => setForm({ ...form, rentDueMode: e.target.value as RentDueMode })}
                >
                  <option value="first">1st of the month</option>
                  <option value="last">Last day of the month</option>
                  <option value="custom">Choose a day…</option>
                </select>
                {form.rentDueMode === "custom" ? (
                  <Input
                    type="date"
                    value={ymdFromRentDueDay(form.rentDueCustomDay)}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const day = new Date(e.target.value + "T12:00:00").getDate();
                      setForm({ ...form, rentDueCustomDay: day });
                    }}
                    style={{ marginTop: 8 }}
                    required
                  />
                ) : null}
                <p className="pg-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                  Due: {rentDueLabel(rentDueDay)}
                </p>
              </Field>

              <Field label="Additional tenants (optional)">
                {!isEdit ? (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <select
                        className="pg-input"
                        style={{ flex: "1 1 200px" }}
                        defaultValue=""
                        disabled={!primaryTenantId || additionalTenantOptions.length === 0}
                        onChange={(e) => {
                          if (e.target.value) {
                            addAdditionalTenant(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">Add tenant by name…</option>
                        {additionalTenantOptions
                          .filter((t) => !additionalTenantIds.includes(String(t.id)))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.firstName} {t.lastName}
                            </option>
                          ))}
                      </select>
                    </div>
                    {additionalTenantIds.length > 0 ? (
                      <ul className="pg-workspace-inset-list" style={{ marginTop: 10 }}>
                        {additionalTenantIds.map((id) => {
                          const t = tenants.find((row) => String(row.id) === id);
                          return (
                            <li key={id} className="pg-workspace-inset" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <span>{t ? `${t.firstName} ${t.lastName}` : id}</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeAdditionalTenant(id)}>
                                Remove
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="pg-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                        Add co-tenants, spouses, or occupants on the same lease. Names only — no extra details required.
                      </p>
                    )}
                  </>
                ) : additionalTenantIds.length > 0 ? (
                  <ul className="pg-workspace-inset-list" style={{ marginTop: 0 }}>
                    {additionalTenantIds.map((id) => {
                      const t = tenants.find((row) => String(row.id) === id);
                      return (
                        <li key={id} className="pg-workspace-inset">
                          {t ? `${t.firstName} ${t.lastName}`.trim() || id : id}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="pg-muted" style={{ fontSize: 12, margin: 0 }}>No additional tenants on this lease.</p>
                )}
              </Field>

              {allSelectedTenantIds.length >= 2 ? (
                <Field label="Split monthly rent">
                  {!isEdit ? (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={rentSplitEnabled}
                      onChange={(e) => setRentSplitEnabled(e.target.checked)}
                    />
                    Split rent between tenants (shares must sum to total monthly rent)
                  </label>
                  ) : (
                    <p className="pg-muted" style={{ fontSize: 13, margin: 0 }}>
                      {rentSplitEnabled ? "Rent is split between tenants on this lease." : "Rent is not split between tenants."}
                    </p>
                  )}
                  {rentSplitEnabled ? (
                    <div className="pg-workspace-inset-list" style={{ marginTop: 10 }}>
                      {allSelectedTenantIds.map((id) => {
                        const t = tenants.find((row) => String(row.id) === id);
                        return (
                          <label key={id} className="pg-workspace-inset" style={{ display: "block" }}>
                            <span className="pg-muted" style={{ fontSize: 13 }}>
                              {t ? `${t.firstName} ${t.lastName}` : id}
                              {id === primaryTenantId ? " (primary)" : ""}
                            </span>
                            {isEdit ? (
                              <span>{rentShares[id] ? `R ${Number(rentShares[id]).toLocaleString("en-ZA")}` : "—"}</span>
                            ) : (
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={rentShares[id] ?? ""}
                              onChange={(e) => setRentShares((prev) => ({ ...prev, [id]: e.target.value }))}
                              required
                            />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </Field>
              ) : null}

              <Field label="Notes (optional)">
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>

              <LeaseContractUploadSection
                tenantId={primaryTenantId || null}
                leaseId={editLeaseId}
                disabled={saving || tenantsLoading}
                pendingFile={pendingLeaseContract}
                onPendingFileChange={setPendingLeaseContract}
              />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <Button type="submit" loading={saving}>
                  {submitLabel}
                </Button>
                <ButtonLink href={backHref} variant="ghost">
                  Cancel
                </ButtonLink>
              </div>
            </form>
          </Card>
    </AppFormPage>
  );
}
