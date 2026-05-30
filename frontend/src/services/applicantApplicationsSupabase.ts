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
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
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
  const application = (row.application ?? {}) as Record<string, unknown>;
  const formData = application.formData as Record<string, unknown> | null;
  const primaryRaw = (formData?.primary ?? {}) as Record<string, unknown>;
  const firstName = String(tenant.firstName ?? primaryRaw.firstName ?? "");
  const lastName = String(tenant.lastName ?? primaryRaw.lastName ?? "");
  return {
    tenantId,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email:
      tenant.email != null ? String(tenant.email) : primaryRaw.email != null ? String(primaryRaw.email) : null,
    phone:
      tenant.phone != null ? String(tenant.phone) : primaryRaw.phone != null ? String(primaryRaw.phone) : null,
    propertyId: tenant.appliedPropertyId != null ? String(tenant.appliedPropertyId) : null,
    propertyName: null,
    monthlyIncome: Number(application.monthlyIncome ?? 0),
    fitScore: Number(application.fitScore ?? 0),
    targetRent: Number(application.targetRent ?? 0),
    submittedAt: application.submittedAt != null ? String(application.submittedAt) : null,
    formData: formData
      ? {
          primary: primaryRaw as ApplicantSubmissionPayload["primary"],
          coApplicantEnabled: Boolean(formData.coApplicantEnabled),
          coApplicant: formData.coApplicant
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
  await requireUserId();
  const sb = getSupabase();
  const { data: detail, error: detailErr } = await sb
    .from("applicant_application_details")
    .select(
      "tenant_id, monthly_income, fit_score, target_rent, submitted_at, previous_residency, landlord_contact, time_rented, form_data, co_applicant, property_id"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (detailErr) throw toError(detailErr);
  if (!detail) return null;

  const { data: tenant, error: tenantErr } = await sb
    .from("tenants")
    .select("first_name, last_name, email, phone, applied_property_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr) throw toError(tenantErr);
  if (!tenant) return null;

  const row = detail as Record<string, unknown>;
  const t = tenant as Record<string, unknown>;
  const formData = row.form_data as Record<string, unknown> | null;
  const primaryRaw = (formData?.primary ?? {}) as Record<string, unknown>;
  const firstName = String(t.first_name ?? primaryRaw.firstName ?? "");
  const lastName = String(t.last_name ?? primaryRaw.lastName ?? "");

  return {
    tenantId,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: t.email != null ? String(t.email) : primaryRaw.email != null ? String(primaryRaw.email) : null,
    phone: t.phone != null ? String(t.phone) : primaryRaw.phone != null ? String(primaryRaw.phone) : null,
    propertyId:
      t.applied_property_id != null
        ? String(t.applied_property_id)
        : row.property_id != null
          ? String(row.property_id)
          : null,
    propertyName: null,
    monthlyIncome: Number(row.monthly_income ?? 0),
    fitScore: Number(row.fit_score ?? 0),
    targetRent: Number(row.target_rent ?? 0),
    submittedAt: row.submitted_at != null ? String(row.submitted_at) : null,
    formData: formData
      ? {
          primary: primaryRaw as ApplicantSubmissionPayload["primary"],
          coApplicantEnabled: Boolean(formData.coApplicantEnabled),
          coApplicant: formData.coApplicant
            ? (formData.coApplicant as ApplicantSubmissionPayload["coApplicant"])
            : null,
          template: formData.template
            ? normalizeApplicantFormTemplate(formData.template)
            : DEFAULT_APPLICANT_FORM_TEMPLATE
        }
      : null,
    previousResidency: row.previous_residency != null ? String(row.previous_residency) : null,
    landlordContact: row.landlord_contact != null ? String(row.landlord_contact) : null,
    timeRented: row.time_rented != null ? String(row.time_rented) : null
  };
}

export function applicantApplyUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/apply/${token}`;
  }
  return `/apply/${token}`;
}

export { buildSubmissionPayload } from "../features/applicants/applicantTypes";
