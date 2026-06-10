import {
  businessDetailsToPayload,
  normalizeBusinessDetails,
  normalizeProfileDetails,
  profileDetailsToPayload,
  type NormalizedBusinessDetails,
  type NormalizedProfileDetails
} from "../../../api/_lib/profileContactShared";

export type ProfileContactFormState = {
  fullName: string;
  personalPhone: string;
  personalAddress: string;
  avatarStorageKey: string;
  useBusinessForFinancials: boolean;
  businessName: string;
  landlordName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
};

export function emptyProfileContactForm(email = ""): ProfileContactFormState {
  return {
    fullName: "",
    personalPhone: "",
    personalAddress: "",
    avatarStorageKey: "",
    useBusinessForFinancials: false,
    businessName: "",
    landlordName: "",
    businessEmail: email,
    businessPhone: "",
    businessAddress: ""
  };
}

export function profileContactFormFromMe(
  me: {
    name?: string | null;
    email?: string;
    profileDetails?: NormalizedProfileDetails;
    businessDetails?: NormalizedBusinessDetails;
  },
  useBusinessForFinancials: boolean
): ProfileContactFormState {
  const p = me.profileDetails ?? normalizeProfileDetails(null);
  const b = me.businessDetails ?? normalizeBusinessDetails(null);
  return {
    fullName: me.name?.trim() ?? "",
    personalPhone: p.phone,
    personalAddress: p.address,
    avatarStorageKey: p.avatarStorageKey,
    useBusinessForFinancials,
    businessName: b.businessName,
    landlordName: b.landlordName,
    businessEmail: b.email || me.email?.trim() || "",
    businessPhone: b.phone,
    businessAddress: b.address
  };
}

export function profileContactFormToPayloads(form: ProfileContactFormState) {
  const profileDetails = profileDetailsToPayload({
    phone: form.personalPhone.trim(),
    address: form.personalAddress.trim(),
    avatarStorageKey: form.avatarStorageKey.trim()
  });
  const businessDetails = businessDetailsToPayload({
    businessName: form.businessName.trim(),
    landlordName: form.landlordName.trim(),
    email: form.businessEmail.trim(),
    phone: form.businessPhone.trim(),
    address: form.businessAddress.trim()
  });
  return {
    fullName: form.fullName.trim() || null,
    profileDetails,
    businessDetails,
    useBusinessForFinancials: form.useBusinessForFinancials
  };
}
