/**
 * Maps SPA tenant payloads (camelCase, Express/Prisma shape) to `public.tenants` columns (snake_case),
 * and normalizes Supabase rows back for the UI.
 */
import { snakeRowToCamel } from "./propertyRowMapping";

const TENANT_STATUS = new Set(["ACTIVE", "PAST", "APPLICANT"]);

function coerceStatus(raw: unknown): string {
  const u = String(raw ?? "ACTIVE").toUpperCase();
  return TENANT_STATUS.has(u) ? u : "ACTIVE";
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function requiredName(v: unknown, label: string): string {
  const t = String(v ?? "").trim();
  if (!t) throw new Error(`${label} is required.`);
  return t;
}

/** UUID string or null (never numeric). */
export function coercePropertyIdForDb(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim();
}

/** Insert/update body for `public.tenants` (no `user_id`). */
export function tenantToDb(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    first_name: requiredName(input.firstName, "firstName"),
    last_name: requiredName(input.lastName, "lastName"),
    email: strOrNull(input.email),
    phone: strOrNull(input.phone),
    id_number: strOrNull(input.idNumber),
    emergency_contact_name: strOrNull(input.emergencyContactName),
    emergency_contact_phone: strOrNull(input.emergencyContactPhone)
  };
  if (input.status !== undefined) {
    out.status = coerceStatus(input.status);
  }
  if (input.propertyId !== undefined) {
    out.property_id = coercePropertyIdForDb(input.propertyId);
  }
  if (input.appliedPropertyId !== undefined) {
    out.applied_property_id = coercePropertyIdForDb(input.appliedPropertyId);
  }
  if (input.appliedUnitId !== undefined) {
    out.applied_unit_id = coercePropertyIdForDb(input.appliedUnitId);
  }
  return out;
}

/** Flat tenant row + optional embedded `properties` join → camelCase `property`. */
export function dbToTenant(row: Record<string, unknown>): Record<string, unknown> {
  const c = { ...snakeRowToCamel(row) } as Record<string, unknown>;
  const rel = c.properties ?? c.property;
  if (rel && typeof rel === "object" && !Array.isArray(rel)) {
    c.property = snakeRowToCamel(rel as Record<string, unknown>);
  } else if (Array.isArray(rel) && rel[0] && typeof rel[0] === "object") {
    c.property = snakeRowToCamel(rel[0] as Record<string, unknown>);
  }
  delete c.properties;
  return c;
}
