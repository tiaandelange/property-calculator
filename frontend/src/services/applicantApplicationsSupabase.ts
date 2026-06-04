import { getSupabase } from "../lib/supabaseClient";
import {
  DEFAULT_APPLICANT_FORM_TEMPLATE,
  normalizeApplicantFormTemplate,
  type ApplicantFormTemplate
} from "../features/applicants/applicantFormTemplate";
import type {
  ApplicantApplicationRecord,
  ApplicantInvitePublicContext,
  ApplicantSubmissionPayload
} from "../features/applicants/applicantTypes";
import { combinedIncomeFromValues, personPayloadFromValues } from "../features/applicants/applicantTypes";

function toError(e: { message?: string } | Error): Error {
  return e instanceof Error ? e : new Error(String(e.message ?? "Request failed."));
}

async function requireUserId(): Promise<string> {
  try {
    return await requireUserIdFromSession();
  } catch (e) {
    throw toError(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function getOrCreateApplicantInvite(propertyId: string, unitId?: string | null) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_or_create_applicant_invite", {
    p_property_id: propertyId,
    p_unit_id: unitId ?? null
  });
  if (error) throw toError(error);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    token: String(row.token ?? ""),
    propertyId: String(row.propertyId ?? propertyId),
    unitId: row.unitId != null ? String(row.unitId) : null
  };
}

export async function getApplicantInvitePublic(token: string): Promise<ApplicantInvitePublicContext> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_applicant_invite_public", { p_token: token });
  if (error) throw toError(error);
  const row = data as Record<string, unknown>;
  return {
    propertyName: String(row.propertyName ?? "Property"),
    propertyAddress: String(row.propertyAddress ?? ""),
    unitName: row.unitName != null ? String(row.unitName) : null,
    targetRent: Number(row.targetRent ?? 0),
    formTemplate: normalizeApplicantFormTemplate(row.formTemplate)
  };
}

function payloadForRpc(template: ApplicantFormTemplate, payload: ApplicantSubmissionPayload) {
  const primary = personPayloadFromValues(payload.primary);
  const co = payload.coApplicant ? personPayloadFromValues(payload.coApplicant) : null;
  if (primary.monthlyIncome === undefined || primary.monthlyIncome === "") {
    primary.monthlyIncome = String(combinedIncomeFromValues(template, payload.primary));
  }
  return {
    primary,
    coApplicantEnabled: payload.coApplicantEnabled,
    coApplicant: payload.coApplicantEnabled && co ? co : null,
    template
  };
}

export async function submitApplicantApplication(
  token: string,
  template: ApplicantFormTemplate,
  payload: ApplicantSubmissionPayload
) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("submit_applicant_application", {
    p_token: token,
    p_payload: payloadForRpc(template, payload)
  });
  if (error) throw toError(error);
  const row = data as Record<string, unknown>;
  return {
    tenantId: String(row.tenantId ?? ""),
    fitScore: Number(row.fitScore ?? 0)
  };
}

export async function getApplicantApplicationOwner(tenantId: string): Promise<ApplicantApplicationRecord> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_applicant_application_owner", { p_tenant_id: tenantId });
  if (error) throw toError(error);
  const row = data as Record<string, unknown>;
  const tenant = (row.tenant ?? {}) as Record<string, unknown>;
  const activeTenant = (row.activeTenant ?? tenant) as Record<string, unknown>;
  const application = (row.application ?? {}) as Record<string, unknown>;
  const formData = application.formData as Record<string, unknown> | null;
  const primaryRaw = (formData?.primary ?? {}) as Record<string, unknown>;
  const coApplicantRaw = application.coApplicant as Record<string, unknown> | null | undefined;
  const coEnabled = Boolean(application.coApplicantEnabled ?? formData?.coApplicantEnabled ?? coApplicantRaw);
  const firstName = String(activeTenant.firstName ?? primaryRaw.firstName ?? "");
  const lastName = String(activeTenant.lastName ?? primaryRaw.lastName ?? "");

  return {
    tenantId: String(activeTenant.id ?? tenantId),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email:
      activeTenant.email != null
        ? String(activeTenant.email)
        : primaryRaw.email != null
          ? String(primaryRaw.email)
          : null,
    phone:
      activeTenant.phone != null
        ? String(activeTenant.phone)
        : primaryRaw.phone != null
          ? String(primaryRaw.phone)
          : null,
    propertyId:
      activeTenant.appliedPropertyId != null
        ? String(activeTenant.appliedPropertyId)
        : tenant.appliedPropertyId != null
          ? String(tenant.appliedPropertyId)
          : null,
    propertyName: null,
    monthlyIncome: Number(application.monthlyIncome ?? 0),
    fitScore: Number(application.fitScore ?? 0),
    targetRent: Number(application.targetRent ?? 0),
    submittedAt: application.submittedAt != null ? String(application.submittedAt) : null,
    formData: formData
      ? {
          primary: primaryRaw as ApplicantSubmissionPayload["primary"],
          coApplicantEnabled: coEnabled,
          coApplicant: coApplicantRaw
            ? (coApplicantRaw as ApplicantSubmissionPayload["coApplicant"])
            : formData.coApplicant
              ? (formData.coApplicant as ApplicantSubmissionPayload["coApplicant"])
              : null,
          template: formData.template
            ? normalizeApplicantFormTemplate(formData.template)
            : DEFAULT_APPLICANT_FORM_TEMPLATE
        }
      : null,
    previousResidency:
      application.previousResidency != null
        ? String(application.previousResidency)
        : primaryRaw.previousResidency != null
          ? String(primaryRaw.previousResidency)
          : null,
    landlordContact:
      application.landlordContact != null
        ? String(application.landlordContact)
        : primaryRaw.landlordContact != null
          ? String(primaryRaw.landlordContact)
          : null,
    timeRented:
      application.timeRented != null
        ? String(application.timeRented)
        : primaryRaw.timeRented != null
          ? String(primaryRaw.timeRented)
          : null
  };
}

export async function updateApplicantApplicationOwner(
  tenantId: string,
  template: ApplicantFormTemplate,
  payload: ApplicantSubmissionPayload
) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("update_applicant_application_owner", {
    p_tenant_id: tenantId,
    p_payload: payloadForRpc(template, payload)
  });
  if (error) throw toError(error);
  const row = data as Record<string, unknown>;
  return { tenantId, fitScore: Number(row.fitScore ?? 0) };
}

export async function listApplicantApplicationDetailsByTenantIds(
  tenantIds: string[]
): Promise<Map<string, { monthlyIncome: number; fitScore: number; targetRent: number; submittedAt: string | null }>> {
  if (!tenantIds.length) return new Map();
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("applicant_application_details")
    .select("tenant_id, monthly_income, fit_score, target_rent, submitted_at")
    .in("tenant_id", tenantIds);
  if (error) throw toError(error);
  const map = new Map<string, { monthlyIncome: number; fitScore: number; targetRent: number; submittedAt: string | null }>();
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const id = String(r.tenant_id ?? "");
    map.set(id, {
      monthlyIncome: Number(r.monthly_income ?? 0),
      fitScore: Number(r.fit_score ?? 0),
      targetRent: Number(r.target_rent ?? 0),
      submittedAt: r.submitted_at != null ? String(r.submitted_at) : null
    });
  }
  return map;
}

export async function fetchApplicantApplicationDetailsByTenantId(
  tenantId: string
): Promise<ApplicantApplicationRecord | null> {
  try {
    return await getApplicantApplicationOwner(tenantId);
  } catch {
    return null;
  }
}

/** Every applicant tenant row (primary and co) for picklists — not grouped. */
export async function listApplicantPicklist(): Promise<
  Array<{
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    propertyName?: string | null;
    fitScore?: number | null;
    monthlyIncome?: number | null;
  }>
> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tenants")
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      phone,
      application_group_id,
      applicant_group_role,
      applied_property_id,
      properties:applied_property_id ( name )
    `
    )
    .eq("status", "APPLICANT")
    .order("created_at", { ascending: false });
  if (error) throw toError(error);

  const rows = (data ?? []) as Record<string, unknown>[];

  const resolvePrimaryId = (row: Record<string, unknown>): string => {
    const id = String(row.id ?? "");
    if (row.applicant_group_role === "CO" && row.application_group_id) {
      const match = rows.find(
        (r) =>
          r.application_group_id === row.application_group_id && r.applicant_group_role === "PRIMARY"
      );
      if (match?.id) return String(match.id);
    }
    return id;
  };

  const primaryIds = [...new Set(rows.map((row) => resolvePrimaryId(row)))];
  const detailsByPrimary = await listApplicantApplicationDetailsByTenantIds(primaryIds);

  return rows.map((row) => {
    const id = String(row.id ?? "");
    const firstName = String(row.first_name ?? "");
    const lastName = String(row.last_name ?? "");
    const props = row.properties as Record<string, unknown> | null | undefined;
    const propertyName = props?.name != null ? String(props.name) : null;
    const primaryId = resolvePrimaryId(row);
    const detail = detailsByPrimary.get(primaryId);
    return {
      id,
      fullName: `${firstName} ${lastName}`.trim(),
      email: row.email != null ? String(row.email) : null,
      phone: row.phone != null ? String(row.phone) : null,
      propertyName,
      fitScore: detail?.fitScore ?? null,
      monthlyIncome: detail?.monthlyIncome ?? null
    };
  });
}

export function applicantApplyUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/apply/${token}`;
  }
  return `/apply/${token}`;
}

export { buildSubmissionPayload } from "../features/applicants/applicantTypes";
