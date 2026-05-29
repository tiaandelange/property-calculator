-- Invoice foundation (step 1): new enum values must commit before use in indexes/RPCs.

DO $$
BEGIN
  CREATE TYPE public.app_invoice_type AS ENUM ('RENT', 'MANUAL', 'UTILITY_RECOVERY', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TYPE public.app_invoice_status ADD VALUE IF NOT EXISTS 'GENERATED';
ALTER TYPE public.app_invoice_status ADD VALUE IF NOT EXISTS 'DUE';
ALTER TYPE public.app_invoice_status ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE public.app_invoice_status ADD VALUE IF NOT EXISTS 'VOID';
