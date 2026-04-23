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
  v_existing_email text;
  v_current_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'reason', 'not_authenticated');
  END IF;

  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('status', 'ok', 'reason', 'invalid_device_skip');
  END IF;

  SELECT email
    INTO v_current_email
    FROM auth.users
   WHERE id = v_uid;

  SELECT ds.user_id, ds.email_hint, au.email
    INTO v_existing_user, v_existing_hint, v_existing_email
    FROM public.device_signups ds
    LEFT JOIN auth.users au ON au.id = ds.user_id
   WHERE ds.device_fp = p_device_fp
   ORDER BY ds.created_at ASC
   LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    IF v_existing_user = v_uid THEN
      UPDATE public.device_signups
         SET email_hint = COALESCE(p_email_hint, email_hint)
       WHERE device_fp = p_device_fp
         AND user_id = v_uid
         AND COALESCE(email_hint, '') IS DISTINCT FROM COALESCE(p_email_hint, '');

      RETURN jsonb_build_object('status', 'ok');
    END IF;

    IF v_existing_email IS NOT NULL
       AND v_current_email IS NOT NULL
       AND lower(v_existing_email) = lower(v_current_email) THEN
      INSERT INTO public.device_signups (device_fp, user_id, email_hint)
      VALUES (p_device_fp, v_uid, COALESCE(p_email_hint, v_existing_hint))
      ON CONFLICT (device_fp, user_id) DO UPDATE
        SET email_hint = COALESCE(EXCLUDED.email_hint, public.device_signups.email_hint);

      RETURN jsonb_build_object('status', 'ok');
    END IF;

    RETURN jsonb_build_object(
      'status', 'blocked',
      'email_hint', v_existing_hint,
      'message', 'This device is already linked to another account.'
    );
  END IF;

  INSERT INTO public.device_signups (device_fp, user_id, email_hint)
  VALUES (p_device_fp, v_uid, p_email_hint)
  ON CONFLICT (device_fp, user_id) DO UPDATE
    SET email_hint = COALESCE(EXCLUDED.email_hint, public.device_signups.email_hint);

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_device_single_account(text, text) TO authenticated;