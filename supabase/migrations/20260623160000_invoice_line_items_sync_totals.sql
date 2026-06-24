-- Keep invoice header totals in sync when line items change (auto-generated rent invoices included).

CREATE OR REPLACE FUNCTION public.invoice_recompute_totals_from_lines (p_invoice_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_inv public.invoices %ROWTYPE;
  v_subtotal double precision;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT coalesce(sum(ili.total), 0)
  INTO v_subtotal
  FROM public.invoice_line_items ili
  WHERE ili.invoice_id = p_invoice_id;

  UPDATE public.invoices i
  SET
    subtotal = v_subtotal,
    total = round((v_subtotal + coalesce(i.tax_amount, 0))::numeric, 2)::double precision,
    total_amount = round((v_subtotal + coalesce(i.tax_amount, 0))::numeric, 2)::double precision,
    balance_due = public.invoice_balance_due_for_total(
      p_invoice_id,
      round((v_subtotal + coalesce(i.tax_amount, 0))::numeric, 2)::double precision,
      i.status
    ),
    updated_at = now()
  WHERE i.id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_line_items_sync_invoice_totals ()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  v_invoice_id := coalesce(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  PERFORM public.invoice_recompute_totals_from_lines(v_invoice_id);
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS invoice_line_items_sync_invoice_totals_trg ON public.invoice_line_items;

CREATE TRIGGER invoice_line_items_sync_invoice_totals_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.invoice_line_items_sync_invoice_totals();

COMMENT ON FUNCTION public.invoice_recompute_totals_from_lines (uuid) IS
  'Recompute invoices.subtotal/total/total_amount/balance_due from child line items. Used by auto-generated rent invoices and manual edits.';

-- Backfill draft/generated rent invoices (migration runs without auth.uid()).
DO $$
DECLARE
  v_inv public.invoices %ROWTYPE;
  v_line_count integer;
  v_line_total double precision;
  v_desc text;
BEGIN
  FOR v_inv IN
    SELECT i.*
    FROM public.invoices i
    WHERE i.invoice_type = 'RENT'::public.app_invoice_type
      AND i.status IN ('DRAFT'::public.app_invoice_status, 'GENERATED'::public.app_invoice_status)
  LOOP
    SELECT count(*), coalesce(sum(ili.total), 0)
    INTO v_line_count, v_line_total
    FROM public.invoice_line_items ili
    WHERE ili.invoice_id = v_inv.id;

    IF v_line_count = 0 AND v_inv.lease_id IS NOT NULL THEN
      SELECT public.rent_invoice_line_description(
        coalesce(v_inv.invoice_period, to_char((v_inv.due_date AT TIME ZONE 'UTC')::date, 'YYYY-MM')),
        tn.first_name,
        tn.last_name,
        pu.unit_name
      )
      INTO v_desc
      FROM public.leases l
      LEFT JOIN public.tenants tn ON tn.id = coalesce(v_inv.tenant_id, l.tenant_id)
      LEFT JOIN public.property_units pu ON pu.id = coalesce(v_inv.unit_id, l.unit_id)
      WHERE l.id = v_inv.lease_id;

      SELECT coalesce(v_inv.total_amount, v_inv.total, l.monthly_rent, 0)
      INTO v_line_total
      FROM public.leases l
      WHERE l.id = v_inv.lease_id;

      INSERT INTO public.invoice_line_items (
        invoice_id, description, category, quantity, unit_price, total, sort_order
      )
      VALUES (
        v_inv.id,
        coalesce(v_desc, 'Monthly Rent'),
        'RENT'::public.app_property_income_category,
        1,
        v_line_total,
        v_line_total,
        1
      );
    END IF;

    PERFORM public.invoice_recompute_totals_from_lines(v_inv.id);
  END LOOP;
END;
$$;
