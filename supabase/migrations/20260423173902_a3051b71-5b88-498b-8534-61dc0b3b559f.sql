-- Debug RPC: returns the caller's matched device row + email hint, no PII leaks.
CREATE OR REPLACE FUNCTION public.get_my_device_status(p_device_fp text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_owner_email text;
  v_owner_hint text;
  v_my_email text;
  v_linked boolean := false;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('status', 'invalid_fp', 'fp', p_device_fp);
  END IF;

  SELECT email INTO v_my_email FROM auth.users WHERE id = v_uid;

  SELECT count(*) INTO v_count
    FROM public.device_signups
   WHERE device_fp = p_device_fp;

  -- The original owner of this device (first signup)
  SELECT ds.user_id, au.email
    INTO v_owner_id, v_owner_email
    FROM public.device_signups ds
    LEFT JOIN auth.users au ON au.id = ds.user_id
   WHERE ds.device_fp = p_device_fp
   ORDER BY ds.created_at ASC
   LIMIT 1;

  v_owner_hint := public.mask_email_hint(v_owner_email);

  SELECT EXISTS (
    SELECT 1 FROM public.device_signups
     WHERE device_fp = p_device_fp
       AND user_id = v_uid
  ) INTO v_linked;

  RETURN jsonb_build_object(
    'status', 'ok',
    'fp', p_device_fp,
    'my_user_id', v_uid,
    'my_email_hint', public.mask_email_hint(v_my_email),
    'device_rows', v_count,
    'owner_user_id', v_owner_id,
    'owner_email_hint', v_owner_hint,
    'i_am_owner', (v_owner_id = v_uid),
    'i_am_linked', v_linked,
    'would_be_blocked', (v_owner_id IS NOT NULL
                        AND v_owner_id <> v_uid
                        AND (v_owner_email IS NULL
                             OR v_my_email IS NULL
                             OR lower(v_owner_email) <> lower(v_my_email)))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_device_status(text) TO authenticated;