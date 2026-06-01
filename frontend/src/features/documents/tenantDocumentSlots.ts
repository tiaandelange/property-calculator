import type { ApplicantDocumentSlotId } from "../applicants/applicantDocumentSlots";

export const LEASE_CONTRACT_SLOT = "LEASE_CONTRACT" as const;

export type LeaseDocumentSlotId = typeof LEASE_CONTRACT_SLOT;

export type TenantDocumentSlotId = ApplicantDocumentSlotId | LeaseDocumentSlotId;

export const LEASE_CONTRACT_SLOT_DEF = {
  slot: LEASE_CONTRACT_SLOT,
  label: "Signed lease agreement",
  description: "Upload the signed lease contract. It will appear on each tenant’s file under Documents."
} as const;

export function isLeaseContractSlot(slot: string): slot is LeaseDocumentSlotId {
  return slot === LEASE_CONTRACT_SLOT;
}

export function tenantDocumentSlotLabel(slot: string): string {
  if (isLeaseContractSlot(slot)) return LEASE_CONTRACT_SLOT_DEF.label;
  return slot;
}
