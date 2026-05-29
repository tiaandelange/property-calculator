-- Additional property-linked bonds (second bonds, credit facilities, etc.).
-- Independent from properties.outstanding_bond_balance / bond_* profile fields.

CREATE TABLE IF NOT EXISTS public.property_additional_bonds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  description text NOT NULL,
  outstanding_balance double precision,
  monthly_payment double precision,
  annual_interest_rate_percent double precision,
  bond_term_years integer,
  bond_start_date date,
  bond_remaining_term_months integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_additional_bonds_term_years_check CHECK (
    bond_term_years IS NULL
    OR bond_term_years IN (5, 10, 15, 20, 25, 30)
  )
);

CREATE INDEX IF NOT EXISTS property_additional_bonds_property_id_idx ON public.property_additional_bonds (property_id);
CREATE INDEX IF NOT EXISTS property_additional_bonds_user_id_idx ON public.property_additional_bonds (user_id);
CREATE INDEX IF NOT EXISTS property_additional_bonds_property_sort_idx ON public.property_additional_bonds (property_id, sort_order);

COMMENT ON TABLE public.property_additional_bonds IS
  'Extra loans/credit facilities linked to a property for cash-flow reporting — not the primary home-loan bond on the property row.';

ALTER TABLE public.property_additional_bonds ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.property_additional_bonds TO authenticated;

DROP POLICY IF EXISTS property_additional_bonds_all_own ON public.property_additional_bonds;

CREATE POLICY property_additional_bonds_all_own ON public.property_additional_bonds
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_additional_bonds.property_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_additional_bonds.property_id
        AND p.user_id = auth.uid()
    )
  );
