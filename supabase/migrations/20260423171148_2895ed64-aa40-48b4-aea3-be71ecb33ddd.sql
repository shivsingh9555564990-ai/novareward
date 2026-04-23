CREATE OR REPLACE FUNCTION public.enforce_device_single_account(p_device_fp text, p_email_hint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_user uuid;
  v_existing_hint text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'reason', 'not_authenticated');
  END IF;

  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('status', 'ok', 'reason', 'invalid_device_skip');
  END IF;

  -- Find any existing signup on this device that belongs to a DIFFERENT user
  SELECT user_id, email_hint
    INTO v_existing_user, v_existing_hint
    FROM public.device_signups
   WHERE device_fp = p_device_fp
     AND user_id <> v_uid
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'blocked',
      'email_hint', v_existing_hint,
      'message', 'This device is already linked to another account.'
    );
  END IF;

  -- Same user (or first time on this device) → register the link
  INSERT INTO public.device_signups (device_fp, user_id, email_hint)
  VALUES (p_device_fp, v_uid, p_email_hint)
  ON CONFLICT (device_fp, user_id) DO NOTHING;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_device_single_account(text, text) TO authenticated;