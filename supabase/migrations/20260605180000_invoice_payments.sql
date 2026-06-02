-- Invoice payments: record partial/full payments, auto mark sent, update status and balance_due.

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  payment_reference text,
  amount double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx ON public.invoice_payments (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_user_id_idx ON public.invoice_payments (user_id);

COMMENT ON TABLE public.invoice_payments IS
  'Payments received against an invoice. Drives PARTIALLY_PAID / PAID status and balance_due.';

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_payments TO authenticated;

DROP POLICY IF EXISTS invoice_payments_all_own ON public.invoice_payments;

CREATE POLICY invoice_payments_all_own ON public.invoice_payments
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS invoice_payments_set_updated_at ON public.invoice_payments;
CREATE TRIGGER invoice_payments_set_updated_at
BEFORE UPDATE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recalculate invoice status/balance from payment rows.
CREATE OR REPLACE FUNCTION public.invoice_recalculate_payment_status (p_invoice_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.invoices %ROWTYPE;
  v_paid double precision := 0;
  v_total double precision := 0;
  v_balance double precision := 0;
  v_last_payment date;
BEGIN
  SELECT * INTO v_inv FROM public.invoices
  WHERE id = p_invoice_id AND user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;

  SELECT coalesce(sum(ip.amount), 0), max(ip.payment_date)
  INTO v_paid, v_last_payment
  FROM public.invoice_payments ip
  WHERE ip.invoice_id = p_invoice_id;

  v_total := coalesce(v_inv.total_amount, v_inv.total, 0);
  v_balance := greatest(0, v_total - v_paid);

  IF v_paid <= 0 THEN
    IF v_inv.status IN (
      'PAID'::public.app_invoice_status,
      'PARTIALLY_PAID'::public.app_invoice_status
    ) THEN
      UPDATE public.invoices
      SET
        status = 'SENT'::public.app_invoice_status,
        balance_due = v_total,
        paid_at = NULL,
        updated_at = now()
      WHERE id = p_invoice_id;
    END IF;
    RETURN;
  END IF;

  IF v_balance <= 0.005 THEN
    UPDATE public.invoices
    SET
      status = 'PAID'::public.app_invoice_status,
      balance_due = 0,
      paid_at = coalesce(v_last_payment::timestamptz, now()),
      updated_at = now()
    WHERE id = p_invoice_id;
  ELSE
    UPDATE public.invoices
    SET
      status = 'PARTIALLY_PAID'::public.app_invoice_status,
      balance_due = v_balance,
      paid_at = NULL,
      updated_at = now()
    WHERE id = p_invoice_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_payment (
  p_invoice_id uuid,
  p_payment_date date,
  p_payment_reference text DEFAULT NULL,
  p_amount double precision DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.invoices %ROWTYPE;
  v_payment_id uuid;
  v_ref text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'INVOICE_ID_REQUIRED';
  END IF;
  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_DATE_REQUIRED';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID';
  END IF;

  SELECT * INTO v_inv FROM public.invoices
  WHERE id = p_invoice_id AND user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;
  IF v_inv.status IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status) THEN
    RAISE EXCEPTION 'INVOICE_NOT_PAYABLE';
  END IF;
  IF v_inv.status = 'PAID'::public.app_invoice_status THEN
    RAISE EXCEPTION 'INVOICE_ALREADY_PAID';
  END IF;

  IF public.invoice_status_is_editable(v_inv.status)
    OR v_inv.status IN ('DRAFT'::public.app_invoice_status, 'GENERATED'::public.app_invoice_status) THEN
    UPDATE public.invoices
    SET
      status = 'SENT'::public.app_invoice_status,
      sent_at = coalesce(sent_at, now()),
      updated_at = now()
    WHERE id = p_invoice_id;
  END IF;

  v_ref := nullif(trim(coalesce(p_payment_reference, '')), '');

  INSERT INTO public.invoice_payments (invoice_id, user_id, payment_date, payment_reference, amount)
  VALUES (p_invoice_id, v_uid, p_payment_date, v_ref, p_amount)
  RETURNING id INTO v_payment_id;

  PERFORM public.invoice_recalculate_payment_status(p_invoice_id);

  RETURN (
    SELECT jsonb_build_object(
      'payment', to_jsonb(ip.*),
      'invoice', to_jsonb(i.*),
      'payments', coalesce((
        SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.payment_date DESC, p.created_at DESC)
        FROM public.invoice_payments p
        WHERE p.invoice_id = p_invoice_id), '[]'::jsonb))
    FROM public.invoice_payments ip
    INNER JOIN public.invoices i ON i.id = ip.invoice_id
    WHERE ip.id = v_payment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_invoice_payment (
  p_payment_id uuid,
  p_payment_date date DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_amount double precision DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pay public.invoice_payments %ROWTYPE;
  v_ref text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT ip.* INTO v_pay
  FROM public.invoice_payments ip
  INNER JOIN public.invoices i ON i.id = ip.invoice_id
  WHERE ip.id = p_payment_id AND ip.user_id = v_uid AND i.user_id = v_uid
  FOR UPDATE OF ip;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF p_amount IS NOT NULL AND p_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID';
  END IF;

  v_ref := CASE
    WHEN p_payment_reference IS NOT NULL THEN nullif(trim(p_payment_reference), '')
    ELSE v_pay.payment_reference
  END;

  UPDATE public.invoice_payments
  SET
    payment_date = coalesce(p_payment_date, payment_date),
    payment_reference = v_ref,
    amount = coalesce(p_amount, amount),
    updated_at = now()
  WHERE id = p_payment_id;

  PERFORM public.invoice_recalculate_payment_status(v_pay.invoice_id);

  RETURN (
    SELECT jsonb_build_object(
      'payment', to_jsonb(ip.*),
      'invoice', to_jsonb(i.*),
      'payments', coalesce((
        SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.payment_date DESC, p.created_at DESC)
        FROM public.invoice_payments p
        WHERE p.invoice_id = v_pay.invoice_id), '[]'::jsonb))
    FROM public.invoice_payments ip
    INNER JOIN public.invoices i ON i.id = ip.invoice_id
    WHERE ip.id = p_payment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_invoice_payment (p_payment_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pay public.invoice_payments %ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT ip.* INTO v_pay
  FROM public.invoice_payments ip
  WHERE ip.id = p_payment_id AND ip.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  DELETE FROM public.invoice_payments WHERE id = p_payment_id;

  PERFORM public.invoice_recalculate_payment_status(v_pay.invoice_id);

  RETURN (
    SELECT jsonb_build_object(
      'invoice', to_jsonb(i.*),
      'payments', coalesce((
        SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.payment_date DESC, p.created_at DESC)
        FROM public.invoice_payments p
        WHERE p.invoice_id = v_pay.invoice_id), '[]'::jsonb))
    FROM public.invoices i
    WHERE i.id = v_pay.invoice_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_recalculate_payment_status (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_invoice_payment (uuid, date, text, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_invoice_payment (uuid, date, text, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_invoice_payment (uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.invoice_recalculate_payment_status (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment (uuid, date, text, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_payment (uuid, date, text, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_invoice_payment (uuid) TO authenticated;
