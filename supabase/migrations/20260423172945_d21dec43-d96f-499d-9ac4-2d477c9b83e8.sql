CREATE OR REPLACE FUNCTION public.mask_email_hint(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_user text;
  v_domain text;
  v_len integer;
  v_head text;
  v_tail text;
  v_mask_len integer;
BEGIN
  IF p_email IS NULL OR position('@' IN p_email) = 0 THEN
    RETURN p_email;
  END IF;

  v_user := split_part(p_email, '@', 1);
  v_domain := split_part(p_email, '@', 2);
  v_len := char_length(v_user);

  IF v_len <= 2 THEN
    RETURN p_email;
  END IF;

  v_head := left(v_user, 2);

  IF v_len <= 7 THEN
    v_tail := right(v_user, GREATEST(v_len - 2, 0));
    RETURN v_head || v_tail || '@' || v_domain;
  END IF;

  v_tail := right(v_user, 5);
  v_mask_len := GREATEST(v_len - 7, 1);

  RETURN v_head || repeat('*', v_mask_len) || v_tail || '@' || v_domain;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_device_signup(p_device_fp text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_hint text;
BEGIN
  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT ds.user_id, au.email
    INTO v_user_id, v_email
    FROM public.device_signups ds
    LEFT JOIN auth.users au ON au.id = ds.user_id
   WHERE ds.device_fp = p_device_fp
   ORDER BY ds.created_at ASC
   LIMIT 1;

  v_hint := COALESCE(public.mask_email_hint(v_email), (
    SELECT ds2.email_hint
      FROM public.device_signups ds2
     WHERE ds2.device_fp = p_device_fp
     ORDER BY ds2.created_at ASC
     LIMIT 1
  ));

  RETURN jsonb_build_object(
    'exists', v_user_id IS NOT NULL,
    'email_hint', v_hint
  );
END;
$$;

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
  v_current_hint text;
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

  v_current_hint := COALESCE(public.mask_email_hint(v_current_email), p_email_hint);

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
         SET email_hint = COALESCE(v_current_hint, email_hint)
       WHERE device_fp = p_device_fp
         AND user_id = v_uid
         AND COALESCE(email_hint, '') IS DISTINCT FROM COALESCE(v_current_hint, '');

      RETURN jsonb_build_object('status', 'ok');
    END IF;

    IF v_existing_email IS NOT NULL
       AND v_current_email IS NOT NULL
       AND lower(v_existing_email) = lower(v_current_email) THEN
      INSERT INTO public.device_signups (device_fp, user_id, email_hint)
      VALUES (p_device_fp, v_uid, COALESCE(v_current_hint, public.mask_email_hint(v_existing_email), v_existing_hint))
      ON CONFLICT (device_fp, user_id) DO UPDATE
        SET email_hint = COALESCE(EXCLUDED.email_hint, public.device_signups.email_hint);

      RETURN jsonb_build_object('status', 'ok');
    END IF;

    RETURN jsonb_build_object(
      'status', 'blocked',
      'email_hint', COALESCE(public.mask_email_hint(v_existing_email), v_existing_hint),
      'message', 'This device is already linked to another account.'
    );
  END IF;

  INSERT INTO public.device_signups (device_fp, user_id, email_hint)
  VALUES (p_device_fp, v_uid, v_current_hint)
  ON CONFLICT (device_fp, user_id) DO UPDATE
    SET email_hint = COALESCE(EXCLUDED.email_hint, public.device_signups.email_hint);

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

UPDATE public.device_signups ds
   SET email_hint = public.mask_email_hint(au.email)
  FROM auth.users au
 WHERE au.id = ds.user_id
   AND COALESCE(ds.email_hint, '') IS DISTINCT FROM COALESCE(public.mask_email_hint(au.email), '');

GRANT EXECUTE ON FUNCTION public.mask_email_hint(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_device_signup(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.enforce_device_single_account(text, text) TO authenticated;