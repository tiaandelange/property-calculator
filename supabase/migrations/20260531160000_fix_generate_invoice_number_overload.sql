-- Resolve ambiguous generate_invoice_number() overload (legacy zero-arg vs uuid DEFAULT).

DROP FUNCTION IF EXISTS public.generate_invoice_number ();

GRANT EXECUTE ON FUNCTION public.generate_invoice_number (uuid) TO authenticated;

COMMENT ON FUNCTION public.generate_invoice_number (uuid) IS
  'Single entry point for invoice numbers (INV-YY-####). Call with no args or explicit user id.';
