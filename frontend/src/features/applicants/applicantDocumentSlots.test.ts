import { describe, expect, it } from "vitest";
import {
  appendPendingGroupFiles,
  emptyApplicantDocumentSlotsForGroup,
  type ApplicantPendingDocuments
} from "./applicantDocumentSlots";

describe("appendPendingGroupFiles", () => {
  it("fills empty payslip slots without removing existing files", () => {
    const first = new File(["a"], "payslip-jan.pdf", { type: "application/pdf" });
    const second = new File(["b"], "payslip-feb.pdf", { type: "application/pdf" });
    const pending: ApplicantPendingDocuments = { PAYSLIP_1: first };

    const next = appendPendingGroupFiles("payslips", [second], pending);

    expect(next.PAYSLIP_1).toBe(first);
    expect(next.PAYSLIP_2).toBe(second);
    expect(next.PAYSLIP_3).toBeUndefined();
  });

  it("reports remaining empty slots in order", () => {
    const occupied = ["PAYSLIP_1", "PAYSLIP_3"] as const;
    expect(emptyApplicantDocumentSlotsForGroup("payslips", occupied)).toEqual(["PAYSLIP_2"]);
  });
});
