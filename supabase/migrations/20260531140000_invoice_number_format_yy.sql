-- Invoice numbers: INV-YY-#### per user per calendar year (respects user_settings.invoice_number_format).

CREATE OR REPLACE FUNCTION public.generate_invoice_number (p_user_id uuid DEFAULT auth.uid())
  RETURNS text
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_format text;
  v_yy text;
  v_yyyy text;
  v_seq integer;
  v_result text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  PERFORM public.get_or_create_user_settings();

  SELECT coalesce(nullif(trim(us.invoice_number_format), ''), 'INV-YY-{####}')
  INTO v_format
  FROM public.user_settings us
  WHERE us.user_id = v_uid;

  IF v_format IS NULL THEN
    v_format := 'INV-YY-{####}';
  END IF;

  v_yy := to_char(timezone('UTC', now()), 'YY');
  v_yyyy := to_char(timezone('UTC', now()), 'YYYY');

  SELECT coalesce(max(
    CASE
      WHEN i.invoice_number ~ ('^INV-' || v_yy || '-[0-9]{4}$') THEN
        substring(i.invoice_number from '[0-9]{4}$')::integer
      WHEN i.invoice_number ~ ('^INV-' || v_yyyy || '-[0-9]{4}$') THEN
        substring(i.invoice_number from '[0-9]{4}$')::integer
      ELSE NULL
    END
  ), 0) + 1
  INTO v_seq
  FROM public.invoices i
  WHERE i.user_id = v_uid;

  IF v_seq IS NULL OR v_seq < 1 THEN
    v_seq := 1;
  END IF;

  v_result := v_format;
  v_result := replace(v_result, 'YYYY', v_yyyy);
  v_result := replace(v_result, 'YY', v_yy);
  v_result := replace(v_result, '{####}', lpad(v_seq::text, 4, '0'));

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.generate_invoice_number (uuid) IS
  'User-scoped invoice numbers from user_settings.invoice_number_format (default INV-YY-{####}, sequence resets per calendar year).';

ALTER TABLE public.user_settings
  ALTER COLUMN invoice_number_format SET DEFAULT 'INV-YY-{####}';

UPDATE public.user_settings
SET invoice_number_format = 'INV-YY-{####}'
WHERE invoice_number_format = 'INV-YYYY-{####}';
