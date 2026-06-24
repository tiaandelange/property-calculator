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

-- Backfill draft/generated rent invoices so statement credits match line items.
SELECT public.repair_rent_invoices(NULL);
