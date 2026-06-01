-- delete_property_workspace: remove all leases (hard delete), de-link tenants, then delete property.
-- Tenant records are never deleted.

CREATE OR REPLACE FUNCTION public.delete_property_workspace (p_property_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_lease_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.properties p
    WHERE
      p.id = p_property_id
      AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'PROPERTY_NOT_FOUND';
  END IF;

  FOR v_lease_id IN
    SELECT
      l.id
    FROM
      public.leases l
    WHERE
      l.property_id = p_property_id
      AND l.user_id = v_uid
    ORDER BY
      l.created_at
  LOOP
    PERFORM public.hard_delete_lease (v_lease_id);
  END LOOP;

  UPDATE
    public.tenants t
  SET
    property_id = NULL,
    updated_at = now()
  WHERE
    t.property_id = p_property_id
    AND t.user_id = v_uid;

  UPDATE
    public.tenants t
  SET
    applied_property_id = NULL,
    updated_at = now()
  WHERE
    t.applied_property_id = p_property_id
    AND t.user_id = v_uid;

  DELETE FROM public.tenant_unit_links tul
  WHERE tul.property_id = p_property_id
    AND tul.user_id = v_uid;

  DELETE FROM public.properties p
  WHERE p.id = p_property_id
    AND p.user_id = v_uid;
END;
$$;

COMMENT ON FUNCTION public.delete_property_workspace (uuid) IS
  'Permanently deletes a property after hard-deleting all leases and de-linking tenants (tenants are preserved).';

GRANT EXECUTE ON FUNCTION public.delete_property_workspace (uuid) TO authenticated;
