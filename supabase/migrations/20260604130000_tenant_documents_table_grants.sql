-- tenant_documents was created with RLS policies but without table privileges for authenticated.
-- Without GRANT, RPCs and CASCADE deletes fail with "permission denied for table tenant_documents".

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_documents TO authenticated;
