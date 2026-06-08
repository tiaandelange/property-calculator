-- Supabase linter: wrap auth.* in (select ...) so RLS policies use InitPlan (once per query, not per row).
-- @see https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DROP POLICY IF EXISTS applicant_invites_all_own ON public.applicant_invites;

CREATE POLICY applicant_invites_all_own ON public.applicant_invites
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS applicant_application_details_all_own ON public.applicant_application_details;

CREATE POLICY applicant_application_details_all_own ON public.applicant_application_details
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
