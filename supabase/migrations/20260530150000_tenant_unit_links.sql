-- Tenant ↔ unit links (many tenants per unit; independent from leases).
-- Apply with: supabase db push (after review).

CREATE TABLE IF NOT EXISTS public.tenant_unit_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.property_units (id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases (id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'occupant',
  status text NOT NULL DEFAULT 'active',
  is_primary boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_unit_links_role_check CHECK (
    role IN ('primary_tenant', 'co_tenant', 'spouse', 'occupant', 'guarantor')
  ),
  CONSTRAINT tenant_unit_links_status_check CHECK (
    status IN ('draft', 'active', 'pending', 'ended', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS tenant_unit_links_property_id_idx ON public.tenant_unit_links (property_id);
CREATE INDEX IF NOT EXISTS tenant_unit_links_unit_id_idx ON public.tenant_unit_links (unit_id);
CREATE INDEX IF NOT EXISTS tenant_unit_links_tenant_id_idx ON public.tenant_unit_links (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_unit_links_user_id_idx ON public.tenant_unit_links (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_unit_links_active_tenant_unit_idx
  ON public.tenant_unit_links (tenant_id, unit_id)
  WHERE status = 'active' AND unit_id IS NOT NULL;

COMMENT ON TABLE public.tenant_unit_links IS
  'Assigns existing tenants to property units without creating leases. Does not replace tenants.property_id or lease records.';

ALTER TABLE public.tenant_unit_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_unit_links TO authenticated;

DROP POLICY IF EXISTS tenant_unit_links_all_own ON public.tenant_unit_links;

CREATE POLICY tenant_unit_links_all_own ON public.tenant_unit_links
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = tenant_unit_links.property_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = tenant_unit_links.property_id
        AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = tenant_unit_links.tenant_id
        AND t.user_id = auth.uid()
    )
    AND (
      tenant_unit_links.unit_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.property_units u
        WHERE u.id = tenant_unit_links.unit_id
          AND u.property_id = tenant_unit_links.property_id
          AND u.user_id = auth.uid()
      )
    )
  );
