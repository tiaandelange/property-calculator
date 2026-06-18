import { describe, expect, it } from "vitest";
import { resolveFinancialLandlordParty } from "./profileContactShared.js";

describe("resolveFinancialLandlordParty", () => {
  it("uses personal profile when business toggle is off", () => {
    const party = resolveFinancialLandlordParty({
      useBusinessForFinancials: false,
      fullName: "Alex Landlord",
      authEmail: "alex@example.com",
      profileDetails: { phone: "082 111 2222", address: "1 Home St", avatarStorageKey: "", avatarIcon: "property" },
      businessDetails: {
        businessName: "ACME Props",
        landlordName: "ACME",
        email: "biz@example.com",
        phone: "082 999 8888",
        address: "99 Biz Rd"
      }
    });
    expect(party.name).toBe("Alex Landlord");
    expect(party.email).toBe("alex@example.com");
    expect(party.phone).toBe("082 111 2222");
    expect(party.address).toBe("1 Home St");
  });

  it("uses business details when toggle is on", () => {
    const party = resolveFinancialLandlordParty({
      useBusinessForFinancials: true,
      fullName: "Alex Landlord",
      authEmail: "alex@example.com",
      profileDetails: { phone: "082 111 2222", address: "1 Home St", avatarStorageKey: "", avatarIcon: "property" },
      businessDetails: {
        businessName: "ACME Properties",
        landlordName: "Jane ACME",
        email: "rents@acme.co.za",
        phone: "082 999 8888",
        address: "99 Business Park"
      }
    });
    expect(party.name).toBe("ACME Properties");
    expect(party.email).toBe("rents@acme.co.za");
    expect(party.phone).toBe("082 999 8888");
    expect(party.address).toBe("99 Business Park");
  });
});
