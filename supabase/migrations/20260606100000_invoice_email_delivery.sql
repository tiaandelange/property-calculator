-- Invoice email delivery (Resend): metadata on invoices + audit log + optional email templates in user_settings.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS email_provider text,
  ADD COLUMN IF NOT EXISTS email_provider_id text,
  ADD COLUMN IF NOT EXISTS email_status text;

COMMENT ON COLUMN public.invoices.last_sent_at IS 'Last successful outbound email send timestamp.';
COMMENT ON COLUMN public.invoices.recipient_email IS 'Primary recipient used in the last successful send.';
COMMENT ON COLUMN public.invoices.email_provider IS 'Outbound provider id (e.g. resend).';
COMMENT ON COLUMN public.invoices.email_provider_id IS 'Provider message id from last successful send.';
COMMENT ON COLUMN public.invoices.email_status IS 'Last outbound email status (e.g. sent, failed).';

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_invoice_email_subject text,
  ADD COLUMN IF NOT EXISTS default_invoice_email_body text;

COMMENT ON COLUMN public.user_settings.default_invoice_email_subject IS
  'Optional default subject for manual invoice emails; supports {propertyName}, {invoiceNumber} placeholders.';
COMMENT ON COLUMN public.user_settings.default_invoice_email_body IS
  'Optional default body for manual invoice emails; supports {tenantFirstName}, {propertyName}, {invoiceNumber}, {formattedTotalAmount}, {formattedDueDate}, {userOrBusinessName}.';

CREATE TABLE IF NOT EXISTS public.invoice_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient_emails text[] NOT NULL,
  cc_emails text[],
  subject text NOT NULL,
  message text,
  provider text NOT NULL DEFAULT 'resend',
  provider_email_id text,
  status text NOT NULL,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_email_logs_invoice_id_idx ON public.invoice_email_logs (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_email_logs_user_id_idx ON public.invoice_email_logs (user_id, created_at DESC);

ALTER TABLE public.invoice_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_email_logs_select_own ON public.invoice_email_logs;
CREATE POLICY invoice_email_logs_select_own ON public.invoice_email_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS invoice_email_logs_insert_own ON public.invoice_email_logs;
CREATE POLICY invoice_email_logs_insert_own ON public.invoice_email_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.invoice_email_logs TO authenticated;
