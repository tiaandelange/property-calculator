import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPLICANT_FORM_TEMPLATE,
  emptyFieldValues,
  fieldValuesFromRecord,
  formatAdditionalOccupants,
  formatApplicantAnimalsSummary,
  mergeApplicantSystemFields,
  normalizeApplicantFormTemplate
} from "./applicantFormTemplate";

describe("normalizeApplicantFormTemplate", () => {
  it("includes additional occupants and pets on legacy templates", () => {
    const legacy = {
      ...DEFAULT_APPLICANT_FORM_TEMPLATE,
      fields: DEFAULT_APPLICANT_FORM_TEMPLATE.fields.filter(
        (f) => f.id !== "additionalOccupants" && f.id !== "animals"
      )
    };
    const normalized = normalizeApplicantFormTemplate(legacy);
    expect(normalized.fields.some((f) => f.id === "additionalOccupants")).toBe(true);
    expect(normalized.fields.some((f) => f.id === "animals")).toBe(true);
    const incomeIdx = normalized.fields.findIndex((f) => f.id === "monthlyIncome");
    const occupantsIdx = normalized.fields.findIndex((f) => f.id === "additionalOccupants");
    expect(occupantsIdx).toBe(incomeIdx + 1);
  });
});

describe("emptyFieldValues", () => {
  it("defaults pets to no and counts to zero", () => {
    const values = emptyFieldValues(DEFAULT_APPLICANT_FORM_TEMPLATE);
    expect(values.hasAnimals).toBe("no");
    expect(values.catCount).toBe("0");
    expect(values.dogCount).toBe("0");
  });
});

describe("fieldValuesFromRecord", () => {
  it("restores pets and occupants from saved primary payload", () => {
    const values = fieldValuesFromRecord(DEFAULT_APPLICANT_FORM_TEMPLATE, {
      hasAnimals: "yes",
      catCount: "2",
      dogCount: "1",
      additionalOccupants: "3"
    });
    expect(values.hasAnimals).toBe("yes");
    expect(values.catCount).toBe("2");
    expect(values.dogCount).toBe("1");
    expect(values.additionalOccupants).toBe("3");
  });
});

describe("display helpers", () => {
  it("formats animals summary", () => {
    expect(
      formatApplicantAnimalsSummary({ hasAnimals: "no", catCount: "0", dogCount: "0" })
    ).toBe("No pets");
    expect(
      formatApplicantAnimalsSummary({ hasAnimals: "yes", catCount: "2", dogCount: "1" })
    ).toBe("2 cats, 1 dog");
  });

  it("formats additional occupants", () => {
    expect(formatAdditionalOccupants("1")).toBe("1 additional person");
    expect(formatAdditionalOccupants("3")).toBe("3 additional people");
    expect(formatAdditionalOccupants("")).toBeNull();
  });
});

describe("mergeApplicantSystemFields", () => {
  it("inserts missing system fields", () => {
    const merged = mergeApplicantSystemFields(
      DEFAULT_APPLICANT_FORM_TEMPLATE.fields.filter((f) => f.id !== "animals")
    );
    expect(merged.some((f) => f.id === "animals")).toBe(true);
  });
});
