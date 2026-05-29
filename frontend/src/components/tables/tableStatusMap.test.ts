import { describe, expect, it } from "vitest";
import { proplyticStatusLabel, proplyticStatusVariant } from "./tableStatusMap";

describe("tableStatusMap", () => {
  it("maps generated to Draft label and warning variant", () => {
    expect(proplyticStatusLabel("GENERATED")).toBe("Draft");
    expect(proplyticStatusVariant("GENERATED")).toBe("warning");
  });

  it("maps paid and active to success", () => {
    expect(proplyticStatusVariant("PAID")).toBe("success");
    expect(proplyticStatusVariant("active")).toBe("success");
  });

  it("maps overdue to danger", () => {
    expect(proplyticStatusVariant("OVERDUE")).toBe("danger");
  });
});
