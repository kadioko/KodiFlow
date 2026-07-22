-- Audit events are written by triggers after user-owned financial records change.
-- The trigger must bypass activity_log RLS while the log itself stays read-only to users.
CREATE OR REPLACE FUNCTION public.log_row_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  record_data JSONB := to_jsonb(COALESCE(NEW, OLD));
  action_name TEXT := lower(TG_OP);
BEGIN
  INSERT INTO public.activity_log (user_id, actor_user_id, entity_type, entity_id, action, summary, metadata)
  VALUES (
    (record_data ->> 'user_id')::UUID,
    auth.uid(),
    TG_TABLE_NAME,
    (record_data ->> 'id')::UUID,
    action_name,
    initcap(replace(TG_TABLE_NAME, '_', ' ')) || ' ' || action_name,
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('before', record_data) ELSE jsonb_build_object('record', record_data) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
