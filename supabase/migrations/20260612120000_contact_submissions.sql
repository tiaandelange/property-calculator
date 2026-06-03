-- Public contact form submissions (marketing site).
-- Inserts via trusted API using service_role only; no public read.

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text NOT NULL,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'contact_page',
  status text NOT NULL DEFAULT 'new',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT contact_submissions_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT contact_submissions_email_not_blank CHECK (length(trim(email)) > 0),
  CONSTRAINT contact_submissions_subject_not_blank CHECK (length(trim(subject)) > 0),
  CONSTRAINT contact_submissions_message_not_blank CHECK (length(trim(message)) > 0),
  CONSTRAINT contact_submissions_status_check CHECK (status IN ('new', 'read', 'archived'))
);

CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx
  ON public.contact_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_submissions_status_created_at_idx
  ON public.contact_submissions (status, created_at DESC);

COMMENT ON TABLE public.contact_submissions IS
  'Inbound contact form messages from the public marketing site. Insert via service_role API only; not readable by anon/authenticated clients.';

COMMENT ON COLUMN public.contact_submissions.source IS
  'Submission origin (e.g. contact_page).';

COMMENT ON COLUMN public.contact_submissions.status IS
  'Workflow status: new, read, or archived.';

-- ---------------------------------------------------------------------------
-- RLS: enabled; no policies for anon/authenticated (deny client access).
-- service_role bypasses RLS for server-side inserts.
-- ---------------------------------------------------------------------------

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.contact_submissions FROM PUBLIC;
REVOKE ALL ON TABLE public.contact_submissions FROM anon;
REVOKE ALL ON TABLE public.contact_submissions FROM authenticated;

GRANT INSERT, SELECT, UPDATE ON TABLE public.contact_submissions TO service_role;
