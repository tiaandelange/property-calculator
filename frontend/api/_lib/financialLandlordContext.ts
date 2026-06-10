import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeBusinessDetails,
  normalizeProfileDetails,
  resolveFinancialLandlordParty,
  type FinancialLandlordParty
} from "./profileContactShared.js";

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

export type FinancialLandlordContext = {
  useBusinessForFinancials: boolean;
  landlord: FinancialLandlordParty;
  profileDetails: ReturnType<typeof normalizeProfileDetails>;
  businessDetails: ReturnType<typeof normalizeBusinessDetails>;
  invoicePaymentDetails: unknown;
};

/**
 * Resolves landlord/party details for invoices, PDFs, and email — honours
 * Settings → Edit profile → “Use business details for financials”.
 */
export async function loadFinancialLandlordContext(
  sb: SupabaseClient,
  uid: string,
  authEmail?: string | null
): Promise<FinancialLandlordContext> {
  const [{ data: profile }, { data: settings }, authResult] = await Promise.all([
    sb
      .from("profiles")
      .select("full_name, invoice_payment_details, profile_details, business_details")
      .eq("id", uid)
      .maybeSingle(),
    sb.from("user_settings").select("use_business_for_financials").eq("user_id", uid).maybeSingle(),
    authEmail != null ? Promise.resolve({ data: { user: { email: authEmail } } }) : sb.auth.getUser()
  ]);

  const paymentRaw = profile?.invoice_payment_details;
  const profileDetails = normalizeProfileDetails(profile?.profile_details);
  const businessDetails = normalizeBusinessDetails(profile?.business_details, paymentRaw);
  const ccEmail = str(
    (paymentRaw as Record<string, unknown> | null)?.ccEmail ??
      (paymentRaw as Record<string, unknown> | null)?.cc_email
  );
  const email = authEmail ?? authResult.data.user?.email ?? null;

  const useBusinessForFinancials = settings?.use_business_for_financials === true;
  const landlord = resolveFinancialLandlordParty({
    useBusinessForFinancials,
    fullName: profile?.full_name,
    authEmail: email,
    profileDetails,
    businessDetails,
    invoiceCcEmail: ccEmail
  });

  return {
    useBusinessForFinancials,
    landlord,
    profileDetails,
    businessDetails,
    invoicePaymentDetails: paymentRaw
  };
}
