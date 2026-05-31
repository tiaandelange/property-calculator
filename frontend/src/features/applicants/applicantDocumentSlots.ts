export type ApplicantDocumentSlotId =
  | "ID"
  | "PAYSLIP_1"
  | "PAYSLIP_2"
  | "PAYSLIP_3"
  | "BANK_STATEMENT_1"
  | "BANK_STATEMENT_2"
  | "BANK_STATEMENT_3";

export type ApplicantDocumentSlotDef = {
  slot: ApplicantDocumentSlotId;
  label: string;
  group: "identity" | "payslips" | "bank";
  hint?: string;
};

export const APPLICANT_DOCUMENT_GROUPS: Array<{ id: ApplicantDocumentSlotDef["group"]; title: string; description: string }> = [
  { id: "identity", title: "Identity", description: "Upload a clear copy of your ID document." },
  { id: "payslips", title: "Payslips (3 months)", description: "Upload your three most recent payslips." },
  { id: "bank", title: "Bank statements (3 months)", description: "Upload your three most recent bank statements." }
];

export const APPLICANT_DOCUMENT_SLOTS: ApplicantDocumentSlotDef[] = [
  { slot: "ID", label: "ID document", group: "identity" },
  { slot: "PAYSLIP_1", label: "Payslip — most recent", group: "payslips" },
  { slot: "PAYSLIP_2", label: "Payslip — 2 months ago", group: "payslips" },
  { slot: "PAYSLIP_3", label: "Payslip — 3 months ago", group: "payslips" },
  { slot: "BANK_STATEMENT_1", label: "Bank statement — most recent", group: "bank" },
  { slot: "BANK_STATEMENT_2", label: "Bank statement — 2 months ago", group: "bank" },
  { slot: "BANK_STATEMENT_3", label: "Bank statement — 3 months ago", group: "bank" }
];

export function applicantDocumentSlotsForGroup(group: ApplicantDocumentSlotDef["group"]): ApplicantDocumentSlotDef[] {
  return APPLICANT_DOCUMENT_SLOTS.filter((s) => s.group === group);
}

export function applicantDocumentSlotIdsForGroup(group: ApplicantDocumentSlotDef["group"]): ApplicantDocumentSlotId[] {
  return applicantDocumentSlotsForGroup(group).map((s) => s.slot);
}

export function applicantDocumentsCompleteCount(uploadedSlots: Set<string>): number {
  return APPLICANT_DOCUMENT_SLOTS.filter((s) => uploadedSlots.has(s.slot)).length;
}

export function applicantDocumentsAllComplete(uploadedSlots: Set<string>): boolean {
  return applicantDocumentsCompleteCount(uploadedSlots) === APPLICANT_DOCUMENT_SLOTS.length;
}

export function applicantDocumentGroupComplete(
  group: ApplicantDocumentSlotDef["group"],
  uploadedSlots: Set<string>
): boolean {
  return applicantDocumentSlotIdsForGroup(group).every((slot) => uploadedSlots.has(slot));
}

export function applicantDocumentGroupsCompleteCount(uploadedSlots: Set<string>): number {
  return APPLICANT_DOCUMENT_GROUPS.filter((g) => applicantDocumentGroupComplete(g.id, uploadedSlots)).length;
}

export function applicantDocumentFilenamesForGroup(
  group: ApplicantDocumentSlotDef["group"],
  docsBySlot: Map<ApplicantDocumentSlotId, { originalFilename?: string | null; fileName?: string }>
): string {
  return applicantDocumentSlotIdsForGroup(group)
    .map((slot) => docsBySlot.get(slot))
    .filter(Boolean)
    .map((doc) => doc!.originalFilename || doc!.fileName || "Document")
    .join(", ");
}

export type ApplicantPendingDocuments = Partial<Record<ApplicantDocumentSlotId, File>>;

export function applicantDocumentGroupCompleteFromPending(
  group: ApplicantDocumentSlotDef["group"],
  pendingBySlot: ApplicantPendingDocuments
): boolean {
  return applicantDocumentSlotIdsForGroup(group).every((slot) => Boolean(pendingBySlot[slot]));
}

export function applicantDocumentGroupsCompleteCountFromPending(pendingBySlot: ApplicantPendingDocuments): number {
  return APPLICANT_DOCUMENT_GROUPS.filter((g) => applicantDocumentGroupCompleteFromPending(g.id, pendingBySlot)).length;
}

export function allApplicantDocumentGroupsComplete(pendingBySlot: ApplicantPendingDocuments): boolean {
  return applicantDocumentGroupsCompleteCountFromPending(pendingBySlot) === APPLICANT_DOCUMENT_GROUPS.length;
}

export function applicantDocumentFilenamesForGroupFromPending(
  group: ApplicantDocumentSlotDef["group"],
  pendingBySlot: ApplicantPendingDocuments
): string {
  return applicantDocumentSlotIdsForGroup(group)
    .map((slot) => pendingBySlot[slot]?.name)
    .filter(Boolean)
    .join(", ");
}

export function applicantPendingDocumentsForGroup(
  group: ApplicantDocumentSlotDef["group"],
  pendingBySlot: ApplicantPendingDocuments
): ApplicantPendingDocuments {
  const next: ApplicantPendingDocuments = {};
  for (const slot of applicantDocumentSlotIdsForGroup(group)) {
    if (pendingBySlot[slot]) next[slot] = pendingBySlot[slot];
  }
  return next;
}
