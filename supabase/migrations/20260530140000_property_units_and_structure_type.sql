-- Property units (rentable spaces) — independent from tenants in phase 1.
-- Apply with: supabase db push (after review).

CREATE TABLE IF NOT EXISTS public.property_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  unit_type text,
  description text,
  bedrooms numeric,
  bathrooms numeric,
  size_sqm numeric,
  expected_rent numeric,
  rent_frequency text DEFAULT 'monthly',
  occupancy_status text NOT NULL DEFAULT 'vacant',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_units_rent_frequency_check CHECK (
    rent_frequency IS NULL
    OR rent_frequency IN ('monthly', 'weekly', 'nightly', 'per_room', 'per_bed')
  ),
  CONSTRAINT property_units_occupancy_status_check CHECK (
    occupancy_status IN (
      'vacant',
      'occupied',
      'unavailable',
      'owner_occupied',
      'under_maintenance',
      'inactive'
    )
  )
);

CREATE INDEX IF NOT EXISTS property_units_property_id_idx ON public.property_units (property_id);
CREATE INDEX IF NOT EXISTS property_units_user_id_idx ON public.property_units (user_id);
CREATE INDEX IF NOT EXISTS property_units_property_sort_idx ON public.property_units (property_id, sort_order);

COMMENT ON TABLE public.property_units IS
  'Rentable units/rooms/spaces for a property. Tenants link in a later phase (unit_id on tenants/leases).';

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS structure_type_id text;

COMMENT ON COLUMN public.properties.structure_type_id IS
  'App structure type id (e.g. duplex, multi_family) — see frontend config/propertyTypes.ts';

ALTER TABLE public.property_units ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.property_units TO authenticated;

DROP POLICY IF EXISTS property_units_all_own ON public.property_units;

CREATE POLICY property_units_all_own ON public.property_units
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_units.property_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_units.property_id
        AND p.user_id = auth.uid()
    )
  );
