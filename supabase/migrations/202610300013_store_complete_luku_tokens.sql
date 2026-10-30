BEGIN;

ALTER TABLE public.electricity_topups
  ADD COLUMN IF NOT EXISTS token_code TEXT;

DO $token_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.electricity_topups'::regclass
      AND conname = 'electricity_topups_token_code_format_check'
  ) THEN
    ALTER TABLE public.electricity_topups
      ADD CONSTRAINT electricity_topups_token_code_format_check
      CHECK (token_code IS NULL OR token_code ~ '^[0-9]{20}$');
  END IF;
END;
$token_constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS electricity_topups_token_code_unique_idx
  ON public.electricity_topups(token_code)
  WHERE token_code IS NOT NULL;

CREATE FUNCTION public.record_electricity_topup_with_value(
  p_account_id UUID,
  p_purchase_date DATE,
  p_units NUMERIC,
  p_token_suffix TEXT,
  p_token_code TEXT,
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
  IF p_token_code IS NULL OR p_token_code !~ '^[0-9]{20}$' THEN
    RAISE EXCEPTION 'Enter the complete 20-digit LUKU token';
  END IF;
  IF p_token_suffix IS DISTINCT FROM right(p_token_code, 4) THEN
    RAISE EXCEPTION 'Token ending does not match the complete token';
  END IF;
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
  SET purchase_amount_tzs = p_purchase_amount_tzs,
      token_code = p_token_code
  WHERE id = v_topup.id
  RETURNING * INTO v_topup;

  RETURN v_topup;
END;
$record_topup_with_value$;

REVOKE ALL ON FUNCTION public.record_electricity_topup_with_value(UUID, DATE, NUMERIC, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_topup_with_value(UUID, DATE, NUMERIC, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

COMMIT;
