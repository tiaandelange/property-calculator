import { describe, expect, it } from "vitest";
import { marketingFooterCompanyLinks } from "./homeMarketingFooter";

describe("marketingFooterCompanyLinks", () => {
  it("links Contact to /contact without duplicate Pricing", () => {
    const labels = marketingFooterCompanyLinks.map((l) => l.label);
    expect(labels).toContain("Contact");
    expect(labels).not.toContain("Pricing");
    const contact = marketingFooterCompanyLinks.find((l) => l.label === "Contact");
    expect(contact?.to).toBe("/contact");
  });
});
