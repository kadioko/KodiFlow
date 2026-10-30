BEGIN;

ALTER TABLE public.electricity_topups
  ADD COLUMN purchase_amount_tzs NUMERIC(14, 2)
  CHECK (purchase_amount_tzs IS NULL OR (purchase_amount_tzs > 0 AND purchase_amount_tzs <= 1000000000));

CREATE OR REPLACE FUNCTION public.record_electricity_topup_with_value(
  p_account_id UUID,
  p_purchase_date DATE,
  p_units NUMERIC,
  p_token_suffix TEXT,
  p_purchase_amount_tzs NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.electricity_topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $record_topup_with_value$
DECLARE
  v_topup public.electricity_topups%ROWTYPE;
BEGIN
  IF p_purchase_amount_tzs IS NULL
    OR p_purchase_amount_tzs <= 0
    OR p_purchase_amount_tzs > 1000000000 THEN
    RAISE EXCEPTION 'Enter a purchase value greater than zero and no more than TZS 1,000,000,000';
  END IF;

  v_topup := public.record_electricity_topup(
    p_account_id,
    p_purchase_date,
    p_units,
    p_token_suffix,
    FALSE,
    p_notes
  );

  UPDATE public.electricity_topups
  SET purchase_amount_tzs = p_purchase_amount_tzs
  WHERE id = v_topup.id
  RETURNING * INTO v_topup;

  RETURN v_topup;
END;
$record_topup_with_value$;

REVOKE ALL ON FUNCTION public.record_electricity_topup_with_value(UUID, DATE, NUMERIC, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_topup_with_value(UUID, DATE, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated;

COMMIT;
