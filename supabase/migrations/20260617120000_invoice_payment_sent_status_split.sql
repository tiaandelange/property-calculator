-- Decouple invoice "sent" workflow from payment recording.
-- Payments update PARTIALLY_PAID / PAID only; sent_at is set via mark-as-sent / email send.

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
        status = CASE
          WHEN v_inv.sent_at IS NOT NULL THEN 'SENT'::public.app_invoice_status
          ELSE 'GENERATED'::public.app_invoice_status
        END,
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
